import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("uses a 32px window icon on Windows instead of upscaling the first 16px ICO frame", async () => {
  const lib = await readFile(new URL("../src-tauri/src/lib.rs", import.meta.url), "utf8");

  assert.match(
    lib,
    /#\[cfg\(target_os = "windows"\)\][\s\S]*?get_webview_window\("main"\)[\s\S]*?set_icon\(tauri::include_image!\("\.\/icons\/32x32\.png"\)\)/,
  );
});

test("sets the Windows taskbar large icon from a high-resolution source", async () => {
  const lib = await readFile(new URL("../src-tauri/src/lib.rs", import.meta.url), "utf8");

  assert.match(lib, /set_windows_taskbar_icon/);
  assert.match(lib, /include_image!\("\.\/icons\/64x64\.png"\)/);
  assert.match(lib, /WM_SETICON/);
  assert.match(lib, /ICON_BIG/);
});
