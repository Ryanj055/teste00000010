import { describe, expect, it } from 'vitest';
import { contractStatuses, monthlyMovements, sumMoney } from '@/lib/gbts/indicators';

describe('Indicadores exclusivamente reais', () => {
  it('apresenta zero financeiro e contagens sem registros', () => {
    expect(sumMoney([], Number)).toBe(0);
    expect(contractStatuses([])).toEqual([]);
  });
  it('não inventa pontos para gráficos vazios', () => {
    expect(monthlyMovements([], [], '2026-01-01', '2026-12-31')).toEqual([]);
  });
  it('inclui movimentos reais antigos no período sem limite fixo de seis meses', () => {
    expect(monthlyMovements([{ effective_date: '2025-01-02', amount: 150 }], [], '2025-01-01', '2026-10-24'))
      .toEqual([{ name: '01/2025', received: 150, expense: 0 }]);
  });
  it('respeita o período e não conta despesa pendente ou reembolsável como paga', () => {
    expect(monthlyMovements([{ effective_date: '2026-09-01', amount: 900 }], [
      { paid_at: '2026-10-01', status: 'Pago', reimbursable: false, amount: 100 },
      { paid_at: null, status: 'Pendente', reimbursable: false, amount: 200 },
      { paid_at: '2026-10-02', status: 'Pago', reimbursable: true, amount: 300 },
    ], '2026-10-01', '2026-10-31')).toEqual([{ name: '10/2026', received: 0, expense: 100 }]);
  });
  it('concilia estornos e centavos dos registros reais', () => {
    expect(monthlyMovements([
      { effective_date: '2026-10-01', amount: 0.1 },
      { effective_date: '2026-10-01', amount: 0.2 },
      { effective_date: '2026-10-02', amount: -0.1 },
    ], [], '2026-10-01', '2026-10-31')[0]?.received).toBe(0.2);
  });
  it('conta todos os estados de contrato cadastrados sem categorias fixas', () => {
    expect(contractStatuses([{status:'Ativo'}, {status:'Suspenso'}, {status:'Ativo'}]).map(({name,value})=>({name,value})))
      .toEqual([{name:'Ativo',value:2},{name:'Suspenso',value:1}]);
  });
});