import { DOProxy } from './dist/do-proxy.js';

class Test extends DOProxy {
  method1() {}
  method2() {}
  method3() {}
  method4() {}
  method5() {}
  method6() {}
  method7() {}
  method8() {}
  method9() {}
  method10() {}
}

const start = process.hrtime.bigint();
console.time(`DurableObjectNameSpaceProxy.get`);
for (let i = 0, l = 100000; i < l; i++) {
  const TEST = Test.wrap({
    get() {
      return {
        fetch() {},
        id: {
          toString() {
            return 'id';
          },
          name: 'id',
        },
      };
    },
  });
  TEST.get('test');
}
console.timeEnd(`DurableObjectNameSpaceProxy.get`);
