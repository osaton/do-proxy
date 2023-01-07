import { DOProxy } from './do-proxy';
import { getProxyMethodHandler, ProxyMethodHandler } from './proxy';
import { getRequestConfig, RequestConfig } from './request-config';

export function getProxyClassHandler<T extends Set<string>>(
  methods: T,
  stub: DurableObjectStub,
  fetcher: (stub: DurableObjectStub, config: RequestConfig) => any
) {
  return getProxyMethodHandler('function', Array.from(methods), stub, fetcher);
}

export function getClassMethods<T extends DOProxy>(proto: T) {
  const exclude = ['constructor', 'fetch'];
  const methods: Set<string> = new Set();
  let o = proto;
  while (o !== null) {
    for (let name of Object.getOwnPropertyNames(o)) {
      if (
        !exclude.includes(name) &&
        typeof (proto as any)[name] === 'function' &&
        proto.hasOwnProperty(name)
      ) {
        methods.add(name);
      }
    }
    o = Object.getPrototypeOf(o);
  }
  return methods as Set<string>;
}
