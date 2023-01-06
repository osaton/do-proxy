import { getRequestConfig, RequestConfig } from './request-config';
type SupportedStorageMethods =
  | 'delete'
  | 'deleteAlarm'
  | 'deleteAll'
  | 'get'
  | 'getAlarm'
  | 'list'
  | 'put'
  | 'setAlarm'
  | 'sync';

export const storageMethods: SupportedStorageMethods[] = [
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

export type Storage = Pick<DurableObjectStorage, SupportedStorageMethods>;

type ProxyMode = 'batch' | 'execute';
type ProxyStorage = {
  mode: ProxyMode;
  setMode: (mode: ProxyMode) => void;
  methods: Storage;
};

export function getProxyStorage(
  stub: DurableObjectStub,
  fetcher: (stub: DurableObjectStub, config: RequestConfig) => any
) {
  let _mode: ProxyMode = 'execute';

  const storage: ProxyStorage = {
    get mode() {
      return _mode;
    },
    setMode(mode) {
      _mode = mode;
    },
    methods: {} as Storage,
  };

  storageMethods.forEach((methodName) => {
    storage.methods[methodName] = async function (...args: any) {
      const config = getRequestConfig('storage', methodName, args);
      if (storage.mode === 'batch') {
        return config;
      }
      return fetcher(stub, config);
    };
  });

  return storage;
}
