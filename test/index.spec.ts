const { TEST_DO } = getMiniflareBindings();

import { TestDO } from '../worker/test-do';
import { DOStorage } from '../src/do-storage';
// Use beforeAll & beforeEach inside describe blocks to set up particular DB states for a set of tests
describe('DOStorage', () => {
  it('Should be able to get instance with all id types', async () => {
    const id = TEST_DO.idFromName('test');
    const fromId = DOStorage.from(TEST_DO).getById(id);
    const fromString = DOStorage.from(TEST_DO).getByString(id.toString());
    const fromName = DOStorage.from(TEST_DO).get('test');

    await fromName.storage.put('get-methods', true);
    const res = await Promise.all([
      fromId.storage.get('get-methods'),
      fromString.storage.get('get-methods'),
      fromName.storage.get('get-methods'),
    ]);

    expect(res).toEqual([true, true, true]);
  });
  it('Should handle class methods', async () => {
    const testDo = TestDO.from<TestDO>(TEST_DO).get('test');

    await testDo.class.setStorage('test2', 'moro', 'nääs');
    const tota = await testDo.class.getStorage();
  });

  it('Should handle storage methods', async () => {
    const testDoStub = TestDO.from<TestDO>(TEST_DO);
    const testDo = testDoStub.get('test');
    const testDo2 = testDoStub.get('test2');

    await testDo.storage.put('test', 'foo');
    await testDo2.storage.put('test', 'bar');
    const res = await testDo.storage.get('test');
    const res2 = await testDo2.storage.get('test');

    expect(res).toEqual('foo');
    expect(res2).toEqual('bar');
  });

  it('Should be possible to use it as standalone', async () => {
    const storage = DOStorage.from(TEST_DO);
    const test = storage.get('test');

    await test.storage.put('test2', {
      foo: 'bar',
    });
    const res = await test.storage.get('test2');

    expect(res).toEqual({
      foo: 'bar',
    });
  });

  it('Should be able to batch commands', async () => {
    const storage = DOStorage.from(TEST_DO);
    const test = storage.get('test');

    const res = await test.batch(() => {
      return [test.storage.put('test-batch', 'first'), test.storage.get('test-batch')];
    });
    expect(res).toEqual([null, 'first']);
  });

  /*
  it('Should throw if returned callback array contains invalid data', async () => {
    const storage = DOStorage.from(TEST_DO);
    const test = storage.get('test');

    const res = expect(() => {
      test.batch(() => {
        return [test.storage.put('test-batch', 'first'), () => {}, test.storage.get('test-batch')];
      });
    }).toThrow(
      'DOStorageInstance.batch: Returned array has invalid job at index 1. Only `DOStorageInstance` methods supported.'
    );
  });*/
});

export {};
