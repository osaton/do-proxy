const { TEST_DO } = getMiniflareBindings();

import { TestDO } from '../worker/test-do';
import { DOProxy } from '../src/do-proxy';

describe('DOProxy', () => {
  describe('#wrap', () => {
    it('should return `DurableObjectNamespace` like proxy object', async () => {
      const DO = TestDO.wrap(TEST_DO);
      const id = DO.idFromName('test');
      const id2 = DO.newUniqueId();
      const fromString = DO.idFromString(id.toString());

      expect(fromString.equals(id)).toEqual(true);
      expect(id).toEqual(TEST_DO.idFromName('test'));
      expect(typeof id2.equals).toEqual('function');
    });
  });

  describe('#from', () => {
    it('Should be able to get instance with all id types', async () => {
      const id = TEST_DO.idFromName('test');
      const fromId = DOProxy.from(TEST_DO).getById(id);
      const fromString = DOProxy.from(TEST_DO).getByString(id.toString());
      const fromName = DOProxy.from(TEST_DO).get('test');

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

      await testDo.class.setStorage('foo', 'bar', 'baz');
      const res = await testDo.class.getStorage();
      expect(res).toEqual('foobarbaz');
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
      const storage = DOProxy.from(TEST_DO);
      const test = storage.get('test');

      await test.storage.put('test2', {
        foo: 'bar',
      });
      const res = await test.storage.get('test2');

      expect(res).toEqual({
        foo: 'bar',
      });
    });

    it('Should be able to batch commands with `storage` methods', async () => {
      const storage = DOProxy.wrap(TEST_DO);
      const test = storage.getByName('test');

      const res = await test.batch(() => {
        return [test.storage.put('test-batch', 'first'), test.storage.get('test-batch')];
      });
      expect(res).toEqual([null, 'first']);
    });

    it('Should be able to batch commands with `class` methods', async () => {
      const testDo = TestDO.from<TestDO>(TEST_DO).get('test');

      const res = await testDo.batch(() => [
        testDo.class.setStorage('foo', 'bar', 'baz'),
        testDo.storage.list(),
      ]);

      const map = new Map();
      map.set('test', 'foobarbaz');
      expect(res).toEqual([null, map]);
    });

    it('Should not run the class constructor when initializing `DOProxyNamespace`', async () => {
      class Test extends DOProxy {
        state: DurableObjectState;
        constructor(state: DurableObjectState, env: any) {
          super(state);
          // Should never run
          throw Error('no problem for `DOProxyNamespace` initialization');
        }
      }

      expect(() => {
        Test.from<Test>(TEST_DO).get('test');
      }).not.toThrow();
    });

    describe('#batch', () => {
      it('Should throw if array returned from callback contains invalid data', async () => {
        const stub = DOProxy.wrap(TEST_DO).getByName('test');

        await expect(
          // @ts-expect-error
          stub.batch(() => {
            return [
              stub.storage.put('test-batch', 'first'),
              () => {},
              stub.storage.get('test-batch'),
            ];
          })
        ).rejects.toThrow(
          'Returned array has invalid job at index 1. Only `storage` and `class` methods supported.'
        );
      });

      it('Should throw if callback returns something else than array', async () => {
        const stub = DOProxy.wrap(TEST_DO).getByName('test');

        await expect(
          // @ts-expect-error
          stub.batch(() => false)
        ).rejects.toThrow('`batch` callback should return an array, got: boolean');
      });
    });
  });
});

export {};
