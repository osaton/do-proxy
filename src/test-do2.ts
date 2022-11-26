import { DOStorage } from './do-storage';
import { Env } from './index';

export class TestDO2 extends DOStorage {
  constructor(state: DurableObjectState, env: Env) {
    super(state);
  }

  async fetch(req: Request) {
    return Response.json({ foo: 'yes2' });
  }
}
