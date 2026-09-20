export type Lang = "zh" | "en";

export interface HelpSection {
  title: string;
  body: string;
  /** LaTeX formulas, rendered as MathML. */
  formulas?: readonly string[];
  items?: readonly string[];
}

export interface Strings {
  pages: {
    dashboard: string;
    detail: string;
  };
  common: {
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
    intro: string;
    sections: readonly HelpSection[];
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
    alerts: {
      violations: (n: number) => string;
      markers: (n: number) => string;
    };
    kpiDetail: {
      avg: (n: number) => string;
      scale: (files: number, functions: number) => string;
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
  },
  common: {
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
  help: {
    title: "帮助 · 指标说明",
    intro: "这里解释每一项指标的定义与计算公式，公式由 LaTeX 渲染。",
    sections: [
      {
        title: "语言检测",
        body: "先按文件扩展名判断语言。TypeScript / JavaScript 使用官方编译器解析为 AST，再在 AST 上统计各项指标。",
      },
      {
        title: "圈复杂度",
        body: "衡量函数中独立执行路径的数量。函数基础值为 1，每个决策点加 1。",
        formulas: ["CC = 1 + \\#\\{\\text{决策点}\\}"],
        items: [
          "if / else if",
          "for、for-in、for-of",
          "while、do-while",
          "switch 的每个 case",
          "catch",
          "三元表达式 ?:",
          "逻辑运算符 &&、||、??",
        ],
      },
      {
        title: "认知复杂度",
        body: "Sonar 风格，按嵌套深度加权：每个结构记 1 + 当前嵌套层数；else if 链保持平坦；同类逻辑运算符的连续序列只记 1 分。",
        formulas: ["Cog = \\sum_{i}\\left(1 + \\text{nesting}_i\\right) + \\#\\{\\text{逻辑序列}\\}"],
      },
      {
        title: "嵌套深度",
        body: "函数体内控制结构（if、循环、switch、try）的最大嵌套层数。",
        formulas: ["D = \\max_{n}\\,\\text{nesting}(n)"],
      },
      {
        title: "Halstead",
        body: "由函数中的运算符与操作数统计得出的一组软件科学度量。",
        formulas: [
          "n = n_1 + n_2",
          "N = N_1 + N_2",
          "V = N \\log_2 n",
          "D = \\frac{n_1}{2}\\cdot\\frac{N_2}{n_2}",
          "E = D\\cdot V",
        ],
        items: [
          "n₁ / N₁：不同 / 总运算符数",
          "n₂ / N₂：不同 / 总操作数数",
          "V：体积",
          "D：难度",
          "E：工作量",
        ],
      },
      {
        title: "可维护性指数",
        body: "综合体积、圈复杂度与代码行得到的 0–100 评分，越高越易维护。",
        formulas: [
          "MI = 171 - 3.42\\,\\ln V - 0.23\\,CC - 16.2\\,\\ln(LOC)",
          "MI_{\\text{norm}} = \\max\\!\\left(0,\\ \\min\\!\\left(100,\\ \\frac{MI \\times 100}{171}\\right)\\right)",
        ],
      },
      {
        title: "代码行",
        body: "按行拆分的口径，四类之和等于物理行数；逻辑行是 AST 中语句节点的数量。",
        formulas: ["physical = code + comment + blank"],
      },
      {
        title: "注释密度",
        body: "非空行中注释所占的比例。",
        formulas: ["density = \\frac{comment}{code + comment} \\times 100\\%"],
      },
      {
        title: "标记",
        body: "注释中 TODO、FIXME、HACK 的出现次数。",
      },
      {
        title: "分布聚合",
        body: "每个指标都会在所有函数上汇总为分布，供图表与 CI 门禁使用。",
        formulas: [
          "\\bar{x} = \\frac{1}{n}\\sum_{i=1}^{n} x_i",
          "sum,\\quad \\min x_i,\\quad \\max x_i",
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
      functionLoc: "每个函数的物理行数上限",
      fileLoc: "每个文件的物理行数上限",
    },
  },
  dashboard: {
    title: "分析大屏",
    alerts: {
      violations: (n) => `${n} 处违规`,
      markers: (n) => `${n} 个标记`,
    },
    kpiDetail: {
      avg: (n) => `平均 ${n}`,
      scale: (files, functions) => `${files} 文件 · ${functions} 函数`,
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
  },
  common: {
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
  help: {
    title: "Help · metric reference",
    intro: "Definitions and formulas for every metric. Formulas are rendered from LaTeX.",
    sections: [
      {
        title: "Language detection",
        body: "The language is chosen from the file extension first. TypeScript / JavaScript is parsed into an AST with the official compiler, and all metrics are measured on that AST.",
      },
      {
        title: "Cyclomatic complexity",
        body: "Counts independent execution paths in a function. The base value is 1 and every decision point adds 1.",
        formulas: ["CC = 1 + \\#\\{\\text{decision points}\\}"],
        items: [
          "if / else if",
          "for, for-in, for-of",
          "while, do-while",
          "each case of a switch",
          "catch",
          "ternary ?:",
          "logical operators &&, ||, ??",
        ],
      },
      {
        title: "Cognitive complexity",
        body: "Sonar style, weighted by nesting depth: each construct scores 1 + current nesting; else-if chains stay flat; a run of like logical operators scores once.",
        formulas: ["Cog = \\sum_{i}\\left(1 + \\text{nesting}_i\\right) + \\#\\{\\text{logical runs}\\}"],
      },
      {
        title: "Nesting depth",
        body: "Maximum depth of nested control constructs (if, loops, switch, try) inside a function body.",
        formulas: ["D = \\max_{n}\\,\\text{nesting}(n)"],
      },
      {
        title: "Halstead",
        body: "A set of software-science measures derived from the operators and operands in a function.",
        formulas: [
          "n = n_1 + n_2",
          "N = N_1 + N_2",
          "V = N \\log_2 n",
          "D = \\frac{n_1}{2}\\cdot\\frac{N_2}{n_2}",
          "E = D\\cdot V",
        ],
        items: [
          "n₁ / N₁: distinct / total operators",
          "n₂ / N₂: distinct / total operands",
          "V: volume",
          "D: difficulty",
          "E: effort",
        ],
      },
      {
        title: "Maintainability index",
        body: "A 0–100 score combining volume, cyclomatic complexity and lines of code. Higher is easier to maintain.",
        formulas: [
          "MI = 171 - 3.42\\,\\ln V - 0.23\\,CC - 16.2\\,\\ln(LOC)",
          "MI_{\\text{norm}} = \\max\\!\\left(0,\\ \\min\\!\\left(100,\\ \\frac{MI \\times 100}{171}\\right)\\right)",
        ],
      },
      {
        title: "Lines of code",
        body: "Line split by kind; the four kinds sum to the physical line count. Logical lines are AST statement nodes.",
        formulas: ["physical = code + comment + blank"],
      },
      {
        title: "Comment density",
        body: "Share of non-blank lines that are comments.",
        formulas: ["density = \\frac{comment}{code + comment} \\times 100\\%"],
      },
      {
        title: "Markers",
        body: "Counts of TODO, FIXME and HACK found in comments.",
      },
      {
        title: "Distribution aggregate",
        body: "Every metric is aggregated over all functions into a distribution, used by charts and CI gates.",
        formulas: [
          "\\bar{x} = \\frac{1}{n}\\sum_{i=1}^{n} x_i",
          "sum,\\quad \\min x_i,\\quad \\max x_i",
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
      functionLoc: "Max physical lines per function",
      fileLoc: "Max physical lines per file",
    },
  },
  dashboard: {
    title: "Analysis dashboard",
    alerts: {
      violations: (n) => `${n} violation${n === 1 ? "" : "s"}`,
      markers: (n) => `${n} marker${n === 1 ? "" : "s"}`,
    },
    kpiDetail: {
      avg: (n) => `avg ${n}`,
      scale: (files, functions) => `${files} files · ${functions} functions`,
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
