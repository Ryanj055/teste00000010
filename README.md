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
- Demonstração pública em `/` somente com dados fictícios.

## Arquitetura
- TanStack Start (React 19 + TypeScript + Vite). Rotas em `src/routes`; telas privadas em `src/routes/_authenticated`.
- Camada de dados em `src/lib/gbts/data.functions.ts` (funções de servidor). A interface nunca acessa o banco diretamente.
- Regras financeiras em `src/lib/gbts/finance.ts`; planilhas em `src/lib/gbts/spreadsheet.ts`.
- Banco PostgreSQL (Lovable Cloud) com permissões por linha: somente contas com papel de associada acessam dados privados. Schema em `drizzle/migrations`.
- Pagamentos e contratos são gravados por funções transacionais do banco.

## Executar localmente
```bash
bun install        # ou npm install
cp .env.example .env   # preencha com os dados públicos do projeto
bun run dev
bun run test
bun run build
```

## Código-fonte e GitHub
No editor Lovable, conecte o GitHub (menu GitHub → Connect) para sincronizar o repositório nos dois sentidos.

## Publicação
Publique pelo botão Publish do Lovable. Hospedagem externa precisa suportar Cloudflare Workers ou adaptador equivalente do TanStack Start, com as variáveis do `.env.example`.

## Trocar de banco de dados
Substitua as consultas de `data.functions.ts` mantendo as mesmas assinaturas e o tipo `WorkspaceData`; as telas não precisam mudar. Recrie as regras de permissão e as funções transacionais no novo banco.

## Limitações conhecidas
- Sem integração bancária, cobrança automática ou consulta processual.
- Divisão de honorários entre associadas e cobranças planejadas para próxima fase.
- Antes de dados reais: ambiente separado, revisão de segurança aprofundada, política de backups testada e adequação à LGPD.
