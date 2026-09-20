import { el } from "./dom.js";

export interface Column {
  header: string;
  align?: "left" | "right";
  sortable?: boolean;
}

export interface Cell {
  content: Node | string | number;
  value?: string | number;
  class?: string;
}

function cellValue(cell: Cell): string | number {
  if (cell.value !== undefined) return cell.value;
  if (typeof cell.content === "string" || typeof cell.content === "number") {
    return cell.content;
  }
  return cell.content.textContent ?? "";
}

/** A table whose headers sort the body when clicked. */
export function dataTable(columns: Column[], rows: Cell[][]): HTMLTableElement {
  const table = el("table", { class: "data" });
  const headRow = el("tr");
  const tbody = el("tbody");
  let sortIndex = -1;
  let direction: 1 | -1 = 1;

  const renderBody = (): void => {
    const data =
      sortIndex < 0
        ? rows
        : [...rows].sort((a, b) => {
            const av = cellValue(a[sortIndex] ?? { content: "" });
            const bv = cellValue(b[sortIndex] ?? { content: "" });
            if (typeof av === "number" && typeof bv === "number") {
              return (av - bv) * direction;
            }
            return String(av).localeCompare(String(bv)) * direction;
          });
    tbody.replaceChildren(
      ...data.map((row) =>
        el(
          "tr",
          {},
          ...row.map((cell, index) =>
            el(
              "td",
              { class: cell.class ?? (columns[index]?.align === "right" ? "right" : undefined) },
              cell.content,
            ),
          ),
        ),
      ),
    );
  };

  const arrows: HTMLElement[] = [];
  columns.forEach((column, index) => {
    const arrow = el("span", { class: "sort-arrow" });
    const th = el(
      "th",
      { class: column.align === "right" ? "right" : undefined },
      column.header,
      arrow,
    );
    if (column.sortable !== false) {
      th.classList.add("sortable");
      th.addEventListener("click", () => {
        if (sortIndex === index) {
          direction = direction === 1 ? -1 : 1;
        } else {
          sortIndex = index;
          direction = 1;
        }
        arrows.forEach((node, i) => {
          node.textContent = i === sortIndex ? (direction === 1 ? " ▲" : " ▼") : "";
        });
        renderBody();
      });
    }
    arrows.push(arrow);
    headRow.append(th);
  });

  renderBody();
  table.append(el("thead", {}, headRow), tbody);
  return table;
}
