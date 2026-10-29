CREATE OR REPLACE FUNCTION public.remove_client(p_client uuid,p_archive boolean DEFAULT false) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_org uuid:=public.current_org();
BEGIN IF NOT public.can_access(v_org) THEN RAISE EXCEPTION 'Acesso não autorizado'; END IF;
PERFORM 1 FROM public.clients WHERE id=p_client AND organization_id=v_org FOR UPDATE; IF NOT FOUND THEN RAISE EXCEPTION 'Cliente não encontrado'; END IF;
IF p_archive THEN UPDATE public.clients SET status='Arquivado' WHERE id=p_client; RETURN 'archived'; END IF;
IF NOT public.is_general_admin() THEN RAISE EXCEPTION 'Somente a administração geral do escritório pode excluir clientes definitivamente. Use Arquivar.'; END IF;
DELETE FROM public.fee_payouts WHERE organization_id=v_org AND (division_id IN (SELECT d.id FROM public.fee_divisions d JOIN public.contracts c ON c.id=d.contract_id WHERE c.client_id=p_client) OR payment_id IN (SELECT p.id FROM public.payments p JOIN public.installments i ON i.id=p.installment_id JOIN public.contracts c ON c.id=i.contract_id WHERE c.client_id=p_client));
DELETE FROM public.fee_divisions WHERE contract_id IN (SELECT id FROM public.contracts WHERE client_id=p_client);
DELETE FROM public.payments WHERE installment_id IN (SELECT i.id FROM public.installments i JOIN public.contracts c ON c.id=i.contract_id WHERE c.client_id=p_client);
DELETE FROM public.installments WHERE contract_id IN (SELECT id FROM public.contracts WHERE client_id=p_client);
DELETE FROM public.contracts WHERE client_id=p_client;
DELETE FROM public.legal_cases WHERE client_id=p_client;
INSERT INTO public.audit_log(entity,entity_id,action,user_id,organization_id) VALUES('clients',p_client,'DELETE',auth.uid(),v_org);
DELETE FROM public.clients WHERE id=p_client AND organization_id=v_org; RETURN 'deleted'; END $$;