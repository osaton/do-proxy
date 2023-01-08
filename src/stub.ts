import { getClassMethods, getProxyClassHandler } from './class';
import { unwrapConfigs } from './request-config';
import { getProxyStorageHandler, Storage } from './storage';
import type { DOProxy } from './do-proxy';
import type { RequestConfig } from './request-config';
import { ProxyMethodHandler } from './proxy';

type PromisifyFunction<TFunc extends (...args: any) => any> = ReturnType<TFunc> extends Promise<any>
  ? TFunc
  : (...args: Parameters<TFunc>) => Promise<ReturnType<TFunc>>;

type GetClassMethods<T> = {
  // Only methods can be proxied
  [K in keyof T as T[K] extends Function ? K : never]: T[K] extends (...args: any) => any
    ? // If the class method is not marked as async, we need to wrap return type with `Promise` as the proxied methods are all async
      PromisifyFunction<T[K]>
    : never;
};

type DurableObjectProxy<T> = {
  /**
   * Stub's id
   */
  id: DurableObjectId;
  /**
   * The actual stub returned by `DurableObjectNamespace.get`
   */
  stub: DurableObjectStub;
  /**
   * Transactional storage API
   *
   * [See documentation](https://developers.cloudflare.com/workers/runtime-apis/durable-objects/#transactional-storage-api)
   */
  storage: Storage;
  /**
   * Run multiple commands inside DO instance with one fetch command
   */
  batch: <T extends [Promise<unknown>, ...Promise<unknown>[]]>(
    callback: () => T
  ) => BatchResponse<T>;
  /**
   * Methods from the extended class
   */
  class: GetClassMethods<T>;
};

type UnwrapPromises<Promises> = Promises extends [Promise<infer Value>, ...infer Rest]
  ? [Value, ...UnwrapPromises<Rest>]
  : [];

type BatchResponse<T> = Promise<UnwrapPromises<T>>;

export type DurableObjectStubProxy<T> = keyof GetClassMethods<T> extends never
  ? Omit<DurableObjectProxy<T>, 'class'>
  : DurableObjectProxy<T>;

export function prepareMethods<Proto extends DOProxy = DOProxy>(classProto: Proto) {
  return {
    methods: getClassMethods(classProto),
  };
}

export type StubFactory<T = DOProxy> = (stub: DurableObjectStub) => DurableObjectStubProxy<T>;
/**
 * Create factory function for making subsequent proxy stubs faster to build
 */
export function getStubProxyFactory<Proto extends DOProxy = DOProxy>(
  classProto: Proto
): StubFactory<Proto> {
  const methods = getClassMethods(classProto);
  const storageHandler = getProxyStorageHandler(doStubFetch);
  const classHandler = getProxyClassHandler(methods, doStubFetch);

  return (stub: DurableObjectStub) => {
    const storage = Object.create(storageHandler);
    const classH = Object.create(classHandler);
    storage.setStub(stub);
    classH.setStub(stub);
    return getStubProxy<Proto>(stub, classH, storage);
  };
}

function getStubProxy<T>(
  stub: DurableObjectStub,
  classHandler: ProxyMethodHandler,
  storageHandler: ProxyMethodHandler
) {
  const hasClassMethods = Object.keys(classHandler.methods).length > 0;
  return new Proxy(
    {
      id: stub.id,
      stub: stub,
    },
    {
      get: (target, prop) => {
        if (prop === 'batch') {
          return async function (jobs: () => any[]) {
            // Switching to batch mode, which skips fetching and only returns configs for our jobs
            storageHandler.setMode('batch');
            classHandler.setMode('batch');

            const callbackRes = await jobs();

            if (!Array.isArray(callbackRes)) {
              throw Error(`\`batch\` callback should return an array, got: ${typeof callbackRes}`);
            }

            const configs = await unwrapConfigs(callbackRes);

            configs.forEach((cfg, index) => {
              if (!cfg?.type) {
                throw Error(
                  `Returned array has invalid job at index ${index}. Only \`storage\` and \`class\` methods supported.`
                );
              }
            });
            storageHandler.setMode('execute');
            classHandler.setMode('execute');

            // Handle all jobs with one fetch
            return doStubFetch(stub, configs);
          };
        }
        if (prop === 'class' && hasClassMethods) {
          return classHandler.methods;
        }

        // Handle storage methods
        if (prop === 'storage') {
          return storageHandler.methods;
        }

        const value = (target as any)[prop];
        return typeof value === 'function' ? value.bind(target) : value;
      },
      set(target, prop, value) {
        (target as any)[prop] = value;
        return true;
      },
    }
  ) as unknown as DurableObjectStubProxy<T>;
}

interface FetchResponse {
  data: any;
}

async function doStubFetch(
  stub: DurableObjectStub,
  config: RequestConfig | RequestConfig[]
): Promise<unknown> {
  const res = (await stub
    .fetch(
      new Request('https://do-proxy/', {
        method: 'POST',
        body: JSON.stringify(config),
      })
    )
    .then((res) => res.text())
    .then((text: string) =>
      JSON.parse(text, function reviver(key, value) {
        // Convert received map data back to Map
        if (typeof value === 'object' && value !== null) {
          if (value.__dataType === 'Map') {
            return new Map(value.value);
          }
        }
        return value;
      })
    )) as FetchResponse;

  return res.data;
}
