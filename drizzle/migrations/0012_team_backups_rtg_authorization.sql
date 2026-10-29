CREATE TABLE public.rtg_authorizations (
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
END $$;