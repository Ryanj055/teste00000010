ALTER TABLE public.contracts ADD COLUMN IF NOT EXISTS closed_at date, ADD COLUMN IF NOT EXISTS closed_by uuid, ADD COLUMN IF NOT EXISTS close_note text;
CREATE OR REPLACE FUNCTION public.close_contract(p_contract uuid, p_note text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_org uuid:=public.current_org(); v_status text; v_total numeric; v_paid numeric;
BEGIN
 IF v_org IS NULL OR NOT public.has_finance(v_org) THEN RAISE EXCEPTION 'Acesso não autorizado'; END IF;
 SELECT status INTO v_status FROM public.contracts WHERE id=p_contract AND organization_id=v_org FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Contrato não encontrado'; END IF;
 IF v_status='Encerrado' THEN RAISE EXCEPTION 'Este contrato já está finalizado.'; END IF;
 SELECT COALESCE(sum(amount),0) INTO v_total FROM public.installments WHERE contract_id=p_contract AND NOT superseded;
 SELECT COALESCE(sum(p.amount),0) INTO v_paid FROM public.payments p JOIN public.installments i ON i.id=p.installment_id WHERE i.contract_id=p_contract AND NOT i.superseded AND p.voided_at IS NULL;
 IF round(v_total*100)>round(v_paid*100) THEN RAISE EXCEPTION 'O contrato ainda possui saldo em aberto de R$ %. Finalize somente após a quitação.', to_char(v_total-v_paid,'FM999G999G990D00'); END IF;
 UPDATE public.contracts SET status='Encerrado', closed_at=(now() AT TIME ZONE 'America/Sao_Paulo')::date, closed_by=auth.uid(), close_note=NULLIF(trim(p_note),'') WHERE id=p_contract;
 INSERT INTO public.finance_events(organization_id,entity_id,action,details,user_id) VALUES(v_org,p_contract,'Contrato finalizado',jsonb_build_object('total',v_total,'recebido',v_paid,'observacao',p_note),auth.uid());
END $$;
REVOKE ALL ON FUNCTION public.close_contract(uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.close_contract(uuid,text) TO authenticated, service_role;
CREATE OR REPLACE FUNCTION public.remove_client(p_client uuid,p_archive boolean DEFAULT false) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_org uuid:=public.current_org(); v_contracts int; v_cases int; v_payments int;
BEGIN IF NOT public.can_access(v_org) THEN RAISE EXCEPTION 'Acesso não autorizado'; END IF;
PERFORM 1 FROM public.clients WHERE id=p_client AND organization_id=v_org FOR UPDATE; IF NOT FOUND THEN RAISE EXCEPTION 'Cliente não encontrado'; END IF;
IF p_archive THEN UPDATE public.clients SET status='Arquivado' WHERE id=p_client; RETURN 'archived'; END IF;
SELECT count(*) INTO v_contracts FROM public.contracts WHERE client_id=p_client;
SELECT count(*) INTO v_cases FROM public.legal_cases WHERE client_id=p_client;
SELECT count(*) INTO v_payments FROM public.payments p JOIN public.installments i ON i.id=p.installment_id JOIN public.contracts c ON c.id=i.contract_id WHERE c.client_id=p_client;
IF v_contracts>0 OR v_cases>0 THEN RAISE EXCEPTION 'Exclusão bloqueada: o cliente possui % contrato(s), % processo(s) e % pagamento(s) vinculados. Excluir apagaria ou quebraria esse histórico. Use Arquivar para preservar os registros.', v_contracts, v_cases, v_payments; END IF;
INSERT INTO public.audit_log(entity,entity_id,action,user_id,organization_id) VALUES('clients',p_client,'DELETE',auth.uid(),v_org);
DELETE FROM public.clients WHERE id=p_client AND organization_id=v_org; RETURN 'deleted'; END $$;