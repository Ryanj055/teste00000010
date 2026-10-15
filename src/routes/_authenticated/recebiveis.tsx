import { createFileRoute } from '@tanstack/react-router';
import { Workspace } from '@/components/gbts/workspace';
import { head } from '@/lib/gbts/finance';
export const Route=createFileRoute('/_authenticated/recebiveis')({head:()=>head('Valores a receber','Valores a receber do escritório Gabriella Barreto & Thais Sardinha.'),component:Page});
function Page(){return <Workspace page="receivables"/>;}
