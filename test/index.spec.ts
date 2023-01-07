import {
  DOProxy,
  DurableObjectNamespaceProxy,
  DurableObjectStubProxy,
  Storage,
} from '../src/index';
import { TestDO } from '../worker';

describe('Export', () => {
  it('should export all the needed stuff', () => {
    DOProxy.wrap;
    type MyNamespace = DurableObjectNamespaceProxy<TestDO>;
    type MyStub = DurableObjectStubProxy<TestDO>;
    type MyStorage = Storage;
  });
});
