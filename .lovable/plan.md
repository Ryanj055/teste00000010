# Usuários e permissões: diagnóstico e plano

## Diagnóstico

**1. Autenticação atual.** Login por e-mail e senha, recuperação de senha e convites por e-mail, sem cadastro público. Após o login, o sistema confere se a conta pertence a um escritório (ou à RTG); se não pertencer, a sessão é encerrada. As telas privadas exigem sessão, e todas as operações do servidor validam o login antes de consultar o banco. Isso já funciona e será mantido.

**2. Perfis existentes.**
- Administrador do escritório: convida, desativa e altera papéis da equipe do próprio escritório. Não pode remover o próprio acesso de administrador.
- Usuário: acessa todas as funções do escritório.
- Administrador RTG: gerencia escritórios e assinaturas, sem acesso aos dados jurídicos e financeiros.
- Não existe separação entre jurídico e financeiro.

**3. Organização dos dados.**
- Jurídico: processos (e clientes, que também são usados pelo financeiro).
- Financeiro: contratos, parcelas, recebimentos, despesas, associados, divisões, repasses, estornos e históricos financeiros.
- Todos os registros pertencem a um escritório.

**4. Proteções.**
- Já implementadas (conferido no banco atual): isolamento entre escritórios, bloqueio por assinatura suspensa ou vencida, RTG sem acesso aos dados dos escritórios e gestão de equipe restrita ao administrador.
- Ausente: qualquer usuário ativo do escritório consegue ler e alterar dados financeiros. Ao abrir "Processos", o sistema carrega também todo o financeiro no navegador. As regras do banco e as operações financeiras verificam apenas "pertence ao escritório". Esconder o menu não resolveria.

## Modelo proposto (mínimo)

O papel de administrador continua existindo, e cada membro passa a ter duas permissões independentes:
- **Jurídico:** processos e clientes.
- **Financeiro:** contratos, cobranças, honorários, despesas, relatórios e exportações financeiras.

Combinações:
- Administrador geral: único que gerencia usuários e permissões. Sempre tem as duas permissões.
- Financeiro: permissão financeira, sem gestão de usuários.
- Profissional jurídico: somente jurídico; acessa o financeiro apenas se o administrador conceder explicitamente.

**Preservação do administrador legítimo.** Os administradores atuais mantêm acesso total. Ninguém altera as próprias permissões. O último administrador ativo não pode ser rebaixado ou desativado. Usuários comuns atuais não recebem permissões automaticamente além do que for definido por você (ver decisões). Toda alteração fica registrada no histórico.

## Etapas

1. **Banco: permissões e regras.** Adicionar as duas permissões aos membros e preencher administradores com ambas. Aplicar as regras jurídica e financeira em todas as tabelas, visões e operações financeiras (recebimento, contrato, renegociação, divisão, repasse, estorno, remoção de cliente) e na gestão de membros, com as proteções acima.
   Risco: bloquear alguém indevidamente. Depende das decisões abaixo.
2. **Servidor: dados separados.** Dividir a carga do painel em parte jurídica e parte financeira; cada uma entregue apenas a quem tem permissão. Checagem por operação, inclusive histórico, relatórios e exportações.
   Risco: telas com dados ausentes. Depende da etapa 1.
3. **Equipe e convites.** Na página de equipe (e no convite RTG), opções para conceder ou revogar jurídico e financeiro, mantendo o layout atual.
   Risco baixo. Depende das etapas 1 e 2.
4. **Interface.** Menu, busca global, alertas, painel inicial e acesso direto por endereço passam a respeitar as permissões. Quem não tiver o financeiro entra pela página de processos. Os dados guardados no navegador são descartados ao sair ou quando as permissões mudam.
   Risco: ajustes visuais pontuais. Depende da etapa 2.
5. **Testes de segurança.** Com contas temporárias, depois apagadas:
   - O jurídico não lê nem altera o financeiro, inclusive por acesso direto ao banco e às operações.
   - O financeiro não gerencia usuários.
   - Um usuário não consegue conceder permissões a si mesmo.
   - O último administrador não pode ser rebaixado.
   - A revogação de permissão vale imediatamente.
   - O isolamento entre escritórios e o bloqueio da RTG continuam valendo.
   - As 53 verificações existentes continuam passando.
   Também conferir as telas no computador e no celular.

**Estimativa:** complexidade média. Aproximadamente 5 entregas pequenas; a etapa 1 é a mais delicada.

## Decisões necessárias antes da execução
- O usuário comum atual deve ficar com as duas permissões (preserva o acesso atual) ou apenas com o jurídico?
- Clientes: os profissionais jurídicos podem cadastrar e editar clientes, ou apenas consultá-los?
- Acesso jurídico a todos os processos do escritório (recomendado e mais simples) ou por processo individual (maior esforço)?

## Pendência pausada
A revisão dos indicadores reais ficou parcialmente aplicada: os registros de demonstração foram removidos e os gráficos receberam estados vazios. A conferência com uma conta conectada continua pendente e será retomada depois deste plano.

## Detalhes técnicos
- `organization_members`: colunas `can_legal`, `can_finance` booleanas com padrão falso. Backfill: admins verdadeiro em ambas; members conforme a decisão. Novas funções definer `has_legal()` e `has_finance()` (combinando `can_access` e flag), e `my_access` passa a retornar essas flags.
- Substituir (não somar) as políticas `org_*`: `legal_cases` usa legal; tabelas financeiras e `audit_log` financeiro usam finance; `clients` com leitura para qualquer domínio e escrita conforme a decisão. Visões já usam `security_invoker`.
- Adicionar checagem de finance em `create_contract*`, `record_payment`, `renegotiate_contract`, `save_fee_division`, `record_fee_payout`, `void_financial_entry`, `remove_client`. `set_member_status` passa a receber flags, bloqueia a auto-alteração e o último admin; admin sempre tem as duas permissões.
- `getWorkspace` dividido em `getLegalWorkspace`/`getFinanceWorkspace`; chaves de cache incluem usuário e escritório; `inviteMember`/`setMember` validam as flags.
- Novo script de verificação no padrão de `scripts/isolation-check.ts`.
