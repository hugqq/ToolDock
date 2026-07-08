import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const settingsSource = readFileSync(
  new URL("../src/pages/Settings.tsx", import.meta.url),
  "utf8"
);
const storeSource = readFileSync(
  new URL("../src/stores/useSettingsStore.ts", import.meta.url),
  "utf8"
);
const zhLocale = JSON.parse(
  readFileSync(new URL("../src/i18n/locales/zh-CN.json", import.meta.url), "utf8")
);
const enLocale = JSON.parse(
  readFileSync(new URL("../src/i18n/locales/en.json", import.meta.url), "utf8")
);

test("settings page exposes developer logging controls", () => {
  assert.match(settingsSource, /id:\s*"developer"/);
  assert.match(settingsSource, /set_developer_log_level/);
  assert.match(settingsSource, /get_developer_logs/);
  assert.match(settingsSource, /developerLogLevel/);
});

test("developer settings persist enabled state and selected log level", () => {
  assert.match(storeSource, /developerSettingsEnabled:\s*boolean/);
  assert.match(storeSource, /developerLogLevel:\s*DeveloperLogLevel/);
  assert.match(storeSource, /setDeveloperSettingsEnabled/);
  assert.match(storeSource, /setDeveloperLogLevel/);
});

test("developer settings have Chinese and English labels", () => {
  assert.equal(zhLocale.tools.settings.developer_settings, "开发者设置");
  assert.equal(zhLocale.tools.settings.developer_logs, "日志查看");
  assert.equal(enLocale.tools.settings.developer_settings, "Developer Settings");
  assert.equal(enLocale.tools.settings.developer_logs, "Log Viewer");
});
