const { TEST_DO } = getMiniflareBindings();

import { DOStorage } from '../src/do-storage';
// Use beforeAll & beforeEach inside describe blocks to set up particular DB states for a set of tests
describe('Storage', () => {
  it('should handle map conversion for `storage.list` method', async () => {
    const storage = DOStorage.from(TEST_DO);
    const test = storage.get('test');

    const res = await test.batch(() => {
      return [test.storage.put('foo', 'foo'), test.storage.put('bar', 'bar'), test.storage.list()];
    });
    const map = new Map();
    map.set('foo', 'foo');
    map.set('bar', 'bar');
    expect(res).toEqual([null, null, map]);
  });
});

export {};
