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
  const { data, error } = await context.supabase.from('organization_members').select('id,email,active,created_at,user_id,can_legal,can_finance,is_general_admin').order('created_at');
  if (error) throw new Error('Não foi possível consultar a equipe.');
  return { members: data, me: context.userId };
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
  .inputValidator((i: unknown) => z.object({ email: z.string().trim().toLowerCase().email().max(255), finance: z.boolean().default(false), organization_id: z.string().uuid().optional(), redirect: z.string().url() }).parse(i))
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
    const inserted = await supabaseAdmin.from('organization_members').insert({ organization_id: org, user_id: invited.data.user.id, email: data.email, role: 'member', can_legal: true, can_finance: data.finance });
    if (inserted.error) throw new Error('Convite enviado, mas não foi possível vincular a pessoa. Contate o suporte.');
    await supabaseAdmin.from('admin_events').insert({ organization_id: org, actor: context.userId, action: 'Pessoa convidada', details: { email: data.email, juridico: true, financeiro: data.finance } });
    return true;
  });
