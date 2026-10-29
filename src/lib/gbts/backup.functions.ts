import { createServerFn } from '@tanstack/react-start';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';

/** Tabelas comerciais incluídas no backup; leitura sempre pelas regras do banco (somente o escritório da pessoa). */
export const backupTables = [
  ['clientes', 'clients'], ['processos', 'legal_cases'], ['contratos', 'contracts'], ['parcelas', 'installments'],
  ['recebimentos', 'payments'], ['saldos_cobrancas', 'receivables'], ['despesas', 'expenses'], ['associados', 'associates'],
  ['divisoes_honorarios', 'fee_divisions'], ['repasses', 'fee_payouts'], ['eventos_financeiros', 'finance_events'],
] as const;

export function toCsv(rows: Record<string, unknown>[]): string {
  if (!rows.length) return '';
  const cols = Object.keys(rows[0] ?? {});
  const cell = (v: unknown) => { const s = v == null ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v); return /[",;\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  return '\uFEFF' + [cols.join(';'), ...rows.map((r) => cols.map((c) => cell(r[c])).join(';'))].join('\r\n');
}

export const exportBackup = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const db = context.supabase;
  const { data: id, error } = await db.rpc('backup_start');
  if (error || !id) throw new Error('Somente a administração geral pode gerar backups.');
  try {
    const { data: access } = await db.rpc('my_access');
    const org = (access as { organization?: { name: string; id: string } } | null)?.organization;
    const files: { name: string; csv: string; rows: number }[] = [];
    for (const [name, table] of backupTables) {
      const rows: Record<string, unknown>[] = [];
      for (let from = 0; ; from += 1000) {
        const r = await (db.from as (t: string) => any)(table).select('*').range(from, from + 999);
        if (r.error) throw new Error(`Falha ao ler ${name}`);
        const page = (r.data ?? []) as Record<string, unknown>[];
        rows.push(...page);
        if (page.length < 1000) break;
      }
      files.push({ name: `${name}.csv`, csv: toCsv(rows), rows: rows.length });
    }
    const total = files.reduce((s, f) => s + f.rows, 0);
    const now = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
    const readme = [
      'BACKUP COMERCIAL — GESTÃO JURÍDICA E FINANCEIRA', '',
      `Data e horário da exportação: ${now} (horário de Brasília)`, `Escritório: ${org?.name ?? ''} (${org?.id ?? ''})`, `Identificador do backup: ${id}`, '',
      'Arquivos incluídos (CSV separado por ponto e vírgula, UTF-8):',
      ...files.map((f) => `- ${f.name}: ${f.rows} registro(s)`), '',
      'Os identificadores (id, client_id, contract_id, installment_id, division_id, associate_id) ligam os registros entre os arquivos.',
      'saldos_cobrancas.csv traz valores pagos e saldos calculados de cada parcela; parcelas com superseded=true foram substituídas por renegociação.', '',
      'Limitações conhecidas:',
      '- Inclui somente dados do seu escritório que sua conta pode consultar; não inclui senhas, tokens nem contas de login.',
      '- Não é uma cópia restaurável do banco de dados completo. A cópia integral é feita pelas cópias de segurança automáticas da plataforma.',
      '- Guarde o arquivo em local protegido: ele contém dados pessoais de clientes (LGPD).',
    ].join('\r\n');
    await db.rpc('backup_finish', { p_id: id, p_ok: true, p_files: files.map((f) => ({ name: f.name, rows: f.rows })), p_rows: total, p_error: '' });
    return { id: id as string, files: [...files.map(({ name, csv }) => ({ name, csv })), { name: 'LEIA-ME.txt', csv: readme }], total };
  } catch (err) {
    await db.rpc('backup_finish', { p_id: id, p_ok: false, p_files: [], p_rows: 0, p_error: err instanceof Error ? err.message : 'Falha' });
    throw new Error('O backup falhou e foi registrado no histórico. Tente novamente.');
  }
});

export const listBackups = createServerFn({ method: 'GET' }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const { data, error } = await context.supabase.from('backup_runs').select('*').order('created_at', { ascending: false }).limit(100);
  if (error) throw new Error('Não foi possível consultar o histórico de backups.');
  return data;
});
