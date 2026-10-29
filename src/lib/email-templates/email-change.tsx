import * as React from 'react'
import { Cta, P, Shell, Small } from './layout'

interface EmailChangeEmailProps {
  siteName: string
  // oldEmail is the current address; for the new-recipient half, `email` equals the new one.
  oldEmail: string
  email: string
  newEmail: string
  confirmationUrl: string
}

export const EmailChangeEmail = ({ oldEmail, newEmail, confirmationUrl }: EmailChangeEmailProps) => (
  <Shell preview="Confirme a troca de e-mail" title="Confirme a troca de e-mail">
    <P>Foi solicitada a troca do e-mail de acesso de {oldEmail} para {newEmail}.</P>
    <Cta href={confirmationUrl}>Confirmar troca</Cta>
    <Small>Se você não fez esta solicitação, entre em contato com a administração do escritório.</Small>
  </Shell>
)
export default EmailChangeEmail
