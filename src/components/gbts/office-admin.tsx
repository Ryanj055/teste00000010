import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from '@tanstack/react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { LockKeyhole, LogOut, UserPlus, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import logo from '@/assets/gbts-logo.jpeg.asset.json';
import { inviteMember, listMembers, setMember, type OrgStatus } from '@/lib/gbts/admin.functions';
import { renegotiate } from '@/lib/gbts/data.functions';
import { dateLabel, money, schedule, today, type Schedule } from '@/lib/gbts/finance';
import { Field, Modal } from './forms';
import { DeveloperSignature } from './developer-signature';

export const statusLabels: Record<OrgStatus, string> = { setup: 'Em configuração', trial: 'Em teste', active: 'Ativo', payment_pending: 'Pagamento pendente', suspended: 'Suspenso', closed: 'Encerrado' };
export const statusLabel = (s: string) => statusLabels[s as OrgStatus] ?? s;

async function signOutTo(navigate: ReturnType<typeof useNavigate>, qc: ReturnType<typeof useQueryClient>) {
  await qc.cancelQueries(); qc.clear(); await supabase.auth.signOut(); await navigate({ to: '/auth', replace: true });
}

export function AccessBlocked({ status, name, rtg }: { status: OrgStatus | null; name: string | null; rtg: boolean }) {
  const navigate = useNavigate(), qc = useQueryClient();
  const message = !status ? 'Sua conta não está vinculada a um escritório ativo. Solicite um convite à administradora do seu escritório.'
    : status === 'suspended' ? 'O acesso do escritório está suspenso. Os dados estão preservados e o acesso volta assim que a situação for regularizada com a RTG Systems.'
    : status === 'closed' ? 'A assinatura deste escritório foi encerrada. Os dados permanecem preservados; entre em contato com a RTG Systems.'
    : 'O período contratado ou de teste terminou. Entre em contato com a RTG Systems para renovar o acesso.';
  return <div className="login-screen"><div className="login-wrap"><img className="login-brand" src={logo.url} alt="Gabriella Barreto & Thais Sardinha — Advogados Associados · Parceria Legal" />
    <div className="login-form"><LockKeyhole className="text-gold mb-4" /><h1>Acesso indisponível</h1>{name && <p className="!mb-2"><strong>{name}</strong>{status && ` · ${statusLabel(status)}`}</p>}<p>{message}</p>
      <div className="flex gap-2 flex-wrap">{rtg && <Button asChild><Link to="/rtg">Abrir Painel RTG</Link></Button>}<Button variant="outline" onClick={() => signOutTo(navigate, qc)}><LogOut />Sair</Button></div></div>
    <footer className="login-footer"><DeveloperSignature /></footer></div></div>;
}

export function Renegotiate({ contractId, balance, onDone }: { contractId: string; balance: number; onDone: () => void }) {
  const qc = useQueryClient(); const save = useServerFn(renegotiate);
  const [open, setOpen] = useState(false), [rows, setRows] = useState<Schedule[] | null>(null), [reason, setReason] = useState(''), [busy, setBusy] = useState(false), [error, setError] = useState('');
  function build(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); const f = new FormData(e.currentTarget); setError('');
    try { setReason(String(f.get('reason'))); setRows(schedule(balance, 0, Number(f.get('count')), String(f.get('start')), Number(f.get('frequency')))); }
    catch (err) { setError(err instanceof Error ? err.message : 'Revise os dados.'); }
  }
  async function confirm() {
    if (!rows) return; setBusy(true); setError('');
    try { await save({ data: { contract: contractId, reason, schedule: rows } }); toast.success('Contrato renegociado. Pagamentos anteriores foram preservados.'); await qc.invalidateQueries({ queryKey: ['workspace'] }); setOpen(false); onDone(); }
    catch (err) { setError(err instanceof Error ? err.message : 'Não foi possível renegociar.'); } finally { setBusy(false); }
  }
  return <><Button variant="outline" className="mt-6 ml-2" onClick={() => setOpen(true)}><RefreshCw />Renegociar saldo</Button>
    {open && <Modal title="Renegociar saldo em aberto" onClose={() => setOpen(false)}><div className="modal-body">
      <div className="form-note">Saldo em aberto: <strong>{money(balance)}</strong>. Parcelas já pagas permanecem no histórico; somente o saldo pendente recebe um novo cronograma, sem contar recebimentos duas vezes.</div>
      {!rows ? <form id="reneg" onSubmit={build}><div className="form-grid">
        <Field label="Quantidade de parcelas"><input name="count" type="number" min={1} max={120} required defaultValue={3} /></Field>
        <Field label="Primeiro vencimento"><input name="start" type="date" required defaultValue={today()} /></Field>
        <Field label="Periodicidade"><select name="frequency" defaultValue="1"><option value="1">Mensal</option><option value="2">Bimestral</option><option value="3">Trimestral</option></select></Field>
        <Field label="Motivo" full><input name="reason" required minLength={3} maxLength={500} placeholder="Ex.: acordo com o cliente" /></Field>
      </div></form> : <>{rows.map((r, i) => <div className="form-grid mb-3" key={r.label}><Field label={`${r.label} · valor (R$)`}><input type="number" min="0.01" step="0.01" value={r.amount} onChange={(e) => setRows(rows.map((x, n) => n === i ? { ...x, amount: Number(e.target.value) } : x))} /></Field><Field label="Vencimento"><input type="date" value={r.due_date} onChange={(e) => setRows(rows.map((x, n) => n === i ? { ...x, due_date: e.target.value } : x))} /></Field></div>)}
        <p className="text-xs">Total do novo cronograma: <strong>{money(rows.reduce((s, r) => s + r.amount, 0))}</strong></p></>}
      {error && <div className="form-error" role="alert">{error}</div>}
    </div><div className="modal-footer"><Button variant="outline" onClick={() => rows ? setRows(null) : setOpen(false)}>{rows ? 'Voltar' : 'Cancelar'}</Button>
      {rows ? <Button disabled={busy} onClick={confirm}>{busy ? 'Salvando…' : 'Confirmar renegociação'}</Button> : <Button type="submit" form="reneg">Revisar cronograma</Button>}</div></Modal>}</>;
}

export function TeamPage() {
  const qc = useQueryClient(); const list = useServerFn(listMembers), invite = useServerFn(inviteMember), update = useServerFn(setMember);
  const q = useQuery({ queryKey: ['members'], queryFn: () => list() });
  const [busy, setBusy] = useState(false), [confirmOff, setConfirmOff] = useState<{ id: string; email: string | null; role: 'admin' | 'member' } | null>(null);
  async function send(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); const form = e.currentTarget; const f = new FormData(form); setBusy(true);
    try { await invite({ data: { email: String(f.get('email')), role: f.get('role') === 'admin' ? 'admin' : 'member', redirect: window.location.origin } }); toast.success('Convite enviado por e-mail.'); form.reset(); await qc.invalidateQueries({ queryKey: ['members'] }); }
    catch (err) { toast.error(err instanceof Error ? err.message : 'Não foi possível convidar.'); } finally { setBusy(false); }
  }
  async function change(id: string, active: boolean, role: 'admin' | 'member') {
    try { await update({ data: { id, active, role } }); toast.success('Acesso atualizado.'); await qc.invalidateQueries({ queryKey: ['members'] }); }
    catch (err) { toast.error(err instanceof Error ? err.message : 'Não foi possível atualizar.'); }
  }
  return <><div className="page-heading"><div><div className="eyebrow">ADMINISTRAÇÃO DO ESCRITÓRIO</div><h1>Equipe e acessos</h1><p>Convide, desative ou altere o papel das usuárias do seu escritório.</p></div></div>
    <section className="panel mb-6"><div className="table-heading"><div><h2>Convidar usuária</h2><p>A pessoa recebe um e-mail para definir a própria senha</p></div></div>
      <form className="toolbar !m-0 p-5 flex-wrap" onSubmit={send}><input name="email" type="email" required maxLength={255} placeholder="E-mail da usuária" aria-label="E-mail" className="!max-w-sm" />
        <select name="role" aria-label="Papel" defaultValue="member"><option value="member">Usuária</option><option value="admin">Administradora</option></select><Button disabled={busy}><UserPlus />{busy ? 'Enviando…' : 'Enviar convite'}</Button></form></section>
    <section className="panel">{q.isLoading ? <div className="empty">Carregando equipe…</div> : q.error ? <div className="empty">{q.error.message}</div> :
      <div className="overflow-x-auto"><table className="data-table"><thead><tr><th>E-MAIL</th><th>PAPEL</th><th>SITUAÇÃO</th><th>DESDE</th><th /></tr></thead><tbody>
        {q.data?.members.map((m) => { const self = m.user_id === q.data.me; const role = m.role === 'admin' ? 'admin' : 'member';
          return <tr key={m.id}><td>{m.email}{self && <span className="cell-secondary block">Você</span>}</td>
            <td><select aria-label={`Papel de ${m.email}`} disabled={self} value={role} onChange={(e) => change(m.id, m.active, e.target.value === 'admin' ? 'admin' : 'member')}><option value="member">Usuária</option><option value="admin">Administradora</option></select></td>
            <td><span className={`badge ${m.active ? 'paid' : 'partial'}`}>{m.active ? 'Ativa' : 'Desativada'}</span></td><td>{dateLabel(m.created_at)}</td>
            <td>{!self && (m.active ? <Button variant="outline" size="sm" onClick={() => setConfirmOff({ id: m.id, email: m.email, role })}>Desativar</Button> : <Button variant="outline" size="sm" onClick={() => change(m.id, true, role)}>Reativar</Button>)}</td></tr>; })}
      </tbody></table></div>}</section>
    {confirmOff && <Modal title="Desativar acesso" onClose={() => setConfirmOff(null)}><div className="modal-body"><p className="text-sm">{confirmOff.email} deixará de acessar o escritório. Os registros criados por ela são preservados.</p></div>
      <div className="modal-footer"><Button variant="outline" onClick={() => setConfirmOff(null)}>Cancelar</Button><Button variant="destructive" onClick={async () => { await change(confirmOff.id, false, confirmOff.role); setConfirmOff(null); }}>Desativar</Button></div></Modal>}
  </>;
}
