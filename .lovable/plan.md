# Preparação para Vercel com Supabase próprio

Decisões: hospedagem na Vercel; banco em um projeto Supabase seu. O sistema atual é preservado (visual, logo, módulos, dados). Nada é recriado do zero.

## Etapa 1 — Auditoria (sem alterar nada)
- Conferir configuração do servidor: hoje o projeto é montado para o servidor do Lovable; a Vercel precisa de outro modo de saída. Essa é a causa provável de páginas travadas, login falhando e botões sem resposta fora do Lovable (a confirmar).
- Conferir logo, imagens e fontes: a logo está hospedada pelo Lovable; verificar se carrega fora dele. Se não, copiar o arquivo para dentro do projeto.
- Conferir variáveis de ambiente, URLs de retorno do login e da recuperação de senha.
- Listar qualquer dado fictício restante nas telas.

## Etapa 2 — Correções de segurança pendentes (já identificadas)
- Refazer a regra que protege a troca do administrador geral (hoje pode ser contornada).
- Financeiro somente para quem recebeu permissão explícita.
- Restringir a exceção de remoção de membros ao servidor.

## Etapa 3 — Equipe e acessos completo
- Convite por nome e e-mail, convites pendentes, status, permissões, suspender, reativar.
- Remoção real da conta, com confirmação: encerra acesso e sessões, apaga a identidade de login no servidor e preserva clientes, contratos, processos e históricos.
- Impedir remover o último administrador sem transferência; registrar a operação no histórico.
- Nenhum e-mail fixo no código; primeiro administrador criado por procedimento documentado.

## Etapa 4 — Vercel
- Adaptar a configuração para a Vercel mantendo login, banco e funções do servidor.
- Testar acesso direto a páginas internas, atualização do navegador, login e logout.

## Etapa 5 — Seu Supabase
- Gerar um pacote com toda a estrutura do banco (tabelas, regras de acesso, funções) para aplicar no seu projeto.
- Exportar os dados atuais (escritório, equipe, registros) para importação.
- Contas de login não podem ser copiadas com senha: cada pessoa recebe novo convite.
- Você fornece: URL do projeto, chave pública e chave privilegiada (esta só na Vercel, nunca no código).

## Etapa 6 — Testes e relatório
- Testes automáticos, verificações de permissões, isolamento e financeiras; telas em celular e computador.
- Relatório final com variáveis da Vercel (públicas x secretas), configurações do Supabase (URLs de retorno, e-mail) e passos manuais.

## Limitações honestas
- Daqui eu não consigo publicar na Vercel nem acessar seu Supabase: você conecta o GitHub, importa na Vercel e aplica o pacote no Supabase seguindo o passo a passo.
- Após a mudança, a prévia do Lovable continua usando o banco atual; o site da Vercel usará o seu.
- Testes do site na Vercel e de e-mails reais dependem de você.

## Detalhes técnicos
- Trocar o preset de saída Cloudflare do TanStack Start por target Vercel (Nitro `vercel`) em `vite.config.ts`, mantendo build Lovable funcional; validar sem `ssr.external`.
- Migrations `drizzle/migrations/0000–0009` + correções consolidadas num SQL único idempotente em `supabase/production/`; export de dados via `COPY` para CSV.
- Remoção de conta: server function com `requireSupabaseAuth`, autorização verificada no banco, depois `auth.admin.deleteUser` via cliente admin carregado no handler; FKs de autoria passam a `ON DELETE SET NULL`/texto preservado.
- Guarda de `is_general_admin`: `REVOKE UPDATE` de coluna para `authenticated` e alteração só pela função definer que valida `is_rtg_admin(auth.uid())`.
- Logo: baixar do CDN para `public/` se necessário.
