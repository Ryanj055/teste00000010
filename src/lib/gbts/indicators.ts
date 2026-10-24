import { cents } from './finance';

export const workspaceRefreshInterval = 30_000;
export const sumMoney = <T,>(rows: T[], amount: (row: T) => number) =>
  rows.reduce((total, row) => total + cents(amount(row)), 0) / 100;

type Movement = { effective_date: string | null; amount: number | null };
type Expense = { paid_at: string | null; status: string; reimbursable: boolean; amount: number };

export function monthlyMovements(ledger: Movement[], expenses: Expense[], start: string, end: string) {
  const months = new Map<string, { name: string; received: number; expense: number }>();
  const add = (date: string | null, amount: number, field: 'received' | 'expense') => {
    if (!date || date < start || date > end) return;
    const month = date.slice(0, 7);
    const row = months.get(month) ?? { name: `${month.slice(5)}/${month.slice(0, 4)}`, received: 0, expense: 0 };
    row[field] += cents(amount);
    months.set(month, row);
  };
  ledger.forEach(row => add(row.effective_date, Number(row.amount), 'received'));
  expenses.filter(row => row.status === 'Pago' && !row.reimbursable)
    .forEach(row => add(row.paid_at, row.amount, 'expense'));
  return [...months].sort(([a], [b]) => a.localeCompare(b))
    .map(([, row]) => ({ ...row, received: row.received / 100, expense: row.expense / 100 }));
}

export function contractStatuses(contracts: { status: string }[]) {
  const groups = new Map<string, number>();
  contracts.forEach(contract => groups.set(contract.status, (groups.get(contract.status) ?? 0) + 1));
  return [...groups].map(([name, value], i) => ({ name, value, color: ['var(--primary)', 'var(--gold)', 'var(--info)'][i % 3] }));
}