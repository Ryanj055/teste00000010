import { describe, expect, it } from 'vitest';
import { parseCsv, toCsv } from '@/lib/gbts/spreadsheet';

describe('planilhas', () => {
  it('lê CSV com ponto e vírgula e aspas', () => {
    expect(parseCsv('nome;tipo\n"Silva; Ltda";PJ\n')).toEqual([{ nome: 'Silva; Ltda', tipo: 'PJ' }]);
  });
  it('neutraliza fórmulas ao exportar', () => {
    expect(toCsv(['a'], [['=SOMA(1)']])).toContain("'=SOMA(1)");
  });
});
