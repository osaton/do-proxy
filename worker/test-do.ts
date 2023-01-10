import { DOProxy } from '../src/do-proxy';
import { Env } from './index';

class Base extends DOProxy {
  env: Env;
  state: DurableObjectState;
  constructor(state: DurableObjectState, env: Env) {
    super(state);
    this.state = state;
    this.env = env;
  }

  async getStorage(): Promise<string> {
    const res = ((await this.state.storage.get('test')) as string) || 'foo';

    return res;
  }
}

// Extend extended, parent methods should be available in tests
class Extended extends Base {
  async setStorage(data: string, data2: string, data3: string) {
    this.state.storage.put('test', data + data2 + data3);
  }
}

// Extend extended, parent methods should be available in tests
export class TestDO extends Extended {
  publicProperty = true;
  funcWithoutAsync() {
    return ['foo'];
  }
  set test(val: string) {}
}
