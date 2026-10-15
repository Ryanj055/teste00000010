REVOKE ALL ON FUNCTION public.record_payment(uuid,numeric,date,text,uuid,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_payment(uuid,numeric,date,text,uuid,text,text) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.create_contract(uuid,text,text,text,text,numeric,date,jsonb,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_contract(uuid,text,text,text,text,numeric,date,jsonb,text) TO authenticated, service_role;