import { DOProxy } from '../src/do-proxy';
import { Env } from './index';

export class TestDO extends DOProxy {
  env: Env;
  state: DurableObjectState;
  constructor(state: DurableObjectState, env: Env) {
    super(state);
    this.state = state;
    this.env = env;
  }

  async getStorage() {
    return this.state.storage.get('test');
  }

  async setStorage(data: string, data2: string, data3: string) {
    this.state.storage.put('test', data + data2 + data3);
  }
}
