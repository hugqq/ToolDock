import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("HTTP debugger is registered in the tool catalog and router", async () => {
  const [registry, app] = await Promise.all([
    read("../src/tools/registry.ts"),
    read("../src/App.tsx"),
  ]);

  assert.match(registry, /id:\s*"http_debugger"/);
  assert.match(registry, /route:\s*"\/tools\/http-debugger"/);
  assert.match(app, /path="\/tools\/http-debugger"/);
});

test("HTTP request command is exposed without history state", async () => {
  const source = await read("../src-tauri/src/lib.rs");

  assert.match(source, /\bsend_http_request\b/);
  assert.doesNotMatch(source, /HttpHistoryState|_http_history/);
});

test("HTTP debugger exposes multipart file selection", async () => {
  const [requestEditor, multipartEditor, page] = await Promise.all([
    read("../src/pages/http-debugger/RequestEditor.tsx"),
    read("../src/pages/http-debugger/MultipartEditor.tsx"),
    read("../src/pages/HttpDebugger.tsx"),
  ]);

  assert.match(requestEditor, /bodyMode === "multipart"/);
  assert.match(requestEditor, /<MultipartEditor/);
  assert.match(multipartEditor, /@tauri-apps\/plugin-dialog/);
  assert.match(multipartEditor, /filePath/);
  assert.doesNotMatch(page, /HistoryPanel|_http_history/);
});
