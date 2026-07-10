import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("registers native file-search commands", async () => {
  const [lib, commands] = await Promise.all([
    read("../src-tauri/src/lib.rs"),
    read("../src-tauri/src/commands/mod.rs"),
  ]);
  assert.match(commands, /pub mod search;/);
  for (const command of ["get_file_search_status", "search_local_files", "open_search_result"]) {
    assert.match(lib, new RegExp(`\\b${command}\\b`));
  }
});

test("configures the standalone command palette window and permissions", async () => {
  const config = JSON.parse(await read("../src-tauri/tauri.conf.json"));
  const capability = JSON.parse(await read("../src-tauri/capabilities/default.json"));
  const palette = config.app.windows.find((window) => window.label === "command-palette");
  assert.ok(palette);
  assert.equal(palette.url, "#/command-palette");
  assert.equal(palette.visible, false);
  assert.equal(palette.width, 720);
  assert.equal(palette.height, 520);
  assert.equal(palette.decorations, false);
  assert.equal(palette.alwaysOnTop, true);
  assert.equal(palette.skipTaskbar, true);
  assert.ok(capability.windows.includes("command-palette"));
  assert.match(JSON.stringify(capability), /https:\/\/www\.voidtools\.com\/downloads\//);
});

test("routes shortcuts and palette UI events", async () => {
  const [hotkey, app, lib] = await Promise.all([
    read("../src-tauri/src/core/hotkey.rs"),
    read("../src/App.tsx"),
    read("../src-tauri/src/lib.rs"),
  ]);
  assert.match(hotkey, /toggle_command_palette/);
  assert.match(hotkey, /command-palette-focus/);
  assert.match(app, /"\/command-palette"/);
  assert.match(app, /getCurrentWindow\(\)\.label\s*===\s*"command-palette"/);
  assert.match(app, /navigate-to-tool/);
  assert.match(
    lib,
    /window\.label\(\)\s*==\s*"command-palette"[\s\S]*?window\.hide\(\)[\s\S]*?api\.prevent_close\(\)/,
  );
});

test("palette searches files and supports full keyboard control", async () => {
  const page = await read("../src/pages/CommandPalette.tsx");
  assert.match(page, /command-palette-focus/);
  assert.match(page, /search_local_files/);
  assert.match(page, /onFocusChanged/);
  assert.match(
    page,
    /onFocusChanged\([\s\S]*?focused[\s\S]*?if \(!focused\)[\s\S]*?\.hide\(\)/,
  );
  assert.match(page, /focusUnlisten\.then\(\(dispose\) => dispose\(\)\)/);
  for (const key of ["ArrowUp", "ArrowDown", "Enter", "Escape"]) {
    assert.match(page, new RegExp(key));
  }
  assert.match(page, /https:\/\/www\.voidtools\.com\/downloads\//);
});
