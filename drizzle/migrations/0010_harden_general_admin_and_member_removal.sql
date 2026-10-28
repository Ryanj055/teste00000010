ALTER TABLE public.organization_members ADD COLUMN IF NOT EXISTS full_name text NOT NULL DEFAULT '';

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
REVOKE ALL ON FUNCTION public.guard_member_delete() FROM PUBLIC, anon, authenticated;