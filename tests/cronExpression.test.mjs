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

  const expression = buildCronExpression(states, 5);

  assert.equal(expression, "* * * * ?");
  assert.equal(expression.split(/\s+/).length, 5);
  assert.deepEqual(getCronTabs(5), [
    "minutes",
    "hours",
    "days",
    "months",
    "weeks",
  ]);
});

test("builds a six-field cron expression when seconds are enabled", () => {
  const states = createDefaultCronFieldStates();

  const expression = buildCronExpression(states, 6);

  assert.equal(expression, "0 * * * * ?");
  assert.equal(expression.split(/\s+/).length, 6);
  assert.deepEqual(getCronTabs(6), [
    "seconds",
    "minutes",
    "hours",
    "days",
    "months",
    "weeks",
  ]);
});

test("builds a seven-field cron expression when year is enabled", () => {
  const states = createDefaultCronFieldStates();

  const expression = buildCronExpression(states, 7);

  assert.equal(expression, "0 * * * * ? *");
  assert.equal(expression.split(/\s+/).length, 7);
  assert.deepEqual(getCronTabs(7), [
    "seconds",
    "minutes",
    "hours",
    "days",
    "months",
    "weeks",
    "years",
  ]);
});

test("parses field count from five-field, six-field, and seven-field expressions", () => {
  const five = parseCronExpression("* * * * ?");
  const six = parseCronExpression("0 * * * * ?");
  const seven = parseCronExpression("0 * * * * ? *");

  assert.equal(five?.fieldCount, 5);
  assert.equal(six?.fieldCount, 6);
  assert.equal(seven?.fieldCount, 7);
});
