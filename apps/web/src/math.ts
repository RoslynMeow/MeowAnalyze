export interface LatexNode {
  node: HTMLElement;
  latex: string;
}

/**
 * Render LaTeX nodes to MathML with Temml, loaded lazily so the initial bundle
 * stays small. The raw LaTeX text is kept as a fallback if rendering fails.
 */
export async function renderLatex(nodes: ReadonlyArray<LatexNode>): Promise<void> {
  if (nodes.length === 0) return;
  try {
    const temml = (await import("temml")).default;
    for (const { node, latex } of nodes) {
      node.innerHTML = temml.renderToString(latex, {
        throwOnError: false,
        displayMode: true,
      });
    }
  } catch {
    // keep the raw LaTeX already shown in the node
  }
}
