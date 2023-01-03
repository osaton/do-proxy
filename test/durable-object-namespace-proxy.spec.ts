import { DurableObjectStubProxy, DurableObjectNamespaceProxy } from '../src/do-proxy';
import { TestDO } from '../worker/test-do';
import { DOProxy } from '../src/do-proxy';
const { TEST_DO } = getMiniflareBindings();

describe('DurableObjectNamespaceProxy', () => {
  it('should have all the built-in methods', () => {
    const DO = DOProxy.wrap(TEST_DO);

    const id = DO.newUniqueId();
    const idFromStr = DO.idFromString(id.toString());
    expect(id).toEqual(idFromStr);

    const idFromName = DO.idFromName('test');
    const stub = DO.get(idFromName);
    const stub2 = DO.get(id);

    expect(stub.id).toEqual(idFromName);
    expect(stub2.id).toEqual(id);
  });

  it('should have all custom methods', () => {
    const DO = DOProxy.wrap(TEST_DO);

    const idFromName = DO.idFromName('test');
    const stub1 = DO.getByName('test');
    const stub2 = DO.getById(idFromName.toString());

    expect(stub1.id.equals(idFromName)).toEqual(true);
    expect(stub2.id.equals(idFromName)).toEqual(true);
  });
});
