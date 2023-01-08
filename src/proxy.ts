import { getRequestConfig, RequestConfig, RequestConfigType } from './request-config';
type ProxyMode = 'batch' | 'execute';

export type ProxyMethodHandler = {
  mode: ProxyMode;
  stub: DurableObjectStub;
  setStub: (stub: DurableObjectStub) => void;
  setMode: (mode: ProxyMode) => void;
  methods: {
    [prop: string]: (...agrs: any) => any;
  };
};

export function getProxyMethodHandler<T extends [string, ...string[]]>(
  type: RequestConfigType,
  methods: string[],
  fetcher: (stub: DurableObjectStub, config: RequestConfig) => Promise<any>
) {
  const handler: Record<string, any> = {
    _stub: null,
    _mode: 'execute',
    get mode() {
      return this._mode;
    },
    get stub() {
      return this._stub;
    },
    setStub(stub: DurableObjectStub) {
      this._stub = stub;
    },
    getStub() {},
    setMode(mode: ProxyMode) {
      this._mode = mode;
    },
    get methods() {
      if (this._methods) {
        return this._methods;
      }

      const _methods: Record<string, () => any> = {};
      methods.forEach((methodName) => {
        _methods[methodName] = async (...args: any) => {
          const config = getRequestConfig(type, methodName, args);
          if (this.mode === 'batch') {
            return config;
          }

          return fetcher(this.stub, config);
        };
      });
      this._methods = _methods;
      return this._methods;
    },
  };

  return handler as ProxyMethodHandler;
}
