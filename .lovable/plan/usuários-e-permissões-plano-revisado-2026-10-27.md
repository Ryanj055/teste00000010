# Usuários e permissões: plano revisado

## Diagnóstico (conferido no sistema atual)
- **Login:** e-mail e senha, recuperação e convite, sem cadastro público. Todas as operações do servidor validam a sessão. Será mantido.
- **Administração RTG:** usa uma lista própria de administradores da plataforma, separada dos escritórios. Dá acesso ao Painel RTG (escritórios, planos, assinaturas e histórico administrativo) e não dá acesso aos dados jurídicos e financeiros. O aplicativo não consegue alterar essa lista. Hoje ela está **vazia**: nenhuma conta RTG está designada.
- **Administração do escritório:** o papel "administrador" ou "usuário" vale somente dentro do próprio escritório. Um administrador de escritório não acessa o Painel RTG, não altera assinaturas e não vê outros escritórios (conferido nas regras do banco).
- **Falha atual:** todo membro ativo lê e altera o financeiro. Ao abrir "Processos", o financeiro inteiro também é carregado. O banco e as operações financeiras verificam apenas se a pessoa pertence ao escritório. Além disso, qualquer "administrador" de escritório consegue promover outros administradores.
- **Contas do escritório atual:** três contas com papel de administrador, todas de teste:
  - Ryan (ryanj021@hotmail.com);
  - Gabriel (gabrielcrf2003@gmail.com);
  - uma conta técnica de validação que sobrou dos testes.
  Não há usuários comuns.

## Hierarquia
```text
RTG Systems (plataforma, autenticada e autorizada)
  - escritórios, assinaturas, regras e limites das permissões
  - ÚNICA que designa, substitui ou remove o administrador geral de cada escritório
  - sem acesso automático aos dados jurídicos e financeiros
     |
Administrador geral do escritório (designado pela RTG)
  - gerencia a equipe do próprio escritório: jurídico e/ou financeiro
  - não designa nem transfere a administração geral
  - não altera as próprias permissões, assinaturas nem regras da plataforma
     |
Usuários internos: jurídico, financeiro ou ambos
```

## Modelo de permissões
- **Jurídico:** processos do próprio escritório e clientes. Permite cadastrar, consultar e editar os dados cadastrais. Não há permissão por processo nesta versão.
- **Financeiro:** contratos, parcelas, recebimentos, despesas, honorários, repasses, estornos, relatórios, exportações e histórico financeiros. Dos clientes, acessa apenas os dados de identificação.
- **Administrador geral:** gerencia usuários e concede ou revoga jurídico e financeiro **no próprio escritório**. É uma designação separada do acesso aos módulos e não concede jurídico nem financeiro automaticamente.
- O catálogo de permissões é fixo na plataforma; o escritório não cria nem amplia permissões.
- Os novos usuários recebem jurídico por padrão, sem financeiro. O financeiro só é concedido explicitamente.
- Ninguém altera as próprias permissões. Toda alteração fica no histórico. As revogações valem na operação seguinte, porque o banco confere a permissão a cada leitura e gravação.

## Designação e substituição pela RTG
No Painel RTG, em cada escritório: **"Administrador geral"**, com a seleção de um membro ativo daquele escritório ou o convite de um e-mail novo já vinculado ao escritório.

A operação, feita inteiramente no banco e numa única etapa:
1. Confirma que quem executa é administrador RTG autenticado.
2. Confirma que a conta de destino existe, está ativa e pertence ao escritório informado.
3. Retira a designação do administrador anterior e a atribui ao novo, sem que o escritório fique sem administrador geral. O anterior mantém apenas os acessos de módulo que já tinha.
4. Não altera o jurídico nem o financeiro de ninguém e não toca em processos, clientes, contratos, recebimentos, despesas ou históricos.
5. Registra no histórico administrativo quem alterou, quando, de quem para quem e em qual escritório.

A troca pode ser repetida a qualquer momento: no desenvolvimento, nos testes, na demonstração ou após a entrega. Nenhum e-mail fica fixo no código.

**Bloqueios no banco e no servidor:**
- Somente a RTG altera a designação; o escritório não consegue, nem por chamadas diretas.
- O administrador do escritório não designa, transfere nem remove a função.
- Nenhuma operação do escritório escreve na lista RTG.
- Desativar ou remover o administrador geral só é possível depois que a RTG designar outro.
- A RTG continua sem ler os dados jurídicos e financeiros.

## Contas definidas
- **Gabriel (gabrielcrf2003@gmail.com): administrador da plataforma RTG.**
  - Hoje ele também é membro administrador do escritório, o que lhe dá acesso aos dados jurídicos e financeiros.
  - Para cumprir a regra "RTG sem acesso automático", esse vínculo com o escritório será **desativado**, e não apagado. Os registros criados por ele continuam preservados.
  - Ele passa a usar apenas o Painel RTG.
- **Ryan (ryanj021@hotmail.com): administrador geral de teste do escritório.**
  - A designação inicial será feita pela própria função de designação da RTG, executada uma única vez em nome da RTG, com registro no histórico. Depois disso, as trocas serão feitas somente pelo Painel RTG.
  - Ele mantém os acessos jurídico e financeiro que já tem, gerencia a equipe e as permissões, mas não altera a própria designação nem acessa o Painel RTG.
- **Conta técnica de validação:** desativada, sem apagar registros.
- Nenhum e-mail fica fixo no código. As substituições futuras não exigem código nem novas migrações.

## Preservação na migração
- Nenhum registro jurídico ou financeiro é apagado ou alterado.
- O antigo papel "administrador" deixa de dar poder de gestão; somente a designação feita pela RTG vale.
- Passos únicos de dados, feitos após as mudanças estruturais:
  - incluir Gabriel na lista RTG;
  - desativar os vínculos de Gabriel e da conta técnica com o escritório;
  - designar Ryan.

## Etapas (pequenas, verificáveis e reversíveis)
1. **Banco: novos controles (aditivo).**
   - Jurídico, financeiro e administrador geral em cada membro, com o histórico.
   - A função de designação da RTG.
   - Nada é removido; a reversão consiste em deixar de usar os novos controles.
2. **Banco: regras de acesso.**
   - Cada regra ampla é substituída por uma equivalente, mantendo o isolamento e o bloqueio por assinatura e acrescentando o jurídico ou o financeiro.
   - As operações financeiras internas passam a exigir o financeiro; a remoção de cliente exige o jurídico.
   - A gestão de membros passa a exigir o administrador geral.
3. **Equipe, convites e Painel RTG.**
   - A página da equipe ganha o controle de jurídico e financeiro, sem a opção de administrador.
   - O Painel RTG ganha a designação e a substituição do administrador geral.
4. **Servidor separado por domínio.** As partes jurídica e financeira são entregues somente a quem tem permissão, incluindo relatórios, exportações e histórico.
5. **Interface.**
   - Menu, busca, alertas, painel inicial e endereços diretos passam a respeitar as permissões.
   - Quem não tem o financeiro entra por "Processos".
   - O cache é limpo ao sair ou quando as permissões mudam.
   - O visual não muda.
6. **Testes**, com contas e escritórios temporários apagados ao final:
   - as 53 verificações existentes;
   - o jurídico não lê nem grava o financeiro, inclusive por acesso direto ao banco, às visões e às operações;
   - o financeiro não gerencia usuários;
   - não há autoconcessão de permissões;
   - a revogação vale imediatamente;
   - a RTG designa e depois substitui o administrador geral, o anterior perde a função e o histórico registra as duas trocas;
   - a designação é rejeitada para conta de outro escritório, conta inativa ou inexistente;
   - um administrador ou usuário de escritório que tente designar, transferir ou remover a função, ou se tornar RTG, por chamada direta, é bloqueado;
   - o escritório nunca fica sem administrador geral após a designação;
   - a RTG não lê dados jurídicos e financeiros;
   - o isolamento entre escritórios e o bloqueio por assinatura se mantêm;
   - as telas são conferidas no computador e no celular.

**Estimativa:** complexidade média, em 6 entregas. As etapas 1 e 2 são as mais delicadas.

**Riscos:**
- Bloqueio indevido de acesso. Mitigação: testes completos antes de publicar.
- Período sem gestor de equipe até a designação.
- Gabriel deixará de ver os dados do escritório ao tornar-se RTG. Isso é intencional e reversível: basta reativar o vínculo.

## Decisões pendentes
Nenhuma. O plano está pronto para aprovação.

## Fora deste escopo
A revisão dos indicadores reais segue pendente e separada (os registros de demonstração foram removidos e os gráficos mostram estado vazio; falta a conferência com uma conta conectada). Nada será retomado nem recriado aqui.

## Detalhes técnicos
- **`organization_members`:**
  - `can_legal boolean default true`;
  - `can_finance boolean default false`;
  - `is_general_admin boolean default false`;
  - índice único parcial com um general admin ativo por organização.
  - Backfill: os membros atuais recebem legal e finance verdadeiros e `is_general_admin` falso. A coluna `role` fica obsoleta (comentário DEPRECATED).
- **Gatilho:**
  - impede a alteração de `is_general_admin` fora da função RTG, com flag de sessão definida apenas dentro dela;
  - impede desativar o general admin atual.
- **Funções definer:**
  - `has_legal(org)`, `has_finance(org)` e `is_general_admin()`, compostas com `can_access`;
  - `my_access` retorna as flags;
  - `is_org_admin` passa a significar general admin;
  - `rtg_set_general_admin(p_org, p_member)` exige `is_rtg_admin`, valida membro ativo do mesmo `p_org`, troca a flag em uma transação e grava em `admin_events` (actor, de, para).
- **`set_member_status` reformulada:** exige `is_general_admin`, mesmo escritório e alvo diferente de si mesmo; altera somente `active`/`can_legal`/`can_finance`; rejeita o alvo general admin para desativação.
- **Políticas:**
  - `legal_cases`: has_legal;
  - `clients`: leitura com legal ou finance, escrita com legal;
  - `contracts`, `installments`, `payments`, `expenses`, `associates`, `fee_divisions`, `fee_payouts` e `finance_events`: has_finance;
  - `audit_log`: filtro por entidade;
  - as visões já usam `security_invoker`;
  - `rtg_admins`, `organizations` e `admin_events` permanecem inalteradas.
- **RPCs:**
  - has_finance: `create_contract`, `create_contract_review`, `record_payment`, `renegotiate_contract`, `save_fee_division`, `record_fee_payout` e `void_financial_entry`;
  - has_legal: `remove_client`.
- **Arquivos:**
  - `src/lib/gbts/admin.functions.ts`:
    - `inviteMember` permite que o general admin convide para o próprio escritório e a RTG para o escritório indicado, sem flag administrativa;
    - nova função `designateGeneralAdmin`;
    - `setMember` recebe as flags.
  - `src/lib/gbts/data.functions.ts`: `getLegalWorkspace` e `getFinanceWorkspace`.
  - `src/lib/gbts/review.functions.ts`.
  - Componentes: `workspace.tsx`, `office-admin.tsx`, `office-modules.tsx` e `financial-review.tsx`.
  - Rotas: `src/routes/_authenticated/rtg.tsx`, `src/routes/auth.tsx` e `src/routes/__root.tsx`.
  - Os tipos são regenerados.
- **Dados (ferramenta de dados, uma vez):**
  - inserir o `user_id` de gabrielcrf2003@gmail.com em `rtg_admins`;
  - definir `active=false` nos vínculos de Gabriel e da conta técnica em `organization_members`;
  - aplicar `is_general_admin=true` em Ryan pela mesma lógica de `rtg_set_general_admin`, com evento em `admin_events`. Nenhum desses dados fica no código.
- **Testes:** novo script no padrão de `scripts/isolation-check.ts`, além de testes unitários das regras.
