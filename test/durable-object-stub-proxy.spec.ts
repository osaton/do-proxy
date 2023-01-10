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

    it('should have `id` property', () => {
      expect(stubDo.id).toHaveProperty('equals');
    });

    it('should have `stub` property', () => {
      expect(stubDo.stub).toHaveProperty('fetch');
      expect(stubDo.stub).toHaveProperty('id');
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
    beforeEach(async () => {
      const DO = TestDO.wrap(TEST_DO);
      stubTest = DO.get(DO.newUniqueId());
    });

    it('should have `id` property', () => {
      expect(stubTest.id).toHaveProperty('equals');
    });

    it('should have `stub` property', () => {
      expect(stubTest.stub).toHaveProperty('fetch');
      expect(stubTest.stub).toHaveProperty('id');
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
      const TEST2 = DOProxy.wrap(TEST_DO);
      const stub1 = TEST2.getByName('test');
      // @ts-expect-error
      stub1.class;
      const DO = TestDO.wrap(TEST_DO);
      stubTest = DO.get(DO.newUniqueId());
      await stubTest.class.funcWithoutAsync();
      expect(Object.keys(stubTest.class).sort()).toEqual(
        ['getStorage', 'setStorage', 'funcWithoutAsync'].sort()
      );
      expect(typeof stubTest.class.funcWithoutAsync).toEqual('function');
    });

    it('should have access to batch method', async () => {
      const [, res] = await stubTest.batch(() => [
        stubTest.storage.put('test', 'value'),
        stubTest.storage.get('test'),
        stubTest.class.getStorage(),
      ]);

      expect(res).toEqual('value');
    });
  });
});
