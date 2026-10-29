import * as React from 'react'
import { Cta, P, Shell, Small } from './layout'

interface SignupEmailProps { siteName: string; siteUrl: string; recipient: string; confirmationUrl: string }

export const SignupEmail = ({ recipient, confirmationUrl }: SignupEmailProps) => (
  <Shell preview="Confirme seu e-mail" title="Confirme seu e-mail">
    <P>Confirme que {recipient} é o seu endereço de e-mail para concluir o acesso.</P>
    <Cta href={confirmationUrl}>Confirmar e-mail</Cta>
    <Small>Se você não fez esta solicitação, ignore esta mensagem.</Small>
  </Shell>
)
export default SignupEmail
