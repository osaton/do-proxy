const { TEST_DO } = getMiniflareBindings();

import { TestDO } from '../src/test-do';
import { DOStorage } from '../src/do-storage';
// Use beforeAll & beforeEach inside describe blocks to set up particular DB states for a set of tests
describe('DOStorage', () => {
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
});

export {};
