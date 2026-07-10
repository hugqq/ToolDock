import assert from "node:assert/strict";
import test from "node:test";
import { buildShortcutFromKey } from "../src/lib/shortcut.ts";

test("normalizes Alt+Space for hotkey registration", () => {
  assert.equal(
    buildShortcutFromKey({ key: " ", code: "Space", altKey: true }),
    "Alt+Space"
  );
});

test("normalizes Ctrl+Space for hotkey registration", () => {
  assert.equal(
    buildShortcutFromKey({ key: " ", code: "Space", ctrlKey: true }),
    "Ctrl+Space"
  );
});

test("keeps existing shortcut formatting and ignores modifier-only input", () => {
  assert.equal(
    buildShortcutFromKey({
      key: "d",
      code: "KeyD",
      ctrlKey: true,
      shiftKey: true,
    }),
    "Ctrl+Shift+D"
  );
  assert.equal(
    buildShortcutFromKey({ key: "Alt", code: "AltLeft", altKey: true }),
    null
  );
});
