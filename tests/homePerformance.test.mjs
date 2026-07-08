import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const homeSource = readFileSync(new URL("../src/pages/Home.tsx", import.meta.url), "utf8");

test("home tool list avoids Framer Motion layout animations", () => {
  assert.equal(homeSource.includes("framer-motion"), false);
  assert.equal(/\blayout\b/.test(homeSource), false);
  assert.equal(homeSource.includes("<motion."), false);
  assert.equal(homeSource.includes("<AnimatePresence"), false);
});
