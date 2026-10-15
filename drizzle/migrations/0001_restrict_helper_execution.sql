REVOKE ALL ON FUNCTION public.has_role(uuid,public.app_role) FROM PUBLIC,anon; GRANT EXECUTE ON FUNCTION public.has_role(uuid,public.app_role) TO authenticated,service_role;
REVOKE ALL ON FUNCTION public.is_partner() FROM PUBLIC,anon; GRANT EXECUTE ON FUNCTION public.is_partner() TO authenticated,service_role;
REVOKE ALL ON FUNCTION public.audit_change() FROM PUBLIC,anon,authenticated;