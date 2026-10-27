# Usuários e permissões: diagnóstico e plano revisado

## Diagnóstico (conferido no sistema atual)
- **Login:** e-mail e senha, recuperação e convite, sem cadastro público. As operações do servidor validam a sessão. Isso será mantido.
- **Perfis atuais:** "administrador" e "usuário" do escritório, além do administrador RTG separado. Não há separação entre jurídico e financeiro.
- **Proteções existentes:** isolamento entre escritórios, bloqueio por assinatura, RTG sem acesso aos dados dos escritórios, gestão de equipe restrita a administradores e impedimento de remover o próprio acesso. Tudo isso será preservado.
- **Falha:** qualquer membro ativo lê e altera o financeiro. Ao abrir "Processos", o financeiro inteiro é carregado no navegador. Banco e operações financeiras verificam apenas se a pessoa pertence ao escritório.
- **Contas atuais do escritório:** três contas com papel de administrador:
  - ryanj021@hotmail.com
  - gabrielcrf2003@gmail.com
  - uma conta técnica de validação, gbts-validation-…@example.com, que deveria ter sido removida após os testes.
  - Não há usuários comuns nem administrador RTG cadastrado.

## Modelo de permissões
Três controles independentes por membro:
- **Jurídico:** processos do próprio escritório e clientes. Permite cadastrar, consultar e editar os dados cadastrais.
- **Financeiro:** contratos, parcelas, recebimentos, despesas, honorários, repasses, estornos, relatórios, exportações e histórico financeiros. Nos clientes, apenas os dados necessários, como nome e código, para identificar contratos.
- **Administrador geral:** gerencia usuários e concede, altera ou revoga permissões. É distinto do acesso aos módulos.

Regras:
- Os usuários comuns, atuais e novos, recebem o acesso jurídico por padrão, sem o financeiro.
- O financeiro só é concedido explicitamente pelo administrador geral.
- Ninguém altera as próprias permissões, e o último administrador geral ativo não pode ser rebaixado nem desativado.
- Os processos ficam liberados para todo o escritório nesta versão, sem permissão por processo.
- A RTG continua sem acesso aos dados jurídicos e financeiros.
- Toda alteração de permissão fica no histórico. Revogações valem na operação seguinte, porque o banco confere a permissão em cada leitura e gravação.

## Preservação dos dados e dos administradores atuais
- Nenhum registro jurídico ou financeiro é apagado ou alterado.
- Os atuais "administradores" mantêm, por ora, os acessos jurídico e financeiro, para não perderem nada. Porém **não** recebem automaticamente o poder de administrador geral.
- O administrador geral será marcado somente na conta que você indicar (ver decisões). Até lá, a gestão de equipe fica sem titular. Por segurança, a execução só começa após essa indicação.

## Etapas (pequenas, verificáveis e reversíveis)
1. **Permissões no banco (aditivo).**
   - Novos controles nos membros: jurídico, financeiro e administrador geral.
   - Preenchimento: as contas atuais ficam com jurídico e financeiro; o administrador geral fica apenas na conta indicada.
   - Funções de verificação e informações de acesso atualizadas.
   - Nada é removido. A reversão consiste em ignorar os novos controles.
2. **Regras de acesso do banco.**
   - Cada regra ampla atual é substituída por uma equivalente que mantém o isolamento entre escritórios e o bloqueio por assinatura, acrescentando a permissão jurídica ou financeira.
   - Os clientes ficam acessíveis a ambos. Para o financeiro, a tela usa apenas os campos de identificação; o cadastro não contém campos financeiros.
   - As operações financeiras internas (contrato, recebimento, renegociação, divisão, repasse e estorno) passam a exigir o financeiro.
   - A remoção de cliente exige o jurídico, e o arquivamento continua obrigatório quando houver vínculos.
   - Risco: bloqueio indevido. Mitigação: testes completos antes da publicação.
3. **Gestão de equipe e convites.**
   - Somente o administrador geral convida, altera e revoga, com bloqueio de auto-alteração e proteção do último administrador geral.
   - Os convites do escritório passam a definir o jurídico e o financeiro.
   - O convite pelo painel RTG pode indicar o administrador geral de um escritório novo, mas sem que a RTG passe a ver os dados.
4. **Servidor separado por domínio.**
   - A carga atual é dividida em parte jurídica e parte financeira, cada uma entregue somente a quem tem a permissão.
   - Relatórios, exportações e histórico verificam a permissão correspondente.
5. **Interface.**
   - Menu, busca, alertas, painel inicial e endereços digitados diretamente passam a respeitar as permissões.
   - Quem não tem o financeiro entra por "Processos".
   - O cache é descartado ao sair ou quando as permissões mudam.
   - O visual permanece o mesmo.
6. **Testes.**
   - As 53 verificações existentes continuam passando.
   - Novas verificações com contas temporárias, apagadas ao final:
     - o jurídico não lê nem grava o financeiro, inclusive por acesso direto ao banco, às visões e às operações;
     - o financeiro não gerencia usuários;
     - não há autoconcessão de permissões;
     - o último administrador geral fica protegido;
     - a revogação vale imediatamente;
     - o isolamento entre escritórios e o bloqueio da RTG se mantêm.
   - Conferência das telas no computador e no celular.

**Estimativa:** complexidade média, em 6 entregas. As etapas 1 e 2 são as mais delicadas.

## Decisões necessárias antes da execução
- Qual conta será o administrador geral do escritório: ryanj021@hotmail.com, gabrielcrf2003@gmail.com ou outra a convidar?
- A conta técnica de validação pode ser desativada (sem apagar nenhum registro)?
- Quais contas devem manter o financeiro? Por padrão, as duas atuais o mantêm até você revisar.

## Fora deste escopo
A revisão dos indicadores reais permanece pendente e separada:
- os registros de demonstração foram removidos;
- os gráficos passaram a mostrar estado vazio;
- falta conferir as telas com uma conta conectada.

Nada nela será retomado nem recriado aqui.

## Detalhes técnicos
- **Membros (`organization_members`):** `can_legal boolean default true`, `can_finance boolean default false`, `is_general_admin boolean default false`. Backfill: os membros existentes ficam com legal e finance verdadeiros e o general admin somente para a conta indicada. Gatilho para impedir a remoção do último general admin ativo.
- **Funções:** novas funções definer `has_legal(org)`, `has_finance(org)` e `is_general_admin()`, todas compostas com `can_access`. `my_access` passa a retornar as três flags. `is_org_admin` é mantida por compatibilidade e deixa de autorizar a gestão.
- **Políticas:**
  - `legal_cases`: has_legal.
  - `clients`: leitura com legal ou finance; escrita com legal.
  - `contracts`, `installments`, `payments`, `expenses`, `associates`, `fee_divisions`, `fee_payouts` e `finance_events`: has_finance.
  - `audit_log`: leitura filtrada por entidade (`legal_cases`/`clients` exigem legal; demais exigem finance).
  - As visões `receivables`, `receipt_ledger` e `payout_ledger` já usam `security_invoker`.
- **RPCs:**
  - Exigem has_finance: `create_contract`, `create_contract_review`, `record_payment`, `renegotiate_contract`, `save_fee_division`, `record_fee_payout` e `void_financial_entry`.
  - Exige has_legal: `remove_client`.
  - `set_member_status` recebe as flags, exige `is_general_admin` e bloqueia `p_member` do próprio usuário.
- **Arquivos:**
  - `src/lib/gbts/data.functions.ts`: `getLegalWorkspace` e `getFinanceWorkspace`.
  - `src/lib/gbts/review.functions.ts` e `src/lib/gbts/admin.functions.ts`: flags, convite e verificação do general admin antes de usar o cliente administrativo.
  - Telas: `src/components/gbts/workspace.tsx`, `office-admin.tsx`, `office-modules.tsx` e `financial-review.tsx`.
  - Rotas: `src/routes/auth.tsx`, `src/routes/_authenticated/rtg.tsx` e `src/routes/__root.tsx`.
  - Os tipos são regenerados.
- **Testes:** novo script no padrão de `scripts/isolation-check.ts`, além de testes unitários das regras de permissão.
