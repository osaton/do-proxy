import { getRequestConfig, RequestConfig, RequestConfigType } from './request-config';
type ProxyMode = 'batch' | 'execute';

type As<A, B> = A extends B ? A : never;

type KeysToProperties<T, Value, output = {}> = T extends [infer First, ...infer Rest]
  ? First extends string
    ? KeysToProperties<
        Rest,
        Value,
        output & {
          [K in `${First}`]: Value;
        }
      >
    : output
  : output;

type KeysToProps<T, Value> = {
  [K in keyof T as T[K] extends string ? `${T[K]}` : never]: Value;
};

export type ProxyMethodHandler<T extends [string, ...string[]]> = {
  mode: ProxyMode;
  setMode: (mode: ProxyMode) => void;
  methods: {
    [prop: string]: (...agrs: any) => any;
  };
};

export function getProxyMethodHandler<T extends [string, ...string[]]>(
  type: RequestConfigType,
  methods: string[],
  stub: DurableObjectStub,
  fetcher: (stub: DurableObjectStub, config: RequestConfig) => Promise<any>
) {
  let _mode: ProxyMode = 'execute';

  const handler: Record<any, any> = {
    get mode() {
      return _mode;
    },
    setMode(mode: ProxyMode) {
      _mode = mode;
    },
    methods: {},
  };

  methods.forEach((methodName) => {
    handler.methods[methodName] = async function (...args: any) {
      const config = getRequestConfig(type, methodName, args);
      if (handler.mode === 'batch') {
        return config;
      }
      return fetcher(stub, config);
    };
  });

  return handler as ProxyMethodHandler<T>;
}
