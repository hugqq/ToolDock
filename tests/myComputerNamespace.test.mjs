import assert from "node:assert/strict";
import test from "node:test";
import { isSuspiciousNamespaceIcon } from "../src/lib/myComputerNamespace.ts";

test("marks common rogue cloud drive icons as suspicious", () => {
  assert.equal(isSuspiciousNamespaceIcon("百度网盘"), true);
  assert.equal(isSuspiciousNamespaceIcon("双击运行夸克网盘"), true);
  assert.equal(isSuspiciousNamespaceIcon("Aliyun Drive"), true);
});

test("does not mark ordinary system labels as suspicious", () => {
  assert.equal(isSuspiciousNamespaceIcon("Downloads"), false);
  assert.equal(isSuspiciousNamespaceIcon("Documents"), false);
});
