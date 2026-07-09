import assert from "node:assert/strict";
import test from "node:test";
import { isLatestRequest, moveSelection, rankToolMatches } from "../src/lib/commandPalette.ts";

const tools = [
  { id: "json", route: "/tools/json", name: "JSON Formatter", description: "Format JSON text" },
  { id: "dns", route: "/tools/dns", name: "DNS Helper", description: "Network diagnosis" },
  { id: "naming", route: "/tools/naming", name: "Variable Naming", description: "Generate JSON names" },
];

test("ranks exact and prefix tool names ahead of description matches", () => {
  assert.deepEqual(rankToolMatches(tools, "json", 5).map((tool) => tool.id), ["json", "naming"]);
});

test("wraps keyboard selection in both directions", () => {
  assert.equal(moveSelection(2, 1, 3), 0);
  assert.equal(moveSelection(0, -1, 3), 2);
  assert.equal(moveSelection(0, 1, 0), -1);
});

test("accepts only the newest file-search response", () => {
  assert.equal(isLatestRequest(7, 7), true);
  assert.equal(isLatestRequest(6, 7), false);
});
