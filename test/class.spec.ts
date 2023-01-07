const { TEST_DO } = getMiniflareBindings();

import { getClassMethods, getProxyClassHandler } from '../src/class';
import { TestDO } from '../worker/test-do';
import { RequestConfig } from '../src/request-config';

describe('getClassMethods', () => {
  it('should get defined functions from prototype', () => {
    const methods = getClassMethods(TestDO.prototype);
    const set = new Set();
    set.add('setStorage');
    set.add('getStorage');
    set.add('funcWithoutAsync');
    expect(methods).toEqual(set);
  });
});

describe('getProxyClassHandler', () => {
  it('should have supported class methods', () => {
    const stub = { test: 'foo' } as unknown as DurableObjectStub;
    const fetcher = (stub: any, config: RequestConfig) => {
      console.log(stub, config);
    };
    const methods = getClassMethods(TestDO.prototype);
    const handler = getProxyClassHandler(methods, stub, fetcher);

    expect(Object.keys(handler.methods)).toEqual(Array.from(methods));
  });

  it('methods should fire fetcher if in `execution` mode', async () => {
    const stub = { test: 'foo' } as unknown as DurableObjectStub;
    const fetcher = (stub: any, config: RequestConfig) => {
      return {
        stub,
        config,
      };
    };
    const methods = getClassMethods(TestDO.prototype);
    const handler = getProxyClassHandler(methods, stub, fetcher);

    const res = await handler.methods.getStorage(['test']);
    expect(res).toEqual({
      stub,
      config: {
        args: [['test']],
        prop: 'getStorage',
        type: 'function',
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
    const methods = getClassMethods(TestDO.prototype);
    const handler = getProxyClassHandler(methods, stub, fetcher);
    handler.setMode('batch');

    const res = await handler.methods.funcWithoutAsync('key');
    expect(res).toEqual({
      args: ['key'],
      prop: 'funcWithoutAsync',
      type: 'function',
    });
  });
});

export {};
