import * as React from 'react'
import { Cta, P, Shell, Small } from './layout'

interface MagicLinkEmailProps { siteName: string; confirmationUrl: string }

export const MagicLinkEmail = ({ confirmationUrl }: MagicLinkEmailProps) => (
  <Shell preview="Seu link de acesso" title="Seu link de acesso">
    <P>Use o botão abaixo para entrar. O link expira em pouco tempo.</P>
    <Cta href={confirmationUrl}>Entrar</Cta>
    <Small>Se você não fez esta solicitação, ignore esta mensagem.</Small>
  </Shell>
)
export default MagicLinkEmail
