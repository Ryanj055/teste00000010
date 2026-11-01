import { dateLabel, money } from './finance';

type ClientInfo = {
  name?: string | null; code?: string | null; type?: string | null; document?: string | null;
  email?: string | null; phone?: string | null; address?: string | null; cep?: string | null;
  nationality?: string | null; marital_status?: string | null; profession?: string | null;
  rg?: string | null; rg_issuer?: string | null; responsible?: string | null;
};
type ContractInfo = {
  number?: string | null; subject?: string | null; service_description?: string | null;
  modality?: string | null; responsible?: string | null; signed_at?: string | null;
  expected_method?: string | null; total?: number | null; status?: string | null; notes?: string | null;
};
type InstallmentInfo = { label?: string | null; amount?: number | string | null; due_date?: string | null };

function line(label: string, value: string | number | null | undefined): string | null {
  const text = String(value ?? '').trim();
  return text ? `${label}: ${text}` : null;
}

/** Monta o TXT apenas com informações realmente cadastradas; campos vazios são omitidos. */
export function buildContractTxt(client: ClientInfo | undefined, contract: ContractInfo, installments: InstallmentInfo[]): string {
  const clientLines = [
    line('Nome', client?.name),
    line('Código', client?.code),
    client?.type ? line('Tipo', client.type === 'PF' ? 'Pessoa física' : 'Pessoa jurídica') : null,
    line(client?.type === 'PJ' ? 'CNPJ' : 'CPF', client?.document),
    line('Nacionalidade', client?.nationality),
    line('Estado civil', client?.marital_status),
    line('Profissão', client?.profession),
    line('Identidade/RG', client?.rg),
    line('Órgão expedidor', client?.rg_issuer),
    line('Endereço', client?.address),
    line('CEP', client?.cep),
    line('E-mail', client?.email),
    line('Telefone/WhatsApp', client?.phone),
  ].filter((x): x is string => Boolean(x));

  const contractLines = [
    line('Número do contrato', contract.number),
    line('Situação', contract.status),
    line('Objeto do contrato', contract.subject),
    line('Descrição do serviço/ação', contract.service_description),
    line('Modalidade contratual', contract.modality),
    line('Responsável', contract.responsible),
    line('Data de contratação', contract.signed_at ? dateLabel(contract.signed_at) : null),
    line('Forma de pagamento prevista', contract.expected_method),
    contract.total != null ? line('Valor total contratado', money(Number(contract.total))) : null,
    line('Observações', contract.notes),
  ].filter((x): x is string => Boolean(x));

  const scheduleLines = installments.map((i) => {
    const parts = [i.label, i.amount != null ? money(Number(i.amount)) : null, i.due_date ? `vencimento ${dateLabel(i.due_date)}` : null].filter(Boolean);
    return parts.length ? `- ${parts.join(' · ')}` : null;
  }).filter((x): x is string => Boolean(x));

  const sections = [
    'DADOS DO CLIENTE', clientLines.length ? clientLines.join('\n') : 'Nenhuma informação cadastrada.',
    'DADOS DO CONTRATO', contractLines.join('\n'),
    scheduleLines.length ? 'CRONOGRAMA DE PAGAMENTO' : null, scheduleLines.length ? scheduleLines.join('\n') : null,
  ].filter((x): x is string => Boolean(x));

  return `CONTRATO ${contract.number ?? ''} — INFORMAÇÕES CADASTRADAS\nExportado do sistema Gestão Jurídica e Financeira\n\n${sections.join('\n\n')}\n`;
}
