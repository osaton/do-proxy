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
console.time(`#wrap`);
for (let i = 0, l = 10000; i < l; i++) {
  Test.wrap({});
}
console.timeEnd(`#wrap`);
