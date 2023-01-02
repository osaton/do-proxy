const { TEST_DO } = getMiniflareBindings();

import { DOProxy } from '../src/do-proxy';

describe('Storage', () => {
  it('should handle map conversion for `storage.list` method', async () => {
    const ns = DOProxy.from(TEST_DO);
    const test = ns.get('test');

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
