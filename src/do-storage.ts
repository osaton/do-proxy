import { DurableObjectGetAlarmOptions, DurableObjectPutOptions } from '@cloudflare/workers-types';
const MODULE_NAME = 'do-storage';

interface RequestConfig {
  type: 'function';
  prop: string;
  args: any[];
}

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

export class DOStorage {
  state: DurableObjectState;
  storage!: Storage;

  constructor(state: DurableObjectState) {
    this.state = state;
  }
  // ----
  // DurableObjectState.storage supported methods
  // ----

  delete(key: string, options?: DurableObjectPutOptions | undefined) {
    return this.state.storage.delete(key, options);
  }

  deleteAlarm() {
    return this.state.storage.deleteAlarm();
  }

  deleteAll(options?: DurableObjectPutOptions | undefined) {
    return this.state.storage.deleteAll(options);
  }

  get(key: string, options?: DurableObjectGetOptions | undefined) {
    return this.state.storage.get(key, options);
  }

  getAlarm(options?: DurableObjectGetAlarmOptions | undefined) {
    return this.state.storage.getAlarm(options);
  }

  list(options?: globalThis.DurableObjectListOptions | undefined) {
    return this.state.storage.list(options);
  }

  put(key: string, value: unknown, options?: DurableObjectPutOptions | undefined) {
    return this.state.storage.put(key, value, options);
  }

  setAlarm(scheduledTime: number, options?: globalThis.DurableObjectSetAlarmOptions | undefined) {
    return this.state.storage.setAlarm(scheduledTime, options);
  }

  sync() {
    return this.state.storage.sync();
  }

  async fetch(request: Request) {
    let config: null | RequestConfig = null;
    try {
      config = (await request.json()) as RequestConfig;
    } catch (e) {}

    if (!config) {
      throw Error(
        `You can't directly call stub's fetch method if you're using ${MODULE_NAME}. Use class methods instead.`
      );
    }

    let data: any = undefined;
    if (config.type === 'function') {
      data = await (this as any)[config.prop](...config.args);
    }

    return Response.json({
      data,
    });
  }

  static getApi<T>(binding: DurableObjectNamespace) {
    const classInstance = new this({} as DurableObjectState) as any;
    return {
      get(name: string) {
        const stub = binding.get(binding.idFromName(name));

        return new Proxy(this, {
          get: (target, prop, receiver) => {
            if (typeof classInstance[prop] === 'function') {
              return async function (...args: any[]) {
                const config: RequestConfig = {
                  type: 'function',
                  prop: String(prop),
                  args: args,
                };
                const res = (await stub
                  .fetch(
                    new Request('https://do-api/', {
                      method: 'POST',
                      body: JSON.stringify(config),
                    })
                  )
                  .then((res) => res.json())) as FetchResponse;

                return res.data;
              };
            }

            return (target as any)[prop];
          },
          set(target, prop, value) {
            console.dir({ set: [prop, value] });
            (target as any)[prop] = value;
            return true;
          },
        }) as T;
      },
    };
  }
}
