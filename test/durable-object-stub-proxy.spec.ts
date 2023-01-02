import { DurableObjectStubProxy } from '../src/do-proxy';
import { TestDO } from '../worker/test-do';
import { DOProxy } from '../src/do-proxy';
const { TEST_DO } = getMiniflareBindings();

let stubDo: DurableObjectStubProxy<DOProxy>;
let stubTest: DurableObjectStubProxy<TestDO>;
describe('DurableObjectStubProxy', () => {
  describe('With `DoProxy`', () => {
    beforeEach(() => {
      const DO = DOProxy.wrap(TEST_DO);
      stubDo = DO.get(DO.newUniqueId());
    });

    it('should have access to storage methods', async () => {
      await stubDo.storage.put('test', 'value');
      const res = await stubDo.storage.get('test');

      expect(res).toEqual('value');
      expect(Object.keys(stubDo.storage)).toEqual([
        'delete',
        'deleteAlarm',
        'deleteAll',
        'get',
        'getAlarm',
        'list',
        'put',
        'setAlarm',
        'sync',
      ]);
    });

    it('should have access to batch method', async () => {
      const [, res] = await stubDo.batch(() => [
        stubDo.storage.put('test', 'value'),
        stubDo.storage.get('test'),
      ]);

      expect(res).toEqual('value');
    });

    it("shouldn't have access to class methods", async () => {
      // @ts-expect-error
      expect(stubDo.class).toEqual(undefined);
    });
  });

  describe('With extended class', () => {
    beforeEach(() => {
      const DO = TestDO.wrap(TEST_DO);
      stubTest = DO.get(DO.newUniqueId());
    });

    it('should have access to storage methods', async () => {
      await stubTest.storage.put('test', 'value');
      const res = await stubTest.storage.get('test');

      expect(res).toEqual('value');
      expect(Object.keys(stubTest.storage)).toEqual([
        'delete',
        'deleteAlarm',
        'deleteAll',
        'get',
        'getAlarm',
        'list',
        'put',
        'setAlarm',
        'sync',
      ]);
    });

    it('should have access to class methods', async () => {
      await stubTest.class.funcWithoutAsync();
      expect(Object.keys(stubTest.class)).toEqual(['getStorage', 'setStorage', 'funcWithoutAsync']);
      expect(typeof stubTest.class.funcWithoutAsync).toEqual('function');
    });

    it('should have access to batch method', async () => {
      const [, res] = await stubTest.batch(() => [
        stubTest.storage.put('test', 'value'),
        stubTest.storage.get('test'),
      ]);

      expect(res).toEqual('value');
    });
  });
});
