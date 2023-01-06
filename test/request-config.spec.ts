import { getRequestConfig, RequestConfig } from '../src/request-config';

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
