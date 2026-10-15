# GBTS | Gestão Jurídica & Financeira — Plano da Primeira Entrega

Como o documento pede, segue um resumo da arquitetura antes de começar. A primeira entrega cobre as **Fases 1, 2 e 3**, que são a prioridade: base do sistema, clientes, contratos e valores a receber. Os demais módulos entram nas próximas entregas, sem que nada precise ser refeito.

## O que será entregue agora

**Fase 1 — Base do sistema**
- Identidade visual com o logo original enviado: azul-marinho, dourado discreto e tipografia elegante.
- Tela de login com e-mail e senha, recuperação de senha e encerramento seguro da sessão. Não haverá cadastro público: as contas das associadas serão criadas de forma administrativa.
- Menu lateral no computador e menu compacto no celular.
- Faixa permanente: "AMBIENTE DE DEMONSTRAÇÃO — DADOS FICTÍCIOS".
- Banco de dados real (Lovable Cloud), com acesso restrito a usuárias autenticadas e autorizadas.
- Dados fictícios: 8 ou mais clientes, 10 ou mais contratos, parcelas pagas, pendentes e vencidas, pagamentos parciais e entradas.

**Fase 2 — Clientes e contratos**
- Clientes: cadastro de pessoa física ou jurídica, com validação de CPF/CNPJ e máscaras; listagem com busca, filtros, ordenação e paginação.
- Ficha do cliente com abas: Dados, Contratos, Financeiro e Histórico. Clientes com vínculos serão arquivados, nunca apagados.
- Contratos: modalidades de honorários, entrada, parcelas e frequência.
- Prévia editável do cronograma de parcelas, com conferência obrigatória do total antes de salvar.
- Indicadores do contrato: contratado, recebido, saldo, parcelas por situação e próximo vencimento.

**Fase 3 — Financeiro**
- Central de Valores a Receber com todas as colunas pedidas, filtros e situação calculada automaticamente: a vencer, parcialmente pago, pago ou vencido.
- Registro de pagamentos integrais ou parciais. O sistema bloqueia valores acima do saldo e impede duplicidades. Cada recebimento é um registro próprio.
- Dashboard com indicadores reais, filtro de período e gráficos de recebido vs. despesas, evolução mensal, atraso por faixa e contratos por situação.
- Cadastro básico de despesas, para alimentar o fluxo de caixa.
- Histórico (auditoria) das operações relevantes.

## O que fica para as próximas entregas
Cobranças e renegociações, processos e prazos, importação e exportação de Excel/PDF, relatórios completos, PWA, área administrativa e divisão entre as associadas. A divisão aparecerá como "Planejada para a próxima fase", sem nenhum percentual presumido.

## Pendências que dependem do escritório
- E-mails das duas associadas, para criar as contas.
- Regras de divisão de honorários e de rateio de despesas.

## Detalhes técnicos
```text
clients ─< contracts ─< installments ─< payments
   │            └─< contract_events (histórico)
   └─< (futuro) legal_cases, collections, renegotiations
expenses, audit_log, user_roles (admin|partner)
```
- Os valores são guardados como `numeric(14,2)`. A situação de cada parcela é calculada a partir dos pagamentos e da data, por meio de uma view.
- Os pagamentos passam por uma função SQL transacional, que trava a parcela, valida o saldo e bloqueia duplicidades por chave de idempotência.
- RLS: apenas usuárias com papel `partner` ou `admin` acessam os dados. Os papéis ficam em uma tabela separada e são verificados com `has_role`.
- Rotas protegidas em `_authenticated/`: dashboard, clientes, contratos, recebíveis e despesas.
- Os cálculos financeiros serão cobertos por testes automatizados: saldo, parcial, quitação, excesso e geração do cronograma.