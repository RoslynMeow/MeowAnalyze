export type Lang = "zh" | "en";

export interface HelpSection {
  title: string;
  body: string;
  /** LaTeX formulas, rendered as MathML. */
  formulas?: readonly string[];
  items?: readonly string[];
  /** A closing remark, shown muted under the formulas. */
  note?: string;
}

export interface Strings {
  pages: {
    dashboard: string;
    detail: string;
    diagrams: string;
  };
  common: {
    menu: string;
    settings: string;
    help: string;
    exportJson: string;
    home: string;
    cancel: string;
    apply: string;
    back: string;
  };
  help: {
    title: string;
    sections: readonly HelpSection[];
  };
  diagrams: {
    title: string;
    kinds: {
      class: string;
      package: string;
      activity: string;
      sequence: string;
      state: string;
      er: string;
      communication: string;
    };
    pickFunction: string;
    empty: {
      class: string;
      package: string;
      activity: string;
      sequence: string;
      state: string;
      er: string;
      communication: string;
    };
    reload: string;
    download: string;
    exportSvg: string;
  };
  theme: {
    dark: string;
    light: string;
  };
  landing: {
    openFolder: string;
  };
  notices: {
    noFiles: string;
  };
  settings: {
    title: string;
    hint: string;
    dashboardTitle: string;
    dashboardHint: string;
    reset: string;
    fields: {
      cyclomatic: string;
      cognitive: string;
      nesting: string;
      params: string;
      functionLoc: string;
      fileLoc: string;
    };
    fieldHints: {
      cyclomatic: string;
      cognitive: string;
      nesting: string;
      params: string;
      functionLoc: string;
      fileLoc: string;
    };
  };
  dashboard: {
    title: string;
    fileMap: string;
    attention: string;
    attentionHint: string;
    alerts: {
      violations: (n: number) => string;
      markers: (n: number) => string;
    };
    kpiDetail: {
      avg: (n: number) => string;
      scale: (files: number, functions: number) => string;
      functionLength: (n: number) => string;
      params: (n: number) => string;
    };
    maintainability: {
      low: string;
      moderate: string;
      healthy: string;
    };
    kpi: {
      scale: string;
      files: string;
      functions: string;
      codeLines: string;
      commentPct: string;
      maintainability: string;
      avgCyclomatic: string;
      maxCyclomatic: string;
      avgCognitive: string;
      maxCognitive: string;
      halsteadDifficulty: string;
      physicalLines: string;
      logicalLines: string;
      avgFunctionLength: string;
      maxNesting: string;
      params: string;
      halsteadVolume: string;
      violations: string;
      markers: string;
    };
    charts: {
      linesOfCode: string;
      languages: string;
      cyclomatic: string;
      cognitive: string;
      nesting: string;
      functionLength: string;
      functionKinds: string;
      maintainability: string;
      parameters: string;
      halsteadVolume: string;
      fileSize: string;
      markers: string;
      ruleViolations: string;
    };
    donut: {
      physical: string;
      files: string;
      functions: string;
    };
    segment: {
      code: string;
      comment: string;
      blank: string;
    };
    kinds: {
      function: string;
      method: string;
      arrow: string;
      constructor: string;
      getter: string;
      setter: string;
    };
  };
  detail: {
    locPill: (
      physical: number,
      code: number,
      comment: number,
      blank: number,
      logical: number,
    ) => string;
    filesTitle: string;
    selectHint: string;
    kpi: {
      functions: string;
      maintainability: string;
      maxCyclomatic: string;
      maxCognitive: string;
      maxNesting: string;
      codeLines: string;
      violations: string;
    };
    functionsTitle: (n: number) => string;
    source: string;
    sourceTooLarge: (n: number) => string;
    table: {
      cyclomatic: string;
      cognitive: string;
      nesting: string;
      loc: string;
      params: string;
      maintainability: string;
      function: string;
      line: string;
    };
  };
}

const zh: Strings = {
  pages: {
    dashboard: "数据大屏",
    detail: "文件详情",
    diagrams: "图表",
  },
  common: {
    menu: "菜单",
    settings: "设置",
    help: "帮助",
    exportJson: "导出 JSON",
    home: "返回主页",
    cancel: "取消",
    apply: "应用",
    back: "← 返回",
  },
  theme: {
    dark: "暗色",
    light: "亮色",
  },
  landing: {
    openFolder: "打开文件夹",
  },
  notices: {
    noFiles: "没有找到可分析的 TypeScript / JavaScript 文件。",
  },
  diagrams: {
    title: "图表 · UML",
    kinds: {
      class: "类图",
      package: "包依赖图",
      activity: "活动图",
      sequence: "时序图",
      state: "状态机",
      er: "ER 图",
      communication: "通信图",
    },
    pickFunction: "选择函数",
    empty: {
      class: "没有找到类 / 接口 / 枚举声明。",
      package: "没有可解析的模块依赖。",
      activity: "该函数没有可绘制的控制流。",
      sequence: "该函数没有解析到调用。",
      state: "未识别到状态机（需要同一类中对同一变量赋值 ≥2 个不同字面量）。",
      er: "没有找到带字段的类 / 接口。",
      communication: "没有解析到项目内的函数调用。",
    },
    reload: "重新载入",
    download: "下载 .drawio",
    exportSvg: "导出 SVG",
  },
  help: {
    title: "帮助 · 指标说明",
    sections: [
      {
        title: "语言检测",
        body: "分析器先按文件扩展名识别语言。当前支持 TypeScript 与 JavaScript（.ts/.tsx/.mts/.cts/.js/.jsx/.mjs/.cjs），使用 TypeScript 官方编译器把源码解析成 AST，再在 AST 与词法扫描之上计算所有指标。二进制文件与超过大小上限的文件会被跳过。",
        note: "更多语言计划通过 tree-sitter 接入。",
      },
      {
        title: "圈复杂度（Cyclomatic Complexity）",
        body: "由 McCabe 提出，衡量一个函数中线性无关路径的数量，也就是覆盖所有分支所需的测试用例下限，反映控制流的复杂程度。它既可以由控制流图计算，也可以等价地由决策点计数得到。",
        formulas: ["M = E - N + 2P", "M(f) = 1 + \\left|D(f)\\right|"],
        items: [
          "E：控制流图的边数，N：节点数，P：连通分量数（单个函数 P = 1）",
          "D(f)：函数内的决策点集合",
          "if / else if",
          "for、for-in、for-of",
          "while、do-while",
          "switch 的每个 case",
          "catch",
          "三元运算符 ?:",
          "逻辑运算符 &&、||、??",
        ],
        note: "函数基础值为 1；嵌套函数单独计算，不累加到外层。",
      },
      {
        title: "认知复杂度（Cognitive Complexity）",
        body: "在圈复杂度之外，进一步刻画“人读懂代码的难度”：结构嵌套越深越难理解，因此按嵌套深度加权；同时避免惩罚等价的简单写法（如 else if）。",
        formulas: [
          "\\mathrm{Cog}(f) = \\sum_{i \\in S(f)}\\left(1 + \\nu_i\\right) + \\left|R(f)\\right|",
        ],
        items: [
          "S(f)：函数内的控制结构集合，νᵢ 为第 i 个结构的嵌套层数",
          "每个 if / 循环 / switch / catch / ?: 记 1 + 嵌套层数",
          "else if 链保持同一层，不额外增加嵌套",
          "R(f)：同类逻辑运算符的连续序列数；a && b && c 只记 1",
        ],
        note: "与圈复杂度的区别：嵌套会显著放大认知复杂度，而 else if 几乎不被惩罚。",
      },
      {
        title: "嵌套深度（Nesting Depth）",
        body: "函数体内控制结构相互嵌套的最大层数，用来衡量代码的最大缩进深度。",
        formulas: [
          "D(f) = \\max_{s \\in S(f)} \\mathrm{depth}(s)",
          "\\mathrm{depth}(s) = 1 + \\max_{p \\in \\mathrm{anc}(s)} \\mathrm{depth}(p)",
        ],
        items: ["计入的结构：if、for、for-in、for-of、while、do、switch、try"],
      },
      {
        title: "Halstead 度量",
        body: "从函数文本中的运算符（operators）与操作数（operands）统计出一组软件科学度量，用数量的规模与多样性估算程序的体量和理解成本。",
        formulas: [
          "n = n_1 + n_2",
          "N = N_1 + N_2",
          "V = N \\log_2 n",
          "D = \\frac{n_1}{2} \\cdot \\frac{N_2}{n_2}",
          "E = D \\cdot V",
        ],
        items: [
          "n₁ / N₁：不同 / 总运算符数",
          "n₂ / N₂：不同 / 总操作数数",
          "n：词汇量，N：程序长度",
          "V：体积（信息量），D：难度，E：工作量",
        ],
        note: "体积与难度会参与可维护性指数的计算。",
      },
      {
        title: "可维护性指数（Maintainability Index）",
        body: "由 Oman 与 Hagemeister 提出，综合 Halstead 体积、圈复杂度与代码行数，给出 0–100 的可维护性评分，越高越易维护。本工具沿用 Visual Studio 的系数并做归一化。",
        formulas: [
          "MI = 171 - 3.42\\,\\ln V - 0.23\\,G - 16.2\\,\\ln L",
          "MI^{*} = \\max\\!\\left(0,\\ \\min\\!\\left(100,\\ \\frac{100\\,MI}{171}\\right)\\right)",
        ],
        items: [
          "V：Halstead 体积（函数级取该函数，文件级取文件内所有函数之和）",
          "G：圈复杂度",
          "L：代码行数（含源码 token 的行）",
        ],
        note: "颜色分级：< 40 红（难维护）、40–65 黄、≥ 65 绿。",
      },
      {
        title: "代码行（Lines of Code）",
        body: "以行为单位的口径。物理行是文件总行数；逻辑行来自 AST 中语句节点的数量，比物理行更接近“实际语句数”。",
        formulas: [
          "L_{\\mathrm{phys}} = L_{\\mathrm{code}} + L_{\\mathrm{comment}} + L_{\\mathrm{blank}}",
          "L_{\\mathrm{logical}} = \\#\\{\\, n : n \\in \\mathrm{AST}_{\\mathrm{stmt}} \\,\\}",
        ],
        items: [
          "代码行：至少含一个非注释 token 的行",
          "注释行：仅含注释的行",
          "空行：不含任何 token 的空白行",
        ],
        note: "代码 + 注释 + 空行 = 物理行，恒等成立。",
      },
      {
        title: "注释密度（Comment Density）",
        body: "非空行中注释所占的比例，用来粗略衡量文档化程度；并非越高越好。",
        formulas: [
          "\\rho = \\frac{L_{\\mathrm{comment}}}{L_{\\mathrm{code}} + L_{\\mathrm{comment}}} \\times 100\\%",
        ],
      },
      {
        title: "标记（Markers）",
        body: "统计注释中出现的待办与告警标记，便于快速定位技术债。",
        formulas: ["\\#\\{\\text{TODO}\\}, \\quad \\#\\{\\text{FIXME}\\}, \\quad \\#\\{\\text{HACK}\\}"],
        items: ["仅统计出现在注释中的标记，字符串或标识符里的同名文字不计入"],
      },
      {
        title: "分布与聚合（Distribution）",
        body: "每个函数级指标都会在所有函数上汇总成一个分布，图表据此绘制，CI 门禁则读取 sum / max。",
        formulas: [
          "\\bar{x} = \\frac{1}{n}\\sum_{i=1}^{n} x_i",
          "\\sum_{i=1}^{n} x_i, \\quad \\min_{1 \\le i \\le n} x_i, \\quad \\max_{1 \\le i \\le n} x_i",
        ],
        items: ["count、sum、min、max、mean 五个聚合量"],
      },
      {
        title: "阈值与违规（Thresholds）",
        body: "复杂度类指标可与设定阈值比较，超过即记为违规（默认级别 warning）。阈值可在设置页调整，也可通过 meowanalyze.toml 配置。",
        items: [
          "圈复杂度 > cyclomatic",
          "认知复杂度 > cognitive",
          "嵌套深度 > nesting",
          "函数参数个数 > params",
          "函数代码行数 > function_loc",
          "文件代码行数 > file_loc",
        ],
      },
      {
        title: "语言支持",
        body: "分析器分两级:「精准」有专门规则,所有指标可信;「基础」用通用 tree-sitter 规则尽力而为,复杂度/函数/行数可用,但 Halstead、认知复杂度、类成员等可能不完整。没有函数的语言只能统计文件数、代码行与语言占比。",
        items: [
          "精准:TypeScript / JavaScript、C / C++、Python、Java、C#",
          "基础:Go、Rust、Ruby、PHP、Kotlin、Swift、Scala、Lua、Zig、Solidity、Objective-C、Shell、Elixir、Emacs Lisp、OCaml、ReScript、TLA+",
          "仅文件 / 代码行 / 语言占比:HTML、CSS、JSON、TOML、Vue、ERB、SystemRDL",
        ],
      },
    ],
  },
  settings: {
    title: "设置",
    hint: "超过阈值的函数会被标记为违规。",
    dashboardTitle: "首页显示",
    dashboardHint: "勾选要在大屏上显示的卡片。",
    reset: "恢复默认",
    fields: {
      cyclomatic: "圈复杂度",
      cognitive: "认知复杂度",
      nesting: "嵌套深度",
      params: "参数个数",
      functionLoc: "函数行数",
      fileLoc: "文件行数",
    },
    fieldHints: {
      cyclomatic: "每个函数的圈复杂度上限",
      cognitive: "每个函数的认知复杂度上限",
      nesting: "每个函数的嵌套深度上限",
      params: "每个函数的参数个数上限",
      functionLoc: "每个函数的代码行数上限",
      fileLoc: "每个文件的代码行数上限",
    },
  },
  dashboard: {
    title: "分析大屏",
    fileMap: "文件分布",
    attention: "最该关注的文件",
    attentionHint: "代码量大且维护指数低的文件排在最前",
    alerts: {
      violations: (n) => `${n} 处违规`,
      markers: (n) => `${n} 个标记`,
    },
    kpiDetail: {
      avg: (n) => `平均 ${n}`,
      scale: (files, functions) => `${files} 文件 · ${functions} 函数`,
      functionLength: (n) => `函数平均 ${n} 行`,
      params: (n) => `参数平均 ${n} 个`,
    },
    maintainability: {
      low: "难以维护",
      moderate: "中等",
      healthy: "健康",
    },
    kpi: {
      scale: "规模",
      files: "文件",
      functions: "函数",
      codeLines: "代码行",
      commentPct: "注释占比",
      maintainability: "维护指数",
      avgCyclomatic: "平均圈复杂度",
      maxCyclomatic: "最大圈复杂度",
      avgCognitive: "平均认知复杂度",
      maxCognitive: "最大认知复杂度",
      halsteadDifficulty: "Halstead 难度",
      physicalLines: "物理行",
      logicalLines: "逻辑行",
      avgFunctionLength: "平均函数行数",
      maxNesting: "最大嵌套深度",
      params: "参数个数",
      halsteadVolume: "Halstead 体积",
      violations: "违规",
      markers: "标记",
    },
    charts: {
      linesOfCode: "代码行构成",
      languages: "语言",
      cyclomatic: "圈复杂度分布",
      cognitive: "认知复杂度分布",
      nesting: "嵌套深度分布",
      functionLength: "函数长度分布",
      functionKinds: "函数类型",
      maintainability: "维护指数分布",
      parameters: "参数个数分布",
      halsteadVolume: "Halstead 体积分布",
      fileSize: "文件大小分布",
      markers: "标记",
      ruleViolations: "违规规则",
    },
    donut: {
      physical: "物理行",
      files: "文件",
      functions: "函数",
    },
    segment: {
      code: "代码",
      comment: "注释",
      blank: "空行",
    },
    kinds: {
      function: "函数",
      method: "方法",
      arrow: "箭头函数",
      constructor: "构造函数",
      getter: "取值器",
      setter: "设值器",
    },
  },
  detail: {
    locPill: (physical, code, comment, blank, logical) =>
      `物理 ${physical} · 代码 ${code} · 注释 ${comment} · 空行 ${blank} · 逻辑 ${logical}`,
    filesTitle: "文件",
    selectHint: "从左侧选择一个文件",
    kpi: {
      functions: "函数",
      maintainability: "维护指数",
      maxCyclomatic: "最大圈复杂度",
      maxCognitive: "最大认知复杂度",
      maxNesting: "最大嵌套深度",
      codeLines: "代码行",
      violations: "违规",
    },
    functionsTitle: (n) => `函数(${n})—— 点击函数名定位`,
    source: "源码",
    sourceTooLarge: (n) => `源码过大(${n} 行),已隐藏。`,
    table: {
      cyclomatic: "圈复杂",
      cognitive: "认知",
      nesting: "嵌套",
      loc: "行数",
      params: "参数",
      maintainability: "维护",
      function: "函数",
      line: "行号",
    },
  },
};

const en: Strings = {
  pages: {
    dashboard: "Dashboard",
    detail: "File detail",
    diagrams: "Diagrams",
  },
  common: {
    menu: "Menu",
    settings: "Settings",
    help: "Help",
    exportJson: "Export JSON",
    home: "Back to home",
    cancel: "Cancel",
    apply: "Apply",
    back: "← Back",
  },
  theme: {
    dark: "Dark",
    light: "Light",
  },
  landing: {
    openFolder: "Open folder",
  },
  notices: {
    noFiles: "No TypeScript / JavaScript files found.",
  },
  diagrams: {
    title: "Diagrams · UML",
    kinds: {
      class: "Class",
      package: "Packages",
      activity: "Activity",
      sequence: "Sequence",
      state: "State",
      er: "ER",
      communication: "Communication",
    },
    pickFunction: "Function",
    empty: {
      class: "No class / interface / enum declarations found.",
      package: "No resolvable module dependencies.",
      activity: "This function has no control flow to draw.",
      sequence: "This function has no resolved calls.",
      state: "No state machine detected (needs ≥2 distinct literals assigned to one variable in a class).",
      er: "No classes / interfaces with fields found.",
      communication: "No in-project function calls were resolved.",
    },
    reload: "Reload",
    download: "Download .drawio",
    exportSvg: "Export SVG",
  },
  help: {
    title: "Help · metric reference",
    sections: [
      {
        title: "Language detection",
        body: "The language is chosen from the file extension first. TypeScript and JavaScript (.ts/.tsx/.mts/.cts/.js/.jsx/.mjs/.cjs) are parsed into an AST with the official TypeScript compiler; every metric is then computed over that AST and a lexical scan. Binary files and files over the size limit are skipped.",
        note: "More languages are planned via tree-sitter.",
      },
      {
        title: "Cyclomatic complexity",
        body: "Introduced by McCabe, it counts the number of linearly independent paths through a function — a lower bound on the test cases needed to cover every branch — and so reflects how tangled the control flow is. It can be computed from the control-flow graph or, equivalently, by counting decision points.",
        formulas: ["M = E - N + 2P", "M(f) = 1 + \\left|D(f)\\right|"],
        items: [
          "E: edges and N: nodes of the control-flow graph; P: connected components (P = 1 for a single function)",
          "D(f): the set of decision points in the function",
          "if / else if",
          "for, for-in, for-of",
          "while, do-while",
          "each case of a switch",
          "catch",
          "ternary ?:",
          "logical operators &&, ||, ??",
        ],
        note: "The base value is 1; nested functions are measured separately and do not add to the enclosing one.",
      },
      {
        title: "Cognitive complexity",
        body: "Beyond cyclomatic complexity, it tries to capture how hard the code is for a human to follow: deeply nested structures are harder to understand, so they are weighted by nesting depth, while equivalent simple forms (like else if) are not penalized.",
        formulas: [
          "\\mathrm{Cog}(f) = \\sum_{i \\in S(f)}\\left(1 + \\nu_i\\right) + \\left|R(f)\\right|",
        ],
        items: [
          "S(f): the control structures in the function; νᵢ is the nesting depth of the i-th structure",
          "each if / loop / switch / catch / ?: scores 1 + its nesting depth",
          "else-if chains stay at the same level and add no nesting",
          "R(f): runs of like logical operators; a && b && c scores 1, not 2",
        ],
        note: "The difference from cyclomatic complexity: nesting inflates the score sharply, while else if is barely penalized.",
      },
      {
        title: "Nesting depth",
        body: "The maximum number of mutually nested control structures inside a function body — how deeply the code is indented.",
        formulas: [
          "D(f) = \\max_{s \\in S(f)} \\mathrm{depth}(s)",
          "\\mathrm{depth}(s) = 1 + \\max_{p \\in \\mathrm{anc}(s)} \\mathrm{depth}(p)",
        ],
        items: ["Counted constructs: if, for, for-in, for-of, while, do, switch, try"],
      },
      {
        title: "Halstead measures",
        body: "A set of software-science measures derived from the operators and operands in the function text, using their count and variety to estimate the size of the program and the effort to understand it.",
        formulas: [
          "n = n_1 + n_2",
          "N = N_1 + N_2",
          "V = N \\log_2 n",
          "D = \\frac{n_1}{2} \\cdot \\frac{N_2}{n_2}",
          "E = D \\cdot V",
        ],
        items: [
          "n₁ / N₁: distinct / total operators",
          "n₂ / N₂: distinct / total operands",
          "n: vocabulary, N: program length",
          "V: volume, D: difficulty, E: effort",
        ],
        note: "Volume and difficulty also feed the maintainability index.",
      },
      {
        title: "Maintainability index",
        body: "Proposed by Oman and Hagemeister, it combines Halstead volume, cyclomatic complexity and lines of code into a 0–100 score, where higher is easier to maintain. This tool uses the Visual Studio coefficients and normalizes the result.",
        formulas: [
          "MI = 171 - 3.42\\,\\ln V - 0.23\\,G - 16.2\\,\\ln L",
          "MI^{*} = \\max\\!\\left(0,\\ \\min\\!\\left(100,\\ \\frac{100\\,MI}{171}\\right)\\right)",
        ],
        items: [
          "V: Halstead volume (per function, or the sum over the file's functions at file level)",
          "G: cyclomatic complexity",
          "L: code lines (lines that contain source tokens)",
        ],
        note: "Color grading: < 40 red (hard to maintain), 40–65 yellow, ≥ 65 green.",
      },
      {
        title: "Lines of code",
        body: "A line-based accounting. Physical lines are the total line count; logical lines come from the number of statement nodes in the AST, which is closer to the count of actual statements.",
        formulas: [
          "L_{\\mathrm{phys}} = L_{\\mathrm{code}} + L_{\\mathrm{comment}} + L_{\\mathrm{blank}}",
          "L_{\\mathrm{logical}} = \\#\\{\\, n : n \\text{ is an AST statement node} \\,\\}",
        ],
        items: [
          "code: lines with at least one non-comment token",
          "comment: lines containing only comments",
          "blank: lines with no tokens at all",
        ],
        note: "code + comment + blank = physical, as an identity.",
      },
      {
        title: "Comment density",
        body: "The share of non-blank lines that are comments — a rough proxy for documentation; more is not always better.",
        formulas: [
          "\\rho = \\frac{L_{\\mathrm{comment}}}{L_{\\mathrm{code}} + L_{\\mathrm{comment}}} \\times 100\\%",
        ],
      },
      {
        title: "Markers",
        body: "Counts of the to-do and warning markers found in comments, to help locate technical debt quickly.",
        formulas: ["\\#\\{\\text{TODO}\\}, \\quad \\#\\{\\text{FIXME}\\}, \\quad \\#\\{\\text{HACK}\\}"],
        items: ["Only markers inside comments count; the same words in strings or identifiers do not"],
      },
      {
        title: "Distribution aggregate",
        body: "Every function-level metric is aggregated over all functions into a distribution; charts are drawn from it and CI gates read sum / max.",
        formulas: [
          "\\bar{x} = \\frac{1}{n}\\sum_{i=1}^{n} x_i",
          "\\sum_{i=1}^{n} x_i, \\quad \\min_{1 \\le i \\le n} x_i, \\quad \\max_{1 \\le i \\le n} x_i",
        ],
        items: ["count, sum, min, max and mean"],
      },
      {
        title: "Thresholds",
        body: "Complexity metrics are compared against configured thresholds; exceeding one is recorded as a violation (level warning by default). Thresholds can be edited on the settings page or via meowanalyze.toml.",
        items: [
          "cyclomatic complexity > cyclomatic",
          "cognitive complexity > cognitive",
          "nesting depth > nesting",
          "parameters > params",
          "function code lines > function_loc",
          "file code lines > file_loc",
        ],
      },
      {
        title: "Language support",
        body: "Two tiers. “Tuned” languages have dedicated rules and trustworthy metrics; “basic” languages use the generic tree-sitter rules (best effort): complexity, functions and lines work, but Halstead, cognitive complexity and class members may be incomplete. Languages without functions only contribute files, code lines and language share.",
        items: [
          "Tuned: TypeScript / JavaScript, C / C++, Python, Java, C#",
          "Basic: Go, Rust, Ruby, PHP, Kotlin, Swift, Scala, Lua, Zig, Solidity, Objective-C, Shell, Elixir, Emacs Lisp, OCaml, ReScript, TLA+",
          "Files / code lines / language share only: HTML, CSS, JSON, TOML, Vue, ERB, SystemRDL",
        ],
      },
    ],
  },
  settings: {
    title: "Settings",
    hint: "Thresholds flag functions that exceed them.",
    dashboardTitle: "Dashboard layout",
    dashboardHint: "Pick the cards shown on the dashboard.",
    reset: "Reset to defaults",
    fields: {
      cyclomatic: "Cyclomatic",
      cognitive: "Cognitive",
      nesting: "Nesting",
      params: "Parameters",
      functionLoc: "Function length",
      fileLoc: "File length",
    },
    fieldHints: {
      cyclomatic: "Max cyclomatic complexity per function",
      cognitive: "Max cognitive complexity per function",
      nesting: "Max nesting depth per function",
      params: "Max parameters per function",
      functionLoc: "Max code lines per function",
      fileLoc: "Max code lines per file",
    },
  },
  dashboard: {
    title: "Analysis dashboard",
    fileMap: "File distribution",
    attention: "Needs attention",
    attentionHint: "Large files with low maintainability rank first",
    alerts: {
      violations: (n) => `${n} violation${n === 1 ? "" : "s"}`,
      markers: (n) => `${n} marker${n === 1 ? "" : "s"}`,
    },
    kpiDetail: {
      avg: (n) => `avg ${n}`,
      scale: (files, functions) => `${files} files · ${functions} functions`,
      functionLength: (n) => `avg ${n} lines/function`,
      params: (n) => `avg ${n} params`,
    },
    maintainability: {
      low: "hard to maintain",
      moderate: "moderate",
      healthy: "healthy",
    },
    kpi: {
      scale: "Scale",
      files: "Files",
      functions: "Functions",
      codeLines: "Code lines",
      commentPct: "Comment %",
      maintainability: "Maintainability",
      avgCyclomatic: "Avg cyclomatic",
      maxCyclomatic: "Max cyclomatic",
      avgCognitive: "Avg cognitive",
      maxCognitive: "Max cognitive",
      halsteadDifficulty: "Halstead difficulty",
      physicalLines: "Physical lines",
      logicalLines: "Logical lines",
      avgFunctionLength: "Avg function length",
      maxNesting: "Max nesting",
      params: "Parameters",
      halsteadVolume: "Halstead volume",
      violations: "Violations",
      markers: "Markers",
    },
    charts: {
      linesOfCode: "Lines of code",
      languages: "Languages",
      cyclomatic: "Cyclomatic complexity distribution",
      cognitive: "Cognitive complexity distribution",
      nesting: "Nesting depth distribution",
      functionLength: "Function length distribution",
      functionKinds: "Function kinds",
      maintainability: "Maintainability distribution",
      parameters: "Parameters distribution",
      halsteadVolume: "Halstead volume distribution",
      fileSize: "File size distribution",
      markers: "Markers",
      ruleViolations: "Rule violations",
    },
    donut: {
      physical: "physical",
      files: "files",
      functions: "functions",
    },
    segment: {
      code: "code",
      comment: "comment",
      blank: "blank",
    },
    kinds: {
      function: "function",
      method: "method",
      arrow: "arrow",
      constructor: "constructor",
      getter: "getter",
      setter: "setter",
    },
  },
  detail: {
    locPill: (physical, code, comment, blank, logical) =>
      `${physical} physical · ${code} code · ${comment} comment · ${blank} blank · ${logical} logical`,
    filesTitle: "Files",
    selectHint: "Select a file on the left",
    kpi: {
      functions: "Functions",
      maintainability: "Maintainability",
      maxCyclomatic: "Max cyclomatic",
      maxCognitive: "Max cognitive",
      maxNesting: "Max nesting",
      codeLines: "Code lines",
      violations: "Violations",
    },
    functionsTitle: (n) => `Functions (${n}) — click a name to locate it`,
    source: "Source",
    sourceTooLarge: (n) => `Source hidden: ${n} lines is too large to display.`,
    table: {
      cyclomatic: "cyclo",
      cognitive: "cog",
      nesting: "nest",
      loc: "loc",
      params: "params",
      maintainability: "MI",
      function: "function",
      line: "line",
    },
  },
};

const DICTIONARIES: Record<Lang, Strings> = { zh, en };
const STORAGE_KEY = "meowanalyze.lang";

let current: Lang = loadLang();
const listeners = new Set<() => void>();

function loadLang(): Lang {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "zh" || stored === "en") return stored;
  } catch {
    // storage unavailable — fall through to the default
  }
  return "zh";
}

export function getLang(): Lang {
  return current;
}

export function setLang(lang: Lang): void {
  if (lang === current) return;
  current = lang;
  try {
    localStorage.setItem(STORAGE_KEY, lang);
  } catch {
    // ignore storage failures
  }
  for (const listener of listeners) listener();
}

export function toggleLang(): void {
  setLang(current === "zh" ? "en" : "zh");
}

export function onLangChange(listener: () => void): void {
  listeners.add(listener);
}

/** Current dictionary. */
export function t(): Strings {
  return DICTIONARIES[current];
}
