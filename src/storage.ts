import { getProxyMethodHandler, ProxyMethodHandler } from './proxy';
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

export function getProxyStorageHandler(
  stub: DurableObjectStub,
  fetcher: (stub: DurableObjectStub, config: RequestConfig) => any
) {
  return getProxyMethodHandler('storage', storageMethods, stub, fetcher);
}
