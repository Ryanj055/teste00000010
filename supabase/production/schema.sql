CREATE TYPE public.app_role AS ENUM ('admin','partner');
CREATE TABLE public.user_roles(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE, role public.app_role NOT NULL, UNIQUE(user_id,role));
GRANT SELECT ON public.user_roles TO authenticated; GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY own_roles ON public.user_roles FOR SELECT TO authenticated USING(user_id=auth.uid());
CREATE FUNCTION public.has_role(_user_id uuid,_role public.app_role) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=_user_id AND role=_role) $$;
CREATE FUNCTION public.is_partner() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT public.has_role(auth.uid(),'partner') $$;
CREATE TABLE public.clients(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), code text NOT NULL UNIQUE DEFAULT ('CLI-'||substr(gen_random_uuid()::text,1,8)), name text NOT NULL CHECK(length(name) BETWEEN 2 AND 150), type text NOT NULL DEFAULT 'PF' CHECK(type IN ('PF','PJ')), document text UNIQUE, email text, phone text, address text, responsible text NOT NULL DEFAULT 'Gabriella Barreto', status text NOT NULL DEFAULT 'Ativo' CHECK(status IN ('Ativo','Arquivado')), notes text, demo boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT,INSERT,UPDATE ON public.clients TO authenticated; GRANT SELECT ON public.clients TO anon; GRANT ALL ON public.clients TO service_role;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY partner_clients ON public.clients FOR ALL TO authenticated USING(public.is_partner()) WITH CHECK(public.is_partner());
CREATE POLICY demo_clients ON public.clients FOR SELECT TO anon USING(demo);
CREATE TABLE public.contracts(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), client_id uuid NOT NULL REFERENCES public.clients(id), number text NOT NULL UNIQUE, subject text NOT NULL CHECK(length(subject) BETWEEN 2 AND 500), responsible text NOT NULL, modality text NOT NULL DEFAULT 'Parcelados', total numeric(14,2) NOT NULL CHECK(total>0), signed_at date NOT NULL DEFAULT current_date, status text NOT NULL DEFAULT 'Ativo' CHECK(status IN ('Ativo','Encerrado','Em renegociação')), notes text, demo boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT ON public.contracts TO anon,authenticated; GRANT ALL ON public.contracts TO service_role;
ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;
CREATE POLICY partner_contracts ON public.contracts FOR SELECT TO authenticated USING(public.is_partner());
CREATE POLICY demo_contracts ON public.contracts FOR SELECT TO anon USING(demo);
CREATE TABLE public.installments(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),contract_id uuid NOT NULL REFERENCES public.contracts(id),label text NOT NULL,amount numeric(14,2) NOT NULL CHECK(amount>0),due_date date NOT NULL,demo boolean NOT NULL DEFAULT false, UNIQUE(contract_id,label));
GRANT SELECT ON public.installments TO anon,authenticated; GRANT ALL ON public.installments TO service_role;
ALTER TABLE public.installments ENABLE ROW LEVEL SECURITY;
CREATE POLICY partner_installments ON public.installments FOR SELECT TO authenticated USING(public.is_partner());
CREATE POLICY demo_installments ON public.installments FOR SELECT TO anon USING(demo);
CREATE TABLE public.payments(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),installment_id uuid NOT NULL REFERENCES public.installments(id),amount numeric(14,2) NOT NULL CHECK(amount>0),paid_at date NOT NULL,method text NOT NULL,reference text,notes text,idempotency_key uuid NOT NULL UNIQUE,user_id uuid,demo boolean NOT NULL DEFAULT false,created_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT ON public.payments TO anon,authenticated; GRANT ALL ON public.payments TO service_role;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY partner_payments ON public.payments FOR SELECT TO authenticated USING(public.is_partner());
CREATE POLICY demo_payments ON public.payments FOR SELECT TO anon USING(demo);
CREATE TABLE public.expenses(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),description text NOT NULL CHECK(length(description) BETWEEN 2 AND 200),category text NOT NULL,amount numeric(14,2) NOT NULL CHECK(amount>0),due_date date NOT NULL,paid_at date,status text NOT NULL DEFAULT 'Pendente' CHECK(status IN ('Pendente','Pago')),reimbursable boolean NOT NULL DEFAULT false,demo boolean NOT NULL DEFAULT false,created_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT,INSERT,UPDATE ON public.expenses TO authenticated; GRANT SELECT ON public.expenses TO anon; GRANT ALL ON public.expenses TO service_role;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
CREATE POLICY partner_expenses ON public.expenses FOR ALL TO authenticated USING(public.is_partner()) WITH CHECK(public.is_partner());
CREATE POLICY demo_expenses ON public.expenses FOR SELECT TO anon USING(demo);
CREATE TABLE public.audit_log(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),entity text NOT NULL,entity_id uuid NOT NULL,action text NOT NULL,user_id uuid,created_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT ON public.audit_log TO authenticated; GRANT ALL ON public.audit_log TO service_role;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY partner_audit ON public.audit_log FOR SELECT TO authenticated USING(public.is_partner());
CREATE FUNCTION public.audit_change() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN INSERT INTO public.audit_log(entity,entity_id,action,user_id) VALUES(TG_TABLE_NAME,NEW.id,TG_OP,auth.uid()); RETURN NEW; END $$;
CREATE TRIGGER clients_audit AFTER INSERT OR UPDATE ON public.clients FOR EACH ROW EXECUTE FUNCTION public.audit_change();
CREATE TRIGGER contracts_audit AFTER INSERT OR UPDATE ON public.contracts FOR EACH ROW EXECUTE FUNCTION public.audit_change();
CREATE TRIGGER payments_audit AFTER INSERT ON public.payments FOR EACH ROW EXECUTE FUNCTION public.audit_change();
CREATE TRIGGER expenses_audit AFTER INSERT OR UPDATE ON public.expenses FOR EACH ROW EXECUTE FUNCTION public.audit_change();
CREATE VIEW public.receivables WITH(security_invoker=true) AS SELECT i.*,coalesce(p.paid,0)::numeric(14,2) AS paid,(i.amount-coalesce(p.paid,0))::numeric(14,2) AS balance,p.last_payment,CASE WHEN coalesce(p.paid,0)>=i.amount THEN 'Pago' WHEN i.due_date<current_date THEN 'Vencido' WHEN coalesce(p.paid,0)>0 THEN 'Parcialmente pago' ELSE 'A vencer' END AS status FROM public.installments i LEFT JOIN (SELECT installment_id,sum(amount) paid,max(paid_at) last_payment FROM public.payments GROUP BY installment_id) p ON p.installment_id=i.id;
GRANT SELECT ON public.receivables TO anon,authenticated,service_role;
CREATE FUNCTION public.record_payment(p_installment uuid,p_amount numeric,p_date date,p_method text,p_key uuid,p_reference text DEFAULT NULL,p_notes text DEFAULT NULL) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE v_amount numeric;v_paid numeric;v_id uuid; BEGIN IF NOT public.is_partner() THEN RAISE EXCEPTION 'Acesso não autorizado'; END IF; SELECT id INTO v_id FROM public.payments WHERE idempotency_key=p_key; IF v_id IS NOT NULL THEN RETURN v_id; END IF; SELECT amount INTO v_amount FROM public.installments WHERE id=p_installment FOR UPDATE; IF v_amount IS NULL THEN RAISE EXCEPTION 'Parcela não encontrada'; END IF; SELECT coalesce(sum(amount),0) INTO v_paid FROM public.payments WHERE installment_id=p_installment; IF p_amount IS NULL OR p_amount<=0 OR p_amount<>round(p_amount,2) OR p_amount>v_amount-v_paid THEN RAISE EXCEPTION 'Valor inválido ou superior ao saldo'; END IF; IF p_date IS NULL OR p_date>current_date OR length(p_method)>50 THEN RAISE EXCEPTION 'Data ou forma de pagamento inválida'; END IF; IF EXISTS(SELECT 1 FROM public.payments WHERE installment_id=p_installment AND amount=p_amount AND paid_at=p_date AND method=p_method AND coalesce(reference,'')=coalesce(p_reference,'')) THEN RAISE EXCEPTION 'Possível pagamento duplicado: confira o histórico'; END IF; INSERT INTO public.payments(installment_id,amount,paid_at,method,reference,notes,idempotency_key,user_id) VALUES(p_installment,p_amount,p_date,p_method,p_reference,p_notes,p_key,auth.uid()) RETURNING id INTO v_id; RETURN v_id; END $$;
REVOKE ALL ON FUNCTION public.record_payment(uuid,numeric,date,text,uuid,text,text) FROM PUBLIC; GRANT EXECUTE ON FUNCTION public.record_payment(uuid,numeric,date,text,uuid,text,text) TO authenticated;
CREATE FUNCTION public.create_contract(p_client uuid,p_number text,p_subject text,p_responsible text,p_modality text,p_total numeric,p_signed date,p_schedule jsonb,p_notes text DEFAULT NULL) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE v_id uuid; v_sum numeric; BEGIN IF NOT public.is_partner() THEN RAISE EXCEPTION 'Acesso não autorizado'; END IF; IF jsonb_array_length(p_schedule)<1 OR jsonb_array_length(p_schedule)>120 THEN RAISE EXCEPTION 'Cronograma inválido'; END IF; SELECT sum((x->>'amount')::numeric) INTO v_sum FROM jsonb_array_elements(p_schedule) x; IF v_sum<>p_total OR p_total<=0 OR EXISTS(SELECT 1 FROM jsonb_array_elements(p_schedule) x WHERE (x->>'amount')::numeric<=0 OR (x->>'amount')::numeric<>round((x->>'amount')::numeric,2)) THEN RAISE EXCEPTION 'O cronograma deve totalizar o valor do contrato'; END IF; INSERT INTO public.contracts(client_id,number,subject,responsible,modality,total,signed_at,notes) VALUES(p_client,p_number,p_subject,p_responsible,p_modality,p_total,p_signed,p_notes) RETURNING id INTO v_id; INSERT INTO public.installments(contract_id,label,amount,due_date) SELECT v_id,x->>'label',(x->>'amount')::numeric,(x->>'due_date')::date FROM jsonb_array_elements(p_schedule) x; RETURN v_id; END $$;
REVOKE ALL ON FUNCTION public.create_contract(uuid,text,text,text,text,numeric,date,jsonb,text) FROM PUBLIC; GRANT EXECUTE ON FUNCTION public.create_contract(uuid,text,text,text,text,numeric,date,jsonb,text) TO authenticated;
CREATE INDEX installments_contract_idx ON public.installments(contract_id); CREATE INDEX payments_installment_idx ON public.payments(installment_id); CREATE INDEX contracts_client_idx ON public.contracts(client_id);REVOKE ALL ON FUNCTION public.has_role(uuid,public.app_role) FROM PUBLIC,anon; GRANT EXECUTE ON FUNCTION public.has_role(uuid,public.app_role) TO authenticated,service_role;
REVOKE ALL ON FUNCTION public.is_partner() FROM PUBLIC,anon; GRANT EXECUTE ON FUNCTION public.is_partner() TO authenticated,service_role;
REVOKE ALL ON FUNCTION public.audit_change() FROM PUBLIC,anon,authenticated;REVOKE ALL ON FUNCTION public.record_payment(uuid,numeric,date,text,uuid,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_payment(uuid,numeric,date,text,uuid,text,text) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.create_contract(uuid,text,text,text,text,numeric,date,jsonb,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_contract(uuid,text,text,text,text,numeric,date,jsonb,text) TO authenticated, service_role;CREATE TABLE public.legal_cases(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), number text NOT NULL UNIQUE CHECK(length(number) BETWEEN 3 AND 60), client_id uuid NOT NULL REFERENCES public.clients(id), subject text NOT NULL CHECK(length(subject) BETWEEN 2 AND 500), responsible text NOT NULL, status text NOT NULL DEFAULT 'Em andamento' CHECK(status IN ('Em andamento','Suspenso','Arquivado','Encerrado')), next_deadline date, deadline_note text, notes text, demo boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT, INSERT, UPDATE ON public.legal_cases TO authenticated;
GRANT SELECT ON public.legal_cases TO anon;
GRANT ALL ON public.legal_cases TO service_role;
ALTER TABLE public.legal_cases ENABLE ROW LEVEL SECURITY;
CREATE POLICY partner_cases ON public.legal_cases FOR ALL TO authenticated USING(public.is_partner()) WITH CHECK(public.is_partner());
CREATE POLICY demo_cases ON public.legal_cases FOR SELECT TO anon USING(demo);
CREATE TRIGGER legal_cases_audit AFTER INSERT OR UPDATE ON public.legal_cases FOR EACH ROW EXECUTE FUNCTION public.audit_change();CREATE TABLE public.organizations(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL CHECK(length(name) BETWEEN 2 AND 200), contact_name text, contact_email text, contact_phone text, support_notes text, plan text NOT NULL DEFAULT 'Essencial', status text NOT NULL DEFAULT 'setup' CHECK(status IN ('setup','trial','active','payment_pending','suspended','closed')), trial_ends_at date, starts_at date, ends_at date, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE public.organization_members(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES public.organizations(id), user_id uuid NOT NULL, email text, role text NOT NULL DEFAULT 'member' CHECK(role IN ('admin','member')), active boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(user_id));
CREATE TABLE public.rtg_admins(user_id uuid PRIMARY KEY, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE public.admin_events(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid REFERENCES public.organizations(id), actor uuid, action text NOT NULL, details jsonb, created_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT ON public.organizations, public.organization_members, public.rtg_admins, public.admin_events TO authenticated;
GRANT ALL ON public.organizations, public.organization_members, public.rtg_admins, public.admin_events TO service_role;
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rtg_admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_events ENABLE ROW LEVEL SECURITY;

CREATE FUNCTION public.is_rtg_admin() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT EXISTS(SELECT 1 FROM public.rtg_admins WHERE user_id=auth.uid()) $$;
CREATE FUNCTION public.current_org() RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT organization_id FROM public.organization_members WHERE user_id=auth.uid() AND active $$;
CREATE FUNCTION public.org_access_ok(p_org uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT EXISTS(SELECT 1 FROM public.organizations o WHERE o.id=p_org AND (o.status IN ('setup','payment_pending') OR (o.status='trial' AND coalesce(o.trial_ends_at,current_date)>=current_date) OR (o.status='active' AND coalesce(o.ends_at,current_date)>=current_date))) $$;
CREATE FUNCTION public.can_access(p_org uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT p_org IS NOT NULL AND p_org=public.current_org() AND public.org_access_ok(p_org) $$;
CREATE FUNCTION public.is_org_admin() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT EXISTS(SELECT 1 FROM public.organization_members WHERE user_id=auth.uid() AND active AND role='admin') $$;
CREATE OR REPLACE FUNCTION public.is_partner() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT public.can_access(public.current_org()) $$;

CREATE POLICY rtg_orgs ON public.organizations FOR SELECT TO authenticated USING(public.is_rtg_admin() OR id=public.current_org());
CREATE POLICY members_read ON public.organization_members FOR SELECT TO authenticated USING(public.is_rtg_admin() OR user_id=auth.uid() OR (organization_id=public.current_org() AND public.is_org_admin()));
CREATE POLICY rtg_self ON public.rtg_admins FOR SELECT TO authenticated USING(user_id=auth.uid());
CREATE POLICY rtg_events ON public.admin_events FOR SELECT TO authenticated USING(public.is_rtg_admin());

INSERT INTO public.organizations(id,name,plan,status,starts_at) VALUES('00000000-0000-4000-8000-000000000001','Gabriella Barreto & Thais Sardinha — Advogados Associados','Essencial','active',current_date);
INSERT INTO public.organization_members(organization_id,user_id,email,role) SELECT '00000000-0000-4000-8000-000000000001',r.user_id,u.email,'admin' FROM public.user_roles r JOIN auth.users u ON u.id=r.user_id WHERE r.role='partner' ON CONFLICT DO NOTHING;

DO $$ DECLARE t text; BEGIN FOREACH t IN ARRAY ARRAY['clients','contracts','installments','payments','expenses','legal_cases','audit_log'] LOOP
 EXECUTE format('ALTER TABLE public.%I ADD COLUMN organization_id uuid REFERENCES public.organizations(id) DEFAULT public.current_org()',t);
 EXECUTE format('UPDATE public.%I SET organization_id=%L',t,'00000000-0000-4000-8000-000000000001');
 EXECUTE format('ALTER TABLE public.%I ALTER COLUMN organization_id SET NOT NULL',t);
 EXECUTE format('CREATE INDEX ON public.%I(organization_id)',t);
END LOOP; END $$;

ALTER TABLE public.clients DROP CONSTRAINT clients_code_key, DROP CONSTRAINT clients_document_key, ADD UNIQUE(organization_id,code), ADD UNIQUE(organization_id,document);
ALTER TABLE public.contracts DROP CONSTRAINT contracts_number_key, ADD UNIQUE(organization_id,number);
ALTER TABLE public.legal_cases DROP CONSTRAINT legal_cases_number_key, ADD UNIQUE(organization_id,number);

DROP POLICY IF EXISTS demo_clients ON public.clients; DROP POLICY IF EXISTS demo_contracts ON public.contracts; DROP POLICY IF EXISTS demo_installments ON public.installments; DROP POLICY IF EXISTS demo_payments ON public.payments; DROP POLICY IF EXISTS demo_expenses ON public.expenses; DROP POLICY IF EXISTS demo_cases ON public.legal_cases;
DROP POLICY IF EXISTS partner_clients ON public.clients; DROP POLICY IF EXISTS partner_contracts ON public.contracts; DROP POLICY IF EXISTS partner_installments ON public.installments; DROP POLICY IF EXISTS partner_payments ON public.payments; DROP POLICY IF EXISTS partner_expenses ON public.expenses; DROP POLICY IF EXISTS partner_cases ON public.legal_cases; DROP POLICY IF EXISTS partner_audit ON public.audit_log;
REVOKE SELECT ON public.clients, public.contracts, public.installments, public.payments, public.expenses, public.legal_cases FROM anon;
REVOKE SELECT ON public.receivables FROM anon;
CREATE POLICY org_clients ON public.clients FOR ALL TO authenticated USING(public.can_access(organization_id)) WITH CHECK(public.can_access(organization_id));
CREATE POLICY org_expenses ON public.expenses FOR ALL TO authenticated USING(public.can_access(organization_id)) WITH CHECK(public.can_access(organization_id));
CREATE POLICY org_cases ON public.legal_cases FOR ALL TO authenticated USING(public.can_access(organization_id)) WITH CHECK(public.can_access(organization_id) AND EXISTS(SELECT 1 FROM public.clients c WHERE c.id=client_id AND c.organization_id=legal_cases.organization_id));
CREATE POLICY org_contracts ON public.contracts FOR SELECT TO authenticated USING(public.can_access(organization_id));
CREATE POLICY org_installments ON public.installments FOR SELECT TO authenticated USING(public.can_access(organization_id));
CREATE POLICY org_payments ON public.payments FOR SELECT TO authenticated USING(public.can_access(organization_id));
CREATE POLICY org_audit ON public.audit_log FOR SELECT TO authenticated USING(public.can_access(organization_id));

CREATE OR REPLACE FUNCTION public.audit_change() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN INSERT INTO public.audit_log(entity,entity_id,action,user_id,organization_id) VALUES(TG_TABLE_NAME,NEW.id,TG_OP,auth.uid(),NEW.organization_id); RETURN NEW; END $$;

CREATE OR REPLACE FUNCTION public.record_payment(p_installment uuid,p_amount numeric,p_date date,p_method text,p_key uuid,p_reference text DEFAULT NULL,p_notes text DEFAULT NULL) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE v_amount numeric;v_paid numeric;v_id uuid;v_org uuid:=public.current_org(); BEGIN IF NOT public.can_access(v_org) THEN RAISE EXCEPTION 'Acesso não autorizado'; END IF; SELECT id INTO v_id FROM public.payments WHERE idempotency_key=p_key AND organization_id=v_org; IF v_id IS NOT NULL THEN RETURN v_id; END IF; SELECT amount INTO v_amount FROM public.installments WHERE id=p_installment AND organization_id=v_org FOR UPDATE; IF v_amount IS NULL THEN RAISE EXCEPTION 'Parcela não encontrada'; END IF; SELECT coalesce(sum(amount),0) INTO v_paid FROM public.payments WHERE installment_id=p_installment; IF p_amount IS NULL OR p_amount<=0 OR p_amount<>round(p_amount,2) OR p_amount>v_amount-v_paid THEN RAISE EXCEPTION 'Valor inválido ou superior ao saldo'; END IF; IF p_date IS NULL OR p_date>current_date OR length(p_method)>50 THEN RAISE EXCEPTION 'Data ou forma de pagamento inválida'; END IF; IF EXISTS(SELECT 1 FROM public.payments WHERE installment_id=p_installment AND amount=p_amount AND paid_at=p_date AND method=p_method AND coalesce(reference,'')=coalesce(p_reference,'')) THEN RAISE EXCEPTION 'Possível pagamento duplicado: confira o histórico'; END IF; INSERT INTO public.payments(installment_id,amount,paid_at,method,reference,notes,idempotency_key,user_id,organization_id) VALUES(p_installment,p_amount,p_date,p_method,p_reference,p_notes,p_key,auth.uid(),v_org) RETURNING id INTO v_id; RETURN v_id; END $$;

CREATE OR REPLACE FUNCTION public.create_contract(p_client uuid,p_number text,p_subject text,p_responsible text,p_modality text,p_total numeric,p_signed date,p_schedule jsonb,p_notes text DEFAULT NULL) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE v_id uuid; v_sum numeric; v_org uuid:=public.current_org(); BEGIN IF NOT public.can_access(v_org) THEN RAISE EXCEPTION 'Acesso não autorizado'; END IF; IF NOT EXISTS(SELECT 1 FROM public.clients WHERE id=p_client AND organization_id=v_org) THEN RAISE EXCEPTION 'Cliente não encontrado'; END IF; IF jsonb_array_length(p_schedule)<1 OR jsonb_array_length(p_schedule)>120 THEN RAISE EXCEPTION 'Cronograma inválido'; END IF; SELECT sum((x->>'amount')::numeric) INTO v_sum FROM jsonb_array_elements(p_schedule) x; IF v_sum<>p_total OR p_total<=0 OR EXISTS(SELECT 1 FROM jsonb_array_elements(p_schedule) x WHERE (x->>'amount')::numeric<=0 OR (x->>'amount')::numeric<>round((x->>'amount')::numeric,2)) THEN RAISE EXCEPTION 'O cronograma deve totalizar o valor do contrato'; END IF; INSERT INTO public.contracts(client_id,number,subject,responsible,modality,total,signed_at,notes,organization_id) VALUES(p_client,p_number,p_subject,p_responsible,p_modality,p_total,p_signed,p_notes,v_org) RETURNING id INTO v_id; INSERT INTO public.installments(contract_id,label,amount,due_date,organization_id) SELECT v_id,x->>'label',(x->>'amount')::numeric,(x->>'due_date')::date,v_org FROM jsonb_array_elements(p_schedule) x; RETURN v_id; END $$;

CREATE FUNCTION public.renegotiate_contract(p_contract uuid,p_schedule jsonb,p_reason text) RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE v_org uuid:=public.current_org(); v_open numeric; v_sum numeric; v_round int; BEGIN IF NOT public.can_access(v_org) THEN RAISE EXCEPTION 'Acesso não autorizado'; END IF; PERFORM 1 FROM public.contracts WHERE id=p_contract AND organization_id=v_org FOR UPDATE; IF NOT FOUND THEN RAISE EXCEPTION 'Contrato não encontrado'; END IF; IF p_reason IS NULL OR length(trim(p_reason))<3 OR length(p_reason)>500 THEN RAISE EXCEPTION 'Informe o motivo da renegociação'; END IF; IF jsonb_array_length(p_schedule)<1 OR jsonb_array_length(p_schedule)>120 OR EXISTS(SELECT 1 FROM jsonb_array_elements(p_schedule) x WHERE (x->>'amount')::numeric<=0 OR (x->>'amount')::numeric<>round((x->>'amount')::numeric,2) OR (x->>'due_date') IS NULL) THEN RAISE EXCEPTION 'Cronograma inválido'; END IF;
 SELECT coalesce(sum(i.amount-coalesce(p.paid,0)),0) INTO v_open FROM public.installments i LEFT JOIN (SELECT installment_id,sum(amount) paid FROM public.payments GROUP BY 1) p ON p.installment_id=i.id WHERE i.contract_id=p_contract;
 SELECT sum((x->>'amount')::numeric) INTO v_sum FROM jsonb_array_elements(p_schedule) x; IF v_open<=0 THEN RAISE EXCEPTION 'Contrato sem saldo a renegociar'; END IF; IF v_sum<>v_open THEN RAISE EXCEPTION 'O novo cronograma deve totalizar o saldo em aberto (%)',v_open; END IF;
 DELETE FROM public.installments i WHERE i.contract_id=p_contract AND NOT EXISTS(SELECT 1 FROM public.payments p WHERE p.installment_id=i.id);
 UPDATE public.installments i SET amount=p.paid FROM (SELECT installment_id,sum(amount) paid FROM public.payments GROUP BY 1) p WHERE p.installment_id=i.id AND i.contract_id=p_contract AND i.amount>p.paid;
 SELECT count(*)+1 INTO v_round FROM public.audit_log WHERE entity='renegotiation' AND entity_id=p_contract;
 INSERT INTO public.installments(contract_id,label,amount,due_date,organization_id) SELECT p_contract,'Reneg. '||v_round||' · '||(x->>'label'),(x->>'amount')::numeric,(x->>'due_date')::date,v_org FROM jsonb_array_elements(p_schedule) x;
 UPDATE public.contracts SET status='Ativo',notes=concat_ws(E'\n',notes,'Renegociação '||v_round||' ('||current_date||'): '||p_reason) WHERE id=p_contract;
 INSERT INTO public.audit_log(entity,entity_id,action,user_id,organization_id) VALUES('renegotiation',p_contract,'UPDATE',auth.uid(),v_org); RETURN v_round; END $$;

CREATE FUNCTION public.my_access() RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT jsonb_build_object('rtg',public.is_rtg_admin(),'organization',(SELECT jsonb_build_object('id',o.id,'name',o.name,'status',o.status,'role',m.role,'access',public.org_access_ok(o.id),'ends_at',coalesce(o.ends_at,o.trial_ends_at)) FROM public.organization_members m JOIN public.organizations o ON o.id=m.organization_id WHERE m.user_id=auth.uid() AND m.active)) $$;

CREATE FUNCTION public.rtg_save_org(p_id uuid,p_name text,p_contact_name text,p_contact_email text,p_contact_phone text,p_support text,p_plan text,p_status text,p_trial date,p_start date,p_end date) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE v_id uuid; v_old text; BEGIN IF NOT public.is_rtg_admin() THEN RAISE EXCEPTION 'Acesso não autorizado'; END IF; IF p_status NOT IN ('setup','trial','active','payment_pending','suspended','closed') THEN RAISE EXCEPTION 'Situação inválida'; END IF;
 IF p_id IS NULL THEN INSERT INTO public.organizations(name,contact_name,contact_email,contact_phone,support_notes,plan,status,trial_ends_at,starts_at,ends_at) VALUES(p_name,p_contact_name,p_contact_email,p_contact_phone,p_support,p_plan,p_status,p_trial,p_start,p_end) RETURNING id INTO v_id; v_old:=NULL;
 ELSE SELECT status INTO v_old FROM public.organizations WHERE id=p_id; IF NOT FOUND THEN RAISE EXCEPTION 'Escritório não encontrado'; END IF; UPDATE public.organizations SET name=p_name,contact_name=p_contact_name,contact_email=p_contact_email,contact_phone=p_contact_phone,support_notes=p_support,plan=p_plan,status=p_status,trial_ends_at=p_trial,starts_at=p_start,ends_at=p_end WHERE id=p_id; v_id:=p_id; END IF;
 INSERT INTO public.admin_events(organization_id,actor,action,details) VALUES(v_id,auth.uid(),CASE WHEN p_id IS NULL THEN 'Escritório cadastrado' WHEN v_old<>p_status THEN 'Situação alterada' ELSE 'Dados atualizados' END,jsonb_build_object('de',v_old,'para',p_status,'plano',p_plan,'vencimento',p_end)); RETURN v_id; END $$;

CREATE FUNCTION public.set_member_status(p_member uuid,p_active boolean,p_role text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE v_org uuid; v_user uuid; BEGIN SELECT organization_id,user_id INTO v_org,v_user FROM public.organization_members WHERE id=p_member; IF v_org IS NULL THEN RAISE EXCEPTION 'Usuária não encontrada'; END IF; IF NOT (public.is_rtg_admin() OR (public.is_org_admin() AND v_org=public.current_org())) THEN RAISE EXCEPTION 'Acesso não autorizado'; END IF; IF v_user=auth.uid() AND (NOT p_active OR p_role<>'admin') THEN RAISE EXCEPTION 'Você não pode remover o próprio acesso de administradora'; END IF; IF p_role NOT IN ('admin','member') THEN RAISE EXCEPTION 'Papel inválido'; END IF; UPDATE public.organization_members SET active=p_active,role=p_role WHERE id=p_member; INSERT INTO public.admin_events(organization_id,actor,action,details) VALUES(v_org,auth.uid(),'Usuária atualizada',jsonb_build_object('membro',p_member,'ativa',p_active,'papel',p_role)); END $$;

DO $$ DECLARE f text; BEGIN FOREACH f IN ARRAY ARRAY['is_rtg_admin()','current_org()','org_access_ok(uuid)','can_access(uuid)','is_org_admin()','my_access()','rtg_save_org(uuid,text,text,text,text,text,text,text,date,date,date)','set_member_status(uuid,boolean,text)','renegotiate_contract(uuid,jsonb,text)'] LOOP EXECUTE 'REVOKE ALL ON FUNCTION public.'||f||' FROM PUBLIC, anon'; EXECUTE 'GRANT EXECUTE ON FUNCTION public.'||f||' TO authenticated, service_role'; END LOOP; END $$;ALTER TABLE public.payments ADD COLUMN voided_at timestamptz, ADD COLUMN void_reason text, ADD COLUMN voided_by uuid;
ALTER TABLE public.contracts ADD COLUMN expected_method text;
ALTER TABLE public.legal_cases ADD COLUMN legal_area text, ADD COLUMN closed_at date;
CREATE TABLE public.associates(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL DEFAULT public.current_org() REFERENCES public.organizations(id), name text NOT NULL CHECK(length(trim(name)) BETWEEN 2 AND 150), active boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(organization_id,name));
GRANT SELECT,INSERT,UPDATE ON public.associates TO authenticated; GRANT ALL ON public.associates TO service_role;
ALTER TABLE public.associates ENABLE ROW LEVEL SECURITY;
CREATE POLICY org_associates ON public.associates FOR ALL TO authenticated USING(public.can_access(organization_id)) WITH CHECK(public.can_access(organization_id));
CREATE TABLE public.fee_divisions(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL DEFAULT public.current_org() REFERENCES public.organizations(id), contract_id uuid NOT NULL REFERENCES public.contracts(id), version integer NOT NULL, basis text NOT NULL CHECK(basis IN ('contracted','received')), mode text NOT NULL CHECK(mode IN ('percent','fixed')), allocations jsonb NOT NULL, reason text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), user_id uuid, UNIQUE(contract_id,version));
GRANT SELECT ON public.fee_divisions TO authenticated; GRANT ALL ON public.fee_divisions TO service_role;
ALTER TABLE public.fee_divisions ENABLE ROW LEVEL SECURITY;
CREATE POLICY org_divisions ON public.fee_divisions FOR SELECT TO authenticated USING(public.can_access(organization_id));
CREATE TABLE public.fee_payouts(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL DEFAULT public.current_org() REFERENCES public.organizations(id), division_id uuid NOT NULL REFERENCES public.fee_divisions(id), associate_id uuid NOT NULL REFERENCES public.associates(id), amount numeric(14,2) NOT NULL CHECK(amount>0), paid_at date NOT NULL, method text NOT NULL, payment_id uuid REFERENCES public.payments(id), reference text, notes text, idempotency_key uuid NOT NULL UNIQUE, user_id uuid, created_at timestamptz NOT NULL DEFAULT now(), voided_at timestamptz, void_reason text, voided_by uuid);
GRANT SELECT ON public.fee_payouts TO authenticated; GRANT ALL ON public.fee_payouts TO service_role;
ALTER TABLE public.fee_payouts ENABLE ROW LEVEL SECURITY;
CREATE POLICY org_payouts ON public.fee_payouts FOR SELECT TO authenticated USING(public.can_access(organization_id));
CREATE TABLE public.finance_events(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL DEFAULT public.current_org() REFERENCES public.organizations(id), entity_id uuid NOT NULL, action text NOT NULL, details jsonb NOT NULL, user_id uuid, created_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT ON public.finance_events TO authenticated; GRANT ALL ON public.finance_events TO service_role;
ALTER TABLE public.finance_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY org_finance_events ON public.finance_events FOR SELECT TO authenticated USING(public.can_access(organization_id));
CREATE OR REPLACE VIEW public.receivables WITH(security_invoker=true) AS SELECT i.id,i.contract_id,i.label,i.amount,i.due_date,i.demo,coalesce(p.paid,0)::numeric(14,2) paid,(i.amount-coalesce(p.paid,0))::numeric(14,2) balance,p.last_payment,CASE WHEN coalesce(p.paid,0)>=i.amount THEN 'Pago' WHEN i.due_date<current_date THEN 'Vencido' WHEN coalesce(p.paid,0)>0 THEN 'Parcialmente pago' ELSE 'A vencer' END status FROM public.installments i LEFT JOIN (SELECT installment_id,sum(amount) paid,max(paid_at) last_payment FROM public.payments WHERE voided_at IS NULL GROUP BY installment_id) p ON p.installment_id=i.id;
CREATE OR REPLACE FUNCTION public.record_payment(p_installment uuid,p_amount numeric,p_date date,p_method text,p_key uuid,p_reference text DEFAULT NULL,p_notes text DEFAULT NULL) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE v_amount numeric;v_paid numeric;v_id uuid;v_org uuid:=public.current_org();v_contract uuid;v_old public.payments; BEGIN
IF NOT public.can_access(v_org) THEN RAISE EXCEPTION 'Acesso não autorizado'; END IF;
SELECT contract_id INTO v_contract FROM public.installments WHERE id=p_installment AND organization_id=v_org; IF NOT FOUND THEN RAISE EXCEPTION 'Parcela não encontrada'; END IF;
PERFORM 1 FROM public.contracts WHERE id=v_contract FOR UPDATE;
SELECT amount INTO v_amount FROM public.installments WHERE id=p_installment AND organization_id=v_org FOR UPDATE; IF v_amount IS NULL THEN RAISE EXCEPTION 'Parcela não encontrada'; END IF;
SELECT * INTO v_old FROM public.payments WHERE idempotency_key=p_key AND organization_id=v_org; IF FOUND THEN IF v_old.installment_id IS DISTINCT FROM p_installment OR v_old.amount IS DISTINCT FROM p_amount OR v_old.paid_at IS DISTINCT FROM p_date OR v_old.method IS DISTINCT FROM p_method OR coalesce(v_old.reference,'')<>coalesce(p_reference,'') OR coalesce(v_old.notes,'')<>coalesce(p_notes,'') THEN RAISE EXCEPTION 'Tentativa alterada: confira o histórico antes de repetir'; END IF; RETURN v_old.id; END IF;
SELECT coalesce(sum(amount),0) INTO v_paid FROM public.payments WHERE installment_id=p_installment AND voided_at IS NULL;
IF p_key IS NULL OR p_amount IS NULL OR p_amount<=0 OR p_amount<>round(p_amount,2) OR p_amount>v_amount-v_paid THEN RAISE EXCEPTION 'Valor inválido ou superior ao saldo'; END IF;
IF p_date IS NULL OR p_date>(now() AT TIME ZONE 'America/Sao_Paulo')::date OR p_method IS NULL OR length(trim(p_method))<2 OR length(p_method)>50 THEN RAISE EXCEPTION 'Data ou forma de pagamento inválida'; END IF;
IF EXISTS(SELECT 1 FROM public.payments WHERE installment_id=p_installment AND amount=p_amount AND paid_at=p_date AND method=p_method AND coalesce(reference,'')=coalesce(p_reference,'') AND voided_at IS NULL) THEN RAISE EXCEPTION 'Possível pagamento duplicado: confira o histórico'; END IF;
INSERT INTO public.payments(installment_id,amount,paid_at,method,reference,notes,idempotency_key,user_id,organization_id) VALUES(p_installment,p_amount,p_date,p_method,p_reference,p_notes,p_key,auth.uid(),v_org) RETURNING id INTO v_id; RETURN v_id; END $$;
CREATE FUNCTION public.remove_client(p_client uuid,p_archive boolean DEFAULT false) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE v_org uuid:=public.current_org(); BEGIN IF NOT public.can_access(v_org) THEN RAISE EXCEPTION 'Acesso não autorizado'; END IF;
PERFORM 1 FROM public.clients WHERE id=p_client AND organization_id=v_org FOR UPDATE; IF NOT FOUND THEN RAISE EXCEPTION 'Cliente não encontrado'; END IF;
IF p_archive THEN UPDATE public.clients SET status='Arquivado' WHERE id=p_client; RETURN 'archived'; END IF;
IF EXISTS(SELECT 1 FROM public.contracts WHERE client_id=p_client) OR EXISTS(SELECT 1 FROM public.legal_cases WHERE client_id=p_client) THEN RAISE EXCEPTION 'Cliente possui registros vinculados. Arquive para preservar o histórico.'; END IF;
INSERT INTO public.audit_log(entity,entity_id,action,user_id,organization_id) VALUES('clients',p_client,'DELETE',auth.uid(),v_org);
DELETE FROM public.clients WHERE id=p_client AND organization_id=v_org; RETURN 'deleted'; END $$;
CREATE FUNCTION public.save_fee_division(p_contract uuid,p_basis text,p_mode text,p_allocations jsonb,p_reason text) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE v_org uuid:=public.current_org();v_total numeric;v_sum numeric;v_base numeric;v_version integer;v_id uuid; BEGIN
IF NOT public.can_access(v_org) THEN RAISE EXCEPTION 'Acesso não autorizado'; END IF;
SELECT total INTO v_total FROM public.contracts WHERE id=p_contract AND organization_id=v_org FOR UPDATE; IF NOT FOUND THEN RAISE EXCEPTION 'Contrato não encontrado'; END IF;
IF p_basis IS NULL OR p_mode IS NULL OR p_reason IS NULL OR p_allocations IS NULL OR p_basis NOT IN ('contracted','received') OR p_mode NOT IN ('percent','fixed') OR length(trim(p_reason))<3 OR jsonb_typeof(p_allocations)<>'array' OR jsonb_array_length(p_allocations)<1 OR jsonb_array_length(p_allocations)>50 THEN RAISE EXCEPTION 'Divisão inválida'; END IF;
IF EXISTS(SELECT 1 FROM jsonb_array_elements(p_allocations)x WHERE (x->>'value') IS NULL OR (x->>'value')::numeric<=0 OR (x->>'value')::numeric<>round((x->>'value')::numeric,2) OR NOT EXISTS(SELECT 1 FROM public.associates a WHERE a.id=(x->>'associate_id')::uuid AND a.organization_id=v_org AND a.active)) OR (SELECT count(DISTINCT x->>'associate_id') FROM jsonb_array_elements(p_allocations)x)<>jsonb_array_length(p_allocations) THEN RAISE EXCEPTION 'Participações ou associados inválidos'; END IF;
SELECT coalesce(sum(p.amount),0) INTO v_base FROM public.payments p JOIN public.installments i ON i.id=p.installment_id WHERE i.contract_id=p_contract AND p.voided_at IS NULL;
IF p_basis='contracted' THEN v_base:=v_total; END IF;
SELECT sum((x->>'value')::numeric) INTO v_sum FROM jsonb_array_elements(p_allocations)x;
IF (p_mode='percent' AND v_sum<>100) OR (p_mode='fixed' AND v_sum<>v_base) THEN RAISE EXCEPTION 'A soma deve ser 100%% ou o montante distribuível (%)',v_base; END IF;
SELECT coalesce(max(version),0)+1 INTO v_version FROM public.fee_divisions WHERE contract_id=p_contract;
INSERT INTO public.fee_divisions(organization_id,contract_id,version,basis,mode,allocations,reason,user_id) VALUES(v_org,p_contract,v_version,p_basis,p_mode,p_allocations,p_reason,auth.uid()) RETURNING id INTO v_id;
INSERT INTO public.finance_events(organization_id,entity_id,action,details,user_id) VALUES(v_org,v_id,'Divisão configurada',jsonb_build_object('version',v_version,'allocations',p_allocations,'reason',p_reason),auth.uid()); RETURN v_id; END $$;
CREATE FUNCTION public.record_fee_payout(p_division uuid,p_associate uuid,p_amount numeric,p_date date,p_method text,p_key uuid,p_payment uuid DEFAULT NULL,p_reference text DEFAULT NULL,p_notes text DEFAULT NULL) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE v_org uuid:=public.current_org();d public.fee_divisions;v_base numeric;v_value numeric;v_due numeric;v_paid numeric;v_id uuid;v_old public.fee_payouts; BEGIN
IF NOT public.can_access(v_org) THEN RAISE EXCEPTION 'Acesso não autorizado'; END IF;
SELECT * INTO d FROM public.fee_divisions WHERE id=p_division AND organization_id=v_org; IF NOT FOUND THEN RAISE EXCEPTION 'Divisão não encontrada'; END IF;
PERFORM 1 FROM public.contracts WHERE id=d.contract_id AND organization_id=v_org FOR UPDATE;
SELECT * INTO v_old FROM public.fee_payouts WHERE idempotency_key=p_key AND organization_id=v_org; IF FOUND THEN IF v_old.division_id IS DISTINCT FROM p_division OR v_old.associate_id IS DISTINCT FROM p_associate OR v_old.amount IS DISTINCT FROM p_amount OR v_old.paid_at IS DISTINCT FROM p_date OR v_old.method IS DISTINCT FROM p_method OR v_old.payment_id IS DISTINCT FROM p_payment OR coalesce(v_old.reference,'')<>coalesce(p_reference,'') OR coalesce(v_old.notes,'')<>coalesce(p_notes,'') THEN RAISE EXCEPTION 'Tentativa alterada: confira o histórico'; END IF; RETURN v_old.id; END IF;
IF EXISTS(SELECT 1 FROM public.fee_divisions WHERE contract_id=d.contract_id AND version>d.version) THEN RAISE EXCEPTION 'Utilize a versão atual da divisão'; END IF;
SELECT (x->>'value')::numeric INTO v_value FROM jsonb_array_elements(d.allocations)x WHERE (x->>'associate_id')::uuid=p_associate; IF v_value IS NULL THEN RAISE EXCEPTION 'Associado não pertence à divisão'; END IF;
IF d.basis='contracted' THEN SELECT total INTO v_base FROM public.contracts WHERE id=d.contract_id; ELSE SELECT coalesce(sum(p.amount),0) INTO v_base FROM public.payments p JOIN public.installments i ON i.id=p.installment_id WHERE i.contract_id=d.contract_id AND p.voided_at IS NULL; END IF;
IF d.mode='fixed' THEN v_due:=v_value; ELSE SELECT CASE WHEN ord=jsonb_array_length(d.allocations) THEN round(v_base*100)-coalesce((SELECT sum(floor(round(v_base*100)*(y->>'value')::numeric/100)) FROM jsonb_array_elements(d.allocations) WITH ORDINALITY q(y,n) WHERE n<ord),0) ELSE floor(round(v_base*100)*v_value/100) END/100 INTO v_due FROM jsonb_array_elements(d.allocations) WITH ORDINALITY t(x,ord) WHERE (x->>'associate_id')::uuid=p_associate; END IF;
SELECT coalesce(sum(p.amount),0) INTO v_paid FROM public.fee_payouts p JOIN public.fee_divisions f ON f.id=p.division_id WHERE f.contract_id=d.contract_id AND p.associate_id=p_associate AND p.voided_at IS NULL;
IF p_key IS NULL OR p_amount IS NULL OR p_amount<=0 OR p_amount<>round(p_amount,2) OR p_amount>v_due-v_paid OR p_date IS NULL OR p_date>(now() AT TIME ZONE 'America/Sao_Paulo')::date OR p_method IS NULL OR length(trim(p_method))<2 OR length(p_method)>50 THEN RAISE EXCEPTION 'Valor, saldo, data ou forma de repasse inválidos'; END IF;
IF p_payment IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.payments p JOIN public.installments i ON i.id=p.installment_id WHERE p.id=p_payment AND i.contract_id=d.contract_id AND p.organization_id=v_org AND p.voided_at IS NULL) THEN RAISE EXCEPTION 'Recebimento inválido para este contrato'; END IF;
IF EXISTS(SELECT 1 FROM public.fee_payouts WHERE division_id=p_division AND associate_id=p_associate AND amount=p_amount AND paid_at=p_date AND coalesce(reference,'')=coalesce(p_reference,'') AND voided_at IS NULL) THEN RAISE EXCEPTION 'Possível repasse duplicado'; END IF;
INSERT INTO public.fee_payouts(organization_id,division_id,associate_id,amount,paid_at,method,payment_id,reference,notes,idempotency_key,user_id) VALUES(v_org,p_division,p_associate,p_amount,p_date,p_method,p_payment,p_reference,p_notes,p_key,auth.uid()) RETURNING id INTO v_id;
INSERT INTO public.finance_events(organization_id,entity_id,action,details,user_id) VALUES(v_org,v_id,'Repasse registrado',jsonb_build_object('amount',p_amount,'division',p_division),auth.uid()); RETURN v_id; END $$;
CREATE FUNCTION public.void_financial_entry(p_id uuid,p_kind text,p_reason text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE v_org uuid:=public.current_org();v_contract uuid;v_inst uuid; BEGIN
IF NOT public.can_access(v_org) THEN RAISE EXCEPTION 'Acesso não autorizado'; END IF; IF p_reason IS NULL OR length(trim(p_reason))<3 OR length(p_reason)>500 THEN RAISE EXCEPTION 'Informe o motivo do estorno'; END IF;
IF p_kind='payment' THEN SELECT p.installment_id,i.contract_id INTO v_inst,v_contract FROM public.payments p JOIN public.installments i ON i.id=p.installment_id WHERE p.id=p_id AND p.organization_id=v_org; IF NOT FOUND THEN RAISE EXCEPTION 'Recebimento não encontrado'; END IF;
PERFORM 1 FROM public.contracts WHERE id=v_contract FOR UPDATE; PERFORM 1 FROM public.installments WHERE id=v_inst FOR UPDATE;
IF EXISTS(SELECT 1 FROM public.fee_payouts f JOIN public.fee_divisions d ON d.id=f.division_id WHERE d.contract_id=v_contract AND f.voided_at IS NULL) THEN RAISE EXCEPTION 'Estorne primeiro os repasses deste contrato para revisar o recebimento'; END IF;
IF EXISTS(SELECT 1 FROM public.audit_log WHERE entity='renegotiation' AND entity_id=v_contract) THEN RAISE EXCEPTION 'Recebimento de contrato renegociado: revisão do cronograma necessária antes do estorno'; END IF;
UPDATE public.payments SET voided_at=now(),void_reason=p_reason,voided_by=auth.uid() WHERE id=p_id AND organization_id=v_org AND voided_at IS NULL;
ELSIF p_kind='payout' THEN SELECT d.contract_id INTO v_contract FROM public.fee_payouts p JOIN public.fee_divisions d ON d.id=p.division_id WHERE p.id=p_id AND p.organization_id=v_org; IF NOT FOUND THEN RAISE EXCEPTION 'Repasse não encontrado'; END IF;
PERFORM 1 FROM public.contracts WHERE id=v_contract FOR UPDATE;
UPDATE public.fee_payouts SET voided_at=now(),void_reason=p_reason,voided_by=auth.uid() WHERE id=p_id AND organization_id=v_org AND voided_at IS NULL;
ELSE RAISE EXCEPTION 'Tipo de lançamento inválido'; END IF;
IF FOUND THEN INSERT INTO public.finance_events(organization_id,entity_id,action,details,user_id) VALUES(v_org,p_id,'Estorno de '||p_kind,jsonb_build_object('reason',p_reason),auth.uid()); END IF; END $$;
CREATE FUNCTION public.create_contract_review(p_client uuid,p_number text,p_subject text,p_responsible text,p_modality text,p_total numeric,p_signed date,p_schedule jsonb,p_notes text,p_method text) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE v_id uuid;BEGIN IF p_modality NOT IN ('Fixos','Parcelados','Mensais','Mistos') OR p_method IS NULL OR length(trim(p_method))<2 OR length(p_method)>50 THEN RAISE EXCEPTION 'Modalidade ou pagamento previsto inválido'; END IF;
v_id:=public.create_contract(p_client,p_number,p_subject,p_responsible,p_modality,p_total,p_signed,p_schedule,p_notes); UPDATE public.contracts SET expected_method=p_method WHERE id=v_id AND organization_id=public.current_org(); RETURN v_id; END $$;
CREATE VIEW public.receipt_ledger WITH(security_invoker=true) AS SELECT id AS event_id,id AS payment_id,organization_id,installment_id,paid_at AS effective_date,amount,'receipt'::text AS kind FROM public.payments UNION ALL SELECT id,id,organization_id,installment_id,(voided_at AT TIME ZONE 'America/Sao_Paulo')::date,-amount,'reversal'::text FROM public.payments WHERE voided_at IS NOT NULL;
GRANT SELECT ON public.receipt_ledger TO authenticated,service_role;
CREATE VIEW public.payout_ledger WITH(security_invoker=true) AS SELECT id AS event_id,organization_id,division_id,paid_at AS effective_date,amount FROM public.fee_payouts UNION ALL SELECT id,organization_id,division_id,(voided_at AT TIME ZONE 'America/Sao_Paulo')::date,-amount FROM public.fee_payouts WHERE voided_at IS NOT NULL;
GRANT SELECT ON public.payout_ledger TO authenticated,service_role;
DO $$ DECLARE f text;BEGIN FOREACH f IN ARRAY ARRAY['remove_client(uuid,boolean)','save_fee_division(uuid,text,text,jsonb,text)','record_fee_payout(uuid,uuid,numeric,date,text,uuid,uuid,text,text)','void_financial_entry(uuid,text,text)','create_contract_review(uuid,text,text,text,text,numeric,date,jsonb,text,text)'] LOOP EXECUTE 'REVOKE ALL ON FUNCTION public.'||f||' FROM PUBLIC,anon'; EXECUTE 'GRANT EXECUTE ON FUNCTION public.'||f||' TO authenticated,service_role'; END LOOP; END $$;ALTER TABLE public.installments ADD COLUMN superseded boolean NOT NULL DEFAULT false, ADD COLUMN original_amount numeric(14,2);
UPDATE public.installments SET original_amount=amount;
CREATE OR REPLACE VIEW public.receivables WITH(security_invoker=true) AS SELECT i.id,i.contract_id,i.label,i.amount,i.due_date,i.demo,coalesce(p.paid,0)::numeric(14,2) paid,(i.amount-coalesce(p.paid,0))::numeric(14,2) balance,p.last_payment,CASE WHEN coalesce(p.paid,0)>=i.amount THEN 'Pago' WHEN i.due_date<(now() AT TIME ZONE 'America/Sao_Paulo')::date THEN 'Vencido' WHEN coalesce(p.paid,0)>0 THEN 'Parcialmente pago' ELSE 'A vencer' END status FROM public.installments i LEFT JOIN (SELECT installment_id,sum(amount) paid,max(paid_at) last_payment FROM public.payments WHERE voided_at IS NULL GROUP BY installment_id) p ON p.installment_id=i.id WHERE NOT i.superseded;
CREATE OR REPLACE FUNCTION public.renegotiate_contract(p_contract uuid,p_schedule jsonb,p_reason text) RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE v_org uuid:=public.current_org();v_open numeric;v_sum numeric;v_round int;BEGIN
IF NOT public.can_access(v_org) THEN RAISE EXCEPTION 'Acesso não autorizado'; END IF;
PERFORM 1 FROM public.contracts WHERE id=p_contract AND organization_id=v_org FOR UPDATE;IF NOT FOUND THEN RAISE EXCEPTION 'Contrato não encontrado'; END IF;
IF p_reason IS NULL OR length(trim(p_reason))<3 OR length(p_reason)>500 THEN RAISE EXCEPTION 'Informe o motivo da renegociação'; END IF;
IF p_schedule IS NULL OR jsonb_typeof(p_schedule)<>'array' OR jsonb_array_length(p_schedule)<1 OR jsonb_array_length(p_schedule)>120 OR EXISTS(SELECT 1 FROM jsonb_array_elements(p_schedule)x WHERE (x->>'amount') IS NULL OR (x->>'amount')::numeric<=0 OR (x->>'amount')::numeric<>round((x->>'amount')::numeric,2) OR (x->>'due_date') IS NULL) THEN RAISE EXCEPTION 'Cronograma inválido'; END IF;
SELECT coalesce(sum(i.amount-coalesce(p.paid,0)),0) INTO v_open FROM public.installments i LEFT JOIN (SELECT installment_id,sum(amount) paid FROM public.payments WHERE voided_at IS NULL GROUP BY installment_id)p ON p.installment_id=i.id WHERE i.contract_id=p_contract AND NOT i.superseded;
SELECT sum((x->>'amount')::numeric) INTO v_sum FROM jsonb_array_elements(p_schedule)x;
IF v_open<=0 OR v_sum<>v_open THEN RAISE EXCEPTION 'O cronograma deve totalizar o saldo em aberto (%)',v_open; END IF;
INSERT INTO public.finance_events(organization_id,entity_id,action,details,user_id) SELECT v_org,p_contract,'Cronograma anterior',jsonb_build_object('installments',jsonb_agg(to_jsonb(i)),'reason',p_reason),auth.uid() FROM public.installments i WHERE i.contract_id=p_contract AND NOT i.superseded;
UPDATE public.installments i SET superseded=true WHERE i.contract_id=p_contract AND NOT i.superseded AND NOT EXISTS(SELECT 1 FROM public.payments p WHERE p.installment_id=i.id AND p.voided_at IS NULL);
UPDATE public.installments i SET amount=p.paid FROM (SELECT installment_id,sum(amount) paid FROM public.payments WHERE voided_at IS NULL GROUP BY installment_id)p WHERE p.installment_id=i.id AND i.contract_id=p_contract AND NOT i.superseded AND i.amount>p.paid;
SELECT count(*)+1 INTO v_round FROM public.audit_log WHERE entity='renegotiation' AND entity_id=p_contract;
INSERT INTO public.installments(contract_id,label,amount,original_amount,due_date,organization_id) SELECT p_contract,'Reneg. '||v_round||' · '||(x->>'label'),(x->>'amount')::numeric,(x->>'amount')::numeric,(x->>'due_date')::date,v_org FROM jsonb_array_elements(p_schedule)x;
UPDATE public.contracts SET status='Ativo',notes=concat_ws(E'\n',notes,'Renegociação '||v_round||': '||p_reason) WHERE id=p_contract;
INSERT INTO public.audit_log(entity,entity_id,action,user_id,organization_id) VALUES('renegotiation',p_contract,'UPDATE',auth.uid(),v_org);RETURN v_round;END $$;
CREATE FUNCTION public.reject_superseded_payment() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN IF EXISTS(SELECT 1 FROM public.installments WHERE id=NEW.installment_id AND superseded) THEN RAISE EXCEPTION 'Parcela substituída por renegociação';END IF;RETURN NEW;END $$;
REVOKE ALL ON FUNCTION public.reject_superseded_payment() FROM PUBLIC,anon;
CREATE TRIGGER check_superseded BEFORE INSERT ON public.payments FOR EACH ROW EXECUTE FUNCTION public.reject_superseded_payment();CREATE OR REPLACE FUNCTION public.void_financial_entry(p_id uuid,p_kind text,p_reason text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE v_org uuid:=public.current_org();v_contract uuid;v_inst uuid; BEGIN
IF NOT public.can_access(v_org) THEN RAISE EXCEPTION 'Acesso não autorizado'; END IF; IF p_reason IS NULL OR length(trim(p_reason))<3 OR length(p_reason)>500 THEN RAISE EXCEPTION 'Informe o motivo do estorno'; END IF;
IF p_kind='payment' THEN SELECT p.installment_id,i.contract_id INTO v_inst,v_contract FROM public.payments p JOIN public.installments i ON i.id=p.installment_id WHERE p.id=p_id AND p.organization_id=v_org; IF NOT FOUND THEN RAISE EXCEPTION 'Recebimento não encontrado'; END IF;
PERFORM 1 FROM public.contracts WHERE id=v_contract FOR UPDATE; PERFORM 1 FROM public.installments WHERE id=v_inst FOR UPDATE;
IF EXISTS(SELECT 1 FROM public.fee_payouts f JOIN public.fee_divisions d ON d.id=f.division_id WHERE d.contract_id=v_contract AND f.voided_at IS NULL) THEN RAISE EXCEPTION 'Estorne primeiro os repasses deste contrato para revisar o recebimento'; END IF;
UPDATE public.payments SET voided_at=now(),void_reason=p_reason,voided_by=auth.uid() WHERE id=p_id AND organization_id=v_org AND voided_at IS NULL;
ELSIF p_kind='payout' THEN SELECT d.contract_id INTO v_contract FROM public.fee_payouts p JOIN public.fee_divisions d ON d.id=p.division_id WHERE p.id=p_id AND p.organization_id=v_org; IF NOT FOUND THEN RAISE EXCEPTION 'Repasse não encontrado'; END IF;
PERFORM 1 FROM public.contracts WHERE id=v_contract FOR UPDATE;
UPDATE public.fee_payouts SET voided_at=now(),void_reason=p_reason,voided_by=auth.uid() WHERE id=p_id AND organization_id=v_org AND voided_at IS NULL;
ELSE RAISE EXCEPTION 'Tipo de lançamento inválido'; END IF;
IF FOUND THEN INSERT INTO public.finance_events(organization_id,entity_id,action,details,user_id) VALUES(v_org,p_id,'Estorno de '||p_kind,jsonb_build_object('reason',p_reason),auth.uid());INSERT INTO public.finance_events(organization_id,entity_id,action,details,user_id) VALUES(v_org,v_contract,'Impacto do estorno',jsonb_build_object('entry',p_id,'kind',p_kind,'reason',p_reason),auth.uid()); END IF; END $$;
CREATE FUNCTION public.validate_fixed_payout_base() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE d public.fee_divisions;v_base numeric;v_sum numeric;BEGIN SELECT * INTO d FROM public.fee_divisions WHERE id=NEW.division_id; IF d.mode='fixed' THEN IF d.basis='contracted' THEN SELECT total INTO v_base FROM public.contracts WHERE id=d.contract_id; ELSE SELECT coalesce(sum(p.amount),0) INTO v_base FROM public.payments p JOIN public.installments i ON i.id=p.installment_id WHERE i.contract_id=d.contract_id AND p.voided_at IS NULL; END IF; SELECT sum((x->>'value')::numeric) INTO v_sum FROM jsonb_array_elements(d.allocations)x;IF v_sum<>v_base THEN RAISE EXCEPTION 'A base recebida mudou. Salve uma nova versão dos valores fixos antes do repasse.';END IF;END IF;RETURN NEW;END $$;
REVOKE ALL ON FUNCTION public.validate_fixed_payout_base() FROM PUBLIC,anon;
CREATE TRIGGER fixed_payout_base BEFORE INSERT ON public.fee_payouts FOR EACH ROW EXECUTE FUNCTION public.validate_fixed_payout_base();ALTER TABLE public.organization_members
  ADD COLUMN IF NOT EXISTS can_legal boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS can_finance boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_general_admin boolean NOT NULL DEFAULT false;
UPDATE public.organization_members SET can_finance = true WHERE can_finance = false;
COMMENT ON COLUMN public.organization_members.role IS 'DEPRECATED: management authority is is_general_admin, designated only by RTG';
CREATE UNIQUE INDEX IF NOT EXISTS organization_members_one_general_admin ON public.organization_members(organization_id) WHERE is_general_admin AND active;

CREATE OR REPLACE FUNCTION public.has_legal(p_org uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT public.can_access(p_org) AND EXISTS(SELECT 1 FROM public.organization_members WHERE user_id=auth.uid() AND active AND can_legal AND organization_id=p_org) $$;
CREATE OR REPLACE FUNCTION public.has_finance(p_org uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT public.can_access(p_org) AND EXISTS(SELECT 1 FROM public.organization_members WHERE user_id=auth.uid() AND active AND can_finance AND organization_id=p_org) $$;
CREATE OR REPLACE FUNCTION public.is_general_admin() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT EXISTS(SELECT 1 FROM public.organization_members WHERE user_id=auth.uid() AND active AND is_general_admin) $$;
CREATE OR REPLACE FUNCTION public.is_org_admin() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT public.is_general_admin() $$;

CREATE OR REPLACE FUNCTION public.my_access() RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
 SELECT jsonb_build_object('rtg',public.is_rtg_admin(),'organization',(SELECT jsonb_build_object('id',o.id,'name',o.name,'status',o.status,'role',CASE WHEN m.is_general_admin THEN 'admin' ELSE 'member' END,'general_admin',m.is_general_admin,'can_legal',m.can_legal,'can_finance',m.can_finance,'access',public.org_access_ok(o.id),'ends_at',coalesce(o.ends_at,o.trial_ends_at)) FROM public.organization_members m JOIN public.organizations o ON o.id=m.organization_id WHERE m.user_id=auth.uid() AND m.active)) $$;

-- Designation flag may change only inside the RTG designation function; the general admin cannot be deactivated.
CREATE OR REPLACE FUNCTION public.guard_member_flags() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF (TG_OP='INSERT' AND NEW.is_general_admin) OR (TG_OP='UPDATE' AND NEW.is_general_admin IS DISTINCT FROM OLD.is_general_admin) THEN
    IF coalesce(current_setting('gbts.rtg_designation', true),'')<>'on' THEN RAISE EXCEPTION 'Somente a RTG designa o administrador geral'; END IF;
  END IF;
  IF TG_OP='UPDATE' AND OLD.is_general_admin AND NEW.is_general_admin AND NOT NEW.active THEN RAISE EXCEPTION 'Designe outro administrador geral antes de desativar esta conta'; END IF;
  IF TG_OP='UPDATE' AND NEW.organization_id<>OLD.organization_id THEN RAISE EXCEPTION 'Vínculo de escritório não pode ser alterado'; END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS guard_member_flags ON public.organization_members;
CREATE TRIGGER guard_member_flags BEFORE INSERT OR UPDATE ON public.organization_members FOR EACH ROW EXECUTE FUNCTION public.guard_member_flags();
CREATE OR REPLACE FUNCTION public.guard_member_delete() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN IF OLD.is_general_admin AND OLD.active THEN RAISE EXCEPTION 'Designe outro administrador geral antes de remover esta conta'; END IF; RETURN OLD; END $$;
DROP TRIGGER IF EXISTS guard_member_delete ON public.organization_members;
CREATE TRIGGER guard_member_delete BEFORE DELETE ON public.organization_members FOR EACH ROW EXECUTE FUNCTION public.guard_member_delete();

CREATE OR REPLACE FUNCTION public.rtg_set_general_admin(p_org uuid, p_member uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_old uuid; v_old_email text; v_new_email text;
BEGIN
  IF NOT public.is_rtg_admin() THEN RAISE EXCEPTION 'Acesso não autorizado'; END IF;
  SELECT email INTO v_new_email FROM public.organization_members WHERE id=p_member AND organization_id=p_org AND active FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Conta não encontrada, inativa ou de outro escritório'; END IF;
  SELECT id,email INTO v_old,v_old_email FROM public.organization_members WHERE organization_id=p_org AND is_general_admin FOR UPDATE;
  IF v_old=p_member THEN RETURN; END IF;
  PERFORM set_config('gbts.rtg_designation','on',true);
  UPDATE public.organization_members SET is_general_admin=false WHERE organization_id=p_org AND is_general_admin;
  UPDATE public.organization_members SET is_general_admin=true WHERE id=p_member;
  PERFORM set_config('gbts.rtg_designation','off',true);
  INSERT INTO public.admin_events(organization_id,actor,action,details) VALUES(p_org,auth.uid(),'Administrador geral designado',jsonb_build_object('de',v_old_email,'para',v_new_email));
END $$;

CREATE OR REPLACE FUNCTION public.set_member_access(p_member uuid, p_active boolean, p_legal boolean, p_finance boolean) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_org uuid; v_user uuid; v_ga boolean;
BEGIN
  SELECT organization_id,user_id,is_general_admin INTO v_org,v_user,v_ga FROM public.organization_members WHERE id=p_member;
  IF v_org IS NULL OR NOT public.is_general_admin() OR v_org<>public.current_org() OR NOT public.org_access_ok(v_org) THEN RAISE EXCEPTION 'Acesso não autorizado'; END IF;
  IF v_user=auth.uid() THEN RAISE EXCEPTION 'Você não pode alterar as próprias permissões'; END IF;
  IF v_ga THEN RAISE EXCEPTION 'O administrador geral é definido pela RTG'; END IF;
  IF p_active IS NULL OR p_legal IS NULL OR p_finance IS NULL THEN RAISE EXCEPTION 'Permissões inválidas'; END IF;
  UPDATE public.organization_members SET active=p_active,can_legal=p_legal,can_finance=p_finance WHERE id=p_member;
  INSERT INTO public.admin_events(organization_id,actor,action,details) VALUES(v_org,auth.uid(),'Permissões alteradas',jsonb_build_object('membro',p_member,'ativa',p_active,'juridico',p_legal,'financeiro',p_finance));
END $$;

CREATE OR REPLACE FUNCTION public.set_member_status(p_member uuid, p_active boolean, p_role text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN RAISE EXCEPTION 'Atualize a página: a gestão de equipe agora usa permissões jurídicas e financeiras'; END $$;

-- Write guards that also cover security-definer financial and legal operations.
CREATE OR REPLACE FUNCTION public.require_finance_write() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_org uuid;
BEGIN
  IF auth.uid() IS NULL THEN RETURN coalesce(NEW,OLD); END IF;
  v_org := CASE WHEN TG_OP='DELETE' THEN OLD.organization_id ELSE NEW.organization_id END;
  IF NOT public.has_finance(v_org) THEN RAISE EXCEPTION 'Acesso financeiro não autorizado'; END IF;
  RETURN coalesce(NEW,OLD);
END $$;
CREATE OR REPLACE FUNCTION public.require_legal_write() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_org uuid;
BEGIN
  IF auth.uid() IS NULL THEN RETURN coalesce(NEW,OLD); END IF;
  v_org := CASE WHEN TG_OP='DELETE' THEN OLD.organization_id ELSE NEW.organization_id END;
  IF NOT public.has_legal(v_org) THEN RAISE EXCEPTION 'Acesso jurídico não autorizado'; END IF;
  RETURN coalesce(NEW,OLD);
END $$;
DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['contracts','installments','payments','expenses','associates','fee_divisions','fee_payouts','finance_events'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS require_finance ON public.%I', t);
    EXECUTE format('CREATE TRIGGER require_finance BEFORE INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.require_finance_write()', t);
  END LOOP;
  FOREACH t IN ARRAY ARRAY['clients','legal_cases'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS require_legal ON public.%I', t);
    EXECUTE format('CREATE TRIGGER require_legal BEFORE INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.require_legal_write()', t);
  END LOOP;
END $$;

-- Read and write policies per domain, keeping office isolation and subscription checks (inside has_*).
DROP POLICY IF EXISTS org_clients ON public.clients;
CREATE POLICY clients_read ON public.clients FOR SELECT TO authenticated USING (public.has_legal(organization_id) OR public.has_finance(organization_id));
CREATE POLICY clients_insert ON public.clients FOR INSERT TO authenticated WITH CHECK (public.has_legal(organization_id));
CREATE POLICY clients_update ON public.clients FOR UPDATE TO authenticated USING (public.has_legal(organization_id)) WITH CHECK (public.has_legal(organization_id));
CREATE POLICY clients_delete ON public.clients FOR DELETE TO authenticated USING (public.has_legal(organization_id));
DROP POLICY IF EXISTS org_cases ON public.legal_cases;
CREATE POLICY legal_cases_access ON public.legal_cases FOR ALL TO authenticated USING (public.has_legal(organization_id)) WITH CHECK (public.has_legal(organization_id) AND EXISTS (SELECT 1 FROM public.clients c WHERE c.id=legal_cases.client_id AND c.organization_id=legal_cases.organization_id));
DROP POLICY IF EXISTS org_contracts ON public.contracts;
CREATE POLICY finance_contracts ON public.contracts FOR SELECT TO authenticated USING (public.has_finance(organization_id));
DROP POLICY IF EXISTS org_installments ON public.installments;
CREATE POLICY finance_installments ON public.installments FOR SELECT TO authenticated USING (public.has_finance(organization_id));
DROP POLICY IF EXISTS org_payments ON public.payments;
CREATE POLICY finance_payments ON public.payments FOR SELECT TO authenticated USING (public.has_finance(organization_id));
DROP POLICY IF EXISTS org_expenses ON public.expenses;
CREATE POLICY finance_expenses ON public.expenses FOR ALL TO authenticated USING (public.has_finance(organization_id)) WITH CHECK (public.has_finance(organization_id));
DROP POLICY IF EXISTS org_associates ON public.associates;
CREATE POLICY finance_associates ON public.associates FOR ALL TO authenticated USING (public.has_finance(organization_id)) WITH CHECK (public.has_finance(organization_id));
DROP POLICY IF EXISTS org_divisions ON public.fee_divisions;
CREATE POLICY finance_divisions ON public.fee_divisions FOR SELECT TO authenticated USING (public.has_finance(organization_id));
DROP POLICY IF EXISTS org_payouts ON public.fee_payouts;
CREATE POLICY finance_payouts ON public.fee_payouts FOR SELECT TO authenticated USING (public.has_finance(organization_id));
DROP POLICY IF EXISTS org_finance_events ON public.finance_events;
CREATE POLICY finance_events_read ON public.finance_events FOR SELECT TO authenticated USING (public.has_finance(organization_id));
DROP POLICY IF EXISTS org_audit ON public.audit_log;
CREATE POLICY audit_by_domain ON public.audit_log FOR SELECT TO authenticated USING (CASE WHEN entity IN ('clients','legal_cases') THEN public.has_legal(organization_id) ELSE public.has_finance(organization_id) END);

DO $$ DECLARE f text; BEGIN
  FOREACH f IN ARRAY ARRAY['has_legal(uuid)','has_finance(uuid)','is_general_admin()','rtg_set_general_admin(uuid,uuid)','set_member_access(uuid,boolean,boolean,boolean)'] LOOP
    EXECUTE 'REVOKE ALL ON FUNCTION public.'||f||' FROM PUBLIC, anon'; EXECUTE 'GRANT EXECUTE ON FUNCTION public.'||f||' TO authenticated, service_role';
  END LOOP;
  FOREACH f IN ARRAY ARRAY['guard_member_flags()','guard_member_delete()','require_finance_write()','require_legal_write()'] LOOP
    EXECUTE 'REVOKE ALL ON FUNCTION public.'||f||' FROM PUBLIC, anon, authenticated';
  END LOOP;
END $$;CREATE OR REPLACE FUNCTION public.guard_member_delete() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN IF auth.uid() IS NOT NULL AND OLD.is_general_admin AND OLD.active THEN RAISE EXCEPTION 'Designe outro administrador geral antes de remover esta conta'; END IF; RETURN OLD; END $$;
REVOKE ALL ON FUNCTION public.guard_member_delete() FROM PUBLIC, anon, authenticated;ALTER TABLE public.organization_members ADD COLUMN IF NOT EXISTS full_name text NOT NULL DEFAULT '';

-- The general-admin flag can change only from privileged backend code (RTG designation function runs as owner); direct client updates run as authenticated/anon and are rejected.
CREATE OR REPLACE FUNCTION public.guard_member_flags() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path TO 'public' AS $$
BEGIN
  IF (TG_OP='INSERT' AND NEW.is_general_admin) OR (TG_OP='UPDATE' AND NEW.is_general_admin IS DISTINCT FROM OLD.is_general_admin) THEN
    IF current_user IN ('authenticated','anon') THEN RAISE EXCEPTION 'Somente a RTG designa o administrador geral'; END IF;
  END IF;
  IF TG_OP='UPDATE' AND OLD.is_general_admin AND NEW.is_general_admin AND NOT NEW.active THEN RAISE EXCEPTION 'Designe outro administrador geral antes de desativar esta conta'; END IF;
  IF TG_OP='UPDATE' AND NEW.organization_id<>OLD.organization_id THEN RAISE EXCEPTION 'Vínculo de escritório não pode ser alterado'; END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.rtg_set_general_admin(p_org uuid, p_member uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_old uuid; v_old_email text; v_new_email text;
BEGIN
  IF NOT public.is_rtg_admin() THEN RAISE EXCEPTION 'Acesso não autorizado'; END IF;
  SELECT email INTO v_new_email FROM public.organization_members WHERE id=p_member AND organization_id=p_org AND active FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Conta não encontrada, inativa ou de outro escritório'; END IF;
  SELECT id,email INTO v_old,v_old_email FROM public.organization_members WHERE organization_id=p_org AND is_general_admin FOR UPDATE;
  IF v_old=p_member THEN RETURN; END IF;
  UPDATE public.organization_members SET is_general_admin=false WHERE organization_id=p_org AND is_general_admin;
  UPDATE public.organization_members SET is_general_admin=true, can_legal=true, can_finance=true WHERE id=p_member;
  INSERT INTO public.admin_events(organization_id,actor,action,details) VALUES(p_org,auth.uid(),'Administrador geral designado',jsonb_build_object('de',v_old_email,'para',v_new_email));
END $$;

-- Only privileged backend code may delete the active general admin row (removal flow transfers first).
CREATE OR REPLACE FUNCTION public.guard_member_delete() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path TO 'public' AS $$
BEGIN IF current_user IN ('authenticated','anon') AND OLD.is_general_admin AND OLD.active THEN RAISE EXCEPTION 'Designe outro administrador geral antes de remover esta conta'; END IF; RETURN OLD; END $$;

REVOKE UPDATE (is_general_admin) ON public.organization_members FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.guard_member_flags() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.guard_member_delete() FROM PUBLIC, anon, authenticated;CREATE OR REPLACE FUNCTION public.rtg_set_general_admin(p_org uuid, p_member uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_old uuid; v_old_email text; v_new_email text;
BEGIN
  IF NOT public.is_rtg_admin() THEN RAISE EXCEPTION 'Acesso não autorizado'; END IF;
  SELECT email INTO v_new_email FROM public.organization_members WHERE id=p_member AND organization_id=p_org AND active FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Conta não encontrada, inativa ou de outro escritório'; END IF;
  SELECT id,email INTO v_old,v_old_email FROM public.organization_members WHERE organization_id=p_org AND is_general_admin FOR UPDATE;
  IF v_old=p_member THEN RETURN; END IF;
  UPDATE public.organization_members SET is_general_admin=false WHERE organization_id=p_org AND is_general_admin;
  UPDATE public.organization_members SET is_general_admin=true WHERE id=p_member;
  INSERT INTO public.admin_events(organization_id,actor,action,details) VALUES(p_org,auth.uid(),'Administrador geral designado',jsonb_build_object('de',v_old_email,'para',v_new_email));
END $$;CREATE TABLE public.rtg_authorizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  rtg_user_id uuid NOT NULL,
  rtg_email text NOT NULL,
  scope text NOT NULL DEFAULT 'backup_history',
  granted_by uuid,
  granted_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  revoked_by uuid
);
GRANT SELECT ON public.rtg_authorizations TO authenticated;
GRANT ALL ON public.rtg_authorizations TO service_role;
ALTER TABLE public.rtg_authorizations ENABLE ROW LEVEL SECURITY;
CREATE POLICY rtg_auth_read ON public.rtg_authorizations FOR SELECT TO authenticated
  USING ((organization_id = public.current_org() AND public.is_general_admin()) OR rtg_user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.rtg_authorized(p_org uuid, p_scope text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT public.is_rtg_admin() AND EXISTS(SELECT 1 FROM public.rtg_authorizations WHERE organization_id=p_org AND rtg_user_id=auth.uid() AND scope=p_scope AND revoked_at IS NULL) $$;

CREATE TABLE public.backup_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  requested_by uuid,
  requested_name text NOT NULL DEFAULT '',
  kind text NOT NULL DEFAULT 'Exportação comercial (ZIP com CSV)',
  status text NOT NULL DEFAULT 'Em processamento',
  files jsonb NOT NULL DEFAULT '[]'::jsonb,
  row_count integer,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);
GRANT SELECT ON public.backup_runs TO authenticated;
GRANT ALL ON public.backup_runs TO service_role;
ALTER TABLE public.backup_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY backup_runs_read ON public.backup_runs FOR SELECT TO authenticated
  USING ((organization_id = public.current_org() AND public.is_general_admin()) OR public.rtg_authorized(organization_id,'backup_history'));
CREATE INDEX backup_runs_org_idx ON public.backup_runs(organization_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.backup_start() RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_id uuid; v_name text;
BEGIN
  IF NOT public.is_general_admin() OR NOT public.org_access_ok(public.current_org()) THEN RAISE EXCEPTION 'Acesso não autorizado'; END IF;
  SELECT coalesce(nullif(full_name,''),email) INTO v_name FROM public.organization_members WHERE user_id=auth.uid() AND active;
  INSERT INTO public.backup_runs(organization_id,requested_by,requested_name) VALUES(public.current_org(),auth.uid(),coalesce(v_name,'')) RETURNING id INTO v_id;
  RETURN v_id;
END $$;

CREATE OR REPLACE FUNCTION public.backup_finish(p_id uuid, p_ok boolean, p_files jsonb, p_rows integer, p_error text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  UPDATE public.backup_runs SET status=CASE WHEN p_ok THEN 'Concluído' ELSE 'Falha' END, files=coalesce(p_files,'[]'::jsonb), row_count=p_rows, error=left(p_error,500), completed_at=now()
   WHERE id=p_id AND requested_by=auth.uid() AND status='Em processamento' AND organization_id=public.current_org();
  IF NOT FOUND THEN RAISE EXCEPTION 'Backup não encontrado'; END IF;
END $$;

CREATE OR REPLACE FUNCTION public.office_transfer_general_admin(p_member uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_org uuid := public.current_org(); v_old text; v_new text; v_user uuid;
BEGIN
  IF NOT public.is_general_admin() OR NOT public.org_access_ok(v_org) THEN RAISE EXCEPTION 'Acesso não autorizado'; END IF;
  SELECT email,user_id INTO v_new,v_user FROM public.organization_members WHERE id=p_member AND organization_id=v_org AND active FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Conta não encontrada, inativa ou de outro escritório'; END IF;
  IF v_user=auth.uid() THEN RAISE EXCEPTION 'Escolha outra pessoa'; END IF;
  SELECT email INTO v_old FROM public.organization_members WHERE user_id=auth.uid() AND organization_id=v_org FOR UPDATE;
  UPDATE public.organization_members SET is_general_admin=false WHERE organization_id=v_org AND is_general_admin;
  UPDATE public.organization_members SET is_general_admin=true WHERE id=p_member;
  INSERT INTO public.admin_events(organization_id,actor,action,details) VALUES(v_org,auth.uid(),'Administração geral transferida pelo escritório',jsonb_build_object('de',v_old,'para',v_new));
END $$;

CREATE OR REPLACE FUNCTION public.office_rename_member(p_member uuid, p_name text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_org uuid; v_old text;
BEGIN
  SELECT organization_id,full_name INTO v_org,v_old FROM public.organization_members WHERE id=p_member;
  IF v_org IS NULL OR NOT ((public.is_general_admin() AND v_org=public.current_org()) OR public.is_rtg_admin()) THEN RAISE EXCEPTION 'Acesso não autorizado'; END IF;
  IF length(trim(coalesce(p_name,''))) NOT BETWEEN 2 AND 150 THEN RAISE EXCEPTION 'Informe um nome entre 2 e 150 caracteres'; END IF;
  UPDATE public.organization_members SET full_name=trim(p_name) WHERE id=p_member;
  INSERT INTO public.admin_events(organization_id,actor,action,details) VALUES(v_org,auth.uid(),'Nome atualizado',jsonb_build_object('de',v_old,'para',trim(p_name)));
END $$;

CREATE OR REPLACE FUNCTION public.office_grant_rtg(p_email text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_org uuid := public.current_org(); v_user uuid;
BEGIN
  IF NOT public.is_general_admin() THEN RAISE EXCEPTION 'Acesso não autorizado'; END IF;
  SELECT u.id INTO v_user FROM auth.users u JOIN public.rtg_admins r ON r.user_id=u.id WHERE lower(u.email)=lower(trim(p_email));
  IF v_user IS NULL THEN RAISE EXCEPTION 'Nenhuma pessoa da RTG Systems com este e-mail'; END IF;
  IF EXISTS(SELECT 1 FROM public.rtg_authorizations WHERE organization_id=v_org AND rtg_user_id=v_user AND revoked_at IS NULL) THEN RAISE EXCEPTION 'Esta pessoa já está autorizada'; END IF;
  INSERT INTO public.rtg_authorizations(organization_id,rtg_user_id,rtg_email,granted_by) VALUES(v_org,v_user,lower(trim(p_email)),auth.uid());
  INSERT INTO public.admin_events(organization_id,actor,action,details) VALUES(v_org,auth.uid(),'Acesso da RTG autorizado',jsonb_build_object('email',lower(trim(p_email)),'escopo','Histórico de backups'));
END $$;

CREATE OR REPLACE FUNCTION public.office_revoke_rtg(p_id uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_email text;
BEGIN
  IF NOT public.is_general_admin() THEN RAISE EXCEPTION 'Acesso não autorizado'; END IF;
  UPDATE public.rtg_authorizations SET revoked_at=now(), revoked_by=auth.uid() WHERE id=p_id AND organization_id=public.current_org() AND revoked_at IS NULL RETURNING rtg_email INTO v_email;
  IF v_email IS NULL THEN RAISE EXCEPTION 'Autorização não encontrada'; END IF;
  INSERT INTO public.admin_events(organization_id,actor,action,details) VALUES(public.current_org(),auth.uid(),'Acesso da RTG revogado',jsonb_build_object('email',v_email));
END $$;

DO $$ DECLARE f text; BEGIN
  FOREACH f IN ARRAY ARRAY['rtg_authorized(uuid,text)','backup_start()','backup_finish(uuid,boolean,jsonb,integer,text)','office_transfer_general_admin(uuid)','office_rename_member(uuid,text)','office_grant_rtg(text)','office_revoke_rtg(uuid)'] LOOP
    EXECUTE 'REVOKE ALL ON FUNCTION public.'||f||' FROM PUBLIC, anon';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.'||f||' TO authenticated, service_role';
  END LOOP;
END $$;ALTER TABLE public.contracts ADD COLUMN IF NOT EXISTS closed_at date, ADD COLUMN IF NOT EXISTS closed_by uuid, ADD COLUMN IF NOT EXISTS close_note text;
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
DELETE FROM public.clients WHERE id=p_client AND organization_id=v_org; RETURN 'deleted'; END $$;CREATE OR REPLACE FUNCTION public.remove_client(p_client uuid,p_archive boolean DEFAULT false) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
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