ALTER TABLE public.organization_members
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
END $$;