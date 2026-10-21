// Planilhas CSV (separador ";", compatível com Excel em português).
export type CsvRow = Record<string, string>;

function escape(value: unknown): string {
  const text = value === null || value === undefined ? '' : String(value);
  // Evita fórmulas maliciosas ao abrir no Excel.
  const safe = /^[=+\-@]/.test(text) ? `'${text}` : text;
  return /[";\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export function toCsv(headers: string[], rows: unknown[][]): string {
  return '\uFEFF' + [headers, ...rows].map((r) => r.map(escape).join(';')).join('\r\n');
}

export function parseCsv(text: string): CsvRow[] {
  const src = text.replace(/^\uFEFF/, '');
  const sep = (src.split(/\r?\n/)[0] ?? '').includes(';') ? ';' : ',';
  const lines: string[][] = [];
  let row: string[] = [], cell = '', quoted = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"' && src[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === sep) { row.push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++;
      row.push(cell); lines.push(row); row = []; cell = '';
    } else cell += ch;
  }
  if (cell || row.length) { row.push(cell); lines.push(row); }
  const filled = lines.filter((l) => l.some((c) => c.trim()));
  const [head, ...body] = filled;
  if (!head) return [];
  const keys = head.map((h) => h.trim().toLowerCase());
  return body.map((l) => Object.fromEntries(keys.map((k, i) => [k, (l[i] ?? '').trim()])));
}

export function download(name: string, content: string) {
  const url = URL.createObjectURL(new Blob([content], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url; a.download = name; a.click();
  URL.revokeObjectURL(url);
}
