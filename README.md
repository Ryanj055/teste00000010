# GBTS | Gestão Jurídica & Financeira

Plataforma de gestão financeira e administrativa do escritório Gabriella Barreto & Thais Sardinha — Advogados Associados · Parceria Legal.
Sistema desenvolvido pela RTG Systems.

## Funcionalidades
- Visão geral com indicadores calculados a partir dos registros (contratado, recebido, saldo, atrasos, previstos).
- Clientes: cadastro, edição, pesquisa, arquivamento e contratos vinculados.
- Contratos: cronograma de entrada e parcelas que precisa totalizar o valor contratado.
- Valores a receber: pagamentos integrais ou parciais, nunca acima do saldo nem duplicados.
- Despesas: pagas e pendentes, operacionais e reembolsáveis.
- Processos jurídicos: acompanhamento administrativo e prazos informados manualmente (sem consulta a tribunais).
- Relatórios: fluxo de caixa mensal por período e categoria, exportação CSV (Excel) e importação de clientes com prévia e validação.
- Vários escritórios com dados isolados no banco; administradora de cada escritório convida e desativa usuárias (Equipe e acessos).
- Painel RTG (`/rtg`): escritórios, planos, teste, início/vencimento, ativar/suspender/encerrar e histórico administrativo, sem acesso a dados jurídicos ou financeiros.
- Situação comercial (configuração, teste, ativo, pagamento pendente, suspenso, encerrado) verificada pelo banco com a data do servidor; suspensão bloqueia sem apagar dados.
- Renegociação do saldo em aberto preservando pagamentos anteriores.
- Página inicial institucional; acesso apenas por convite.

## Arquitetura
- TanStack Start (React 19 + TypeScript + Vite). Rotas em `src/routes`; telas privadas em `src/routes/_authenticated`.
- Camada de dados em `src/lib/gbts/data.functions.ts` (funções de servidor). A interface nunca acessa o banco diretamente.
- Regras financeiras em `src/lib/gbts/finance.ts`; planilhas em `src/lib/gbts/spreadsheet.ts`.
- Banco PostgreSQL (Lovable Cloud) com permissões por linha: somente contas com papel de associada acessam dados privados. Schema em `drizzle/migrations`.
- Pagamentos e contratos são gravados por funções transacionais do banco.

## Segurança e isolamento
- Cada tabela tem `organization_id`; as regras de acesso do banco usam `can_access(organization_id)` (membro ativo + assinatura válida).
- Administração RTG em `rtg_admins`; papéis do escritório em `organization_members`. Nada depende de ocultar menus.
- Teste de isolamento: `bun scripts/isolation-check.ts` (cria contas temporárias e as apaga ao final; requer `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` e a chave de serviço do servidor).
- Convites usam o envio de e-mail padrão de autenticação.

## Executar localmente
```bash
bun install        # ou npm install
cp .env.example .env   # preencha com os dados públicos do projeto
# Abra a pasta no VS Code; extensões recomendadas: ESLint e Prettier
bun run dev
bun run test
bun run build
```

## Código-fonte e GitHub
No editor Lovable, conecte o GitHub (menu GitHub → Connect) para sincronizar o repositório nos dois sentidos.

## Publicação
O banco, a autenticação e o envio de e-mails rodam no Lovable Cloud; ao hospedar fora do Lovable, o projeto continua dependendo desse backend (ou de um Supabase próprio com as mesmas migrações em `drizzle/migrations`).
Publique pelo botão Publish do Lovable. Hospedagem externa precisa suportar Cloudflare Workers ou adaptador equivalente do TanStack Start, com as variáveis do `.env.example`.

## Trocar de banco de dados
Substitua as consultas de `data.functions.ts` mantendo as mesmas assinaturas e o tipo `WorkspaceData`; as telas não precisam mudar. Recrie as regras de permissão e as funções transacionais no novo banco.

## Limitações conhecidas
- Sem integração bancária, cobrança automática ou consulta processual.
- Divisão de honorários entre associadas e cobranças planejadas para próxima fase.
- Antes de dados reais: ambiente separado, revisão de segurança aprofundada, política de backups testada e adequação à LGPD.
