import { createFileRoute } from '@tanstack/react-router';
import { Workspace } from '@/components/gbts/workspace';
import { getDemo } from '@/lib/gbts/data.functions';
import { head } from '@/lib/gbts/finance';
export const Route=createFileRoute('/')({head:()=>head('Visão geral — Demonstração','Painel demonstrativo da gestão jurídica e financeira de Gabriella Barreto & Thais Sardinha.'),loader:()=>getDemo(),component:Index});
function Index(){return <Workspace page="dashboard" demo initialData={Route.useLoaderData()}/>;}
