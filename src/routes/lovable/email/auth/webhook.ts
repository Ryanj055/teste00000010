import * as React from 'react'
import { createAuthEmailHandler } from '@lovable.dev/email-js'
import { createFileRoute } from '@tanstack/react-router'
import { SignupEmail } from '@/lib/email-templates/signup'
import { InviteEmail } from '@/lib/email-templates/invite'
import { MagicLinkEmail } from '@/lib/email-templates/magic-link'
import { RecoveryEmail } from '@/lib/email-templates/recovery'
import { EmailChangeEmail } from '@/lib/email-templates/email-change'
import { ReauthenticationEmail } from '@/lib/email-templates/reauthentication'

// Configuration
const SITE_NAME = "Gestão Jurídica e Financeira"
const SENDER_DOMAIN = "notify.rtgsystems.com"
const ROOT_DOMAIN = "rtgsystems.com"
const FROM_DOMAIN = "rtgsystems.com"
const SITE_URL = `https://${ROOT_DOMAIN}`

/** Nome da pessoa, escritório e remetente do convite mais recente para este e-mail (gravado antes do envio). */
async function inviteContext(email: string): Promise<{ name?: string | undefined; office?: string | undefined; inviter?: string | undefined }> {
  try {
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
    const { data: ev } = await supabaseAdmin.from('admin_events').select('organization_id, actor, details')
      .eq('action', 'Pessoa convidada').eq('details->>email', email.toLowerCase())
      .order('created_at', { ascending: false }).limit(1).maybeSingle()
    if (!ev) return {}
    const details = (ev.details ?? {}) as { nome?: string }
    const [{ data: org }, { data: actor }] = await Promise.all([
      ev.organization_id ? supabaseAdmin.from('organizations').select('name').eq('id', ev.organization_id).maybeSingle() : Promise.resolve({ data: null }),
      ev.actor ? supabaseAdmin.from('organization_members').select('full_name, email').eq('user_id', ev.actor).limit(1).maybeSingle() : Promise.resolve({ data: null }),
    ])
    const inviter = actor ? (actor.full_name || actor.email || undefined) : ev.actor ? 'RTG Systems' : undefined
    return { name: details.nome, office: org?.name, inviter: inviter ?? undefined }
  } catch {
    return {}
  }
}

// The SDK handler owns verification, dispatch, and retry semantics; this file
// owns only the email decisions: subjects, templates, and per-type props.
export const Route = createFileRoute("/lovable/email/auth/webhook")({
  server: {
    handlers: {
      POST: ({ request }) => {
        const handler = createAuthEmailHandler({
          apiKey: process.env['LOVABLE_API_KEY']!,
          from: { name: SITE_NAME, address: `noreply@${FROM_DOMAIN}` },
          senderDomain: SENDER_DOMAIN,
          sendUrl: process.env['LOVABLE_SEND_URL'],
          emails: {
            signup: {
              subject: 'Confirme seu e-mail',
              render: (data) =>
                React.createElement(SignupEmail, {
                  siteName: SITE_NAME,
                  siteUrl: SITE_URL,
                  recipient: data.email,
                  confirmationUrl: data.url,
                }),
            },
            invite: {
              subject: 'Convite para acessar o Gestão Jurídica e Financeira',
              render: async (data) =>
                React.createElement(InviteEmail, {
                  siteName: SITE_NAME,
                  siteUrl: SITE_URL,
                  confirmationUrl: data.url,
                  ...(await inviteContext(data.email)),
                }),
            },
            magiclink: {
              subject: 'Seu link de acesso',
              render: (data) =>
                React.createElement(MagicLinkEmail, {
                  siteName: SITE_NAME,
                  confirmationUrl: data.url,
                }),
            },
            recovery: {
              subject: 'Redefinição de senha — Gestão Jurídica e Financeira',
              render: (data) =>
                React.createElement(RecoveryEmail, {
                  siteName: SITE_NAME,
                  confirmationUrl: data.url,
                }),
            },
            email_change: {
              subject: 'Confirme a troca de e-mail',
              render: (data) =>
                React.createElement(EmailChangeEmail, {
                  siteName: SITE_NAME,
                  oldEmail: data.old_email ?? '',
                  email: data.email,
                  newEmail: data.new_email ?? '',
                  confirmationUrl: data.url,
                }),
            },
            reauthentication: {
              subject: 'Seu código de verificação',
              render: (data) =>
                React.createElement(ReauthenticationEmail, { token: data.token ?? '' }),
            },
          },
        })
        return handler(request)
      },
    },
  },
})
