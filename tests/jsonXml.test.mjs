import assert from "node:assert/strict";
import test from "node:test";
import { jsonToXml, xmlToJson } from "../src/lib/jsonXml.ts";

test("converts generated XML back to JSON", () => {
  const source = {
    project: "ToolDock",
    version: "1.0.0",
    active: true,
    author: {
      name: "hugqq",
      skills: ["Rust", "React", "TypeScript", "Tauri"],
    },
    test: '这是一个包含转义字符的字符串："Hello, World!" 和反斜杠 \\ 示例。',
  };

  const xml = jsonToXml(source);
  const json = xmlToJson(xml);

  assert.deepEqual(json, source);
});
