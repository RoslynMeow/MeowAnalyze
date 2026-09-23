<!-- 请把 RoslynMeow 替换成你的 GitHub 用户名或组织名。 -->
<p align="center">
  <img src="./docs/assets/banner.svg" alt="MeowAnalyze" width="100%">
</p>

<h1 align="center">MeowAnalyze</h1>

<p align="center">
  <strong>全功能静态代码分析器</strong><br>
  语言识别 · 圈复杂度与认知复杂度 · 嵌套深度 · Halstead · 可维护性指数
</p>

<p align="center">
  <a href="https://roslynmeow.github.io/MeowAnalyze/"><img alt="在线演示" src="https://img.shields.io/badge/%E5%9C%A8%E7%BA%BF%E6%BC%94%E7%A4%BA-%E6%B5%8F%E8%A7%88%E5%99%A8%E6%89%93%E5%BC%80-ffb454?style=flat-square&logo=githubpages&logoColor=white"></a>
  <a href="https://github.com/RoslynMeow/MeowAnalyze/actions/workflows/ci.yml"><img alt="CI" src="https://github.com/RoslynMeow/MeowAnalyze/actions/workflows/ci.yml/badge.svg"></a>
  <a href="https://github.com/RoslynMeow/MeowAnalyze/releases"><img alt="Release" src="https://img.shields.io/github/v/release/RoslynMeow/MeowAnalyze?display_name=tag&sort=semver&style=flat-square"></a>
  <a href="./LICENSE"><img alt="License: MIT" src="https://img.shields.io/badge/license-MIT-blue?style=flat-square"></a>
  <img alt="Platforms" src="https://img.shields.io/badge/platforms-Windows%20%7C%20macOS%20%7C%20Linux-1f6feb?style=flat-square">
  <img alt="Node" src="https://img.shields.io/badge/node-%3E%3D18-3fb950?style=flat-square">
</p>

<p align="center"><strong>简体中文</strong> · <a href="./README.en.md">English</a></p>

---

MeowAnalyze 读取一个
**TypeScript / JavaScript / C / C++ / Python / Java / C#** 项目,给出最影响维护成本的
各项数字:复杂度、嵌套深度、Halstead 体积、可维护性指数、注释密度,以及技术债标记。同一
套分析核心同时驱动 **CLI**、**完全在浏览器内运行的 Web 应用** 和 **Electron 桌面应用**
—— 任何代码都不会上传。

## 目录

- [特性亮点](#特性亮点)
- [在线体验](#在线体验)
- [安装](#安装)
- [Web 应用](#web-应用)
- [桌面应用](#桌面应用)
- [CLI 参考](#cli-参考)
- [配置](#配置)
- [JavaScript API](#javascript-api)
- [指标](#指标)
- [项目结构](#项目结构)
- [路线图](#路线图)
- [开发](#开发)
- [许可证](#许可证)

## 特性亮点

- **复杂度** —— 函数级圈复杂度与 Sonar 风格认知复杂度,以及嵌套深度,全部基于
  TypeScript 编译器的 AST 计算。
- **Halstead 与可维护性** —— 运算符/操作数、体积、难度、工作量,以及归一化到
  0–100 的可维护性指数(函数级、文件级与项目均值)。
- **代码行数** —— 物理 / 代码 / 注释 / 空行 / 逻辑行,满足
  `代码 + 注释 + 空行 === 物理`。
- **标记** —— 注释中的 `TODO` / `FIXME` / `HACK` 数量与注释密度。
- **分布聚合** —— 每个指标的 `count` / `sum` / `min` / `max` / `mean`,可直接用于
  图表和 CI 门禁。
- **阈值与 CI 门禁** —— 可配置上限,配合 `--fail-on` 退出码。
- **多种输出** —— 丰富的终端报告与稳定的 JSON 文档。
- **浏览器安全的分析核心** —— 引擎不做任何文件系统或进程 I/O,同一份代码可运行在
  Node、浏览器(以及未来的 WASM)中。

## 支持的语言

TypeScript / JavaScript 走 TypeScript 编译器;其余语言走 tree-sitter(WASM)。项目用到的
语法按需加载,并内联打包进所有目标,运行时无需联网获取。

| 级别 | 语言 |
| --- | --- |
| **精准** —— 专门规则,所有指标可信 | TypeScript、JavaScript、C、C++、Python、Java、C#、Go |
| **基础** —— 通用 tree-sitter 规则(尽力而为;复杂度/函数/行数可用,Halstead、认知复杂度、类成员可能不完整) | Rust、Ruby、PHP、Kotlin、Swift、Scala、Lua、Zig、Solidity、Objective-C、Shell、Elixir、Emacs Lisp、OCaml、ReScript、TLA+ |
| **仅文件 / 代码行** —— 只贡献文件数、代码行与语言占比 | HTML、CSS、JSON、TOML、Vue、ERB、SystemRDL |

## 在线体验

无需安装、无需上传 —— 分析完全在浏览器本地运行:

> **https://roslynmeow.github.io/MeowAnalyze/**

选择一个项目文件夹,即可浏览数据大屏、文件详情、UML 图表与阈值设置。

## 安装

### 预编译二进制

从 [Releases](https://github.com/RoslynMeow/MeowAnalyze/releases) 页面下载对应平台的
可执行文件 —— 无需 Node.js。

| 平台 | 文件 |
| --- | --- |
| Windows x64 | `meowanalyze-windows-x64.exe` |
| Linux x64 | `meowanalyze-linux-x64` |
| Linux arm64 | `meowanalyze-linux-arm64` |
| macOS x64(Intel) | `meowanalyze-darwin-x64` |
| macOS arm64(Apple Silicon) | `meowanalyze-darwin-arm64` |

```bash
chmod +x meowanalyze-linux-x64
./meowanalyze-linux-x64 .
```

> macOS 二进制未签名。若被 Gatekeeper 拦截,执行
> `xattr -d com.apple.quarantine meowanalyze-darwin-arm64`。

### 从源码运行

需要 Node.js >= 18。

```bash
git clone https://github.com/RoslynMeow/MeowAnalyze.git
cd MeowAnalyze
npm install
npm run dev -- .          # 分析当前目录
npm run bundle            # -> dist/meowanalyze.cjs(单文件、自包含)
npm run compile           # -> dist/meowanalyze(.exe)(独立二进制,需要 Bun)
```

## Web 应用

Web 应用是一个**纯静态站点,没有后端** —— 分析核心完全在浏览器内运行,代码不会上传。

```bash
npm run dev:web            # 开发服务器 (http://localhost:5173)
npm run build:web          # 静态站点 -> apps/web/dist
npm run build:web:single   # 单文件 -> apps/web/dist-single/index.html
```

**页面**

1. **数据大屏** —— 顶部是维护指数 hero(仪表盘 + 标记 / 违规计数),右侧是 GitHub
   贡献图风格的**文件分布**(每个方块一个文件、按健康度上色,点击跳转),再加一条
   “最该关注的文件”排行,以及代码行构成 / 函数类型的合并卡片。下方卡片墙补充圈复杂度、
   认知复杂度、嵌套深度和 Halstead 体积 / 难度。点击任意卡片打开下钻抽屉;ECharts
   按需懒加载。
2. **文件详情** —— 左侧文件列表 + 右侧源码预览;点击函数名定位并高亮对应行。
3. **图表** —— UML 类图、包依赖图、活动图、时序图、状态机、ER 图和通信图,由**自托管的
   draw.io** 渲染(不请求第三方;可下载 `.drawio`、导出 SVG)。构建前先跑一次
   `npm run drawio` 拉取编辑器。
4. **帮助** —— 每个指标的定义与公式,以 MathML 渲染。
5. **设置** —— 阈值与首页显示哪些卡片,应用后即时重算。

界面支持中英双语与亮/暗主题,均持久化在 `localStorage`。通过 File System Access API
打开项目文件夹(回退到 `webkitdirectory`)。

**发布**:`apps/web/dist` 就是普通静态站点,托管到 GitHub Pages、Cloudflare Pages、
Netlify、Vercel 或任意 Web 服务器即可。本仓库自带一个
[Pages 工作流](./.github/workflows/pages.yml),推送到 `main` / `master` 时自动构建并
部署到 GitHub Pages(线上地址:<https://roslynmeow.github.io/MeowAnalyze/>)。每次发版
还附带 `meowanalyze-web.zip`(站点)和 `meowanalyze-web.html`(单文件版)。

**内嵌 / 离线**:`meowanalyze-web.html` 把全部 JS、CSS 和 banner 内联成一个文件,
无需服务器 —— 可直接从本地打开、单文件分享,或放进 `<iframe>`。

## 桌面应用

桌面应用基于 **Electron**,原样复用 Web UI:渲染进程加载构建好的 Web 应用,主进程弹出
原生文件夹对话框并直接读取文件(不走 CLI 子进程)。

```bash
npm run build:desktop   # 构建 Web 应用 + 打包 Electron main/preload
npm run start:desktop   # 启动(首次运行会下载 Electron 二进制)
npm run dist:desktop    # 打包安装包到 apps/desktop/release
```

安装包(NSIS / dmg / AppImage + deb)由 CI 按平台构建,并附带在每次发版中。

## CLI 参考

```
meowanalyze [path] [options]
```

| 选项 | 默认值 | 说明 |
| --- | --- | --- |
| `[path]` | `.` | 要分析的目录或单个文件。 |
| `-f, --format <format>` | `table` | 输出格式:`table` 或 `json`。 |
| `-c, --config <file>` | 自动 | `meowanalyze.toml` 配置文件路径。 |
| `--no-gitignore` | 遵循 | 不遵循 `.gitignore`。 |
| `-e, --exclude <patterns...>` | – | 要排除的 gitignore 风格模式。 |
| `--top <count>` | `10` | Top / 违规表格显示的行数。 |
| `--max-file-size <bytes>` | `2097152` | 跳过大于该值的文件。 |
| `--fail-on <level>` | `none` | 在 `none` \| `warning` \| `error` 时非零退出。 |
| `-q, --quiet` | – | 只打印汇总表格。 |
| `-v, --version` | – | 打印版本号。 |

### 退出码

| 码 | 含义 |
| --- | --- |
| `0` | 成功(且未达到 `--fail-on` 级别)。 |
| `1` | 存在达到或超过 `--fail-on` 级别的违规。 |
| `2` | 工具错误(参数错误、配置不可读等)。 |

## 配置

在被分析的根目录创建 `meowanalyze.toml`(或用 `--config` 指定):

```toml
[thresholds]
cyclomatic = 15      # 每个函数上限
cognitive = 15       # 每个函数上限
nesting = 4          # 每个函数上限
params = 7           # 每个函数上限
function_loc = 100   # 每个函数代码行数上限
file_loc = 1000      # 每个文件代码行数上限

[analysis]
gitignore = true
exclude = ["**/*.test.ts", "**/*.d.ts"]
max_file_size = 2097152
```

默认值沿用业界惯例(Sonar:圈复杂度 15、认知复杂度 15、参数 7;ESLint `max-depth`:4)。
未设置的字段会回退到**按语言**的默认配置,新语言可以自带一套默认值而不影响调用方。

## JavaScript API

### `analyzeSources` —— 浏览器安全核心

引擎**不做任何 I/O**。传入内存中的源码即可拿到报告,适合读取文件夹句柄的 Web 应用。

```ts
import { analyzeSources } from "@meowanalyze/core";

const report = analyzeSources({
  root: "my-project",                       // 一个标签,不一定是真实路径
  sources: [
    { path: "src/index.ts", content: code }, // content: string | Uint8Array
  ],
  // config?, registry?, diagnostics?, now?, toolVersion?
});

console.log(report.summary.metrics.cyclomatic.max);
```

### `analyze` —— Node 宿主

遍历目录(遵循 `.gitignore`)、读取文件,再交给核心分析。

```ts
import { analyze, loadConfig } from "@meowanalyze/cli";

const config = await loadConfig(undefined, process.cwd());
const report = await analyze({ root: process.cwd(), config });
```

### 自定义语言

实现 `LanguageAnalyzer` 接口并注册即可,新增语言永远不需要改动引擎。

```ts
import { LanguageRegistry, type LanguageAnalyzer } from "@meowanalyze/core";

class MyLang implements LanguageAnalyzer {
  readonly id = "mylang";
  readonly extensions = [".my"];
  matches(path: string) { return path.endsWith(".my"); }
  analyze(ctx) { /* 返回一个 FileReport */ }
}

const registry = new LanguageRegistry().register(new MyLang());
```

## 指标

| 指标 | 定义 |
| --- | --- |
| **圈复杂度** | 每个函数 `1 + 决策点数`。决策点:`if`、`for`、`for-in`、`for-of`、`while`、`do`、`case`、`catch`、`?:`,以及 `&&` / `\|\|` / `??`。 |
| **认知复杂度** | Sonar 风格、按嵌套加权的分数。`if` / 循环 / `switch` / `catch` / `?:` 会因嵌套加分,`else if` 链保持同一层,连续的同种逻辑运算符只加一次。 |
| **嵌套深度** | 函数内控制结构(`if`、循环、`switch`、`try`)的最大嵌套层数。 |
| **Halstead** | 从函数文本扫描出的运算符/操作数的去重与总数,以及词汇量、长度、体积、难度和工作量。 |
| **可维护性指数** | `171 − 3.42·ln(V) − 0.23·CC − 16.2·ln(L)`(归一化到 0–100,越高越易维护),其中 `L` 为函数的代码行数。给出函数级、文件级与项目均值。 |
| **注释密度** | 非空行中注释所占比例。 |
| **标记** | 注释中 `TODO` / `FIXME` / `HACK` 的数量。 |
| **物理行** | 文件总行数。 |
| **代码行** | 至少包含一个非注释 token 的行(函数/文件长度的口径也是它)。 |
| **注释行** | 仅包含注释的行。 |
| **空行** | 不含任何 token 的空白行。`代码 + 注释 + 空行 === 物理`。 |
| **逻辑行** | AST 中语句节点的数量。 |

## 项目结构

```
packages/
  core/      @meowanalyze/core      浏览器安全引擎(无 fs):语言、指标、报告模型
  cli/       @meowanalyze/cli       Node 宿主:文件遍历 + 终端报告 + CLI
apps/
  web/       @meowanalyze/web       Vite Web 应用,在浏览器内运行核心
  desktop/   @meowanalyze/desktop   Electron 应用,复用 Web 构建产物
docs/assets/banner.svg
```

**核心**是纯的、与平台无关;宿主(CLI、Web、桌面)只负责提供源码并渲染报告。

## 路线图

- [x] CLI:终端 + JSON 输出、阈值与 CI 门禁
- [x] 与文件系统解耦的浏览器安全核心
- [x] 基于 Bun 的多平台独立二进制
- [x] Web 应用(在浏览器内运行核心:打开项目文件夹)
- [x] 桌面应用(Electron,复用 Web UI)
- [x] 认知复杂度、Halstead 指标与可维护性指数
- [x] UML 图表(draw.io)与 OOP 结构模型
- [x] 一键部署到 GitHub Pages
- [x] 30+ 语言(tree-sitter WASM,按需加载并内联打包进所有目标)
- [ ] 打磨「基础」级的通用语言画像

## 开发

```bash
npm install
npm run dev -- <path>     # 从源码运行 CLI
npm run dev:web           # 从源码运行 Web 应用
npm run build:desktop     # 构建桌面应用(Web + Electron)
npm run typecheck         # 类型检查全部包
npm test                  # 单元测试(Vitest)
npm run build             # 构建核心库
npm run build:web         # 构建静态 Web 应用
npm run drawio            # 拉取自托管的 draw.io 编辑器(图表页用)
npm run bundle            # 单文件 CJS 打包
npm run compile           # 独立二进制(需要 Bun)
```

## 更新日志

见 [CHANGELOG.md](./CHANGELOG.md)。

## 许可证

[MIT](./LICENSE) © MeowAnalyze contributors
