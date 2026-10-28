# Publicação na Vercel com Supabase próprio

## 1. Supabase
1. Crie um projeto novo no Supabase.
2. SQL Editor → cole e execute `schema.sql` (estrutura completa, regras de acesso e funções; sem dados fictícios).
3. Authentication → Providers: deixe apenas E-mail ativo e **desative "Allow new users to sign up"** (acesso só por convite).
4. Authentication → URL Configuration:
   - Site URL: `https://SEU-DOMINIO.vercel.app`
   - Redirect URLs: `https://SEU-DOMINIO.vercel.app/reset-password` e `https://SEU-DOMINIO.vercel.app/**`
5. Authentication → Emails: revise os textos de convite e recuperação em português neutro.

## 2. Primeiro acesso (provisionamento seguro)
Sem senha fixa no código. No Supabase:
1. Authentication → Users → **Invite user** com o e-mail da administração RTG.
2. SQL Editor (substitua o e-mail):
   ```sql
   insert into public.rtg_admins(user_id) select id from auth.users where email = 'EMAIL_RTG';
   ```
3. Entre no sistema, abra o Painel RTG, cadastre o escritório, convide as advogadas e designe o administrador geral.

## 3. Vercel
1. Conecte o GitHub ao Lovable e importe o repositório na Vercel (Framework: Other; o `vercel.json` já define instalação e build).
2. Variáveis de ambiente (Production e Preview):

| Nome | Tipo |
|---|---|
| `VITE_SUPABASE_URL` | pública |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | pública (chave anon/publishable) |
| `VITE_SUPABASE_PROJECT_ID` | pública |
| `SUPABASE_URL` | servidor |
| `SUPABASE_PUBLISHABLE_KEY` | servidor |
| `SUPABASE_SERVICE_ROLE_KEY` | **secreta** — somente na Vercel, nunca no código |

3. Deploy. A Vercel define `VERCEL=1`, e o build gera automaticamente a saída de servidor da Vercel.

## 4. Validação após publicar
- Abrir `/auth`, entrar, atualizar a página em `/dashboard`, abrir `/clientes` direto pela barra de endereço, sair.
- "Esqueci minha senha" → link do e-mail → `/reset-password`.
- Equipe e acessos: convidar, desativar, reativar e remover uma conta de teste.

## Observações
- A prévia do Lovable continua usando o banco do Lovable Cloud; a Vercel usa o seu Supabase.
- Senhas não são transferidas: cada pessoa recebe novo convite.
- Para levar registros já cadastrados, exporte pelos Relatórios (CSV) e importe os clientes pela tela de importação.
