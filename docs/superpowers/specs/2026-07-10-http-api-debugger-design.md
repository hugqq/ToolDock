# HTTP API Debugger Design

## Goal

Add a local-first developer tool for composing HTTP requests, inspecting responses, keeping safe request history, and copying the current request as cURL.

## Scope

The first version supports:

- GET, POST, PUT, PATCH, DELETE, HEAD, and OPTIONS.
- URL query parameters and request headers.
- No body, JSON, `application/x-www-form-urlencoded`, and raw text body modes.
- Status, response headers, response body, response size, content type, and elapsed time.
- Automatic formatting for JSON responses.
- A local request history with replay and deletion.
- Copying the current request as a platform-appropriate cURL command.

The first version does not include multipart file upload, WebSocket, GraphQL-specific tooling, collection sharing, environment-variable substitution, client certificates, proxy configuration, cloud synchronization, or disabled TLS verification.

## User Interface

The tool is registered in the Developer category and uses the existing `ToolLayout` shell.

The page has three focused areas:

1. A request bar with method, URL, Send, and Copy as cURL.
2. Request tabs for Params, Headers, and Body.
3. A response panel with Body and Headers tabs, plus status, duration, and size summary.

A collapsible history rail lists the newest requests first using method, host, path, response status, elapsed time, and timestamp. Selecting an entry restores its persisted safe fields into the editor. Individual entries and the complete history can be deleted after confirmation.

Key-value editors use stable row identifiers and always keep one empty row available. Disabled or incomplete rows are omitted from the outgoing request. Sending is disabled until the URL is a valid `http` or `https` URL.

## Request Contract

The frontend sends a typed request to Rust:

```ts
type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "HEAD" | "OPTIONS";
type HttpBodyMode = "none" | "json" | "form" | "text";

interface HttpKeyValue {
  id: string;
  enabled: boolean;
  key: string;
  value: string;
}

interface HttpDebugRequest {
  method: HttpMethod;
  url: string;
  query: HttpKeyValue[];
  headers: HttpKeyValue[];
  bodyMode: HttpBodyMode;
  bodyText: string;
  formFields: HttpKeyValue[];
  timeoutMs: number;
}
```

The default timeout is 30 seconds and the accepted range is 1 to 120 seconds. Redirects are enabled with a maximum of ten hops. TLS certificate verification always remains enabled.

JSON bodies must parse before sending. Form fields are encoded as `application/x-www-form-urlencoded`. A user-supplied `Content-Type` header takes precedence only when it is compatible with the selected body mode; incompatible values are reported before sending rather than silently changed.

## Rust HTTP Boundary

The `http_client` core module owns request validation, `reqwest` client creation, body encoding, elapsed-time measurement, response-size limiting, text decoding, and safe history projection. The Tauri command module only converts between `ApiResponse` and the core types.

The existing `reqwest` dependency sends requests outside the WebView, so browser CORS restrictions do not apply. URL construction uses the `reqwest` and URL APIs; query strings and headers are never built through shell interpolation.

The response contract is:

```ts
interface HttpDebugResponse {
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
```

Response bodies are streamed with a five MiB display limit. If the server sends more data, ToolDock stops collecting display bytes, marks the response as truncated, and keeps the status and headers. UTF-8 and JSON-compatible bodies are shown as text; other bodies show a binary-response summary rather than lossy output.

## Response Presentation

JSON is formatted only when the response parses successfully. Invalid JSON remains visible as raw text with a small parse warning. Text and headers use copy actions. Binary and truncated responses clearly state why the full body is not shown.

HTTP error statuses such as 400 or 500 are valid responses and are displayed normally. Network, DNS, timeout, TLS, redirect-loop, invalid-header, and invalid-body failures are presented as request errors without inventing an HTTP status.

## Request History

History is stored in a dedicated `http_history` table in the existing application SQLite database. It keeps the newest 100 requests and automatically removes older entries. Response bodies are not persisted; only response status, duration, and timestamp are retained.

Sensitive header names are matched case-insensitively. At minimum, `Authorization`, `Proxy-Authorization`, `Cookie`, `X-API-Key`, and `Api-Key` values are replaced with `<redacted>` before persistence.

Structured bodies receive the same protection:

- JSON values whose key contains `password`, `passwd`, `token`, `secret`, `api_key`, `api-key`, `authorization`, or `cookie` are replaced recursively with `<redacted>`.
- Form fields using the same sensitive names are redacted.
- Raw text request bodies are not persisted because their structure cannot be classified safely.

History replay restores redacted values as empty fields so they must be entered again. The current in-memory request retains its real values. Copy as cURL uses the current request, not the redacted history projection. HTTP history is not included in ToolDock settings export.

## cURL Generation

cURL generation is a pure frontend utility so it can be tested independently and updates instantly. It includes method, fully encoded query parameters, enabled headers, and the active body. On Windows it emits `curl.exe` with PowerShell 7-safe quoting. On macOS it emits `curl` with POSIX-shell-safe quoting. The generated command is copied to the clipboard and never executed by ToolDock.

## Error Handling

- Invalid or unsupported URL: block Send and identify the URL field.
- Duplicate headers: preserve user order and let the HTTP library combine them according to protocol rules.
- Invalid header name or value: block the request with the affected row identified.
- Invalid JSON: block Send and show the parse location.
- Timeout: return a dedicated timeout error and keep the current editor state.
- TLS or DNS failure: show a concise category plus the underlying safe error message.
- Response over five MiB: show the collected prefix and a truncation warning.
- Database failure: still return the HTTP response; show that history could not be saved.

## Security and Privacy

All requests originate from the local desktop application. ToolDock does not upload history, telemetry, or response data elsewhere. TLS verification cannot be disabled in the first version. Secrets are removed before history persistence, response bodies are not stored, and generated cURL is copied only on explicit user action.

## Testing

Frontend unit tests cover query encoding, PowerShell and POSIX-shell cURL escaping, key-value filtering, JSON presentation, history replay with redacted fields, and request editor validation. Rust unit tests cover request validation, body encoding, sensitive-field redaction, history limits, response truncation, binary classification, and error mapping.

HTTP integration tests use a local test server to verify methods, query parameters, headers, JSON, form encoding, redirects, timeouts, HTTP error statuses, oversized responses, and malformed JSON responses. Database tests use a temporary SQLite file and verify ordering, the 100-entry cap, deletion, and absence of sensitive values.

Manual acceptance checks cover light and dark themes, Chinese and English labels, keyboard operation, copying cURL in PowerShell 7 and the macOS shell, replaying history, clearing history, and running requests that would be blocked by browser CORS.

## Acceptance Criteria

- Common HTTP methods and the specified body modes can be sent through Rust.
- Response status, headers, body, duration, size, truncation, and binary state are represented accurately.
- JSON responses are formatted without hiding invalid raw content.
- Request history is usable without persisting known sensitive values or response bodies.
- Copy as cURL represents the current request and produces quoting that is safe for the current platform's documented shell.
- Network failures do not clear the current request or create false HTTP responses.
