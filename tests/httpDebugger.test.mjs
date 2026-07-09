import assert from "node:assert/strict";
import test from "node:test";
import { activePairs, buildRequestUrl, formatResponseBody, validateHttpDraft } from "../src/lib/httpDebugger.ts";

const row = (key, value, enabled = true) => ({ id: `${key}-${value}`, key, value, enabled });

test("encodes only enabled complete query rows", () => {
  const url = buildRequestUrl("https://example.test/api?existing=1", [row("q", "a b"), row("", "x"), row("off", "x", false)]);
  assert.equal(url, "https://example.test/api?existing=1&q=a+b");
});

test("filters disabled and blank key-value rows", () => {
  assert.deepEqual(activePairs([row("A", "1"), row("", "2"), row("B", "3", false)]), [{ key: "A", value: "1" }]);
  assert.deepEqual(activePairs([row("  Trimmed  ", "  preserved  "), row("   ", "x")]), [{ key: "Trimmed", value: "  preserved  " }]);
});

test("rejects unsupported URLs and invalid JSON", () => {
  assert.equal(validateHttpDraft({ url: "file:///tmp/a", bodyMode: "none", bodyText: "", timeoutMs: 30000 }).url, "unsupported_scheme");
  assert.equal(validateHttpDraft({ url: "   ", bodyMode: "none", bodyText: "", timeoutMs: 30000 }).url, "required");
  assert.equal(validateHttpDraft({ url: "not a URL", bodyMode: "none", bodyText: "", timeoutMs: 30000 }).url, "invalid_url");
  assert.equal(validateHttpDraft({ url: "https://x.test", bodyMode: "json", bodyText: "{", timeoutMs: 30000 }).body, "invalid_json");
  assert.equal(validateHttpDraft({ url: "https://x.test", bodyMode: "none", bodyText: "", timeoutMs: 999 }).timeout, "out_of_range");
  assert.equal(validateHttpDraft({ url: "https://x.test", bodyMode: "none", bodyText: "", timeoutMs: 120001 }).timeout, "out_of_range");
  assert.equal(validateHttpDraft({ url: "https://x.test", bodyMode: "none", bodyText: "", timeoutMs: Number.NaN }).timeout, "out_of_range");
  assert.equal(validateHttpDraft({ url: "https://x.test", bodyMode: "none", bodyText: "", timeoutMs: 1000 }).timeout, undefined);
  assert.equal(validateHttpDraft({ url: "https://x.test", bodyMode: "none", bodyText: "", timeoutMs: 120000 }).timeout, undefined);

  const jsonDraft = { url: "https://x.test", bodyMode: "json", bodyText: "{}", timeoutMs: 30000 };
  assert.equal(validateHttpDraft({ ...jsonDraft, headers: [row("Content-Type", "text/plain")] }).body, "incompatible_content_type");
  assert.equal(validateHttpDraft({ ...jsonDraft, headers: [row(" content-type ", "Application/Problem+JSON; charset=utf-8")] }).body, undefined);
  assert.equal(validateHttpDraft({ ...jsonDraft, headers: [row("Content-Type", "text/plain", false)] }).body, undefined);

  const formDraft = { url: "https://x.test", bodyMode: "form", bodyText: "", timeoutMs: 30000 };
  assert.equal(validateHttpDraft({ ...formDraft, headers: [row("Content-Type", "application/x-www-form-urlencoded; charset=UTF-8")] }).body, undefined);
  assert.equal(validateHttpDraft({ ...formDraft, headers: [row("Content-Type", "application/json")] }).body, "incompatible_content_type");

  const textDraft = { url: "https://x.test", bodyMode: "text", bodyText: "hello", timeoutMs: 30000 };
  assert.equal(validateHttpDraft({ ...textDraft, headers: [row("Content-Type", "Text/Plain; charset=utf-8")] }).body, undefined);
  assert.equal(validateHttpDraft({ ...textDraft, headers: [row("Content-Type", "application/octet-stream")] }).body, "incompatible_content_type");
  assert.equal(validateHttpDraft({ url: "https://x.test", bodyMode: "none", bodyText: "", timeoutMs: 30000, headers: [row("Content-Type", "application/octet-stream")] }).body, undefined);
});

test("formats valid JSON but preserves invalid JSON text", () => {
  assert.deepEqual(formatResponseBody('{"a":1}', "application/json"), {
    text: '{\n  "a": 1\n}',
    jsonFormatted: true,
    parseWarning: false,
  });
  assert.deepEqual(formatResponseBody("{", "application/json"), {
    text: "{",
    jsonFormatted: false,
    parseWarning: true,
  });
  assert.deepEqual(formatResponseBody('{"a":1}', "Application/Problem+JSON; charset=utf-8"), {
    text: '{\n  "a": 1\n}',
    jsonFormatted: true,
    parseWarning: false,
  });
  assert.deepEqual(formatResponseBody("plain text", "text/plain"), {
    text: "plain text",
    jsonFormatted: false,
    parseWarning: false,
  });
});
