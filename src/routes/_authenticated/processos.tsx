import { createFileRoute } from '@tanstack/react-router';
import { Workspace } from '@/components/gbts/workspace';
import { head } from '@/lib/gbts/finance';
export const Route=createFileRoute('/_authenticated/processos')({head:()=>head('Processos jurídicos','Acompanhamento administrativo de processos do escritório Gabriella Barreto & Thais Sardinha.'),component:Page});
function Page(){return <Workspace page="cases"/>;}
