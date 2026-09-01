import { findVeto } from "./veto.ts";

function assert(cond: unknown, msg: string) {
  if (!cond) {
    console.error("FAIL", msg);
    process.exitCode = 1;
  } else {
    console.log("ok", msg);
  }
}

const hit = findVeto("please run kubectl delete pod checkout-api --all");
assert(hit && hit.atChar >= 0, "detects kubectl delete");
assert(hit && hit.dangerousSpan.toLowerCase().includes("kubectl delete"), "span captured");

const clean = findVeto("restore POOL_SIZE=50 and bounce checkout-api canary");
assert(clean === null, "allows pool restore");

const fixture = findVeto("rollback payments-core wholesale", ["rollback payments"]);
assert(fixture && fixture.atChar >= 0, "fixture span works");

if (process.exitCode) {
  console.error("veto tests failed");
  process.exit(1);
}
console.log("veto tests passed");
