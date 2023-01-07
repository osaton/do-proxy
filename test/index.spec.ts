import {
  DOProxy,
  DurableObjectNamespaceProxy,
  DurableObjectStubProxy,
  Storage,
} from '../src/index';
import { TestDO } from '../worker';

type IsNever<T> = T extends never ? true : false;

describe('Export', () => {
  it('should export all the needed stuff', () => {
    DOProxy.wrap;
    type MyNamespace = DurableObjectNamespaceProxy<TestDO>;
    type MyStub = DurableObjectStubProxy<TestDO>;
    type MyStorage = Storage;

    const ns: IsNever<MyNamespace> = false;
    const stub: IsNever<MyStub> = false;
    const storage: IsNever<MyStorage> = false;
    [ns, stub, storage];
  });
});
