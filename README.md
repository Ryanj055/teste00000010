# Gestão Jurídica e Financeira

Plataforma de gestão financeira e administrativa do escritório Gabriella Barreto & Thais Sardinha — Advogados Associados · Parceria Legal.
Sistema desenvolvido pela RTG Systems.

## Funcionalidades
- Visão geral com indicadores calculados a partir dos registros (contratado, recebido, saldo, atrasos, previstos).
- Clientes: cadastro, edição, pesquisa, arquivamento e contratos vinculados; exclusão definitiva apenas sem vínculos, com confirmação.
- Contratos: cronograma de entrada e parcelas que precisa totalizar o valor contratado.
- Cobranças: pagamentos integrais ou parciais, nunca acima do saldo nem duplicados, histórico e estorno com motivo. O original permanece registrado.
- Divisão de honorários: associados por escritório, base contratada ou recebida, percentuais conciliados em 100% ou valores fixos conciliados com a base; versões e repasses efetivos com histórico e estorno.
- Despesas: pagas e pendentes, operacionais e reembolsáveis, com categoria personalizada e pesquisa por descrição.
- Processos jurídicos: áreas, filtros, gráficos de registros reais e prazos informados manualmente (sem consulta a tribunais). Sem prazo não significa em dia.
- Relatórios: fluxo de caixa mensal por período e categoria, exportação CSV (Excel) e importação de clientes com prévia e validação.
- Vários escritórios com dados isolados no banco; administrador de cada escritório convida e desativa usuários (Equipe e acessos).
- Painel RTG (`/rtg`): escritórios, planos, teste, início/vencimento, ativar/suspender/encerrar e histórico administrativo, sem acesso a dados jurídicos ou financeiros.
- Situação comercial (configuração, teste, ativo, pagamento pendente, suspenso, encerrado) verificada pelo banco com a data do servidor; suspensão bloqueia sem apagar dados.
- Renegociação do saldo em aberto preservando pagamentos anteriores e um retrato do cronograma substituído; não aumenta o total contratado.
- Página inicial institucional; acesso apenas por convite.

## Arquitetura
- TanStack Start (React 19 + TypeScript + Vite). Rotas em `src/routes`; telas privadas em `src/routes/_authenticated`.
- Camada de dados em `src/lib/gbts/data.functions.ts` (funções de servidor). A interface nunca acessa o banco diretamente.
- Regras financeiras em `src/lib/gbts/finance.ts`; planilhas em `src/lib/gbts/spreadsheet.ts`.
- Banco PostgreSQL (Lovable Cloud) com permissões por linha: somente membros ativos com assinatura válida acessam dados privados. Schema em `drizzle/migrations`.
- Pagamentos e contratos são gravados por funções transacionais do banco.
- Revisão financeira em `review.functions.ts` e `review.ts`: divisões versionadas e livros de recebimentos/repasses com estornos por data efetiva. O repasse é um lançamento financeiro próprio, não uma segunda despesa, evitando dupla contagem.

## Segurança e isolamento
- Cada tabela tem `organization_id`; as regras de acesso do banco usam `can_access(organization_id)` (membro ativo + assinatura válida).
- Administração RTG em `rtg_admins`; papéis do escritório em `organization_members`. Nada depende de ocultar menus.
- Teste de isolamento: `bun scripts/isolation-check.ts` (cria contas temporárias e as apaga ao final; requer `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` e a chave de serviço do servidor).
- Convites usam o envio de e-mail padrão de autenticação.
- Verificação adicional: `bun scripts/review-check.ts`. Usa somente escritórios e contas temporários, apaga-os ao final e valida 34 regras de conciliação, estorno, exclusão segura e isolamento. As credenciais privilegiadas são fornecidas pelo ambiente de execução; não são entregues aos usuários do Lovable Cloud.

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
- Modalidades disponíveis: valor fixo com cronograma, parcelado, mensal por prazo definido e entrada com parcelas. Êxito e recorrência sem prazo não são oferecidos sem suas regras.
- Formas de pagamento previstas não geram recebimentos. Valores fixos na base recebida precisam de nova versão quando essa base muda.
- Antes de dados reais: ambiente separado, revisão de segurança aprofundada, política de backups testada e adequação à LGPD.

## Resultado da revisão de outubro de 2026
- Implementados: cobranças com totais e histórico de movimentos, estornos com motivo, associados, divisões explícitas, versões e repasses; remoção segura/arquivamento; categoria personalizada; gráficos e filtros de processos; forma prevista separada da efetiva; nome sem sigla, linguagem neutra e contatos RTG no rodapé.
- Conferidos pela interface com conta temporária isolada: cliente, contrato de R$ 1.000, recebimento parcial de R$ 400, divisão 60/40 sobre recebido (R$ 240/R$ 160), repasse de R$ 100, estornos de repasse e recebimento, retorno do saldo a R$ 1.000 e arquivamento de cliente vinculado; despesa personalizada e processo com prazo vencido.
- Testes: 19 testes automatizados e 34 verificações financeiras isoladas aprovados. O histórico anterior da renegociação é preservado; o teste confirma total R$ 1.000, recebido R$ 400 e saldo R$ 600 antes de estornar.
- Telas verificadas em 360, 390, 430 e 1280 pixels: dashboard, clientes, contratos, cobranças, honorários, despesas, processos e relatórios, sem transbordamento da página; nenhum erro de execução nos fluxos verificados. A formatação do calendário nativo acompanha o idioma do navegador; datas exibidas nos registros são brasileiras.
- Os registros e contas temporários desta revisão foram removidos. Dados preexistentes do escritório foram preservados, inclusive os fictícios cuja remoção aguarda autorização.
- Não incluídos: cálculo de honorários por êxito/percentual contratual sem regras definidas, integração bancária, mensagens automáticas, consulta a tribunais e cobrança automática. As opções indisponíveis não são oferecidas como funcionais.
- Pendências externas: e-mails de Gabriella, Thais e administrador RTG; autorização para remover dados fictícios; teste operacional de restauração de backup e revisão LGPD/segurança aprofundada. Esta revisão não certifica prontidão para produção.
- A revisão está na prévia; não foi feita nova publicação nesta solicitação.
