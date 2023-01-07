import { getRequestConfig, RequestConfig, unwrapConfigs } from '../src/request-config';

describe('getRequestConfig', () => {
  it('should return config for function', () => {
    const res = getRequestConfig('function', 'myMethod', ['foo', 'bar']);
    expect(res).toEqual({ args: ['foo', 'bar'], prop: 'myMethod', type: 'function' });
  });
  it('should return config for storage', () => {
    const res = getRequestConfig('storage', 'get', ['foo', 'bar']);
    expect(res).toEqual({ args: ['foo', 'bar'], prop: 'get', type: 'storage' });
  });
});

describe('unwrapConfigs', () => {
  it('it should unwrap configs wrapped in Promise', async () => {
    const configs = [
      {
        type: 'function',
        prop: 'test',
        args: [1, 2],
      },
      Promise.resolve({
        type: 'function',
        prop: 'test',
        args: [1, 2],
      }),
    ] as RequestConfig[];

    const res = await unwrapConfigs(configs);
    expect(res).toEqual([
      {
        type: 'function',
        prop: 'test',
        args: [1, 2],
      },
      {
        type: 'function',
        prop: 'test',
        args: [1, 2],
      },
    ]);
  });
});
