const { TEST_DO } = getMiniflareBindings();

import { TestDO } from '../src/test-do';
// Use beforeAll & beforeEach inside describe blocks to set up particular DB states for a set of tests
describe('DOStorage', () => {
  it('Should handle class methods', async () => {
    //expect(res).toEqual({ foo: 'yes' });

    const testDo = TestDO.getApi<TestDO>(TEST_DO).get('test');

    await testDo.setStorage('test2', 'moro', 'nääs');
    const tota = await testDo.getStorage();
    testDo.testProp;
  });

  it('should handle storage methods', async () => {
    const testDo = TestDO.getApi<TestDO>(TEST_DO).get('test');
    await testDo.put('test', 'foo');

    const res = await testDo.get('test');
    expect(res).toEqual('foo');

    await testDo.deleteAll();
    expect(await testDo.get('test')).toEqual(undefined);
  });
});

export {};
