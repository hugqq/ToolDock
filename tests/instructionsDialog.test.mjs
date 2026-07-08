import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(
  new URL("../src/components/shared/InstructionsDialog.tsx", import.meta.url),
  "utf8"
);

test("instructions dialog close button uses an explicit close handler", () => {
  assert.match(source, /const handleClose = \(\) => \{/);
  assert.match(source, /<button[\s\S]*type="button"[\s\S]*onClick=\{handleClose\}/);
});
