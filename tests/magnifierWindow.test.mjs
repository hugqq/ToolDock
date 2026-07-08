import assert from "node:assert/strict";
import test from "node:test";
import {
  MAGNIFIER_WINDOW_OPTIONS,
  waitForWindowCreated,
} from "../src/lib/magnifierWindow.ts";

test("magnifier window starts hidden and transparent without background color commands", () => {
  assert.equal(MAGNIFIER_WINDOW_OPTIONS.visible, false);
  assert.equal(MAGNIFIER_WINDOW_OPTIONS.transparent, true);
  assert.equal("backgroundColor" in MAGNIFIER_WINDOW_OPTIONS, false);
});

test("waits for the Tauri created event instead of a fixed delay", async () => {
  const events = [];
  const fakeWindow = {
    once(eventName, handler) {
      events.push(eventName);
      if (eventName === "tauri://created") {
        queueMicrotask(() => handler({ event: eventName, payload: null }));
      }
      return Promise.resolve(() => {});
    },
  };

  const result = await waitForWindowCreated(fakeWindow);

  assert.equal(result, fakeWindow);
  assert.deepEqual(events, ["tauri://created", "tauri://error"]);
});
