import { createFileRoute } from '@tanstack/react-router';
import { Workspace } from '@/components/gbts/workspace';
import { head } from '@/lib/gbts/finance';
export const Route=createFileRoute('/_authenticated/dashboard')({head:()=>head('Visão geral','Visão geral do escritório Gabriella Barreto & Thais Sardinha.'),component:Page});
function Page(){return <Workspace page="dashboard"/>;}
