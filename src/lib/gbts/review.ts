import { cents } from './finance';
export type Allocation = { associate_id: string; value: number };
export function allocate(base: number, mode: string, rows: Allocation[]) {
  if (!rows.length || rows.some(x => !Number.isFinite(x.value) || x.value <= 0)) throw new Error('Informe participações positivas.');
  const sum = rows.reduce((s, x) => s + cents(x.value), 0);
  if (mode === 'percent' ? sum !== 10000 : sum !== cents(base)) throw new Error(mode === 'percent' ? 'Os percentuais devem totalizar 100%.' : 'Os valores devem totalizar o montante distribuível.');
  let remaining = cents(base);
  return rows.map((x, i) => { const value = mode === 'fixed' ? cents(x.value) : i === rows.length - 1 ? remaining : Math.floor(cents(base) * x.value / 100); remaining -= value; return { ...x, amount: value / 100 }; });
}
export function deadlineState(date: string | null, status: string, now: string) {
  if (status === 'Encerrado' || status === 'Arquivado') return { label: 'Não aplicável', days: null };
  if (!date) return { label: 'Sem prazo', days: null };
  const days = Math.round((Date.parse(date) - Date.parse(now)) / 86400000);
  return { label: days < 0 ? 'Vencido' : days <= 7 ? 'Próximo' : 'Em dia', days };
}
export const paymentMethods = ['Pix', 'Dinheiro', 'Transferência bancária', 'Cartão de crédito', 'Cartão de débito', 'Boleto', 'Outra forma'];
export const modalities = [
  { value: 'Fixos', label: 'Valor fixo', description: 'Valor definido com cronograma de vencimentos.' },
  { value: 'Parcelados', label: 'Pagamento parcelado', description: 'Total dividido em parcelas revisáveis.' },
  { value: 'Mensais', label: 'Mensal por prazo definido', description: 'Parcelas mensais com total e quantidade definidos.' },
  { value: 'Mistos', label: 'Entrada e parcelas', description: 'Entrada combinada com parcelas individualizadas.' },
];