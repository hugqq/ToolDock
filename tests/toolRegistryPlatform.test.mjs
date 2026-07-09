import assert from "node:assert/strict";
import test from "node:test";
import { getVisibleTools } from "../src/lib/toolVisibility.ts";

const tools = [
  { id: "settings" },
  { id: "my_computer_namespace", supportedPlatforms: ["windows"] },
];

test("hides This PC icon cleaner on macOS", () => {
  const visibleTools = getVisibleTools(tools, "macos");

  assert.equal(
    visibleTools.some((tool) => tool.id === "my_computer_namespace"),
    false
  );
});

test("shows This PC icon cleaner on Windows", () => {
  const visibleTools = getVisibleTools(tools, "windows");

  assert.equal(
    visibleTools.some((tool) => tool.id === "my_computer_namespace"),
    true
  );
});
