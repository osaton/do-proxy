const { TEST_DO } = getMiniflareBindings();

import { storageMethods, getProxyStorageHandler } from '../src/storage';
import { DOProxy } from '../src/do-proxy';
import { RequestConfig } from '../src/request-config';

describe('Storage', () => {
  it('should handle map conversion for `storage.list` method', async () => {
    const ns = DOProxy.from(TEST_DO);
    const test = ns.get('test');

    const res = await test.batch(() => {
      return [test.storage.put('foo', 'foo'), test.storage.put('bar', 'bar'), test.storage.list()];
    });
    const map = new Map();
    map.set('foo', 'foo');
    map.set('bar', 'bar');
    expect(res).toEqual([null, null, map]);
  });

  describe('getProxyStorage', () => {
    it('should have supported storage methods', () => {
      const stub = { test: 'foo' } as unknown as DurableObjectStub;
      const fetcher = (stub: any, config: RequestConfig) => {
        console.log(stub, config);
      };
      const storage = getProxyStorageHandler(stub, fetcher);

      expect(Object.keys(storage.methods)).toEqual(storageMethods);
    });

    it('methods should fire fetcher if in `execution` mode', async () => {
      const stub = { test: 'foo' } as unknown as DurableObjectStub;
      const fetcher = (stub: any, config: RequestConfig) => {
        return {
          stub,
          config,
        };
      };
      const storage = getProxyStorageHandler(stub, fetcher);

      const res = await storage.methods.get('key');
      expect(res).toEqual({
        stub,
        config: {
          args: ['key'],
          prop: 'get',
          type: 'storage',
        },
      });
    });

    it('methods should return config if in `batch` mode', async () => {
      const stub = { test: 'foo' } as unknown as DurableObjectStub;
      const fetcher = (stub: any, config: RequestConfig) => {
        return {
          stub,
          config,
        };
      };
      const storage = getProxyStorageHandler(stub, fetcher);
      storage.setMode('batch');

      const res = await storage.methods.get('key');
      expect(res).toEqual({
        args: ['key'],
        prop: 'get',
        type: 'storage',
      });
    });
  });
});

export {};
