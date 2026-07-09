# HTTP API Debugger Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a local-first HTTP/API debugger with common methods, request composition, formatted responses, safe local history, and platform-appropriate cURL copying.

**Architecture:** Pure TypeScript utilities validate editor state and generate cURL. Rust validates and sends requests with the existing `reqwest` dependency, caps displayed response bodies, classifies failures, and stores redacted request history in the existing SQLite file. The React page is split into small request, response, and history components.

**Tech Stack:** React 19, TypeScript 5.9, Tauri 2, Rust 2021, reqwest 0.12, rusqlite 0.32, Node test runner, Tokio local test server.

## Global Constraints

- Support GET, POST, PUT, PATCH, DELETE, HEAD, and OPTIONS.
- Support none, JSON, URL-encoded form, and raw text bodies; do not add multipart upload.
- Accept only `http` and `https` URLs.
- Keep TLS certificate verification enabled and redirects limited to ten hops.
- Default timeout is 30 seconds; valid range is 1 to 120 seconds.
- Display at most five MiB of a response body.
- Persist at most 100 history entries and never persist response bodies.
- Redact documented sensitive headers and structured body keys before persistence.
- Never persist raw text request bodies.
- Generate `curl.exe` PowerShell 7 quoting on Windows and POSIX `curl` quoting on macOS.
- Keep all user-facing copy in both locale files.

---

## File Structure

- Create `src/types/httpDebugger.ts`: frontend request, response, history, and editor contracts.
- Create `src/lib/httpDebugger.ts`: URL construction, validation, formatting, and cURL generation.
- Create `src/pages/http-debugger/KeyValueEditor.tsx`: reusable Params/Headers/Form editor.
- Create `src/pages/http-debugger/RequestEditor.tsx`: request bar and tabs.
- Create `src/pages/http-debugger/ResponseViewer.tsx`: response summary and tabs.
- Create `src/pages/http-debugger/HistoryPanel.tsx`: replay and deletion UI.
- Create `src/pages/HttpDebugger.tsx`: orchestration and ToolLayout integration.
- Create `src-tauri/src/models/http_client.rs`: serialized request, response, and history DTOs.
- Create `src-tauri/src/core/http_client.rs`: validation, sending, redaction, and body collection.
- Create `src-tauri/src/core/http_history_db.rs`: SQLite schema and retention.
- Create `src-tauri/src/commands/http_client.rs`: Tauri commands and managed DB state.
- Modify module exports, `lib.rs`, `App.tsx`, registry, locales, and README files.
- Create `tests/httpDebugger.test.mjs` and `tests/httpDebuggerIntegration.test.mjs`.

### Task 1: Frontend Contracts, URL Building, and Validation

**Files:**
- Create: `src/types/httpDebugger.ts`
- Create: `src/lib/httpDebugger.ts`
- Test: `tests/httpDebugger.test.mjs`

**Interfaces:**
- Produces: `buildRequestUrl`, `activePairs`, `validateHttpDraft`, `formatResponseBody`, and the shared TypeScript contracts.

- [ ] **Step 1: Write the failing tests**

```js
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
});

test("rejects unsupported URLs and invalid JSON", () => {
  assert.equal(validateHttpDraft({ url: "file:///tmp/a", bodyMode: "none", bodyText: "", timeoutMs: 30000 }).url, "unsupported_scheme");
  assert.equal(validateHttpDraft({ url: "https://x.test", bodyMode: "json", bodyText: "{", timeoutMs: 30000 }).body, "invalid_json");
});

test("formats valid JSON but preserves invalid JSON text", () => {
  assert.equal(formatResponseBody('{"a":1}', "application/json").text, '{\n  "a": 1\n}');
  assert.equal(formatResponseBody("{", "application/json").text, "{");
});
```

- [ ] **Step 2: Run and verify RED**

Run: `node --experimental-strip-types --test tests/httpDebugger.test.mjs`

Expected: FAIL with `ERR_MODULE_NOT_FOUND`.

- [ ] **Step 3: Add exact frontend types**

```ts
export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "HEAD" | "OPTIONS";
export type HttpBodyMode = "none" | "json" | "form" | "text";

export interface HttpKeyValue {
  id: string;
  enabled: boolean;
  key: string;
  value: string;
}

export interface HttpDebugRequest {
  method: HttpMethod;
  url: string;
  query: HttpKeyValue[];
  headers: HttpKeyValue[];
  bodyMode: HttpBodyMode;
  bodyText: string;
  formFields: HttpKeyValue[];
  timeoutMs: number;
}

export interface HttpDebugResponse {
  status: number;
  reason: string;
  headers: Array<{ key: string; value: string }>;
  bodyText: string | null;
  contentType: string | null;
  sizeBytes: number;
  durationMs: number;
  truncated: boolean;
  binary: boolean;
}

export interface SendHttpResult {
  response: HttpDebugResponse;
  historySaved: boolean;
}

export interface HttpHistoryEntry {
  id: string;
  request: HttpDebugRequest;
  responseStatus: number;
  durationMs: number;
  createdAt: number;
}

export interface HttpDraftErrors {
  url?: "required" | "invalid_url" | "unsupported_scheme";
  body?: "invalid_json" | "incompatible_content_type";
  timeout?: "out_of_range";
}
```

- [ ] **Step 4: Implement pure helpers**

Use `new URL(baseUrl)`, `URLSearchParams.append`, and JSON parsing. `activePairs` trims keys but preserves values. `validateHttpDraft` checks scheme, timeout range, and JSON. `formatResponseBody` returns `{ text, jsonFormatted, parseWarning }` without discarding invalid raw data.

- [ ] **Step 5: Verify GREEN and commit**

Run: `node --experimental-strip-types --test tests/httpDebugger.test.mjs`

Expected: 4 tests pass.

```powershell
git add src/types/httpDebugger.ts src/lib/httpDebugger.ts tests/httpDebugger.test.mjs
git commit -m "feat: add HTTP debugger frontend helpers"
```

### Task 2: Platform-Aware cURL Generation

**Files:**
- Modify: `src/lib/httpDebugger.ts`
- Modify: `tests/httpDebugger.test.mjs`

**Interfaces:**
- Produces: `generateCurl(request, platform)` where platform is `windows` or `macos`.

- [ ] **Step 1: Add failing quoting tests**

```js
test("generates PowerShell-safe curl.exe with current secrets", () => {
  const command = generateCurl({
    method: "POST",
    url: "https://example.test/api",
    query: [],
    headers: [row("Authorization", "Bearer it's-secret")],
    bodyMode: "json",
    bodyText: '{"name":"O\'Brien"}',
    formFields: [],
    timeoutMs: 30000,
  }, "windows");
  assert.match(command, /^curl\.exe /);
  assert.match(command, /'Bearer it''s-secret'/);
});

test("generates POSIX curl quoting on macOS", () => {
  const command = generateCurl({ method: "GET", url: "https://example.test/a'b", query: [], headers: [], bodyMode: "none", bodyText: "", formFields: [], timeoutMs: 30000 }, "macos");
  assert.match(command, /^curl /);
  assert.match(command, /'\\''/);
});
```

- [ ] **Step 2: Verify RED**

Run: `node --experimental-strip-types --test tests/httpDebugger.test.mjs`

Expected: FAIL because `generateCurl` is missing.

- [ ] **Step 3: Implement quoting and generation**

PowerShell single-quoted values escape `'` as `''`; POSIX single-quoted values escape `'` as `'\''`. Include `--request`, URL with encoded query, one `--header` per enabled header, `--data-raw` for JSON/text, and `--data-urlencode` for enabled form fields. Do not execute the result.

- [ ] **Step 4: Verify GREEN and commit**

Run: `node --experimental-strip-types --test tests/httpDebugger.test.mjs`

Expected: all helper tests pass.

```powershell
git add src/lib/httpDebugger.ts tests/httpDebugger.test.mjs
git commit -m "feat: generate platform-safe curl commands"
```

### Task 3: Rust Request Models, Validation, and Redaction

**Files:**
- Create: `src-tauri/src/models/http_client.rs`
- Create: `src-tauri/src/core/http_client.rs`
- Modify: `src-tauri/src/models/mod.rs`
- Modify: `src-tauri/src/core/mod.rs`

**Interfaces:**
- Produces: Rust equivalents of all DTOs, `validate_request`, `build_history_projection`, and `is_sensitive_name`.

- [ ] **Step 1: Add failing unit tests**

Test timeout bounds, supported schemes, JSON validation, case-insensitive header redaction, recursive JSON key redaction, form redaction, and omission of raw text bodies.

```rust
#[test]
fn redacts_sensitive_headers_case_insensitively() {
    let headers = vec![pair("authorization", "Bearer secret"), pair("Accept", "application/json")];
    let safe = redact_headers(&headers);
    assert_eq!(safe[0].value, "<redacted>");
    assert_eq!(safe[1].value, "application/json");
}
```

- [ ] **Step 2: Verify RED**

Run: `cargo test --manifest-path src-tauri/Cargo.toml http_client`

Expected: FAIL because the module does not exist.

- [ ] **Step 3: Implement models and validation**

Use serde camelCase. Represent methods and body modes as enums with lowercase/body-compatible serde names. Validate URL through `reqwest::Url`, accept only HTTP(S), enforce 1,000..=120,000 milliseconds, parse JSON before send, and reject incompatible explicit content types.

- [ ] **Step 4: Implement safe history projection**

Match header and structured-body keys after lowercasing and removing `_` and `-`. Sensitive fragments are `password`, `passwd`, `token`, `secret`, `apikey`, `authorization`, and `cookie`. Recursively traverse JSON objects and arrays. Preserve non-sensitive JSON. Store no raw text body.

- [ ] **Step 5: Verify GREEN and commit**

Run: `cargo test --manifest-path src-tauri/Cargo.toml http_client`

Expected: all validation and redaction tests pass.

```powershell
git add src-tauri/src/models/http_client.rs src-tauri/src/models/mod.rs src-tauri/src/core/http_client.rs src-tauri/src/core/mod.rs
git commit -m "feat: validate and redact HTTP debugger requests"
```

### Task 4: HTTP Execution and Response Limiting

**Files:**
- Modify: `src-tauri/src/core/http_client.rs`

**Interfaces:**
- Produces: `execute_request(HttpDebugRequest) -> Result<HttpDebugResponse, HttpClientError>`.

- [ ] **Step 1: Add local-server integration tests**

Use `tokio::net::TcpListener::bind("127.0.0.1:0")` and a one-request server helper. Test method/query/header forwarding, JSON and form bodies, HTTP 500 as a valid response, a delayed timeout, invalid UTF-8 as binary, and a response larger than `5 * 1024 * 1024` as truncated.

- [ ] **Step 2: Verify RED**

Run: `cargo test --manifest-path src-tauri/Cargo.toml http_client::tests`

Expected: FAIL because execution is absent.

- [ ] **Step 3: Implement client and request building**

Build a `reqwest::Client` with ten redirects, the requested timeout, gzip support, and default certificate verification. Append query pairs through `RequestBuilder::query`, append headers with `HeaderName`/`HeaderValue`, and choose JSON, URL-encoded form, text, or empty body. Measure with `Instant`.

- [ ] **Step 4: Stream and classify response**

Collect at most `5 * 1024 * 1024` bytes while counting collected size. Mark truncated when another chunk exceeds the limit. Treat UTF-8, JSON, XML, HTML, JavaScript, and `text/*` as text only when decoding succeeds; otherwise set `binary: true` and `body_text: None`. Preserve all response headers, status, reason, content type, duration, and size.

- [ ] **Step 5: Map failures and verify GREEN**

Map timeout, DNS/connect, TLS, redirect, request-build, and body errors to stable error codes. Do not create fake HTTP statuses.

Run: `cargo test --manifest-path src-tauri/Cargo.toml http_client::tests`

Expected: all local-server tests pass.

- [ ] **Step 6: Commit**

```powershell
git add src-tauri/src/core/http_client.rs
git commit -m "feat: execute HTTP debugger requests"
```

### Task 5: SQLite Request History

**Files:**
- Create: `src-tauri/src/core/http_history_db.rs`
- Modify: `src-tauri/src/core/mod.rs`

**Interfaces:**
- Produces: `HttpHistoryDb::new`, `insert`, `list`, `delete`, and `clear`.

- [ ] **Step 1: Write temporary-database tests**

Use a temporary path under `std::env::temp_dir()` with a UUID filename. Verify newest-first order, JSON serialization round-trip, individual deletion, clear, the 100-entry cap, and that a known secret string does not occur in any stored column.

- [ ] **Step 2: Verify RED**

Run: `cargo test --manifest-path src-tauri/Cargo.toml http_history_db`

Expected: FAIL because the database module is missing.

- [ ] **Step 3: Implement schema and operations**

Create table `http_history` with `id`, `method`, `url`, `request_json`, `response_status`, `duration_ms`, and `created_at`. Insert the already-redacted projection in a transaction, then delete rows outside the newest 100 using `ORDER BY created_at DESC, rowid DESC`. Do not store response bodies.

- [ ] **Step 4: Verify GREEN and commit**

Run: `cargo test --manifest-path src-tauri/Cargo.toml http_history_db`

Expected: all history tests pass.

```powershell
git add src-tauri/src/core/http_history_db.rs src-tauri/src/core/mod.rs
git commit -m "feat: persist safe HTTP request history"
```

### Task 6: Tauri HTTP Commands and Managed State

**Files:**
- Create: `src-tauri/src/commands/http_client.rs`
- Modify: `src-tauri/src/commands/mod.rs`
- Modify: `src-tauri/src/lib.rs`
- Test: `tests/httpDebuggerIntegration.test.mjs`

**Interfaces:**
- Produces: `send_http_request`, `list_http_history`, `delete_http_history`, and `clear_http_history`.

- [ ] **Step 1: Add failing registration tests**

Read `lib.rs` and assert all four commands are in `generate_handler!`, `HttpHistoryState` is managed, and `commands/mod.rs` exports `http_client`.

- [ ] **Step 2: Verify RED**

Run: `node --test tests/httpDebuggerIntegration.test.mjs`

Expected: FAIL because commands are absent.

- [ ] **Step 3: Implement command behavior**

`send_http_request` validates and executes first, then attempts to save the redacted request plus response metadata. It returns `SendHttpResult { response, history_saved }`, so the real HTTP response is preserved even if history saving fails. The other commands initialize `HttpHistoryDb` lazily at `app_data_dir()/tooldock.db` and delegate list/delete/clear.

- [ ] **Step 4: Register state and commands**

Add `HttpHistoryState(Mutex<Option<HttpHistoryDb>>)` to managed state and all four commands to `generate_handler!`.

- [ ] **Step 5: Verify GREEN and commit**

Run: `node --test tests/httpDebuggerIntegration.test.mjs`

Expected: registration tests pass.

```powershell
git add src-tauri/src/commands/http_client.rs src-tauri/src/commands/mod.rs src-tauri/src/lib.rs tests/httpDebuggerIntegration.test.mjs
git commit -m "feat: expose HTTP debugger commands"
```

### Task 7: React Request, Response, and History Components

**Files:**
- Create: `src/pages/http-debugger/KeyValueEditor.tsx`
- Create: `src/pages/http-debugger/RequestEditor.tsx`
- Create: `src/pages/http-debugger/ResponseViewer.tsx`
- Create: `src/pages/http-debugger/HistoryPanel.tsx`
- Create: `src/pages/HttpDebugger.tsx`
- Modify: `tests/httpDebuggerIntegration.test.mjs`

**Interfaces:**
- Consumes: frontend helpers/types and four Tauri commands.
- Produces: a complete page with editable draft, response, and history state.

- [ ] **Step 1: Add failing component/source assertions**

Assert `HttpDebugger.tsx` uses `ToolLayout`, invokes `send_http_request`, preserves draft state on error, refreshes history only after a successful send, and exposes copy-as-cURL. Assert key-value rows have enabled/key/value controls and response rendering distinguishes binary, truncated, formatted JSON, and raw text.

- [ ] **Step 2: Verify RED**

Run: `node --test tests/httpDebuggerIntegration.test.mjs`

Expected: FAIL because components are absent.

- [ ] **Step 3: Implement `KeyValueEditor` and `RequestEditor`**

Keep stable UUID row IDs and one trailing empty row. Tabs are Params, Headers, and Body. Body mode controls show CodeMirror for JSON/text and the key-value editor for form. The request bar contains method, URL, timeout, Send, and Copy as cURL. Disable Send only for validation errors or an active request.

- [ ] **Step 4: Implement `ResponseViewer`**

Show status with success/error color, duration, size, and content type. Body and Headers tabs provide explicit copy buttons. Use `formatResponseBody`; show binary and truncation notices without discarding available metadata or valid collected text.

- [ ] **Step 5: Implement `HistoryPanel` and orchestration**

Load newest-first history on mount. Replay replaces the draft with safe persisted fields and leaves redacted values blank. Deletion and clear require the existing modal confirmation pattern. On request failure, retain draft and prior response while showing a concise toast. Read `SendHttpResult.historySaved`; if it is false, display `SendHttpResult.response` and a history warning.

- [ ] **Step 6: Verify GREEN and commit**

Run: `node --experimental-strip-types --test tests/httpDebugger.test.mjs tests/httpDebuggerIntegration.test.mjs`

Expected: all HTTP frontend/integration assertions pass.

```powershell
git add src/pages/http-debugger src/pages/HttpDebugger.tsx tests/httpDebuggerIntegration.test.mjs
git commit -m "feat: add HTTP debugger interface"
```

### Task 8: Route, Registry, Locales, and Documentation

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/tools/registry.ts`
- Modify: `src/i18n/locales/zh-CN.json`
- Modify: `src/i18n/locales/en.json`
- Modify: `README_zh.md`
- Modify: `README.md`
- Modify: `tests/httpDebuggerIntegration.test.mjs`

- [ ] **Step 1: Add failing integration assertions**

Assert lazy route `/tools/http-debugger`, registry id `http_debugger` in the Developer category, and required Chinese/English labels for request, response, history, methods, body modes, errors, redaction, truncation, and cURL.

- [ ] **Step 2: Verify RED**

Run: `node --test tests/httpDebuggerIntegration.test.mjs`

Expected: FAIL on route/registry/locales.

- [ ] **Step 3: Register the page and add complete copy**

Use a suitable Lucide network/request icon and existing registry conventions. Add all page labels and error messages in both locales. Update both README tool counts and Developer tool lists.

- [ ] **Step 4: Verify GREEN**

Run: `node --experimental-strip-types --test tests/httpDebugger.test.mjs tests/httpDebuggerIntegration.test.mjs`

Expected: all focused tests pass.

- [ ] **Step 5: Commit**

```powershell
git add src/App.tsx src/tools/registry.ts src/i18n/locales/zh-CN.json src/i18n/locales/en.json README.md README_zh.md tests/httpDebuggerIntegration.test.mjs
git commit -m "feat: register HTTP API debugger"
```

### Task 9: Final Verification

- [ ] **Step 1: Run focused tests**

```powershell
node --experimental-strip-types --test tests/httpDebugger.test.mjs tests/httpDebuggerIntegration.test.mjs
cargo test --manifest-path src-tauri/Cargo.toml http_client
cargo test --manifest-path src-tauri/Cargo.toml http_history_db
```

Expected: all focused tests pass.

- [ ] **Step 2: Run repository-wide tests**

```powershell
node --experimental-strip-types --test tests/*.test.mjs
cargo test --manifest-path src-tauri/Cargo.toml
```

Expected: all tests pass with no new warnings attributable to this feature.

- [ ] **Step 3: Perform desktop acceptance checks**

Start with `pnpm tauri dev` in PowerShell 7. Verify GET/POST, query/header forwarding, JSON/form/text bodies, a local CORS-blocked endpoint, timeout handling, HTTP 500 display, truncation, binary response, history replay/redaction/deletion, and cURL copying. Do not send secrets to a third-party endpoint; use a local test server.

- [ ] **Step 4: Record any platform limitation in the handoff**

If macOS was not available, state that macOS-specific cURL output and UI were code-tested but not manually run on macOS. Do not report them as manually verified.
