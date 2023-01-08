import { RequestConfig } from './../src/request-config';
import { getProxyMethodHandler } from '../src/proxy';

async function fetcher(stub: DurableObjectStub, config: RequestConfig) {
  return {
    stub,
    config,
  };
}
describe('getProxyMethodHandler', () => {
  it('should work with proper parameters', () => {
    const test = getProxyMethodHandler('function', ['method1', 'method2'], fetcher);

    test.setStub({} as DurableObjectStub);

    expect(Object.keys(test.methods)).toEqual(['method1', 'method2']);
    expect(typeof test.methods.method1).toEqual('function');
  });

  it('should fire fetcher with execute mode when calling methods', async () => {
    const stub = { test: 'foo' } as unknown as DurableObjectStub;
    let handler = getProxyMethodHandler('function', ['method1'], fetcher);
    handler.setStub(stub);
    let res = await handler.methods.method1('param1', 'param2');
    expect(Object.keys(handler.methods)).toEqual(['method1']);
    expect(typeof handler.methods.method1).toEqual('function');

    expect(res).toEqual({
      stub,
      config: {
        args: ['param1', 'param2'],
        prop: 'method1',
        type: 'function',
      },
    });

    handler = getProxyMethodHandler('storage', ['storageMethod'], fetcher);
    handler.setStub(stub);
    expect(Object.keys(handler.methods)).toEqual(['storageMethod']);
    expect(typeof handler.methods.storageMethod).toEqual('function');

    res = await handler.methods.storageMethod('param1', 'param2');
    expect(res).toEqual({
      stub,
      config: {
        args: ['param1', 'param2'],
        prop: 'storageMethod',
        type: 'storage',
      },
    });
  });
});
