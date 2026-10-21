CREATE TABLE public.legal_cases(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), number text NOT NULL UNIQUE CHECK(length(number) BETWEEN 3 AND 60), client_id uuid NOT NULL REFERENCES public.clients(id), subject text NOT NULL CHECK(length(subject) BETWEEN 2 AND 500), responsible text NOT NULL, status text NOT NULL DEFAULT 'Em andamento' CHECK(status IN ('Em andamento','Suspenso','Arquivado','Encerrado')), next_deadline date, deadline_note text, notes text, demo boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT, INSERT, UPDATE ON public.legal_cases TO authenticated;
GRANT SELECT ON public.legal_cases TO anon;
GRANT ALL ON public.legal_cases TO service_role;
ALTER TABLE public.legal_cases ENABLE ROW LEVEL SECURITY;
CREATE POLICY partner_cases ON public.legal_cases FOR ALL TO authenticated USING(public.is_partner()) WITH CHECK(public.is_partner());
CREATE POLICY demo_cases ON public.legal_cases FOR SELECT TO anon USING(demo);
CREATE TRIGGER legal_cases_audit AFTER INSERT OR UPDATE ON public.legal_cases FOR EACH ROW EXECUTE FUNCTION public.audit_change();