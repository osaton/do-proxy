import { DOProxy } from '../src/do-proxy';
import { Env } from './index';

export class TestDO extends DOProxy {
  env: Env;
  state: DurableObjectState;
  publicProperty = true;

  constructor(state: DurableObjectState, env: Env) {
    super(state);
    this.state = state;
    this.env = env;
  }

  async getStorage(): Promise<string> {
    const res = ((await this.state.storage.get('test')) as string) || 'foo';

    return res;
  }

  async setStorage(data: string, data2: string, data3: string) {
    this.state.storage.put('test', data + data2 + data3);
  }

  funcWithoutAsync() {
    return ['foo'];
  }

  get test() {
    return 'foo';
  }

  set test(val: string) {}
}
