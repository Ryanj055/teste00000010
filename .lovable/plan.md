# Publicar a nova versão

## Sobre o "Supabase"
O site já está conectado ao banco de dados do Lovable Cloud, que usa a mesma tecnologia do Supabase. Não é preciso criar conta nem sincronizar nada: a prévia e o site publicado usam o mesmo banco, com os mesmos dados.

## O que será feito
1. Corrigir antes uma falha de segurança encontrada na troca do administrador geral: hoje a regra que impede um usuário comum de se tornar administrador geral pode ser contornada. A regra será refeita no banco para aceitar a mudança só quando vier de um administrador RTG.
2. Rever a regra que liberou o acesso financeiro para todos os membros já existentes, mantendo o financeiro somente para quem tiver autorização explícita (hoje só Ryan está ativo, então ele continua com acesso).
3. Rodar de novo as verificações de permissões, isolamento e financeiras.
4. Rodar a verificação de segurança do site.
5. Publicar em https://teste00000010.lovable.app.

## Detalhes técnicos
- Substituir o uso de `current_setting('gbts.rtg_designation')` no gatilho `guard_member_flags` por verificação dentro da função definer `rtg_set_general_admin` (ex.: coluna/trigger que só aceita mudança quando `is_rtg_admin(auth.uid())` é verdadeiro na própria função, com `REVOKE UPDATE (is_general_admin)` para `authenticated`).
- Restringir a exceção de exclusão da migração 0009 a `service_role`.
- Executar `scripts/permission-check.ts`, `isolation-check.ts`, `review-check.ts`, `bunx vitest run`, varredura de segurança e então publicar.
