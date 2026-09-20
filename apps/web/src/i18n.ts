export type Lang = "zh" | "en";

export interface Strings {
  pages: {
    dashboard: string;
    detail: string;
  };
  common: {
    settings: string;
    exportJson: string;
    newAnalysis: string;
    cancel: string;
    apply: string;
    back: string;
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
    pills: {
      files: (n: number) => string;
      functions: (n: number) => string;
      violations: (n: number) => string;
      markers: (todo: number, fixme: number, hack: number) => string;
    };
    maintainability: {
      low: string;
      moderate: string;
      healthy: string;
    };
    kpi: {
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
    dashboard: "大屏",
    detail: "文件详情",
  },
  common: {
    settings: "设置",
    exportJson: "导出 JSON",
    newAnalysis: "重新分析",
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
  settings: {
    title: "设置",
    hint: "超过阈值的函数会被标记为违规。",
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
    pills: {
      files: (n) => `${n} 个文件`,
      functions: (n) => `${n} 个函数`,
      violations: (n) => `${n} 处违规`,
      markers: (todo, fixme, hack) => `TODO ${todo} · FIXME ${fixme} · HACK ${hack}`,
    },
    maintainability: {
      low: "难以维护",
      moderate: "中等",
      healthy: "健康",
    },
    kpi: {
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
    exportJson: "Export JSON",
    newAnalysis: "New analysis",
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
  settings: {
    title: "Settings",
    hint: "Thresholds flag functions that exceed them.",
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
    pills: {
      files: (n) => `${n} files`,
      functions: (n) => `${n} functions`,
      violations: (n) => `${n} violations`,
      markers: (todo, fixme, hack) => `TODO ${todo} · FIXME ${fixme} · HACK ${hack}`,
    },
    maintainability: {
      low: "hard to maintain",
      moderate: "moderate",
      healthy: "healthy",
    },
    kpi: {
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
