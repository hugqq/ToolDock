import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const settingsSource = readFileSync(
  new URL("../src/pages/Settings.tsx", import.meta.url),
  "utf8"
);
const zh = JSON.parse(
  readFileSync(new URL("../src/i18n/locales/zh-CN.json", import.meta.url), "utf8")
);
const en = JSON.parse(
  readFileSync(new URL("../src/i18n/locales/en.json", import.meta.url), "utf8")
);

test("settings exposes Alt+Space and Ctrl+Space presets", () => {
  assert.match(settingsSource, /Alt\+Space/);
  assert.match(settingsSource, /Ctrl\+Space/);
  assert.match(settingsSource, /buildShortcutFromKey/);
});

test("space shortcut presets have Chinese and English labels", () => {
  assert.equal(zh.tools.settings.shortcut_preset_alt_space, "Alt+空格");
  assert.equal(zh.tools.settings.shortcut_preset_ctrl_space, "Ctrl+空格");
  assert.equal(en.tools.settings.shortcut_preset_alt_space, "Alt+Space");
  assert.equal(en.tools.settings.shortcut_preset_ctrl_space, "Ctrl+Space");
});
