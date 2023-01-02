const { TEST_DO } = getMiniflareBindings();
import { TestDO } from '../worker/test-do';
import { DurableObjectStubProxy, DurableObjectNamespaceProxy, DOProxy } from '../src/do-proxy';

describe('DOProxy types', () => {
  describe('DurableObjectNamespaceProxy', () => {
    it('should provide correct properties', () => {
      // @todo better tests
      type Test = DurableObjectNamespaceProxy<TestDO>;
      type Do = DurableObjectNamespaceProxy<DOProxy>;

      ['idFromName', 'get', 'idFromString', 'newUniqueId'] satisfies (keyof Test)[];

      ['idFromName', 'get', 'idFromString', 'newUniqueId'] satisfies (keyof Do)[];
    });
  });

  describe('DurableObjectStubProxy', () => {
    it('should provide correct properties', () => {
      // @todo better tests
      type Test = DurableObjectStubProxy<TestDO>;
      type Do = DurableObjectStubProxy<DOProxy>;

      ['id', 'stub', 'storage', 'batch', 'class'] satisfies (keyof Test)[];

      [
        'id',
        'stub',
        'storage',
        'batch',
        // @ts-expect-error
        'class',
      ] satisfies (keyof Do)[];
    });

    it('should expose class methods for extended classes', () => {
      // @todo better tests
      type Test = DurableObjectStubProxy<TestDO>;

      ['funcWithoutAsync', 'getStorage', 'setStorage'] satisfies (keyof Test['class'])[];
    });
  });

  it('should provide correct properties', () => {
    // @todo better tests
    type Test = DurableObjectStubProxy<TestDO>;
    type Do = DurableObjectStubProxy<DOProxy>;

    ['id', 'stub', 'storage', 'batch', 'class'] satisfies (keyof Test)[];

    [
      'id',
      'stub',
      'storage',
      'batch',
      // @ts-expect-error
      'class',
    ] satisfies (keyof Do)[];
  });

  it('should provide correct types', async () => {
    const test = TestDO.from<TestDO>(TEST_DO).get('test');

    // class methods
    test.class.getStorage().then((res) => res.charAt(0));

    // Storage methods
    test.storage.get('foo').then((res) => res);

    // Batch
    await test.batch(() => [
      test.storage.delete('test'),
      test.class.setStorage('foo', 'bar', 'baz'),
    ]);

    // Batch return types
    const [bool, arr, asString] = await test.batch(() => [
      test.storage.delete('test'),
      test.class.funcWithoutAsync(),
      test.storage.get('test') as Promise<string | null>,
    ]);
    bool.valueOf();
    arr[0].charAt(0);
    asString?.charAt(0);

    // Should promisify methods that aren't marked as such
    test.class.funcWithoutAsync().then((res) => {
      res[0];
    });

    // Should strip out properties
    // @ts-expect-error
    test.class.publicProperty;
    // @ts-expect-error
    test.class.test = 'foo';

    // Make sure the stripped properties and modified methods are actually still in the class and not removed / changed accidentally
    const instance = new TestDO({} as any, {} as any);
    instance.publicProperty;
    instance.funcWithoutAsync()[0];
    instance.test = 'foo';
  });
});
