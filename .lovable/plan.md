# Correção de escopo: GBTS como produto comercial da RTG Systems

## Diagnóstico do projeto atual
- **Já é real:** banco de dados compartilhado entre aparelhos (Lovable Cloud), login com e-mail e senha, recuperação de senha, saída, páginas restritas, permissões checadas no banco. Clientes, contratos, parcelas, recebimentos, despesas e processos são salvos de verdade. Recebimentos e contratos são gravados de forma segura (sem duplicar e sem passar do saldo). Painel, relatórios, exportação e importação usam os registros salvos.
- **Ainda é demonstração:** a página inicial pública mostra dados fictícios; existe um aviso "Ambiente de demonstração" em todas as telas; o sistema hoje atende um único escritório; não existe painel da RTG nem controle de assinatura; os convites de usuárias são feitos manualmente por mim; a renegociação de contratos ainda não tem tela própria.
- **Custos:** nada novo precisa ser contratado. Tudo usa o Lovable Cloud que já está ativo, que tem uso gratuito incluído e cobra apenas por uso acima disso. E-mails de convite e recuperação usam o envio padrão já incluído. Nenhuma cobrança automática ou integração de pagamento será criada.

## O que será feito
1. **Escritórios separados.** Cada registro passa a pertencer a um escritório. O banco só deixa a pessoa ver e alterar os registros do próprio escritório, mesmo se ela mudar o endereço da página ou mexer no navegador. Os dados atuais do GBTS vão para o escritório "Gabriella Barreto & Thais Sardinha".
2. **Papéis e usuários.**
   - Administradora do escritório: convida, desativa e define o papel das usuárias do próprio escritório.
   - Usuária: usa as funções financeiras e jurídicas.
   - Administrador RTG: gerencia apenas os escritórios e as assinaturas. Não vê dados jurídicos nem financeiros dos clientes.
   - Os convites são enviados por e-mail e a pessoa define a própria senha. Não existe cadastro aberto ao público.
3. **Painel RTG.** Página `/rtg` com:
   - Cadastro de escritórios: nome, contato e suporte.
   - Plano, período de teste, data de início e data de vencimento.
   - Ações para ativar, suspender, reativar e encerrar.
   - Histórico de alterações administrativas.
4. **Controle de acesso pela assinatura.** O escritório pode estar em configuração, teste, ativo, pagamento pendente, suspenso ou encerrado. A situação é calculada pelo banco usando a data do servidor, não a do navegador.
   - Suspenso ou encerrado: o escritório não acessa as funções e vê uma tela explicando a situação. Nenhum dado é apagado.
   - Pagamento pendente: o acesso continua, com um aviso.
5. **Fim da demonstração em produção.** A página inicial passa a ser institucional e leva ao login. O aviso de dados fictícios sai das telas. Os registros fictícios atuais serão apagados do banco: hoje o projeto tem um único ambiente, então não dá para guardá-los num ambiente de testes separado. Os testes automáticos continuam usando dados próprios.
6. **Renegociação.** Tela para refazer o cronograma das parcelas que ainda têm saldo. Os pagamentos já registrados ficam preservados e não são contados duas vezes.
7. **Sessão expirada.** Quando a sessão expira, a pessoa é levada ao login com uma mensagem clara.
8. **Testes.**
   - Isolamento: uma conta do escritório A não consegue ler nem alterar dados do escritório B.
   - A RTG não vê dados financeiros.
   - Um escritório suspenso fica bloqueado.
   - Testes de renegociação e de cálculos.
   - Verificação das telas no computador e no celular.
9. **Documentação.** O README será atualizado com a configuração do banco e da autenticação, as variáveis de ambiente, a execução local e no VS Code, o uso do GitHub, a publicação e a dependência do Lovable Cloud.

## Decisões que preciso de você
- O e-mail do administrador RTG.
- Os e-mails da Gabriella e da Thais, que serão as administradoras do escritório GBTS.
- Se posso apagar os dados fictícios quando a migração for concluída.

## Detalhes técnicos
- Novas tabelas: `organizations` (com a situação e as datas da assinatura), `organization_members` (usuária, escritório, papel e se está ativa) e `admin_events` (histórico administrativo). Novo papel `rtg_admin` na tabela `user_roles`, que já existe.
- Coluna `organization_id` em todas as tabelas de negócio. Os dados atuais serão preenchidos com o escritório GBTS. As regras de acesso do banco passam a usar `is_org_member(org)` e `org_access_ok(org)`, funções seguras que verificam também a situação da assinatura com `current_date`.
- As funções `create_contract` e `record_payment` passam a receber e validar o escritório. Uma nova função transacional `renegotiate_contract` cuida da renegociação.
- Convites pela função administrativa de convite de usuários, executada no servidor só depois de confirmar que quem convida é administradora daquele escritório ou administrador RTG.
- As regras de acesso para visitantes sem login nas tabelas de demonstração serão removidas.
