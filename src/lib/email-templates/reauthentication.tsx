import * as React from 'react'
import { Code, P, Shell, Small } from './layout'

interface ReauthenticationEmailProps { token: string }

export const ReauthenticationEmail = ({ token }: ReauthenticationEmailProps) => (
  <Shell preview="Seu código de verificação" title="Código de verificação">
    <P>Use o código abaixo para confirmar sua identidade:</P>
    <Code>{token}</Code>
    <Small>O código expira em pouco tempo. Se você não fez esta solicitação, ignore esta mensagem.</Small>
  </Shell>
)
export default ReauthenticationEmail
