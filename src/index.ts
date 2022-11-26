export { TestDO } from './test-do';

export interface Env {
  TEST_DO: DurableObjectNamespace;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const stub = env.TEST_DO.get(env.TEST_DO.idFromName('test'));

    return stub.fetch(request);
  },
};
