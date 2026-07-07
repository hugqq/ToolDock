<div align="center">

# ToolDock

**一个功能强大、原生感十足的 Windows 实用工具箱**

基于 Tauri v2 + React 19 + MUI v7 构建

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Tauri](https://img.shields.io/badge/Tauri-v2.0-24C8D8.svg)](https://tauri.app)
[![React](https://img.shields.io/badge/React-19-61DAFB.svg)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6.svg)](https://www.typescriptlang.org)

[简体中文](README_zh.md) | [English](README.md) | [使用指南](docs/USAGE_zh.md)

</div>

---

## 特性

- **Material Design 3** - 遵循 MUI v7 设计规范，支持亮色/暗色主题自动切换
- **高性能原生体验** - Tauri v2 提供接近原生应用的性能和体积优势
- **实用工具** - 涵盖文件处理、系统管理、网络工具、开发辅助等多个领域
- **国际化支持** - 内置中文、英文等多语言支持，易于扩展
- **安全可靠** - 细粒度权限控制，所有系统操作需明确授权
- **体积小巧** - 安装包小于 15MB，运行时占用内存低
- **类型安全** - 前后端全程 TypeScript/Rust 类型校验

---

## 快速开始

### 环境要求

| 组件    | 版本要求                    |
| ------- | --------------------------- |
| Windows | 10 / 11                     |
| Node.js | v20+                        |
| pnpm    | 最新版本                    |
| Rust    | 1.70+ (带 `windows` target) |

### 安装依赖

```bash
# 克隆仓库
git clone https://github.com/yourusername/ToolDock.git
cd ToolDock

# 安装前端依赖
pnpm install
```

### 开发模式

```bash
# 启动开发服务器（热重载）
pnpm tauri dev
```

### 构建发行版

```bash
# 构建生产版本
pnpm build

# 打包安装程序
pnpm tauri build

# 输出目录: src-tauri/target/release/bundle/
```

---

## 工具清单

### 文件工具 (5)

| 工具            | 说明                       | 核心功能                |
| --------------- | -------------------------- | ----------------------- |
| 文件夹大小   | 递归扫描目录，分析磁盘占用 | 列表视图                |
| 查找重复文件 | 基于 MD5/SHA256 去重       | 批量删除 / 智能筛选     |
| 批量重命名   | 正则替换、序号、大小写转换 | 预览 / 撤销             |
| 图片格式转换 | JPG/PNG/WEBP/ICO 互转      | 批量处理 / 自定义分辨率 |

### 系统工具 (8)

| 工具          | 说明                    | 核心功能                |
| ------------- | ----------------------- | ----------------------- |
| 便笺       | 任务管理 + 番茄工作法   | 今日计划 / 长短期规划   |
| 系统激活   | Windows/Office 激活助手 | 一键激活                |
| 系统信息   | CPU/内存/磁盘监控       | 实时监控 / 系统硬件信息 |
| 屏幕 OCR   | 截图文字识别            | 多语言识别              |
| 连点器     | 自动点击工具            | 鼠标连点 / 键盘连点     |
| 剪贴板历史 | 剪贴板管理器            | 文本 / 图片 / 搜索      |

### 网络工具 (5)

| 工具               | 说明             | 核心功能                |
| ------------------ | ---------------- | ----------------------- |
| DNS 助手        | DNS 查询与测速   | 刷新 DNS 缓存/ 公共 DNS |
| Nginx 配置      | 可视化配置生成器 | 语法校验 / 模板         |
| 端口扫描        | TCP/UDP 端口检测 | 批量扫描 / 服务识别     |
| IP 地址查询     | IP 归属地查询    | IPv4/IPv6 / Geolocation |
| 简单 Web 服务器 | 本地文件服务     | 静态托管 / CORS         |

### 开发工具 (10)

| 工具           | 说明                  | 核心功能               |
| -------------- | --------------------- | ---------------------- |
| Node 管理   | node_modules 清理     | 扫描 / 批量删除        |
| AI 变量命名 | 智能命名建议          | 驼峰 / 下划线 / 帕斯卡 |
| 单位换算    | 汇率、长度、进制转换  | 实时汇率 / 历史记录    |
| ⏰ Cron 表达式 | 可视化生成 Cron       | 预览执行时间           |
| {} JSON 格式化 | JSON 美化与压缩       | 树形视图 / 语法高亮    |
| 编/解码     | Base64/URL/Hex/JWT 等 | 9 种编码格式           |
| 翻译        | 多引擎翻译工具        | Google/DeepL/百度/有道 |
| 取色器      | 屏幕颜色拾取          | Hex/RGB/HSL            |
| 二维码      | 生成与识别二维码      | 自定义样式 / 批量生成  |
| 文本对比    | Diff 工具             | 行级对比 / 高亮差异    |
| ⏱️ 时间戳转换  | Unix 时间戳工具       | 毫秒 / 秒 / ISO 8601   |

### 娱乐工具 (1)

| 工具             | 说明           | 核心功能            |
| ---------------- | -------------- | ------------------- |
| 2048 / 奥赛罗 | 经典游戏       | AI 对战 / 联机模式  |

---

## 使用指南

详细使用说明请查看 [使用指南文档](docs/USAGE_zh.md)。

### 基础操作

1. **工具搜索**: 在顶部搜索框输入关键词快速定位工具
2. **收藏夹**: 点击工具卡片右上角星标按钮收藏常用工具
3. **分类筛选**: 左侧侧边栏按类别浏览工具
4. **主题切换**: 通过设置页面切换亮色/暗色主题
5. **全局快捷键**: 设置中配置快捷键快速唤起应用

### 权限说明

部分工具需要特殊权限：

- **管理员权限**: DNS、编辑 Nginx 配置等
- **文件系统访问**: 文件夹扫描、批量重命名
- **网络访问**: 翻译、端口扫描、IP 查询
- **剪贴板访问**: 剪贴板历史、截图 OCR

---

## 开发指南

### 项目结构

```
ToolDock/
├── src/                    # 前端代码
│   ├── pages/              # 页面组件（懒加载）
│   ├── components/         # 共享组件
│   │   ├── layout/         # ToolLayout 等布局
│   │   └── shared/         # DataTable, LogViewer 等
│   ├── tools/              # 工具注册表 (SSOT)
│   ├── stores/             # Zustand 状态管理
│   ├── hooks/              # 自定义 Hooks
│   ├── i18n/               # 国际化配置
│   └── lib/                # Tauri API 封装
├── src-tauri/              # 后端代码
│   ├── src/
│   │   ├── commands/       # Tauri 命令层
│   │   ├── core/           # 纯业务逻辑（无 Tauri 依赖）
│   │   ├── models/         # 数据模型（DTO）
│   │   └── errors.rs       # 统一错误处理
│   └── capabilities/       # 权限配置
└── docs/                   # 文档
```

### 开发规范

1. **逻辑设计**: 确定数据流向与 Windows API 依赖
2. **I18n 定义**: 在 `src/i18n/locales/*.json` 添加翻译
3. **Rust Core**: 在 `src-tauri/src/core/` 实现核心逻辑
4. **Tauri Command**: 在 `src-tauri/src/commands/` 添加接口
5. **React 前端**: 在 `src/pages/` 创建组件，注册到 `tools/registry.ts`

### 调试技巧

```powershell
# 清除应用数据缓存
Remove-Item -Path "$env:LOCALAPPDATA\tooldock" -Recurse -Force

# 强制终止进程
taskkill /F /IM ToolDock.exe

# 清理 Rust 构建缓存
cd src-tauri
cargo clean

# 启用详细日志
$env:RUST_LOG="debug"
pnpm tauri dev
```

---

## 自动构建

使用发布脚本一键更新版本号并触发 CI/CD 构建：

```powershell
# 发布新版本（自动更新版本号、提交、打 tag、推送）
.\scripts\release.ps1 1.0.1
```

脚本会自动完成：

1. 更新 `package.json`、`Cargo.toml`、`tauri.conf.json` 中的版本号
2. 提交版本变更
3. 创建 git tag（如已存在则自动替换）
4. 推送代码和 tag，触发 GitHub Actions 构建 Windows + macOS 安装包

## 贡献指南

欢迎提交 Issue 和 Pull Request！

### 提交规范

- **Feat**: 新增功能
- **Fix**: 修复 Bug
- **Docs**: 文档更新
- **Style**: 代码格式调整
- **Refactor**: 代码重构
- **Perf**: 性能优化
- **Test**: 测试相关

---

## 许可证

本项目采用 [MIT License](LICENSE) 开源协议。

---

## 致谢

- [Tauri](https://tauri.app) - 跨平台桌面应用框架
- [MUI](https://mui.com) - React 组件库
- [Lucide](https://lucide.dev) - 图标库
- 所有贡献者和用户的支持

---

## 联系方式

- **Issue**: [GitHub Issues](https://github.com/yourusername/ToolDock/issues)
- **讨论**: [GitHub Discussions](https://github.com/yourusername/ToolDock/discussions)

---

<div align="center">

如果觉得这个项目对你有帮助，请给个 ⭐ Star 支持一下！

Made by ToolDock Team

</div>
