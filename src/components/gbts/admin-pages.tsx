import { useState, type FormEvent } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { zipSync, strToU8 } from 'fflate';
import { Archive, CalendarClock, ShieldOff, ShieldPlus, UserX } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { exportBackup, listBackups } from '@/lib/gbts/backup.functions';
import { getTeamAdmin, grantRtg, removeSelf, revokeRtg } from '@/lib/gbts/admin.functions';
import { Field, Modal } from './forms';

const when = (s: string | null) => (s ? new Date(s).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '—');

/** Próxima sexta-feira (hoje, se for sexta). */
export function nextFriday(from = new Date()): Date {
  const d = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  d.setDate(d.getDate() + ((5 - d.getDay() + 7) % 7));
  return d;
}

export function BackupCenter() {
  const qc = useQueryClient();
  const run = useServerFn(exportBackup), list = useServerFn(listBackups);
  const q = useQuery({ queryKey: ['backups'], queryFn: () => list() });
  const [busy, setBusy] = useState(false);
  const last = q.data?.find((b) => b.status === 'Concluído');
  const lastDate = last ? new Date(last.created_at) : null;
  const friday = nextFriday();
  const dueThisWeek = !lastDate || (Date.now() - lastDate.getTime()) / 86400000 >= 7;

  async function backup() {
    setBusy(true);
    try {
      const r = await run();
      const zip = zipSync(Object.fromEntries(r.files.map((f) => [f.name, strToU8(f.csv)])));
      const blob = new Blob([zip as BlobPart], { type: 'application/zip' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `backup-gestao-${new Date().toISOString().slice(0, 10)}.zip`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
      toast.success(`Backup gerado com ${r.total} registro(s). O download foi iniciado — confira a pasta de downloads.`);
    } catch (err) { toast.error(err instanceof Error ? err.message : 'O backup falhou.'); }
    finally { setBusy(false); await qc.invalidateQueries({ queryKey: ['backups'] }); }
  }

  return <>
    <div className="page-heading"><div><div className="eyebrow">ADMINISTRAÇÃO DO ESCRITÓRIO</div><h1>Central de Backups</h1><p>Exporte os dados comerciais do escritório em um arquivo ZIP com planilhas CSV.</p></div>
      <Button disabled={busy} onClick={backup}><Archive />{busy ? 'Gerando…' : 'Fazer backup agora'}</Button></div>
    <section className="panel p-5 mb-5"><div className="flex items-start gap-3"><CalendarClock className="text-gold shrink-0" />
      <div className="text-sm"><p><strong>Último backup concluído:</strong> {lastDate ? when(last!.created_at) : 'nenhum ainda'}.</p>
        <p><strong>Rotina recomendada:</strong> um backup manual toda sexta-feira. Próxima: {friday.toLocaleDateString('pt-BR')}.{dueThisWeek && <span className="badge overdue ml-2">Backup da semana pendente</span>}</p>
        <p className="text-xs text-muted-foreground mt-2">O arquivo não fica guardado no sistema: ele é gerado na hora e baixado no seu computador. Guarde-o em local protegido, pois contém dados de clientes. Não inclui senhas nem contas de login.</p>
        <p className="text-xs text-muted-foreground mt-1">Este ZIP não é uma cópia restaurável do banco completo. A plataforma mantém cópias de segurança automáticas diárias do banco, restauradas pela RTG Systems.</p></div></div></section>
    <section className="panel">{q.isLoading ? <div className="empty">Carregando histórico…</div> : q.error ? <div className="empty">{q.error.message}</div> : !q.data?.length ? <div className="empty">Nenhum backup gerado ainda.</div> :
      <div className="overflow-x-auto"><table className="data-table"><thead><tr><th>DATA</th><th>SOLICITADO POR</th><th>TIPO</th><th>STATUS</th><th>RESULTADO</th></tr></thead><tbody>
        {q.data.map((b) => <tr key={b.id}><td>{when(b.created_at)}</td><td>{b.requested_name || '—'}</td><td>{b.kind}</td>
          <td><span className={`badge ${b.status === 'Concluído' ? 'paid' : b.status === 'Falha' ? 'overdue' : 'partial'}`}>{b.status}</span></td>
          <td className="text-xs">{b.status === 'Falha' ? b.error : b.status === 'Concluído' ? `${b.row_count ?? 0} registro(s) em ${(b.files as unknown[]).length} arquivo(s) · arquivo baixado no momento da geração; para nova cópia, gere outro backup` : 'Em processamento'}</td></tr>)}
      </tbody></table></div>}</section>
  </>;
}

/** Administradores, autorizações da RTG e histórico — dentro de Equipe e acessos. */
export function TeamAdminSection() {
  const qc = useQueryClient();
  const get = useServerFn(getTeamAdmin), grant = useServerFn(grantRtg), revoke = useServerFn(revokeRtg);
  const q = useQuery({ queryKey: ['team-admin'], queryFn: () => get() });
  const [busy, setBusy] = useState(false);
  async function add(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); const form = e.currentTarget; setBusy(true);
    try { await grant({ data: { email: String(new FormData(form).get('email')) } }); toast.success('Acesso da RTG autorizado.'); form.reset(); await qc.invalidateQueries({ queryKey: ['team-admin'] }); }
    catch (err) { toast.error(err instanceof Error ? err.message : 'Não foi possível autorizar.'); } finally { setBusy(false); }
  }
  const active = q.data?.authorizations.filter((a) => !a.revoked_at) ?? [];
  return <>
    <section className="panel p-5 mt-5"><h2 className="text-lg mb-1">Acesso opcional da RTG Systems</h2>
      <p className="text-xs text-muted-foreground mb-4">A RTG não vê dados do escritório por padrão. Aqui você pode autorizar uma pessoa específica da RTG a acompanhar o histórico de backups (sem acesso ao conteúdo). Se precisar que alguém da RTG use as áreas jurídica ou financeira, convide essa pessoa pela lista acima com um perfil próprio. Revogar não afeta seus dados nem seus backups.</p>
      <form className="toolbar !m-0 !p-0 flex-wrap mb-4" onSubmit={add}><input name="email" type="email" required maxLength={255} placeholder="E-mail da pessoa da RTG" aria-label="E-mail da RTG" className="!max-w-sm" /><Button disabled={busy}><ShieldPlus />Autorizar</Button></form>
      {!active.length ? <p className="text-sm">Nenhuma autorização ativa.</p> : active.map((a) => <div key={a.id} className="flex items-center justify-between gap-2 py-2 border-t text-sm"><span>{a.rtg_email} · Histórico de backups · desde {when(a.granted_at)}</span>
        <Button size="sm" variant="outline" onClick={async () => { try { await revoke({ data: { id: a.id } }); toast.success('Autorização revogada.'); await qc.invalidateQueries({ queryKey: ['team-admin'] }); } catch (err) { toast.error(err instanceof Error ? err.message : 'Não foi possível revogar.'); } }}><ShieldOff size={14} />Revogar</Button></div>)}
    </section>
    <section className="panel p-5 mt-5"><h2 className="text-lg mb-3">Histórico administrativo</h2>
      {q.isLoading ? <p className="text-sm">Carregando…</p> : q.error ? <p className="text-sm">{q.error.message}</p> : !q.data?.events.length ? <p className="text-sm">Nenhuma alteração registrada.</p> :
        <ul className="text-sm space-y-2">{q.data.events.map((e) => { const d = (e.details ?? {}) as Record<string, unknown>; return <li key={e.id} className="border-b pb-2"><strong>{e.action}</strong> <span className="text-muted-foreground">· {when(e.created_at)}</span><span className="block text-xs text-muted-foreground">{Object.entries(d).map(([k, v]) => `${k}: ${String(v)}`).join(' · ')}</span></li>; })}</ul>}
    </section>
  </>;
}

export function ProfilePage({ generalAdmin }: { generalAdmin: boolean }) {
  const me = useQuery({ queryKey: ['me-email'], queryFn: async () => (await supabase.auth.getUser()).data.user?.email ?? '' });
  const email = me.data ?? '';
  const navigate = useNavigate(), qc = useQueryClient(); const remove = useServerFn(removeSelf);
  const [open, setOpen] = useState(false), [text, setText] = useState(''), [busy, setBusy] = useState(false), [error, setError] = useState('');
  async function confirm() {
    setBusy(true); setError('');
    try { await remove({ data: { confirm: 'REMOVER' } }); qc.clear(); await supabase.auth.signOut(); toast.success('Seu perfil foi removido.'); await navigate({ to: '/auth', replace: true }); }
    catch (err) { setError(err instanceof Error ? err.message : 'Não foi possível remover.'); } finally { setBusy(false); }
  }
  return <>
    <div className="page-heading"><div><div className="eyebrow">CONTA</div><h1>Meu perfil</h1><p>{email}</p></div></div>
    <section className="panel p-5"><h2 className="text-lg mb-2">Senha</h2><p className="text-sm mb-3">Para trocar a senha, saia e use "Esqueci minha senha" na tela de acesso: você recebe um link individual por e-mail.</p></section>
    <section className="panel p-5 mt-5"><h2 className="text-lg mb-2">Remover meu perfil</h2>
      <p className="text-sm mb-3">Encerra seu acesso e apaga sua conta de login. Clientes, processos, contratos, cobranças, despesas, repasses e históricos do escritório são preservados.</p>
      {generalAdmin && <div className="form-note mb-3">Você é a administração geral. Transfira a função para outra pessoa em "Equipe e acessos" antes de remover seu perfil.</div>}
      <Button variant="destructive" disabled={generalAdmin} onClick={() => setOpen(true)}><UserX />Remover meu perfil</Button></section>
    {open && <Modal title="Remover meu perfil" onClose={() => setOpen(false)}><div className="modal-body">
      <p className="text-sm mb-2"><strong>Será removido:</strong> seu vínculo com o escritório, sua conta de login e todas as suas sessões.</p>
      <p className="text-sm mb-3"><strong>Será preservado:</strong> todos os registros do escritório, inclusive os que você criou. A operação fica no histórico administrativo e não pode ser desfeita.</p>
      <Field label='Digite REMOVER para confirmar' full><input value={text} onChange={(e) => setText(e.target.value)} /></Field>
      {error && <div className="form-error" role="alert">{error}</div>}
    </div><div className="modal-footer"><Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button><Button variant="destructive" disabled={busy || text !== 'REMOVER'} onClick={confirm}>{busy ? 'Removendo…' : 'Remover definitivamente'}</Button></div></Modal>}
  </>;
}

