import * as React from 'react'
import { Cta, P, Shell, Small } from './layout'

interface InviteEmailProps {
  siteName: string
  siteUrl: string
  confirmationUrl: string
  name?: string | undefined
  office?: string | undefined
  inviter?: string | undefined
}

export const InviteEmail = ({ confirmationUrl, name, office, inviter }: InviteEmailProps) => {
  const org = office || 'escritório'
  return (
    <Shell preview={`Convite para acessar o Gestão Jurídica e Financeira — ${org}`} title={name ? `Olá, ${name}.` : 'Olá.'}>
      <P>Boas-vindas ao {org}!</P>
      <P>Você recebeu um convite para acessar o Gestão Jurídica e Financeira, a plataforma utilizada pelo escritório para organizar suas atividades jurídicas e financeiras e suas rotinas administrativas.</P>
      <P>Para iniciar seu cadastro, acesse o link seguro abaixo e siga as instruções apresentadas na tela.</P>
      <Cta href={confirmationUrl}>Aceitar convite e iniciar cadastro</Cta>
      {inviter && <P>O convite foi enviado por {inviter}.</P>}
      <Small>Caso você não reconheça esta solicitação, entre em contato com a administração do escritório antes de prosseguir.</Small>
      <Small>Por segurança, utilize o link individual recebido neste e-mail e não compartilhe suas credenciais de acesso.</Small>
      <P>Atenciosamente,<br />Equipe {org}</P>
    </Shell>
  )
}

export default InviteEmail
