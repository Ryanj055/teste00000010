CREATE OR REPLACE FUNCTION public.rtg_set_general_admin(p_org uuid, p_member uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
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
END $$;