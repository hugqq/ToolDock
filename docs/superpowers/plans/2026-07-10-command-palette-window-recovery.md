# Command Palette Window Recovery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 保证全局快捷键窗口始终显示独立搜索页，并在关闭后仍可再次唤起。

**Architecture:** 使用 Tauri 窗口标签作为独立页面的可靠身份，不只依赖 Hash URL；在 Rust 窗口事件层将搜索窗口关闭转换成隐藏。配置 URL 同时改成 HashRouter 的直接路由形式。

**Tech Stack:** Tauri 2、Rust、React 19、React Router HashRouter、Node.js test runner

## Global Constraints

- 只修改 `command-palette` 相关行为。
- 不改变 `main` 窗口的关闭设置。
- 不增加依赖。
- PowerShell 命令均适用于 PowerShell 7。

---

### Task 1: Add regression assertions

**Files:**
- Modify: `tests/commandPaletteIntegration.test.mjs`

**Interfaces:**
- Consumes: `src-tauri/tauri.conf.json`、`src/App.tsx`、`src-tauri/src/lib.rs` 源文件。
- Produces: 搜索窗口 URL、窗口标签路由、关闭隐藏行为的回归约束。

- [x] **Step 1: Update the configuration assertion**

将窗口 URL 断言从 `index.html#/command-palette` 改为 `#/command-palette`。

- [x] **Step 2: Add identity-routing and close-preservation assertions**

在快捷键路由测试中读取 `src-tauri/src/lib.rs`，断言 `App.tsx` 使用 `getCurrentWindow().label` 识别 `command-palette`，并断言 Rust 关闭事件在该标签分支中依次调用 `window.hide()` 和 `api.prevent_close()`。

- [ ] **Step 3: Verify RED**

Run in PowerShell 7:

```powershell
node --test tests/commandPaletteIntegration.test.mjs
```

Expected: FAIL，因为配置仍为旧 URL，且窗口标签路由和关闭保护尚不存在。

### Task 2: Make the palette route independent from the main window

**Files:**
- Modify: `src-tauri/tauri.conf.json`
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: Tauri 当前窗口标签和 React Router 当前路径。
- Produces: `command-palette` 标签始终对应 `/command-palette` 独立组件。

- [x] **Step 1: Correct the configured URL**

将搜索窗口配置修改为：

```json
"url": "#/command-palette"
```

- [x] **Step 2: Resolve the standalone route from the window label**

在 `App.tsx` 引入 `getCurrentWindow`，并在选择独立组件前计算：

```ts
const standalonePath =
  getCurrentWindow().label === "command-palette"
    ? "/command-palette"
    : location.pathname;
```

使用 `standalonePath` 选择 `STANDALONE_ROUTES` 和加载占位组件。

### Task 3: Preserve the palette window on close

**Files:**
- Modify: `src-tauri/src/lib.rs`

**Interfaces:**
- Consumes: Tauri `CloseRequested` 窗口事件。
- Produces: `command-palette` 关闭请求转换成隐藏操作。

- [x] **Step 1: Add the palette close branch**

在现有 `main` 关闭判断之前加入：

```rust
if window.label() == "command-palette" {
    let _ = window.hide();
    api.prevent_close();
    return;
}
```

- [ ] **Step 2: Verify GREEN**

Run in PowerShell 7:

```powershell
node --test tests/commandPaletteIntegration.test.mjs
```

Expected: 所有 command palette 集成测试通过。

- [x] **Step 3: Review the focused diff**

Run in PowerShell 7:

```powershell
git diff -- tests/commandPaletteIntegration.test.mjs src-tauri/tauri.conf.json src/App.tsx src-tauri/src/lib.rs
```

Expected: 只有搜索窗口路由、关闭保护及对应测试发生变化。
