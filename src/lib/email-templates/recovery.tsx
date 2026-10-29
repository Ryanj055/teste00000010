import * as React from 'react'
import { Cta, P, Shell, Small } from './layout'

interface RecoveryEmailProps { siteName: string; confirmationUrl: string }

export const RecoveryEmail = ({ confirmationUrl }: RecoveryEmailProps) => (
  <Shell preview="Redefinição de senha" title="Redefinir sua senha">
    <P>Recebemos um pedido para redefinir a senha da sua conta. Use o link seguro abaixo para escolher uma nova senha.</P>
    <Cta href={confirmationUrl}>Definir nova senha</Cta>
    <Small>Se você não fez esta solicitação, ignore esta mensagem; sua senha atual continua válida.</Small>
    <Small>Não compartilhe este link nem suas credenciais de acesso.</Small>
  </Shell>
)
export default RecoveryEmail
