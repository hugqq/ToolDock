import assert from "node:assert/strict";
import test from "node:test";
import {
  buildCronExpression,
  createDefaultCronFieldStates,
  getCronTabs,
  parseCronExpression,
} from "../src/lib/cronExpression.ts";

test("builds a five-field cron expression by default", () => {
  const states = createDefaultCronFieldStates();

  const expression = buildCronExpression(states, false);

  assert.equal(expression, "* * * * ?");
  assert.equal(expression.split(/\s+/).length, 5);
  assert.deepEqual(getCronTabs(false), [
    "minutes",
    "hours",
    "days",
    "months",
    "weeks",
  ]);
});

test("builds a six-field cron expression when seconds are enabled", () => {
  const states = createDefaultCronFieldStates();

  const expression = buildCronExpression(states, true);

  assert.equal(expression, "0 * * * * ?");
  assert.equal(expression.split(/\s+/).length, 6);
  assert.deepEqual(getCronTabs(true), [
    "seconds",
    "minutes",
    "hours",
    "days",
    "months",
    "weeks",
  ]);
});

test("parses field count from five-field and six-field expressions", () => {
  const five = parseCronExpression("* * * * ?");
  const six = parseCronExpression("0 * * * * ?");
  const seven = parseCronExpression("0 * * * * ? *");

  assert.equal(five?.includeSeconds, false);
  assert.equal(six?.includeSeconds, true);
  assert.equal(seven, null);
});
