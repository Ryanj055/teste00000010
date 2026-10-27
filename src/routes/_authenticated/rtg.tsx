import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { useState, type FormEvent } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { Plus, Pencil, LogOut, UserPlus, ArrowLeft, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { head, dateLabel } from '@/lib/gbts/finance';
import { designateGeneralAdmin, inviteMember, listOrganizations, orgStatuses, saveOrganization, type OrgStatus } from '@/lib/gbts/admin.functions';
import { Field, Modal } from '@/components/gbts/forms';
import { statusLabel } from '@/components/gbts/office-admin';
import { DeveloperSignature } from '@/components/gbts/developer-signature';

export const Route = createFileRoute('/_authenticated/rtg')({
  head: () => head('Painel RTG', 'Administração de escritórios clientes e assinaturas da RTG Systems.'),
  component: RtgPanel,
});

type Org = Awaited<ReturnType<typeof listOrganizations>>['organizations'][number];

function RtgPanel() {
  const fetcher = useServerFn(listOrganizations), qc = useQueryClient(), navigate = useNavigate();
  const q = useQuery({ queryKey: ['rtg'], queryFn: () => fetcher() });
  const [edit, setEdit] = useState<Org | 'new' | null>(null), [inviteFor, setInviteFor] = useState<Org | null>(null), [adminFor, setAdminFor] = useState<Org | null>(null);
  async function logout() { await qc.cancelQueries(); qc.clear(); await supabase.auth.signOut(); await navigate({ to: '/auth', replace: true }); }
  return <div className="min-h-screen bg-background"><header className="topbar"><div><div className="eyebrow !m-0">RTG SYSTEMS</div><strong>Painel administrativo</strong></div>
    <div className="flex gap-2"><Button variant="ghost" size="sm" asChild><Link to="/dashboard"><ArrowLeft />Escritório</Link></Button><Button variant="ghost" size="icon" aria-label="Sair" onClick={logout}><LogOut size={17} /></Button></div></header>
    <main className="content">
      <div className="page-heading"><div><h1>Escritórios clientes</h1><p>Assinaturas, períodos de teste e situação de acesso. Este painel não exibe dados jurídicos nem financeiros dos escritórios.</p></div><Button onClick={() => setEdit('new')}><Plus />Novo escritório</Button></div>
      {q.isLoading ? <div className="empty">Carregando…</div> : q.error ? <div className="empty">{q.error.message}</div> : <>
        <section className="panel mb-6"><div className="overflow-x-auto"><table className="data-table"><thead><tr><th>ESCRITÓRIO</th><th>PLANO</th><th>SITUAÇÃO</th><th>INÍCIO</th><th>VENCIMENTO / TESTE</th><th>EQUIPE</th><th>ADMINISTRADOR GERAL</th><th /></tr></thead><tbody>
          {q.data?.organizations.map((o) => <tr key={o.id}><td><span className="cell-primary">{o.name}</span><span className="cell-secondary block">{o.contact_name} {o.contact_email}</span></td><td>{o.plan}</td>
            <td><span className={`badge ${o.status === 'active' ? 'paid' : o.status === 'suspended' || o.status === 'closed' ? 'overdue' : 'partial'}`}>{statusLabel(o.status)}</span></td>
            <td>{dateLabel(o.starts_at)}</td><td>{o.status === 'trial' ? dateLabel(o.trial_ends_at) : dateLabel(o.ends_at)}</td>
            <td>{q.data.members.filter((m) => m.organization_id === o.id && m.active).length}</td><td>{q.data.members.find((m) => m.organization_id === o.id && m.active && m.is_general_admin)?.email ?? <span className="text-muted-foreground">Não designado</span>}</td>
            <td className="whitespace-nowrap"><Button variant="ghost" size="icon" aria-label={`Editar ${o.name}`} onClick={() => setEdit(o)}><Pencil size={15} /></Button><Button variant="ghost" size="icon" aria-label={`Convidar para ${o.name}`} onClick={() => setInviteFor(o)}><UserPlus size={15} /></Button><Button variant="ghost" size="icon" aria-label={`Administrador geral de ${o.name}`} title="Designar administrador geral" onClick={() => setAdminFor(o)}><ShieldCheck size={15} /></Button></td></tr>)}
        </tbody></table></div></section>
        <section className="panel"><div className="table-heading"><div><h2>Histórico administrativo</h2><p>Últimas 100 alterações</p></div></div>
          {q.data?.events.length ? q.data.events.map((e) => <div className="timeline-item px-5" key={e.id}><div><strong>{e.action}</strong> · {q.data.organizations.find((o) => o.id === e.organization_id)?.name}<small>{new Date(e.created_at).toLocaleString('pt-BR')} · {e.details ? JSON.stringify(e.details) : ''}</small></div></div>) : <div className="empty">Sem alterações registradas.</div>}</section>
      </>}
      <footer className="footer"><span>RTG Systems · Administração da plataforma</span><DeveloperSignature /></footer>
    </main>
    {edit && <OrgForm org={edit === 'new' ? null : edit} onClose={() => setEdit(null)} />}
    {inviteFor && <InviteForm org={inviteFor} onClose={() => setInviteFor(null)} />}
    {adminFor && q.data && <AdminForm org={adminFor} members={q.data.members.filter((m) => m.organization_id === adminFor.id && m.active)} onClose={() => setAdminFor(null)} />}
  </div>;
}

function OrgForm({ org, onClose }: { org: Org | null; onClose: () => void }) {
  const save = useServerFn(saveOrganization), qc = useQueryClient(); const [busy, setBusy] = useState(false), [error, setError] = useState('');
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); const f = new FormData(e.currentTarget), g = (k: string) => String(f.get(k) ?? ''), d = (k: string) => g(k) || null;
    setBusy(true); setError('');
    try { await save({ data: { id: org?.id ?? null, name: g('name'), contact_name: g('contact_name'), contact_email: g('contact_email'), contact_phone: g('contact_phone'), support_notes: g('support_notes'), plan: g('plan'), status: g('status') as OrgStatus, trial_ends_at: d('trial_ends_at'), starts_at: d('starts_at'), ends_at: d('ends_at') } });
      toast.success('Escritório salvo.'); await qc.invalidateQueries({ queryKey: ['rtg'] }); onClose(); }
    catch (err) { setError(err instanceof Error ? err.message : 'Não foi possível salvar.'); } finally { setBusy(false); }
  }
  return <Modal title={org ? 'Editar escritório' : 'Novo escritório'} onClose={onClose}><form onSubmit={submit}><div className="modal-body"><div className="form-grid">
    <Field label="Nome do escritório" full><input name="name" required minLength={2} maxLength={200} defaultValue={org?.name} /></Field>
    <Field label="Contato"><input name="contact_name" maxLength={150} defaultValue={org?.contact_name ?? ''} /></Field>
    <Field label="E-mail de contato"><input name="contact_email" type="email" maxLength={255} defaultValue={org?.contact_email ?? ''} /></Field>
    <Field label="Telefone"><input name="contact_phone" maxLength={30} defaultValue={org?.contact_phone ?? ''} /></Field>
    <Field label="Plano"><input name="plan" required maxLength={60} defaultValue={org?.plan ?? 'Essencial'} /></Field>
    <Field label="Situação"><select name="status" defaultValue={org?.status ?? 'setup'}>{orgStatuses.map((s) => <option key={s} value={s}>{statusLabel(s)}</option>)}</select></Field>
    <Field label="Fim do teste"><input name="trial_ends_at" type="date" defaultValue={org?.trial_ends_at ?? ''} /></Field>
    <Field label="Início"><input name="starts_at" type="date" defaultValue={org?.starts_at ?? ''} /></Field>
    <Field label="Vencimento"><input name="ends_at" type="date" defaultValue={org?.ends_at ?? ''} /></Field>
    <Field label="Informações de suporte" full><textarea name="support_notes" rows={3} maxLength={2000} defaultValue={org?.support_notes ?? ''} /></Field>
  </div><div className="form-note mt-4">Suspensão ou encerramento bloqueiam o acesso imediatamente, sem apagar dados. Teste e vencimento são verificados com a data do servidor.</div>{error && <div className="form-error" role="alert">{error}</div>}</div>
  <div className="modal-footer"><Button type="button" variant="outline" onClick={onClose}>Cancelar</Button><Button disabled={busy}>{busy ? 'Salvando…' : 'Salvar'}</Button></div></form></Modal>;
}

function InviteForm({ org, onClose }: { org: Org; onClose: () => void }) {
  const invite = useServerFn(inviteMember), qc = useQueryClient(); const [busy, setBusy] = useState(false), [error, setError] = useState('');
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); const f = new FormData(e.currentTarget); setBusy(true); setError('');
    try { await invite({ data: { email: String(f.get('email')), finance: f.get('finance') === 'on', organization_id: org.id, redirect: window.location.origin } }); toast.success('Convite enviado.'); await qc.invalidateQueries({ queryKey: ['rtg'] }); onClose(); }
    catch (err) { setError(err instanceof Error ? err.message : 'Não foi possível convidar.'); } finally { setBusy(false); }
  }
  return <Modal title={`Convidar para ${org.name}`} onClose={onClose}><form onSubmit={submit}><div className="modal-body"><div className="form-grid">
    <Field label="E-mail"><input name="email" type="email" required maxLength={255} /></Field>
    <Field label="Acessos"><label className="flex items-center gap-2 text-xs"><input type="checkbox" name="finance" />Conceder também o acesso financeiro</label></Field>
  </div><div className="form-note mt-4">O acesso jurídico é concedido por padrão. Para tornar a pessoa administradora geral, convide e depois use a designação.</div>{error && <div className="form-error" role="alert">{error}</div>}</div>
  <div className="modal-footer"><Button type="button" variant="outline" onClick={onClose}>Cancelar</Button><Button disabled={busy}>{busy ? 'Enviando…' : 'Enviar convite'}</Button></div></form></Modal>;
}

type RtgMember = Awaited<ReturnType<typeof listOrganizations>>['members'][number];
function AdminForm({ org, members, onClose }: { org: Org; members: RtgMember[]; onClose: () => void }) {
  const designate = useServerFn(designateGeneralAdmin), qc = useQueryClient(); const current = members.find((m) => m.is_general_admin);
  const [member, setMember] = useState(current?.id ?? ''), [busy, setBusy] = useState(false), [error, setError] = useState('');
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); if (!member) return; setBusy(true); setError('');
    try { await designate({ data: { organization_id: org.id, member_id: member } }); toast.success('Administrador geral designado.'); await qc.invalidateQueries({ queryKey: ['rtg'] }); onClose(); }
    catch (err) { setError(err instanceof Error ? err.message : 'Não foi possível designar.'); } finally { setBusy(false); }
  }
  return <Modal title={`Administrador geral · ${org.name}`} onClose={onClose}><form onSubmit={submit}><div className="modal-body">
    <div className="form-note">Atual: <strong>{current?.email ?? 'não designado'}</strong>. A troca retira a função do administrador anterior, não altera os acessos jurídico e financeiro e fica registrada no histórico.</div>
    {members.length ? <Field label="Conta ativa do escritório"><select value={member} onChange={(e) => setMember(e.target.value)} required><option value="" disabled>Selecione</option>{members.map((m) => <option key={m.id} value={m.id}>{m.email}</option>)}</select></Field> : <div className="empty">Nenhuma conta ativa. Convide uma pessoa primeiro.</div>}
    {error && <div className="form-error" role="alert">{error}</div>}</div>
  <div className="modal-footer"><Button type="button" variant="outline" onClick={onClose}>Cancelar</Button><Button disabled={busy || !member || member === current?.id}>{busy ? 'Salvando…' : 'Designar'}</Button></div></form></Modal>;
}
