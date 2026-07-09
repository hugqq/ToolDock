# Global Search Palette Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current global-shortcut destination with a standalone palette that searches ToolDock tools plus Everything on Windows or Spotlight on macOS.

**Architecture:** A dedicated hidden Tauri window renders a focused React page. Frontend code ranks tools immediately and debounces a typed Rust command; Rust normalizes platform-specific providers behind one response model. Windows keeps the existing WinAPI shortcut manager and uses the MIT-licensed `everything-ipc` crate, while macOS uses the Tauri global-shortcut plugin and Foundation `NSMetadataQuery`.

**Tech Stack:** React 19, TypeScript 5.9, Tauri 2, Rust 2021, `everything-ipc` 0.1.4, `objc2-foundation` 0.3, Tauri global-shortcut plugin 2, Node test runner.

## Global Constraints

- Keep the existing saved shortcut string and Settings UI compatible.
- Windows file search requires Everything 1.4 or newer with IPC enabled.
- macOS file search uses `NSMetadataQuery` and respects Spotlight exclusions.
- Do not bundle Everything DLLs, invoke `es.exe`, build a ToolDock file index, or auto-install Everything.
- Tool search must remain usable when the file provider is unavailable.
- Search only file and directory names; do not add content search.
- Persist neither palette queries nor results.
- Keep all user-facing copy in both `zh-CN.json` and `en.json`.

---

## File Structure

- Create `src/lib/commandPalette.ts`: pure tool ranking and selection helpers.
- Create `src/pages/CommandPalette.tsx`: standalone palette UI and keyboard behavior.
- Create `src/types/search.ts`: shared frontend search contracts.
- Create `src-tauri/src/models/search.rs`: serialized Rust contracts.
- Create `src-tauri/src/core/file_search/mod.rs`: platform dispatch and shared normalization.
- Create `src-tauri/src/core/file_search/windows.rs`: Everything IPC adapter.
- Create `src-tauri/src/core/file_search/macos.rs`: Spotlight adapter.
- Create `src-tauri/src/core/file_search/unsupported.rs`: explicit unsupported-platform response.
- Create `src-tauri/src/commands/search.rs`: Tauri search, status, and open commands.
- Modify `src/App.tsx`: standalone route and main-window navigation event.
- Modify `src-tauri/src/core/hotkey.rs`: toggle palette on Windows and register on macOS.
- Modify `src-tauri/src/core/settings.rs`: persist the shortcut on macOS.
- Modify `src-tauri/src/commands/settings.rs`: pass `AppHandle` to cross-platform persistence.
- Modify `src-tauri/src/lib.rs`: plugin setup, state, commands, and navigation events.
- Modify `src-tauri/tauri.conf.json`: configure the hidden palette window.
- Modify `src-tauri/capabilities/default.json`: authorize the new window and official download URL.
- Modify both locale files and README files.
- Create `tests/commandPalette.test.mjs` and `tests/commandPaletteIntegration.test.mjs`.

### Task 1: Pure Tool Ranking and Keyboard Selection

**Files:**
- Create: `src/lib/commandPalette.ts`
- Create: `src/types/search.ts`
- Test: `tests/commandPalette.test.mjs`

**Interfaces:**
- Consumes: tool identifiers, translated names/descriptions, a query, and result counts.
- Produces: `rankToolMatches(candidates, query, limit)`, `moveSelection(index, direction, count)`, and `isLatestRequest(responseId, activeId)`.

- [ ] **Step 1: Write the failing test**

```js
import assert from "node:assert/strict";
import test from "node:test";
import { isLatestRequest, moveSelection, rankToolMatches } from "../src/lib/commandPalette.ts";

const tools = [
  { id: "json", route: "/tools/json", name: "JSON Formatter", description: "Format JSON text" },
  { id: "dns", route: "/tools/dns", name: "DNS Helper", description: "Network diagnosis" },
  { id: "naming", route: "/tools/naming", name: "Variable Naming", description: "Generate JSON names" },
];

test("ranks exact and prefix tool names ahead of description matches", () => {
  assert.deepEqual(rankToolMatches(tools, "json", 5).map((tool) => tool.id), ["json", "naming"]);
});

test("wraps keyboard selection in both directions", () => {
  assert.equal(moveSelection(2, 1, 3), 0);
  assert.equal(moveSelection(0, -1, 3), 2);
  assert.equal(moveSelection(0, 1, 0), -1);
});

test("accepts only the newest file-search response", () => {
  assert.equal(isLatestRequest(7, 7), true);
  assert.equal(isLatestRequest(6, 7), false);
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run in PowerShell 7:

```powershell
node --experimental-strip-types --test tests/commandPalette.test.mjs
```

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `src/lib/commandPalette.ts`.

- [ ] **Step 3: Implement the pure helpers and contracts**

```ts
// src/types/search.ts
export type SearchResultKind = "file" | "directory";

export interface FileSearchResult {
  kind: SearchResultKind;
  name: string;
  path: string;
  modifiedAt?: number;
  size?: number;
}

export interface FileSearchResponse {
  provider: "everything" | "spotlight" | "unsupported";
  available: boolean;
  results: FileSearchResult[];
  errorCode?: "provider_unavailable" | "query_failed" | "unsupported_platform";
}

export interface ToolSearchCandidate {
  id: string;
  route: string;
  name: string;
  description: string;
}
```

```ts
// src/lib/commandPalette.ts
import type { ToolSearchCandidate } from "../types/search";

export function rankToolMatches(
  candidates: ToolSearchCandidate[],
  query: string,
  limit = 5,
): ToolSearchCandidate[] {
  const needle = query.trim().toLocaleLowerCase();
  if (!needle) return candidates.slice(0, limit);

  return candidates
    .map((candidate, index) => {
      const name = candidate.name.toLocaleLowerCase();
      const description = candidate.description.toLocaleLowerCase();
      const score = name === needle ? 0 : name.startsWith(needle) ? 1 : name.includes(needle) ? 2 : description.includes(needle) ? 3 : -1;
      return { candidate, index, score };
    })
    .filter((entry) => entry.score >= 0)
    .sort((a, b) => a.score - b.score || a.index - b.index)
    .slice(0, limit)
    .map((entry) => entry.candidate);
}

export function moveSelection(index: number, direction: -1 | 1, count: number): number {
  if (count <= 0) return -1;
  return (index + direction + count) % count;
}

export function isLatestRequest(responseId: number, activeId: number): boolean {
  return responseId === activeId;
}
```

- [ ] **Step 4: Re-run and verify GREEN**

Run: `node --experimental-strip-types --test tests/commandPalette.test.mjs`

Expected: 3 tests pass.

- [ ] **Step 5: Commit**

```powershell
git add src/lib/commandPalette.ts src/types/search.ts tests/commandPalette.test.mjs
git commit -m "feat: add command palette search helpers"
```

### Task 2: Rust Search Contracts and Platform Boundary

**Files:**
- Create: `src-tauri/src/models/search.rs`
- Create: `src-tauri/src/core/file_search/mod.rs`
- Create: `src-tauri/src/core/file_search/unsupported.rs`
- Modify: `src-tauri/src/models/mod.rs`
- Modify: `src-tauri/src/core/mod.rs`

**Interfaces:**
- Produces: `FileSearchResult`, `FileSearchResponse`, `provider_status()`, and `search_files(query, limit)`.

- [ ] **Step 1: Add failing Rust tests to `core/file_search/mod.rs`**

```rust
#[cfg(test)]
mod tests {
    use super::{normalize_limit, validate_query};

    #[test]
    fn rejects_blank_queries() {
        assert_eq!(validate_query("   ").unwrap_err(), "EMPTY_QUERY");
    }

    #[test]
    fn clamps_limits_to_safe_range() {
        assert_eq!(normalize_limit(0), 1);
        assert_eq!(normalize_limit(50), 50);
        assert_eq!(normalize_limit(500), 100);
    }
}
```

- [ ] **Step 2: Run the focused Rust test and verify RED**

Run:

```powershell
cargo test --manifest-path src-tauri/Cargo.toml file_search
```

Expected: FAIL because the module and functions do not exist.

- [ ] **Step 3: Add models, validation, and dispatch**

```rust
// src-tauri/src/models/search.rs
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct FileSearchResult {
    pub kind: String,
    pub name: String,
    pub path: String,
    pub modified_at: Option<i64>,
    pub size: Option<u64>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct FileSearchResponse {
    pub provider: String,
    pub available: bool,
    pub results: Vec<FileSearchResult>,
    pub error_code: Option<String>,
}
```

```rust
// src-tauri/src/core/file_search/mod.rs
use crate::errors::AppError;
use crate::models::search::FileSearchResponse;

#[cfg(target_os = "windows")]
mod windows;
#[cfg(target_os = "macos")]
mod macos;
#[cfg(not(any(target_os = "windows", target_os = "macos")))]
mod unsupported;

pub fn validate_query(query: &str) -> Result<&str, &'static str> {
    let query = query.trim();
    if query.is_empty() { Err("EMPTY_QUERY") } else { Ok(query) }
}

pub fn normalize_limit(limit: usize) -> usize { limit.clamp(1, 100) }

pub async fn provider_status() -> FileSearchResponse {
    platform::provider_status().await
}

pub async fn search_files(query: String, limit: usize) -> Result<FileSearchResponse, AppError> {
    let query = validate_query(&query).map_err(|code| AppError::Internal(code.into()))?;
    platform::search(query, normalize_limit(limit)).await
}

#[cfg(target_os = "windows")]
use windows as platform;
#[cfg(target_os = "macos")]
use macos as platform;
#[cfg(not(any(target_os = "windows", target_os = "macos")))]
use unsupported as platform;
```

`unsupported.rs` returns provider `unsupported`, `available: false`, no results, and `unsupported_platform`.

- [ ] **Step 4: Export modules and verify GREEN**

Add `pub mod search;` to `models/mod.rs` and `pub mod file_search;` to `core/mod.rs`.

Run: `cargo test --manifest-path src-tauri/Cargo.toml file_search`

Expected: 2 tests pass.

- [ ] **Step 5: Commit**

```powershell
git add src-tauri/src/models/search.rs src-tauri/src/models/mod.rs src-tauri/src/core/file_search src-tauri/src/core/mod.rs
git commit -m "feat: define file search provider boundary"
```

### Task 3: Windows Everything IPC Provider

**Files:**
- Modify: `src-tauri/Cargo.toml`
- Create: `src-tauri/src/core/file_search/windows.rs`

**Interfaces:**
- Consumes: `everything_ipc::wm::{EverythingClient, RequestFlags, Sort}`.
- Produces: provider `everything` responses normalized to `FileSearchResult`.

- [ ] **Step 1: Write mapping tests before the provider**

Create a private `normalize_item(name, parent, is_directory, size, modified_at)` function and tests asserting that `C:\Users` plus `notes.txt` becomes the full path, files keep size, and directories return `size: None`.

```rust
#[test]
fn joins_everything_name_and_parent_path() {
    let item = normalize_item("notes.txt", r"C:\Users\me", false, Some(42), Some(7));
    assert_eq!(item.path, r"C:\Users\me\notes.txt");
    assert_eq!(item.kind, "file");
    assert_eq!(item.size, Some(42));
}
```

- [ ] **Step 2: Verify RED**

Run: `cargo test --manifest-path src-tauri/Cargo.toml joins_everything`

Expected: FAIL because `windows.rs` and `normalize_item` do not exist.

- [ ] **Step 3: Add the Windows-only dependency and provider**

Add under `[target.'cfg(windows)'.dependencies]`:

```toml
everything-ipc = "0.1.4"
```

The provider creates `EverythingClient::new()`, runs `query_wait(query)` inside `tauri::async_runtime::spawn_blocking`, requests `FileName | Path | Size | DateModified`, sorts by name, and limits results. Map `EverythingClient::new()` failure to `provider_unavailable`; map query failure to `query_failed`. Use `item.is_folder()` for kind, `get_string(FileName)`, `get_string(Path)`, `get_size(Size)`, and the date-modified accessor exposed by the crate.

- [ ] **Step 4: Verify GREEN**

Run: `cargo test --manifest-path src-tauri/Cargo.toml file_search::windows`

Expected: mapping tests pass without requiring Everything to be running.

- [ ] **Step 5: Commit**

```powershell
git add src-tauri/Cargo.toml src-tauri/Cargo.lock src-tauri/src/core/file_search/windows.rs
git commit -m "feat: search files through Everything IPC"
```

### Task 4: macOS Spotlight Provider

**Files:**
- Modify: `src-tauri/Cargo.toml`
- Create: `src-tauri/src/core/file_search/macos.rs`

**Interfaces:**
- Consumes: Foundation `NSMetadataQuery`, `NSPredicate`, `NSRunLoop`, and metadata attributes.
- Produces: provider `spotlight` responses matching the shared Rust model.

- [ ] **Step 1: Add pure metadata-normalization tests**

Test `normalize_metadata(path, display_name, content_type, size, modified_at)` with a directory and a file. The helper must be platform-independent inside the macOS module and must not require a live Spotlight index.

- [ ] **Step 2: Verify RED**

Run on macOS PowerShell 7 or a macOS CI runner:

```powershell
cargo test --manifest-path src-tauri/Cargo.toml file_search::macos
```

Expected: FAIL because the Spotlight adapter is absent.

- [ ] **Step 3: Add target-specific Objective-C dependencies**

```toml
[target.'cfg(target_os = "macos")'.dependencies]
objc2 = "0.6"
objc2-foundation = { version = "0.3", features = ["NSArray", "NSDate", "NSMetadata", "NSPathUtilities", "NSPredicate", "NSRunLoop", "NSString", "NSURL"] }
tauri-plugin-global-shortcut = "2"
```

- [ ] **Step 4: Implement the Spotlight lifecycle**

Create the query on a dedicated thread with an autorelease pool. Set a predicate built from `kMDItemFSName ==[cd] '*<escaped query>*'`, set `NSMetadataQueryLocalComputerScope`, call `startQuery`, and drive the current run loop until gathering finishes or two seconds elapse. Read path, display name, content type, size, and modified date attributes, stop the query, truncate to the requested limit, and return normalized results. Convert unavailable indexing or timeout into the documented provider errors.

- [ ] **Step 5: Verify GREEN on macOS and commit**

Run: `cargo test --manifest-path src-tauri/Cargo.toml file_search::macos`

Expected: normalization and bounded-lifecycle tests pass.

```powershell
git add src-tauri/Cargo.toml src-tauri/Cargo.lock src-tauri/src/core/file_search/macos.rs
git commit -m "feat: search files through macOS Spotlight"
```

### Task 5: Tauri Search Commands and File Opening

**Files:**
- Create: `src-tauri/src/commands/search.rs`
- Modify: `src-tauri/src/commands/mod.rs`
- Modify: `src-tauri/src/lib.rs`

**Interfaces:**
- Produces commands `get_file_search_status`, `search_local_files`, and `open_search_result`.

- [ ] **Step 1: Add command-registration source test**

Extend `tests/commandPaletteIntegration.test.mjs` to assert the three command names appear in `lib.rs` and that `commands/mod.rs` exports `search`.

- [ ] **Step 2: Verify RED**

Run: `node --test tests/commandPaletteIntegration.test.mjs`

Expected: FAIL because the commands are not registered.

- [ ] **Step 3: Implement thin commands**

`get_file_search_status` returns `ApiResponse<FileSearchResponse>`. `search_local_files(query, limit)` delegates to `core::file_search::search_files`. `open_search_result(app, path)` checks `Path::exists()` and calls `app.opener().open_path(path, None::<&str>)`; it rejects missing paths as `SEARCH_RESULT_MISSING` and never uses a shell.

- [ ] **Step 4: Register and verify GREEN**

Export the command module and add all three functions to `generate_handler!`.

Run: `node --test tests/commandPaletteIntegration.test.mjs`

Expected: command-registration assertions pass.

- [ ] **Step 5: Commit**

```powershell
git add src-tauri/src/commands/search.rs src-tauri/src/commands/mod.rs src-tauri/src/lib.rs tests/commandPaletteIntegration.test.mjs
git commit -m "feat: expose local file search commands"
```

### Task 6: Standalone Window and Shortcut Routing

**Files:**
- Modify: `src-tauri/tauri.conf.json`
- Modify: `src-tauri/capabilities/default.json`
- Modify: `src-tauri/src/core/hotkey.rs`
- Modify: `src-tauri/src/core/settings.rs`
- Modify: `src-tauri/src/commands/settings.rs`
- Modify: `src-tauri/src/lib.rs`
- Test: `tests/commandPaletteIntegration.test.mjs`

**Interfaces:**
- Produces: window label `command-palette`, event `command-palette-focus`, and helper `toggle_command_palette(&AppHandle)`.

- [ ] **Step 1: Add failing configuration assertions**

Assert `tauri.conf.json` contains a hidden 720x520 `command-palette` window with URL `index.html#/command-palette`, no decorations, `alwaysOnTop: true`, and `skipTaskbar: true`. Assert the capability includes `command-palette` and the official `https://www.voidtools.com/downloads/` URL.

- [ ] **Step 2: Verify RED**

Run: `node --test tests/commandPaletteIntegration.test.mjs`

Expected: FAIL on the missing window.

- [ ] **Step 3: Configure the window and shared toggle**

Add the exact window entry and capability. Implement `toggle_command_palette` so a visible palette is hidden; otherwise it is shown, unminimized, focused, centered, and sent `command-palette-focus`. The Windows `WM_HOTKEY` path calls this helper instead of showing `main`.

- [ ] **Step 4: Add macOS shortcut registration and persistence**

Initialize `tauri-plugin-global-shortcut` only on macOS with a handler that calls the same toggle helper. Extend the non-Windows `HotkeyManager` implementation to register and unregister through `GlobalShortcutExt`. Change shortcut persistence helpers to accept `&AppHandle`; keep the Windows registry implementation and store macOS's string in `app_config_dir()/global-shortcut.txt`. Update setup and Settings commands to pass the app handle.

- [ ] **Step 5: Verify GREEN and commit**

Run: `node --test tests/commandPaletteIntegration.test.mjs`

Expected: window, capability, and routing assertions pass.

```powershell
git add src-tauri/tauri.conf.json src-tauri/capabilities/default.json src-tauri/src/core/hotkey.rs src-tauri/src/core/settings.rs src-tauri/src/commands/settings.rs src-tauri/src/lib.rs tests/commandPaletteIntegration.test.mjs
git commit -m "feat: route global shortcut to search palette"
```

### Task 7: Command Palette React Page

**Files:**
- Create: `src/pages/CommandPalette.tsx`
- Modify: `src/App.tsx`
- Modify: `src/i18n/locales/zh-CN.json`
- Modify: `src/i18n/locales/en.json`
- Test: `tests/commandPaletteIntegration.test.mjs`

**Interfaces:**
- Consumes: `TOOLS`, ranking helpers, `invokeWrapper`, `command-palette-focus`, and `navigate-to-tool`.
- Produces: standalone route `/command-palette` and main-window navigation handling.

- [ ] **Step 1: Add failing UI/source assertions**

Assert the page listens for `command-palette-focus`, invokes `search_local_files`, handles ArrowUp/ArrowDown/Enter/Escape, renders separate tool/file groups, and offers retry plus the fixed Everything download URL. Assert `App.tsx` adds the standalone route and listens for `navigate-to-tool` in the main window.

- [ ] **Step 2: Verify RED**

Run: `node --test tests/commandPaletteIntegration.test.mjs`

Expected: FAIL because the page is missing.

- [ ] **Step 3: Implement state and data flow**

Use `useMemo` for translated tool candidates, `rankToolMatches` for immediate matches, a 150 ms effect timer for files, and an incrementing `useRef` request id. Flatten the two groups for selection while retaining grouped rendering. Empty input shows pinned tools and does not invoke Rust. Unavailable providers preserve tool results.

- [ ] **Step 4: Implement actions and routing**

For tools, emit `navigate-to-tool` to the main window, then hide the current window. For files, invoke `open_search_result` and hide only on success. Escape hides; blur hides unless a palette button is actively processing. The main route listener shows/focuses `main` and calls `navigate(route)`.

- [ ] **Step 5: Add complete Chinese and English copy**

Add labels for the input placeholder, Tools, Files, provider unavailable, Spotlight indexing, install Everything, retry, loading, no results, missing item, and keyboard hints.

- [ ] **Step 6: Verify GREEN and commit**

Run: `node --experimental-strip-types --test tests/commandPalette.test.mjs tests/commandPaletteIntegration.test.mjs`

Expected: all palette frontend tests pass.

```powershell
git add src/pages/CommandPalette.tsx src/App.tsx src/i18n/locales/zh-CN.json src/i18n/locales/en.json tests/commandPaletteIntegration.test.mjs
git commit -m "feat: add global search palette interface"
```

### Task 8: Documentation and Final Verification

**Files:**
- Modify: `README_zh.md`
- Modify: `README.md`

- [ ] **Step 1: Document requirements and behavior**

State that Windows file search requires a running non-Lite Everything instance with IPC, macOS uses Spotlight, unavailable providers do not affect tool search, and the global shortcut now opens the palette.

- [ ] **Step 2: Run focused automated verification**

```powershell
node --experimental-strip-types --test tests/commandPalette.test.mjs tests/commandPaletteIntegration.test.mjs
cargo test --manifest-path src-tauri/Cargo.toml file_search
```

Expected: all focused tests pass.

- [ ] **Step 3: Run repository-wide tests**

```powershell
node --experimental-strip-types --test tests/*.test.mjs
cargo test --manifest-path src-tauri/Cargo.toml
```

Expected: all tests pass with no new warnings attributable to this feature.

- [ ] **Step 4: Commit**

```powershell
git add README.md README_zh.md
git commit -m "docs: document global search palette"
```
