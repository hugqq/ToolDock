<div align="center">

# 🧰 ToolDock

**一个 Windows 优先的桌面工具箱，整合文件、系统、网络和开发常用小工具；macOS 当前属于实验性支持，体验可能偏卡。**

基于 Tauri v2、React 19、TypeScript、Rust、MUI v7 和 Vite 构建。

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Tauri](https://img.shields.io/badge/Tauri-v2-24C8D8.svg)](https://tauri.app)
[![React](https://img.shields.io/badge/React-19-61DAFB.svg)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6.svg)](https://www.typescriptlang.org)

[简体中文](README_zh.md) | [English](README.md)

</div>

---

## ✨ 项目简介

ToolDock 是一个偏本地、偏实用的桌面工具箱。它把日常会用到的文件处理、系统辅助、网络诊断、开发辅助和轻量娱乐工具集中到一个应用里，减少来回切换不同小软件或命令行脚本的成本。

项目基于 Tauri 的跨平台能力构建，但当前主要开发和测试环境仍是 Windows。macOS 目前属于实验性支持，部分功能依赖 Windows API，且当前 macOS 体验可能明显偏卡，暂不建议作为主要使用环境。

项目前端使用 React 构建界面，后端通过 Tauri/Rust 提供桌面能力，例如文件访问、本地命令、剪贴板、OCR、格式转换和原生打包。

## 🖼️ 界面截图

### 🧩 工具总览

![ToolDock 中文工具总览](img/1.png)

### 🌐 英文界面

![ToolDock 英文工具总览](img/2.png)

### 🌙 暗色主题

![ToolDock 暗色主题](img/3.png)

### ⚙️ 系统设置

![ToolDock 系统设置页面](img/4.png)

### ℹ️ 关于窗口

![ToolDock 关于窗口](img/5.png)

## ⭐ 核心特点

- 28 个实用工具，加上一个设置中心，按文件、系统、网络、开发、娱乐分类管理。
- 基于 Tauri v2 打包，体积相对轻，启动和运行更接近原生桌面应用。
- React 19 + MUI v7 界面，支持亮色/暗色主题。
- Rust 命令层处理文件、网络、OCR、剪贴板、转换和本地自动化相关能力。
- 内置中文和英文界面。
- 工具入口集中维护在 `src/tools/registry.ts`，方便新增和调整工具。

## 📋 环境要求

| 组件 | 要求 |
| --- | --- |
| 操作系统 | 推荐 Windows 10 / 11；macOS 当前为实验性支持，性能体验尚未优化 |
| Node.js | 20 或更高版本 |
| pnpm | 当前稳定版本 |
| Rust | Stable 工具链，并带当前系统对应 target |
| WebView2 | Windows 上运行 Tauri 应用所需 |

## 🚀 快速开始

以下命令适用于 PowerShell 7：

```powershell
git clone https://github.com/hugqq/ToolDock.git
cd ToolDock
pnpm install
pnpm tauri dev
```

## 🛠️ 常用命令

以下命令适用于 PowerShell 7：

```powershell
# 只启动 Vite 前端
pnpm dev

# 启动完整 Tauri 桌面应用
pnpm tauri dev

# 构建前端产物
pnpm build

# 构建桌面安装包和应用包
pnpm tauri build
```

构建产物输出目录：

```text
src-tauri/target/release/bundle/
```

## 🧭 工具清单

### 📁 文件工具

- 文件夹大小：扫描目录并分析磁盘占用。
- 哈希计算：计算 MD5、SHA1、SHA256 等校验值。
- 批量重命名：预览并执行批量重命名规则。
- 图片格式转换：转换常见图片格式，并支持调整尺寸。
- PDF 转图片：把 PDF 页面渲染并导出为图片。

### 🖥️ 系统工具

- 便笺：管理计划、备忘录、附件、提醒和番茄钟。
- 屏幕 OCR：截图并识别文字。
- 连点器：自动执行鼠标点击、键盘按键和快捷文本输入。
- 剪贴板历史：记录并搜索剪贴板内容。
- 系统设置：管理应用偏好、翻译密钥、AI 配置、更新检查和配置导入导出。

### 🌐 网络工具

- DNS 助手：执行 DNS 查询和相关诊断。
- Nginx 配置：编辑、校验、套用模板并管理本地 Nginx 配置。
- 端口管理：扫描开放端口，排查本机端口占用，并结束占用进程。
- IP 地址查询：查询 IP 归属地和网络信息。
- 简单 Web 服务器：把本地文件夹快速作为 HTTP 服务分享，适合局域网传文件或静态页面测试。

### 💻 开发工具

- Node 管理：查找并清理 `node_modules` 和包缓存目录。
- AI 变量命名：生成变量命名建议。
- 单位换算：换算汇率、长度、重量、温度、进制、存储和网速单位。
- Cron 生成器：生成并预览 Cron 表达式。
- JSON 格式化：美化、压缩、校验和查看 JSON。
- 编/解码：处理 Base64、URL、Hex、HTML、Unicode、Binary、JWT、Punycode 和 Morse。
- 翻译：支持 Google、DeepL、百度、有道、腾讯和火山引擎等翻译服务。
- 取色器：拾取并转换颜色值。
- 二维码：生成二维码，也可以从图片识别二维码。
- 文本对比：对比文本或文件差异。
- 时间戳转换：在 Unix 时间戳和可读日期时间之间转换。

### 🎮 娱乐工具

- 2048：经典数字合成游戏，支持 AI 辅助。
- 奥赛罗：支持本地 AI 和在线联机对战。

## 🗂️ 项目结构

```text
ToolDock/
├── src/                    # React 前端
│   ├── api/                # 前端 API 辅助方法
│   ├── components/         # 通用组件和布局
│   ├── hooks/              # 可复用 React Hooks
│   ├── i18n/               # 中文和英文语言包
│   ├── lib/                # Tauri 封装和前端公共方法
│   ├── pages/              # 工具页面
│   ├── stores/             # Zustand 状态
│   └── tools/              # 工具注册表
├── src-tauri/              # Tauri 和 Rust 后端
│   ├── capabilities/       # Tauri 权限配置
│   ├── scripts/            # 打包脚本
│   └── src/
│       ├── commands/       # Tauri 命令入口
│       ├── core/           # Rust 核心逻辑
│       ├── models/         # 共享数据模型
│       └── errors.rs       # 统一错误处理
├── scripts/                # 项目辅助脚本
├── tests/                  # Node 测试
└── public/                 # 静态资源
```

## ➕ 新增工具流程

通常按下面顺序处理：

1. 在 `src/pages/` 新增工具页面。
2. 在 `src/components/` 新增或复用通用 UI。
3. 在 `src/i18n/locales/en.json` 和 `src/i18n/locales/zh-CN.json` 增加翻译。
4. 在 `src/tools/registry.ts` 注册工具入口。
5. 如果需要桌面原生能力，在 `src-tauri/src/core/` 增加 Rust 逻辑，并通过 `src-tauri/src/commands/` 暴露命令。
6. 如果工具需要额外权限，更新 Tauri capabilities 配置。

## 🔎 常见排查

以下命令适用于 PowerShell 7：

```powershell
# 清理本地应用数据
Remove-Item -Path "$env:LOCALAPPDATA\tooldock" -Recurse -Force -ErrorAction SilentlyContinue

# 结束正在运行的应用进程
taskkill /F /IM ToolDock.exe

# 清理 Rust 构建产物
Push-Location src-tauri
cargo clean
Pop-Location

# 当前终端开启 Rust 详细日志
$env:RUST_LOG = "debug"
pnpm tauri dev
```

## 📦 发布

发布脚本会更新版本号、创建提交、创建或替换 release tag，并推送分支和 tag。

只有在确认要发布时，再在 PowerShell 7 中执行：

```powershell
.\scripts\release.ps1 1.0.2
```

## 🤝 贡献

欢迎提交 Issue 和 Pull Request。建议保持改动聚焦，Bug 反馈请带上复现步骤和相关日志，并尽量沿用现有前端/Rust 目录结构。

建议提交类型：

- `feat`：新增功能
- `fix`：修复问题
- `docs`：文档更新
- `style`：格式调整
- `refactor`：内部重构
- `perf`：性能优化
- `test`：测试相关
- `chore`：维护任务

## 📄 许可证

ToolDock 基于 [MIT License](LICENSE) 开源。
