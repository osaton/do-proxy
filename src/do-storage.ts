import { DurableObjectGetAlarmOptions, DurableObjectPutOptions } from '@cloudflare/workers-types';
const MODULE_NAME = 'do-storage';

interface RequestConfig {
  type: RequestConfigType;
  prop: string;
  args: any[];
}

type RequestConfigType = 'function' | 'storage';

interface FetchResponse {
  data: any;
}

const storageMethods = [
  'delete',
  'deleteAlarm',
  'deleteAll',
  'get',
  'getAlarm',
  'list',
  'put',
  'setAlarm',
  'sync',
];

interface Storage {
  delete: (key: string, options?: DurableObjectPutOptions | undefined) => Promise<boolean>;
  deleteAlarm: () => {};
  deleteAll: (options?: DurableObjectPutOptions | undefined) => Promise<void>;
  get: (key: string, options?: DurableObjectGetOptions | undefined) => Promise<unknown>;
  getAlarm: (options?: DurableObjectGetAlarmOptions | undefined) => Promise<number | null>;
  list: (
    options?: globalThis.DurableObjectListOptions | undefined
  ) => Promise<Map<string, unknown>>;
  put: (
    key: string,
    value: unknown,
    options?: DurableObjectPutOptions | undefined
  ) => Promise<void>;
  setAlarm: (
    scheduledTime: number | Date,
    options?: globalThis.DurableObjectSetAlarmOptions | undefined
  ) => Promise<void>;
  sync: () => Promise<void>;
}

function getRequestConfig(type: RequestConfigType, prop: PropertyKey, args: any[]): RequestConfig {
  return {
    type,
    prop: String(prop),
    args: args,
  };
}

async function handleStorageFetch(state: DurableObjectState, config: RequestConfig) {
  return (state.storage as any)[config.prop](...config.args);
}

async function doFetch(
  stub: DurableObjectStub,
  config: RequestConfig | RequestConfig[]
): Promise<unknown> {
  const res = (await stub
    .fetch(
      new Request('https://do-api/', {
        method: 'POST',
        body: JSON.stringify(config),
      })
    )
    .then((res) => res.json())) as FetchResponse;

  return res.data;
}

function getProxy<T>(stub: DurableObjectStub, classInstance: any, returnConfig = false) {
  let proxyMode = 'execute';
  let captured: RequestConfig[] = [];

  function getProxyStorage() {
    const obj: Record<string, () => {}> = {};
    storageMethods.forEach((methodName) => {
      obj[methodName] = function (...args) {
        const config = getRequestConfig('storage', methodName, args);
        if (proxyMode === 'batch') {
          return config;
        }
        return doFetch(stub, config);
      };
    });

    return obj as unknown as Storage;
  }

  const storage = getProxyStorage();
  return new Proxy(
    {},
    {
      get: (target, prop) => {
        // Handle class methods
        if (prop === 'batch') {
          return async function (jobs: () => {}) {
            // Switching to batch mode, which skips fetching and only returns configs for our jobs
            captured = [];
            proxyMode = 'batch';
            const configs = await jobs();

            if (!Array.isArray(configs)) {
              throw Error(
                `\`batch\` callback should return array of \`DOStorage\` operations, got: ${typeof configs}`
              );
            }

            configs.forEach((cfg, index) => {
              if (!cfg?.type) {
                throw Error(
                  `DOStorageInstance.batch: Returned array has invalid job at index ${index}. Only \`DOStorageInstance\` methods supported.`
                );
              }
            });

            proxyMode = 'execute';

            // Handle all jobs with one fetch
            return doFetch(stub, configs);
          };
        }
        if (prop === 'class') {
          return new Proxy(
            {},
            {
              get: (target, prop) => {
                const type = typeof classInstance[prop];
                if (type === 'function') {
                  return async function (...args: any[]) {
                    const config = getRequestConfig('function', prop, args);
                    if (proxyMode === 'batch') {
                      return config;
                    }
                    return doFetch(stub, config);
                  };
                }
              },
            }
          );
        }

        // Handle storage methods
        if (prop === 'storage') {
          return storage;
        }

        return (target as any)[prop];
      },
      set(target, prop, value) {
        console.dir({ set: [prop, value] });
        (target as any)[prop] = value;
        return true;
      },
    }
  ) as unknown as DOStorageInstance<T>;
}

export interface DOStorageInstance<T> {
  storage: Storage;
  batch: (callback: () => unknown[]) => Promise<unknown[]>;
  class: T;
}

export class DOStorage {
  #state: DurableObjectState;

  constructor(state: DurableObjectState) {
    this.#state = state;
  }

  private async fetch(request: Request) {
    let config: null | RequestConfig | RequestConfig[] = null;

    const runFetchConfig = async (config: RequestConfig) => {
      if (config.type === 'function') {
        return await (this as any)[config.prop](...config.args);
      } else if (config.type === 'storage') {
        return await handleStorageFetch(this.#state, config);
      }
    };

    try {
      config = (await request.json()) as RequestConfig;
    } catch (e) {}

    if (!config) {
      throw Error(
        `You can't directly call stub's fetch method if you're using ${MODULE_NAME}. Use class methods instead.`
      );
    }

    let data: any = undefined;

    if (Array.isArray(config)) {
      data = [];
      for (const cfg of config) {
        data.push(await runFetchConfig(cfg));
      }
    } else {
      data = await runFetchConfig(config);
    }

    return Response.json({
      data,
    });
  }

  static from<T extends DOStorage>(binding: DurableObjectNamespace) {
    const classInstance = new this({} as DurableObjectState) as any;
    return {
      get(name: string) {
        const stub = binding.get(binding.idFromName(name));
        return getProxy<T>(stub, classInstance);
      },
      getById(id: DurableObjectId) {
        const stub = binding.get(id);
        return getProxy<T>(stub, classInstance);
      },
      getByString(id: string) {
        const stub = binding.get(binding.idFromString(id));
        return getProxy<T>(stub, classInstance);
      },
    };
  }
}
