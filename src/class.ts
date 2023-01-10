import { DOProxy } from './do-proxy';
import { getProxyMethodHandler } from './proxy';
import { RequestConfig } from './request-config';

export function getProxyClassHandler<T extends Set<string>>(
  methods: T,
  fetcher: (stub: DurableObjectStub, config: RequestConfig) => any
) {
  return getProxyMethodHandler('function', Array.from(methods), fetcher);
}

export function getClassMethods<T extends DOProxy>(proto: T) {
  const exclude = ['constructor', 'fetch'];
  const methods: Set<string> = new Set();
  let o: T | null = proto;
  while (o !== null) {
    for (let name of Object.getOwnPropertyNames(o)) {
      if (!exclude.includes(name) && typeof (proto as any)[name] === 'function') {
        methods.add(name);
      }
    }
    o = Object.getPrototypeOf(o);

    // If we have reached Object's prototype it's time to stop
    if (Object.prototype === o) {
      o = null;
    }
  }
  return methods;
}
