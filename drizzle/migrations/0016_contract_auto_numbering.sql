CREATE TABLE public.contract_number_counters (organization_id uuid PRIMARY KEY REFERENCES public.organizations(id), last_value integer NOT NULL DEFAULT 0, updated_at timestamptz NOT NULL DEFAULT now());
GRANT ALL ON public.contract_number_counters TO service_role;
ALTER TABLE public.contract_number_counters ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.contract_number_max(p_org uuid) RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT coalesce(max((substring(number from '(\d+)\s*$'))::integer),0) FROM public.contracts WHERE organization_id=p_org AND number ~ '\d+\s*$' AND length(substring(number from '(\d+)\s*$'))<=9 $$;
REVOKE ALL ON FUNCTION public.contract_number_max(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.format_contract_number(p_n integer) RETURNS text LANGUAGE sql STABLE SET search_path=public AS $$
  SELECT 'CT-'||to_char((now() AT TIME ZONE 'America/Sao_Paulo'),'YYYY')||' '||lpad(p_n::text,3,'0') $$;

CREATE OR REPLACE FUNCTION public.next_contract_number() RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE v_org uuid:=public.current_org(); v_n integer;
BEGIN IF v_org IS NULL OR NOT public.has_finance(v_org) THEN RAISE EXCEPTION 'Acesso financeiro necessário'; END IF;
SELECT greatest(coalesce((SELECT last_value FROM public.contract_number_counters WHERE organization_id=v_org),0),public.contract_number_max(v_org))+1 INTO v_n;
RETURN public.format_contract_number(v_n); END $$;
REVOKE ALL ON FUNCTION public.next_contract_number() FROM PUBLIC, anon; GRANT EXECUTE ON FUNCTION public.next_contract_number() TO authenticated;

CREATE OR REPLACE FUNCTION public.create_contract_auto(p_client uuid, p_subject text, p_responsible text, p_modality text, p_total numeric, p_signed date, p_schedule jsonb, p_notes text, p_method text) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_org uuid:=public.current_org(); v_n integer; v_number text;
BEGIN IF v_org IS NULL OR NOT public.has_finance(v_org) THEN RAISE EXCEPTION 'Acesso financeiro necessário'; END IF;
INSERT INTO public.contract_number_counters(organization_id,last_value) VALUES (v_org,0) ON CONFLICT (organization_id) DO NOTHING;
SELECT last_value INTO v_n FROM public.contract_number_counters WHERE organization_id=v_org FOR UPDATE;
v_n:=greatest(v_n,public.contract_number_max(v_org))+1;
LOOP v_number:=public.format_contract_number(v_n); EXIT WHEN NOT EXISTS (SELECT 1 FROM public.contracts WHERE organization_id=v_org AND number=v_number); v_n:=v_n+1; END LOOP;
UPDATE public.contract_number_counters SET last_value=v_n, updated_at=now() WHERE organization_id=v_org;
RETURN public.create_contract_review(p_client,v_number,p_subject,p_responsible,p_modality,p_total,p_signed,p_schedule,p_notes,p_method); END $$;
REVOKE ALL ON FUNCTION public.create_contract_auto(uuid,text,text,text,numeric,date,jsonb,text,text) FROM PUBLIC, anon; GRANT EXECUTE ON FUNCTION public.create_contract_auto(uuid,text,text,text,numeric,date,jsonb,text,text) TO authenticated;