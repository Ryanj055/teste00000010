-- Campos complementares opcionais de clientes (registros antigos ficam com os campos vazios)
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS nationality text,
  ADD COLUMN IF NOT EXISTS marital_status text,
  ADD COLUMN IF NOT EXISTS profession text,
  ADD COLUMN IF NOT EXISTS rg text,
  ADD COLUMN IF NOT EXISTS rg_issuer text,
  ADD COLUMN IF NOT EXISTS cep text;

-- Descrição complementar do objeto contratual
ALTER TABLE public.contracts ADD COLUMN IF NOT EXISTS service_description text;

-- Documentos PDF anexados aos contratos
CREATE TABLE public.contract_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL DEFAULT current_org() REFERENCES public.organizations(id),
  contract_id uuid NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  file_path text NOT NULL,
  file_name text NOT NULL,
  uploaded_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.contract_documents TO authenticated;
GRANT ALL ON public.contract_documents TO service_role;
ALTER TABLE public.contract_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY finance_contract_documents ON public.contract_documents FOR ALL TO authenticated
  USING (has_finance(organization_id)) WITH CHECK (has_finance(organization_id));

-- Edição dos dados cadastrais do contrato (valores, parcelas e cronograma não são alterados)
CREATE OR REPLACE FUNCTION public.update_contract(p_contract uuid, p_subject text, p_description text, p_responsible text, p_modality text, p_method text, p_notes text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_org uuid;
BEGIN
  SELECT organization_id INTO v_org FROM public.contracts WHERE id = p_contract;
  IF v_org IS NULL THEN RAISE EXCEPTION 'Contrato não encontrado.'; END IF;
  IF NOT public.has_finance(v_org) THEN RAISE EXCEPTION 'Permissão insuficiente.'; END IF;
  UPDATE public.contracts
  SET subject = p_subject,
      service_description = NULLIF(p_description, ''),
      responsible = p_responsible,
      modality = p_modality,
      expected_method = p_method,
      notes = NULLIF(p_notes, '')
  WHERE id = p_contract;
  INSERT INTO public.finance_events (organization_id, entity_id, action, details, user_id)
  VALUES (v_org, p_contract, 'Contrato atualizado', jsonb_build_object('number', (SELECT number FROM public.contracts WHERE id = p_contract)), auth.uid());
END; $$;

-- Exclusão segura de contrato: bloqueia quando há recebimentos ou documento anexado
CREATE OR REPLACE FUNCTION public.delete_contract(p_contract uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_org uuid; v_number text; v_payments integer; v_docs integer;
BEGIN
  SELECT organization_id, number INTO v_org, v_number FROM public.contracts WHERE id = p_contract;
  IF v_org IS NULL THEN RAISE EXCEPTION 'Contrato não encontrado.'; END IF;
  IF NOT public.has_finance(v_org) THEN RAISE EXCEPTION 'Permissão insuficiente.'; END IF;
  SELECT count(*) INTO v_docs FROM public.contract_documents WHERE contract_id = p_contract;
  IF v_docs > 0 THEN RAISE EXCEPTION 'Remova o documento anexado antes de excluir o contrato.'; END IF;
  SELECT count(*) INTO v_payments FROM public.payments p JOIN public.installments i ON i.id = p.installment_id WHERE i.contract_id = p_contract;
  IF v_payments > 0 THEN RAISE EXCEPTION 'Este contrato possui recebimentos registrados e não pode ser excluído. Finalize o contrato para preservar o histórico financeiro.'; END IF;
  DELETE FROM public.fee_payouts WHERE division_id IN (SELECT id FROM public.fee_divisions WHERE contract_id = p_contract);
  DELETE FROM public.fee_divisions WHERE contract_id = p_contract;
  DELETE FROM public.installments WHERE contract_id = p_contract;
  DELETE FROM public.contracts WHERE id = p_contract;
  INSERT INTO public.finance_events (organization_id, entity_id, action, details, user_id)
  VALUES (v_org, p_contract, 'Contrato excluído', jsonb_build_object('number', v_number), auth.uid());
END; $$;

-- Acesso aos PDFs no armazenamento seguro, isolado por escritório (caminho: escritório/contrato/arquivo)
CREATE POLICY contract_docs_read ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'contract-documents' AND public.has_finance((storage.foldername(name))[1]::uuid));
CREATE POLICY contract_docs_write ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'contract-documents' AND public.has_finance((storage.foldername(name))[1]::uuid));
CREATE POLICY contract_docs_update ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'contract-documents' AND public.has_finance((storage.foldername(name))[1]::uuid));
CREATE POLICY contract_docs_delete ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'contract-documents' AND public.has_finance((storage.foldername(name))[1]::uuid));