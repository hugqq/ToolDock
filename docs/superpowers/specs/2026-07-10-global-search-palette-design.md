# Global Search Palette Design

## Goal

Replace the current global-shortcut behavior with a compact standalone search palette that can search ToolDock tools and local files without first showing the main application window.

## Scope

The first version provides:

- A hidden, borderless `command-palette` Tauri window opened by the configured global shortcut.
- Immediate search across ToolDock's registered tools.
- File-name search through Everything IPC on Windows.
- File-name search through Spotlight `NSMetadataQuery` on macOS.
- Keyboard navigation with Up, Down, Enter, and Escape.
- Opening a tool in the main window or a file with the operating system's default application.
- A clear unavailable state when the platform search provider cannot be used.

The first version does not provide file-content search, ToolDock-owned disk indexing, automatic Everything installation, Linux file search, or advanced Everything query syntax documentation.

## Window and Interaction Design

The palette is a separate Tauri window rather than a page inside the main application shell.

- Label: `command-palette`.
- Initial state: hidden.
- Size: 720 by 520 logical pixels.
- Position: horizontally centered and placed near the upper third of the active screen.
- Appearance: borderless, always on top, hidden from the taskbar, and styled with the current ToolDock light or dark theme.
- Focus: the input is focused and selected whenever the global shortcut opens the palette.
- Toggle behavior: pressing the shortcut while the palette is visible hides it.
- Dismissal: Escape or loss of focus hides the palette and clears the transient query.

The search input occupies the top of the window. Results appear below it in two labelled groups: Tools and Files. At most five matching tools and fifty matching files are displayed. The first result is selected automatically. Up and Down move the selection, Enter opens it, and Escape closes the window.

Opening a tool hides the palette, shows and focuses the main window, then navigates to the tool's registered route. Opening a file hides the palette and asks the operating system to open the path with its default application. A failed open operation leaves the palette visible and displays a concise error.

## Frontend Components

`CommandPalette` owns the query, selected result, loading state, and provider status. It does not contain platform-specific logic.

Tool matching is performed synchronously against `TOOLS` from `src/tools/registry.ts`. Matching is case-insensitive and checks the translated tool name and description. Exact and prefix name matches sort ahead of description matches.

File matching starts after a 150 millisecond debounce. Every request carries a monotonically increasing request identifier. Results from an older request are ignored so a slow platform query cannot replace newer results.

The frontend consumes a shared result contract:

```ts
interface FileSearchResult {
  kind: "file" | "directory";
  name: string;
  path: string;
  modifiedAt?: number;
  size?: number;
}

interface FileSearchResponse {
  provider: "everything" | "spotlight";
  available: boolean;
  results: FileSearchResult[];
  errorCode?: "provider_unavailable" | "query_failed" | "unsupported_platform";
}
```

## Rust Search Boundary

The Tauri command layer exposes three operations:

- `get_file_search_status()` reports the current provider and availability.
- `search_local_files(query, limit)` returns normalized file results.
- `open_search_result(path)` opens a file or directory through the operating system.

Platform code implements a common internal `FileSearchProvider` boundary. The command layer selects the provider at compile time and never exposes platform-specific response shapes.

Global shortcut registration also remains behind a platform boundary. Windows reuses the existing WinAPI hotkey manager. macOS adds native global-shortcut registration while preserving the same saved shortcut string and settings UI. A shortcut registration failure is reported without preventing the palette from being opened from inside ToolDock.

### Windows: Everything IPC

The Windows provider uses the official Everything IPC protocol directly through Windows messages. It does not bundle `Everything.dll`, invoke `es.exe`, or maintain a second file index.

The provider first detects the Everything IPC window. Queries use the Unicode Query2 protocol, request full paths and basic metadata, limit results to the requested count, and run outside the UI thread. The provider supports Everything 1.4 or newer with IPC enabled.

If Everything is missing, stopped, or is the Lite build with IPC disabled, tool search remains functional. The Files group shows an Everything unavailable message with buttons to open the official download page and retry detection. ToolDock never downloads or installs Everything automatically and never falls back to a slow disk scan.

### macOS: Spotlight

The macOS provider uses Foundation's `NSMetadataQuery` with a local-computer search scope. The predicate matches `kMDItemFSName` case-insensitively, so behavior stays aligned with Everything's file-name search rather than becoming content search.

The adapter returns the initial result batch or a bounded timeout, then stops the query. It normalizes Spotlight URLs and metadata into `FileSearchResult`. Spotlight indexing exclusions and disabled indexing are respected. When Spotlight cannot answer, tool search remains available and the Files group explains that Spotlight indexing must be enabled.

## Events and Data Flow

1. The configured global shortcut fires in the Windows hotkey manager or the native macOS shortcut provider.
2. Rust toggles the `command-palette` window without showing the main window.
3. The palette emits a focus event and resets its transient state.
4. Each query updates tool results immediately and starts a debounced file query.
5. Rust invokes the active platform provider and returns normalized results.
6. Selecting a tool sends a navigation event to the main window; selecting a file invokes the system opener.

The existing setting and shortcut string remain compatible. Only the shortcut's destination behavior changes.

## Error Handling

- Empty query: show a short hint and recently pinned ToolDock tools; do not query files.
- Everything unavailable: keep tool results, display install and retry actions, and avoid repeated automatic detection until retry or a later palette opening.
- Spotlight unavailable: keep tool results and show an indexing explanation.
- Query failure or timeout: retain tool results and show a retryable file-search error.
- Stale response: discard it silently using the request identifier.
- Missing file between search and open: keep the palette visible and report that the item no longer exists.

Errors are user-facing in Chinese or English and are also written through the existing tracing system without recording the user's query text at normal log levels.

## Security and Privacy

Search queries and results stay on the local machine. ToolDock does not persist palette queries or file results. Paths are passed to the system opener as structured command arguments and are never interpolated into a shell command. The Everything download action opens only the fixed official voidtools URL.

## Testing

Frontend unit tests cover tool ranking, grouping, keyboard selection, stale result rejection, and provider-unavailable rendering. Rust unit tests cover result normalization, limits, empty-query rejection, and platform error mapping. Windows integration tests isolate the IPC codec from the operating-system message transport. macOS adapter tests isolate Spotlight metadata conversion from `NSMetadataQuery` lifecycle management.

Manual acceptance checks verify window focus, shortcut toggling, keyboard-only use, opening tools, opening files, Everything missing/stopped behavior, Spotlight exclusions, light and dark themes, Chinese and English labels, and operation while the main window is hidden.

## Acceptance Criteria

- The configured shortcut displays only the compact palette, not the main ToolDock shell.
- Tool matches appear without waiting for a file provider.
- Windows file results come from a running Everything instance.
- macOS file results come from Spotlight.
- Missing providers do not break tool search.
- Keyboard navigation and opening actions work without using a mouse.
- No search history or result cache is persisted by ToolDock.
