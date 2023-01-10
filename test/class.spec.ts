import { getClassMethods, getProxyClassHandler } from '../src/class';
import { TestDO } from '../worker/test-do';
import { RequestConfig } from '../src/request-config';
import { DOProxy } from '../src';

describe('getClassMethods', () => {
  it('should get defined functions from prototype', () => {
    let methods = getClassMethods(TestDO.prototype);
    const set = new Set();
    set.add('setStorage');
    set.add('getStorage');
    set.add('funcWithoutAsync');
    expect(methods).toEqual(set);
  });

  it('should handle extended classes', () => {
    class Base extends DOProxy {
      prop1 = 'string';
      func() {}
    }

    class Extended extends Base {
      prop2 = 'string';
      func2() {}
    }

    class DoubleExtended extends Extended {
      prop3 = 'string';
      func3() {}
    }

    let methods = getClassMethods(DoubleExtended.prototype);
    const set = new Set();
    set.add('func');
    set.add('func2');
    set.add('func3');
    expect(methods).toEqual(set);
  });
});

describe('getProxyClassHandler', () => {
  it('should have supported class methods', () => {
    const stub = { test: 'foo' } as unknown as DurableObjectStub;
    const fetcher = (stub: any, config: RequestConfig) => {
      throw Error('should not be called in this test');
    };
    const methods = getClassMethods(TestDO.prototype);
    const handler = getProxyClassHandler(methods, fetcher);
    handler.setStub(stub);

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
    const handler = getProxyClassHandler(methods, fetcher);
    handler.setStub(stub);

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
    const handler = getProxyClassHandler(methods, fetcher);
    handler.setStub(stub);
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
