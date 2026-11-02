import { describe, expect, it } from 'vitest';
import { buildContractTxt } from '@/lib/gbts/contract-export';

const client = {
  name: 'Maria Silva', code: 'CLI-abc123', type: 'PF', document: '12345678909',
  email: 'maria@example.com', phone: '11999990000', address: 'Rua A, 100', cep: '01001-000',
  nationality: 'Brasileira', marital_status: 'Casado(a)', profession: 'Comerciante',
  rg: '12.345.678-9', rg_issuer: 'SSP/SP', responsible: 'Gabriella Barreto',
};
const contract = {
  number: 'CT-2026-001', subject: 'Ação de cobrança', service_description: 'Cobrança judicial de valores',
  modality: 'Parcelados', responsible: 'Gabriella Barreto', signed_at: '2026-01-10',
  expected_method: 'Pix', total: 6000, status: 'Ativo', notes: 'Cliente indicado por parceiro',
};

describe('exportação TXT do contrato', () => {
  it('reúne dados do cliente, do contrato e o cronograma com formatação brasileira', () => {
    const txt = buildContractTxt(client, contract, [
      { label: 'Entrada', amount: 1000, due_date: '2026-01-10' },
      { label: 'Parcela 1/5', amount: 1000, due_date: '2026-02-10' },
    ]);
    expect(txt).toContain('DADOS DO CLIENTE');
    expect(txt).toContain('Nome: Maria Silva');
    expect(txt).toContain('Nacionalidade: Brasileira');
    expect(txt).toContain('Estado civil: Casado(a)');
    expect(txt).toContain('Profissão: Comerciante');
    expect(txt).toContain('Identidade/RG: 12.345.678-9');
    expect(txt).toContain('Órgão expedidor: SSP/SP');
    expect(txt).toContain('CEP: 01001-000');
    expect(txt).toContain('DADOS DO CONTRATO');
    expect(txt).toContain('Objeto do contrato: Ação de cobrança');
    expect(txt).toContain('Descrição do serviço/ação: Cobrança judicial de valores');
    expect(txt).toContain('Valor total contratado: R$');
    expect(txt).toContain('6.000,00');
    expect(txt).toContain('CRONOGRAMA DE PAGAMENTO');
    expect(txt).toContain('Entrada');
    expect(txt).toContain('10/02/2026');
  });

  it('omite campos vazios em vez de inventar informações', () => {
    const txt = buildContractTxt(
      { name: 'João', type: 'PF' },
      { number: 'CT-2', subject: 'Consultoria', modality: 'Fixos', total: 500 },
      [],
    );
    expect(txt).toContain('Nome: João');
    expect(txt).not.toContain('Nacionalidade');
    expect(txt).not.toContain('Estado civil');
    expect(txt).not.toContain('Identidade/RG');
    expect(txt).not.toContain('CEP');
    expect(txt).not.toContain('Descrição do serviço');
    expect(txt).not.toContain('CRONOGRAMA DE PAGAMENTO');
    expect(txt).not.toContain('undefined');
    expect(txt).not.toContain('null');
  });

  it('informa quando o cliente não tem dados complementares cadastrados', () => {
    const txt = buildContractTxt(undefined, contract, []);
    expect(txt).toContain('Nenhuma informação cadastrada.');
  });
});
