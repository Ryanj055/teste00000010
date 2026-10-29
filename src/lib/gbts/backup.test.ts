import { describe, expect, it } from 'vitest';
import { nextFriday } from '@/components/gbts/admin-pages';
import { toCsv } from './backup.functions';

describe('Central de Backups', () => {
  it('lembrete aponta para a próxima sexta-feira', () => {
    expect(nextFriday(new Date(2026, 9, 29)).toDateString()).toBe(new Date(2026, 9, 30).toDateString());
    expect(nextFriday(new Date(2026, 9, 30)).toDateString()).toBe(new Date(2026, 9, 30).toDateString());
    expect(nextFriday(new Date(2026, 9, 31)).toDateString()).toBe(new Date(2026, 10, 6).toDateString());
  });
  it('CSV separa por ponto e vírgula e protege campos com separadores', () => {
    expect(toCsv([{ a: 'x;y', b: 2 }])).toBe('\uFEFFa;b\r\n"x;y";2');
  });
});
