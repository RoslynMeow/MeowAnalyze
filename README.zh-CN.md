<!-- 请把 RoslynMeow 替换成你的 GitHub 用户名或组织名。 -->
<p align="center">
  <img src="./docs/assets/banner.svg" alt="MeowAnalyze" width="100%">
</p>

# MeowAnalyze

> 全功能静态代码分析器:语言识别、圈复杂度、嵌套深度等等。

[![CI](https://github.com/RoslynMeow/MeowAnalyze/actions/workflows/ci.yml/badge.svg)](https://github.com/RoslynMeow/MeowAnalyze/actions/workflows/ci.yml)
[![Release](https://img.shields.io/github/v/release/RoslynMeow/MeowAnalyze?display_name=tag&sort=semver)](https://github.com/RoslynMeow/MeowAnalyze/releases)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)
[![Platforms](https://img.shields.io/badge/platforms-Windows%20%7C%20macOS%20%7C%20Linux-1f6feb)](#-安装)
[![Node](https://img.shields.io/badge/node-%3E%3D18-3fb950)](./package.json)

[English](./README.md) | **简体中文**

---

## ✨ 特性

- **逐文件语言识别**(先看扩展名,可扩展到 shebang / 内容特征)。
- **函数级圈复杂度**(决策点:`if`、循环、`case`、`catch`、`?:`、`&&`、`||`、`??`)。
- **认知复杂度**(Sonar 风格,按嵌套加权)。
- **嵌套深度**:函数级。
- **Halstead 指标**与**可维护性指数**(函数级、文件级、项目均值)。
- **标记**:注释中的 `TODO` / `FIXME` / `HACK` 数量,以及注释密度。
- **代码行数**:物理 / 代码 / 注释 / 空行 / 逻辑行。
- **分布聚合**(`count` / `sum` / `min` / `max` / `mean`),可直接用于图表和 CI 门禁。
- **可配置阈值**,带 CI 友好的退出码。
- **多种输出**:终端富表格 + 稳定 JSON。
- **浏览器安全的核心**:分析引擎零文件系统/进程 I/O,同一份代码可驱动 CLI、桌面 UI 和 Web 应用。

## 📦 安装

### 预编译二进制

从 [Releases](https://github.com/RoslynMeow/MeowAnalyze/releases) 下载对应平台的程序,**无需安装 Node.js**。

| 平台 | 文件 |
| --- | --- |
| Windows x64 | `meowanalyze-windows-x64.exe` |
| Linux x64 | `meowanalyze-linux-x64` |
| Linux arm64 | `meowanalyze-linux-arm64` |
| macOS x64 (Intel) | `meowanalyze-darwin-x64` |
| macOS arm64 (Apple Silicon) | `meowanalyze-darwin-arm64` |

```bash
chmod +x meowanalyze-linux-x64
./meowanalyze-linux-x64 .
```

> macOS 二进制未签名,若被 Gatekeeper 拦截,执行
> `xattr -d com.apple.quarantine meowanalyze-darwin-arm64`。

### 从源码构建

需要 Node.js >= 18。

```bash
git clone https://github.com/RoslynMeow/MeowAnalyze.git
cd MeowAnalyze
npm install
npm run dev -- .          # 直接对当前目录运行
npm run bundle            # -> dist/meowanalyze.cjs(自包含单文件)
npm run compile           # -> dist/meowanalyze(.exe)(独立程序,需要 Bun)
```

## 🚀 快速开始

```bash
# 分析一个文件夹(终端报告)
meowanalyze ./src

# 机器可读输出
meowanalyze ./src --format json > report.json

# 只看汇总
meowanalyze ./src --quiet

# 超标时让 CI 失败
meowanalyze ./src --fail-on warning
```

## 🌐 Web 应用

每次发版都会附带浏览器应用的静态包 `meowanalyze-web.zip`。解压后用任意静态服务器托管即可,或从源码运行:

```bash
npm run dev:web            # 开发服务器 (http://localhost:5173)
npm run build:web          # 静态站点 -> apps/web/dist
npm run build:web:single   # 单文件 -> apps/web/dist-single/index.html
```

**发布**:`apps/web/dist` 就是普通静态站点,托管到 GitHub Pages、Cloudflare Pages、Netlify、Vercel 或任意 Web 服务器即可。部署后用户直接打开网址就能用,**没有后端**。每次发版还附带 `meowanalyze-web.zip`(站点)和 `meowanalyze-web.html`(单文件版)。

**内嵌 / 离线**:`meowanalyze-web.html` 把全部 JS、CSS 和 banner 内联成一个文件,无需服务器 —— 可直接从本地打开、单文件分享,或放进 `<iframe>`。

打开项目文件夹 —— 分析核心**完全在浏览器内运行**,代码不会上传。

**输入方式**:打开项目文件夹(File System Access API,回退到 `webkitdirectory`);阈值面板可即时重算。

**三整页**(吸附滚动 + 页码点 + 方向键):

1. **大屏** —— 纯数据屏:可维护性仪表盘、关键数字,以及纯饼图(代码行、语言、圈/认知复杂度分桶)。
2. **文件地图** —— 全屏嵌套式 SpaceSniffer 风格树状图:文件夹包含文件,面积按代码行数、颜色按最大复杂度。点击格子打开文件。
3. **文件详情** —— 左侧文件列表 + 右侧源码预览;点击函数名定位并高亮对应行。

响应式布局、表格可排序、一键导出 JSON。

## 🖥 桌面应用

桌面端用 **Electron**,**原样复用 Web UI**:渲染进程加载构建好的网页,主进程弹出原生"打开文件夹"对话框并读取文件(不启动 CLI 子进程)。

```bash
npm run build:desktop   # 构建 Web + 打包 Electron main/preload
npm run start:desktop   # 启动(首次会下载 Electron 二进制)
npm run dist:desktop    # 打包安装包到 apps/desktop/release
```

安装包(NSIS / dmg / AppImage + deb)由 CI 在各自系统上构建,并附到每次 Release。

## 🛠 CLI 参数

```
meowanalyze [path] [options]
```

| 参数 | 默认值 | 说明 |
| --- | --- | --- |
| `[path]` | `.` | 要分析的目录或单个文件。 |
| `-f, --format <format>` | `table` | 输出格式:`table` 或 `json`。 |
| `-c, --config <file>` | 自动 | `meowanalyze.toml` 配置文件路径。 |
| `--no-gitignore` | 生效 | 不遵循 `.gitignore`。 |
| `-e, --exclude <patterns...>` | – | 要排除的 gitignore 风格模式。 |
| `--top <count>` | `10` | Top / 违规表格显示的行数。 |
| `--max-file-size <bytes>` | `2097152` | 超过此大小的文件跳过。 |
| `--fail-on <level>` | `none` | 在 `none` \| `warning` \| `error` 时非零退出。 |
| `-q, --quiet` | – | 只打印汇总表格。 |
| `-v, --version` | – | 打印版本。 |

### 退出码

| 退出码 | 含义 |
| --- | --- |
| `0` | 成功(且未达到 `--fail-on` 级别)。 |
| `1` | 存在达到 `--fail-on` 级别的违规。 |
| `2` | 工具错误(参数错误、配置无法读取等)。 |

## ⚙️ 配置

在被分析的根目录建 `meowanalyze.toml`(或用 `--config` 指定):

```toml
[thresholds]
cyclomatic = 10      # 每个函数上限
nesting = 4          # 每个函数上限
params = 5           # 每个函数上限
function_loc = 80    # 每个函数行数上限
file_loc = 1000      # 每个文件行数上限

[analysis]
gitignore = true
exclude = ["**/*.test.ts", "**/*.d.ts"]
max_file_size = 2097152
```

## 🧩 JavaScript API

### `analyzeSources` — 浏览器安全核心

引擎**不做任何 I/O**。把内存中的源码喂进去,拿到报告。非常适合读取文件夹句柄的 Web 应用。

```ts
import { analyzeSources } from "@meowanalyze/core";

const report = analyzeSources({
  root: "my-project",                       // 只是标签,不一定是真实路径
  sources: [
    { path: "src/index.ts", content: code }, // content: string | Uint8Array
  ],
  // config?, registry?, diagnostics?, now?, toolVersion?
});

console.log(report.summary.metrics.cyclomatic.max);
```

### `analyze` — Node 宿主

遍历目录(遵循 `.gitignore`)、读取文件,然后交给核心。

```ts
import { analyze, loadConfig } from "@meowanalyze/cli";

const config = await loadConfig(undefined, process.cwd());
const report = await analyze({ root: process.cwd(), config });
```

### 自定义语言

实现 `LanguageAnalyzer` 接口并注册即可,加语言永远不用改引擎。

```ts
import { LanguageRegistry, type LanguageAnalyzer } from "@meowanalyze/core";

class MyLang implements LanguageAnalyzer {
  readonly id = "mylang";
  readonly extensions = [".my"];
  matches(path: string) { return path.endsWith(".my"); }
  analyze(ctx) { /* 返回 FileReport */ }
}

const registry = new LanguageRegistry().register(new MyLang());
```

## 📊 报告结构

```jsonc
{
  "schemaVersion": "0.1.0",
  "toolVersion": "0.1.0",
  "root": "/abs/path",
  "generatedAt": "2026-01-01T00:00:00.000Z",
  "durationMs": 42,
  "summary": {
    "files": 17,
    "filesByLanguage": { "typescript": 17 },
    "loc": { "physical": 1709, "code": 1469, "comment": 91, "blank": 149, "logical": 625 },
    "metrics": {
      "cyclomatic": { "count": 126, "sum": 279, "min": 1, "max": 16, "mean": 2.21 }
    },
    "violations": { "total": 2, "error": 0, "warning": 2, "info": 0 }
  },
  "files": [
    {
      "path": "src/index.ts",
      "language": "typescript",
      "loc": { "physical": 120, "code": 96, "comment": 8, "blank": 16, "logical": 44 },
      "metrics": { "cyclomatic": { "count": 9, "sum": 22, "min": 1, "max": 6, "mean": 2.44 } },
      "functions": [
        {
          "id": "src/index.ts:3:add",
          "name": "add",
          "kind": "function",
          "range": { "start": { "line": 3, "column": 1 }, "end": { "line": 5, "column": 2 } },
          "loc": 3,
          "params": 2,
          "cyclomatic": 1,
          "maxNesting": 0
        }
      ],
      "violations": []
    }
  ],
  "diagnostics": []
}
```

## 📐 指标定义

| 指标 | 定义 |
| --- | --- |
| **圈复杂度** | 每个函数 `1 + 决策点`。决策点:`if`、`for`、`for-in`、`for-of`、`while`、`do`、`case`、`catch`、`?:`、`&&` / `\|\|` / `??`。 |
| **认知复杂度** | Sonar 风格、按嵌套加权。`if` / 循环 / `switch` / `catch` / `?:` 递增嵌套,`else if` 链不加深,同类逻辑运算符的每段序列 +1。 |
| **嵌套深度** | 函数内控制结构(`if`、循环、`switch`、`try`)的最大嵌套层数。 |
| **Halstead** | 从函数文本扫描出的算子/算子的去重数与总数、词汇量、长度、体积、难度与工作量。 |
| **可维护性指数** | `171 − 3.42·ln(V) − 0.23·CC − 16.2·ln(LOC)`,归一到 0–100(越高越好)。按函数、按文件给出并取平均。 |
| **注释密度** | 非空行中注释行的占比。 |
| **标记** | 注释里 `TODO` / `FIXME` / `HACK` 的数量。 |
| **物理行** | 文件总行数。 |
| **代码行** | 至少含一个非注释 token 的行。 |
| **注释行** | 只含注释的行。 |
| **空行** | 空行。`代码 + 注释 + 空行 === 物理行`。 |
| **逻辑行** | AST 中的语句节点数。 |

## 🗂 项目结构

```
packages/
  core/      @meowanalyze/core      浏览器安全引擎(无 fs):语言、指标、报告模型
  cli/       @meowanalyze/cli       Node 宿主:文件遍历 + 终端报告 + CLI
apps/
  web/       @meowanalyze/web       Vite Web 应用,在浏览器内运行核心
  desktop/   @meowanalyze/desktop   Electron 应用,复用 Web 构建产物
docs/assets/banner.svg
```

**核心**是纯的、平台无关;宿主(CLI、Web 应用、桌面应用)只负责提供源码并渲染报告。

## 🗺 路线图

- [x] CLI:终端 + JSON 输出、阈值与 CI 门禁
- [x] 与文件系统解耦的浏览器安全核心
- [x] 通过 Bun 产出多平台独立程序
- [x] Web 应用(浏览器内运行核心:打开项目文件夹)
- [x] 桌面应用(Electron,复用 Web UI)
- [ ] 通过 tree-sitter 支持更多语言、认知复杂度、Halstead 与可维护性指数

## 💻 开发

```bash
npm install
npm run dev -- <path>     # 从源码运行 CLI
npm run dev:web           # 从源码运行 Web 应用
npm run build:desktop     # 构建桌面应用(Web + Electron)
npm run typecheck         # 类型检查所有包
npm test                  # 单元测试(Vitest)
npm run build             # 构建 core 库
npm run build:web         # 构建静态 Web 应用
npm run bundle            # 单文件 CJS 打包
npm run compile           # 独立程序(需要 Bun)
```

## 📝 更新日志

见 [CHANGELOG.md](./CHANGELOG.md)。

## 📄 许可证

[MIT](./LICENSE) © MeowAnalyze contributors
