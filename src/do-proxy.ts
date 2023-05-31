import { getStubProxyFactory, DurableObjectStubProxy, StubFactory } from './stub';
import type { RequestConfig } from './request-config';
import type { Storage } from './storage';
export type { Storage, DurableObjectStubProxy };

const MODULE_NAME = 'do-proxy';

declare abstract class DurableObjectNamespaceProxyClass<T>
  implements Omit<DurableObjectNamespace, 'get'>
{
  jurisdiction(jurisdiction: DurableObjectJurisdiction): DurableObjectNamespace;
  newUniqueId(options?: DurableObjectNamespaceNewUniqueIdOptions | undefined): DurableObjectId;
  idFromName(name: string): DurableObjectId;
  idFromString(id: string): DurableObjectId;
  get(id: DurableObjectId): DurableObjectStubProxy<T>;
}

interface DurableObjectNamespaceExtended<T> extends DurableObjectNamespaceProxyClass<T> {
  /**
   * Get by name
   *
   * Shorthand for `DurableObjectNamespace.get(DurableObjectNamespace.idFromName('name'))`
   */
  getByName: (name: string) => DurableObjectStubProxy<T>;
  /**
   * Get by id
   *
   * Shorthand for `DurableObjectNamespace.get(DurableObjectNamespace.idFromString(hexId))`
   */
  getById: (id: string) => DurableObjectStubProxy<T>;
}

export type DurableObjectNamespaceProxy<T> = T extends ConstructorType
  ? DurableObjectNamespaceExtended<InstanceType<T>>
  : DurableObjectNamespaceExtended<T>;

interface DOProxyNamespace<T> {
  get: (name: string) => DurableObjectStubProxy<T>;
  getById: (id: DurableObjectId) => DurableObjectStubProxy<T>;
  getByString: (id: string) => DurableObjectStubProxy<T>;
}

type ConstructorType = abstract new (...args: any) => any;

async function handleStorageFetch(state: DurableObjectState, config: RequestConfig) {
  return (state.storage as any)[config.prop](...config.args);
}

const stubFactoryMap: Map<unknown, StubFactory> = new Map();

function getCachedStubFactory<Proto extends DOProxy = DOProxy>(proto: Proto): StubFactory {
  const factory = stubFactoryMap.get(proto);
  if (factory) {
    return factory;
  }

  const newFactory = getStubProxyFactory(proto);
  stubFactoryMap.set(proto, newFactory);
  return newFactory;
}
export class DOProxy {
  #state: DurableObjectState;
  constructor(state: DurableObjectState, env?: any) {
    this.#state = state;
  }

  // @ts-ignore
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

    return new Response(
      JSON.stringify(
        {
          data,
        },
        function replacer(_key, value) {
          // Handle Maps. At least `state.storage.list()` returns one
          // We'll convert these back to Map when handling response
          if (value instanceof Map) {
            return {
              __dataType: 'Map',
              value: Array.from(value.entries()),
            };
          } else {
            return value;
          }
        }
      ),
      {
        headers: {
          'content-type': 'application/json',
        },
      }
    );
  }

  /**
   * Get `DurableObjectNamespace` wrapped inside proxy
   */
  static wrap<T extends typeof DOProxy>(
    this: T,
    binding: DurableObjectNamespace
  ): DurableObjectNamespaceProxy<T> {
    const factory = getCachedStubFactory(this.prototype);
    return new Proxy(binding, {
      get: (target, prop) => {
        // `DurableObjectNamespaceProxy.get`
        if (prop === 'get') {
          return function (id: DurableObjectId) {
            const stub = binding.get(id);
            return factory(stub);
          };
        }

        // `DurableObjectNamespaceProxy.getByName`
        if (prop === 'getByName') {
          return function (name: string) {
            const stub = binding.get(binding.idFromName(name));
            return factory(stub);
          };
        }

        // `DurableObjectNamespaceProxy.getById`
        if (prop === 'getById') {
          return function (id: string) {
            const stub = binding.get(binding.idFromString(id));
            return factory(stub);
          };
        }

        // Handle DurableObjectNamespace's builtin properties / methods last, so that possible conflicting updates don't break existing implementations
        if (prop in target) {
          const value = (target as any)[prop];
          return typeof value === 'function' ? value.bind(target) : value;
        }
      },
    }) as unknown as DurableObjectNamespaceProxy<T>;
  }

  /**
   * @deprecated Use `wrap` method instead which allows access to DurableObjectNamespace methods without type quirks
   */
  static from<T extends DOProxy>(binding: DurableObjectNamespace): DOProxyNamespace<T> {
    const factory = getCachedStubFactory(this.prototype);
    return {
      get(name: string) {
        const stub = binding.get(binding.idFromName(name));
        return factory(stub) as any;
      },
      getById(id: DurableObjectId) {
        const stub = binding.get(id);
        return factory(stub) as any;
      },
      getByString(id: string) {
        const stub = binding.get(binding.idFromString(id));
        return factory(stub) as any;
      },
    };
  }
}
