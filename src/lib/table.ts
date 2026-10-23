/** Reading tables pasted from Excel (tab-separated) or CSV files. Pure: usable on the server and in the browser. */

/** Splits pasted text into rows of cells. Tab-separated (Excel paste) or comma-separated (CSV with quotes). */
export function parseTable(text: string): string[][] {
  const clean = text.replace(/^﻿/, "").replace(/\r\n?/g, "\n");
  const firstLine = clean.split("\n", 1)[0] ?? "";
  const delim = firstLine.includes("\t") ? "\t" : firstLine.split(";").length > firstLine.split(",").length ? ";" : ",";
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i];
    if (quoted) {
      if (ch === '"' && clean[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"' && cell === "") quoted = true;
    else if (ch === delim) {
      row.push(cell);
      cell = "";
    } else if (ch === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += ch;
  }
  if (cell !== "" || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows.map((r) => r.map((c) => c.trim())).filter((r) => r.some((c) => c !== ""));
}
