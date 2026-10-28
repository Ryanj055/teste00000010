import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';

export const orgStatuses = ['setup', 'trial', 'active', 'payment_pending', 'suspended', 'closed'] as const;
export type OrgStatus = (typeof orgStatuses)[number];
export type Access = {
  rtg: boolean;
  organization: { id: string; name: string; status: OrgStatus; role: 'admin' | 'member'; general_admin: boolean; can_legal: boolean; can_finance: boolean; access: boolean; ends_at: string | null } | null;
};

/** Situação de acesso calculada no banco com a data do servidor. */
export const getAccess = createServerFn({ method: 'GET' }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const { data, error } = await context.supabase.rpc('my_access');
  if (error) throw new Error('Não foi possível verificar seu acesso.');
  return data as unknown as Access;
});

const orgSchema = z.object({
  id: z.string().uuid().nullable(),
  name: z.string().trim().min(2).max(200),
  contact_name: z.string().max(150),
  contact_email: z.union([z.literal(''), z.string().email().max(255)]),
  contact_phone: z.string().max(30),
  support_notes: z.string().max(2000),
  plan: z.string().trim().min(2).max(60),
  status: z.enum(orgStatuses),
  trial_ends_at: z.string().nullable(),
  starts_at: z.string().nullable(),
  ends_at: z.string().nullable(),
});

export const listOrganizations = createServerFn({ method: 'GET' }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const { data: rtg } = await context.supabase.rpc('is_rtg_admin');
  if (!rtg) throw new Error('Acesso restrito à administração RTG.');
  const [orgs, members, events] = await Promise.all([
    context.supabase.from('organizations').select('*').order('name'),
    context.supabase.from('organization_members').select('id,organization_id,email,active,is_general_admin'),
    context.supabase.from('admin_events').select('*').order('created_at', { ascending: false }).limit(100),
  ]);
  if (orgs.error || members.error || events.error) throw new Error('Não foi possível consultar os escritórios.');
  return { organizations: orgs.data, members: members.data, events: events.data };
});

export const saveOrganization = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).inputValidator((i: unknown) => orgSchema.parse(i)).handler(async ({ data, context }) => {
  const { data: id, error } = await context.supabase.rpc('rtg_save_org', {
    p_id: data.id as string, p_name: data.name, p_contact_name: data.contact_name, p_contact_email: data.contact_email, p_contact_phone: data.contact_phone,
    p_support: data.support_notes, p_plan: data.plan, p_status: data.status, p_trial: data.trial_ends_at as string, p_start: data.starts_at as string, p_end: data.ends_at as string,
  });
  if (error) throw new Error(error.message);
  return id;
});

export const listMembers = createServerFn({ method: 'GET' }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const { data, error } = await context.supabase.from('organization_members').select('id,email,full_name,active,created_at,user_id,can_legal,can_finance,is_general_admin').order('created_at');
  if (error) throw new Error('Não foi possível consultar a equipe.');
  // Convite pendente: a pessoa ainda não confirmou o e-mail nem definiu a senha. Consulta feita somente no servidor.
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
  const members = await Promise.all(data.map(async (m) => {
    const u = await supabaseAdmin.auth.admin.getUserById(m.user_id);
    return { ...m, pending: !u.data.user?.last_sign_in_at };
  }));
  return { members, me: context.userId };
});

export const setMember = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid(), active: z.boolean(), legal: z.boolean(), finance: z.boolean() }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc('set_member_access', { p_member: data.id, p_active: data.active, p_legal: data.legal, p_finance: data.finance });
    if (error) throw new Error(error.message);
    return true;
  });

/** Somente a RTG designa ou substitui o administrador geral de um escritório. */
export const designateGeneralAdmin = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ organization_id: z.string().uuid(), member_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc('rtg_set_general_admin', { p_org: data.organization_id, p_member: data.member_id });
    if (error) throw new Error(error.message);
    return true;
  });

/** Convite por e-mail. O administrador geral convida para o próprio escritório; a RTG indica o escritório. Ninguém é convidado como administrador geral. */
export const inviteMember = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ name: z.string().trim().min(2).max(150), email: z.string().trim().toLowerCase().email().max(255), finance: z.boolean().default(false), organization_id: z.string().uuid().optional(), redirect: z.string().url() }).parse(i))
  .handler(async ({ data, context }) => {
    const [{ data: rtg }, { data: isAdmin }, { data: own }] = await Promise.all([
      context.supabase.rpc('is_rtg_admin'), context.supabase.rpc('is_general_admin'), context.supabase.rpc('current_org'),
    ]);
    const org = rtg && data.organization_id ? data.organization_id : isAdmin && !data.organization_id ? (own as string | null) : null;
    if (!org) throw new Error('Você não tem permissão para convidar pessoas.');
    const redirect = new URL(data.redirect);
    redirect.pathname = '/reset-password';
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    const existing = await supabaseAdmin.from('organization_members').select('id').eq('email', data.email).maybeSingle();
    if (existing.data) throw new Error('Este e-mail já está vinculado a um escritório.');
    const invited = await supabaseAdmin.auth.admin.inviteUserByEmail(data.email, { redirectTo: redirect.toString() });
    if (invited.error || !invited.data.user) throw new Error('Não foi possível enviar o convite. Verifique se o e-mail já possui conta.');
    const inserted = await supabaseAdmin.from('organization_members').insert({ organization_id: org, user_id: invited.data.user.id, email: data.email, full_name: data.name, role: 'member', can_legal: true, can_finance: data.finance });
    if (inserted.error) throw new Error('Convite enviado, mas não foi possível vincular a pessoa. Contate o suporte.');
    await supabaseAdmin.from('admin_events').insert({ organization_id: org, actor: context.userId, action: 'Pessoa convidada', details: { email: data.email, juridico: true, financeiro: data.finance } });
    return true;
  });

/**
 * Remoção definitiva: retira a pessoa da equipe e apaga a identidade de login (encerrando sessões).
 * Registros profissionais são preservados: não há vínculo que os apague junto com a conta.
 */
export const removeMember = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const [{ data: rtg }, { data: isAdmin }, { data: own }] = await Promise.all([
      context.supabase.rpc('is_rtg_admin'), context.supabase.rpc('is_general_admin'), context.supabase.rpc('current_org'),
    ]);
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    const { data: m } = await supabaseAdmin.from('organization_members').select('id,organization_id,user_id,email,is_general_admin').eq('id', data.id).maybeSingle();
    if (!m) throw new Error('Pessoa não encontrada.');
    const allowed = Boolean(rtg) || (Boolean(isAdmin) && own === m.organization_id);
    if (!allowed) throw new Error('Você não tem permissão para remover contas.');
    if (m.user_id === context.userId) throw new Error('Você não pode remover a própria conta.');
    if (m.is_general_admin) throw new Error('Designe outro administrador geral antes de remover esta conta.');
    const del = await supabaseAdmin.from('organization_members').delete().eq('id', m.id);
    if (del.error) throw new Error('Não foi possível remover a pessoa da equipe.');
    const { data: rtgRow } = await supabaseAdmin.from('rtg_admins').select('user_id').eq('user_id', m.user_id).maybeSingle();
    if (!rtgRow) {
      const gone = await supabaseAdmin.auth.admin.deleteUser(m.user_id);
      if (gone.error) throw new Error('A pessoa saiu da equipe, mas a conta de login não pôde ser apagada. Tente novamente.');
    }
    await supabaseAdmin.from('admin_events').insert({ organization_id: m.organization_id, actor: context.userId, action: 'Conta removida', details: { email: m.email } });
    return true;
  });
