import { createFileRoute } from '@tanstack/react-router';
import { Workspace } from '@/components/gbts/workspace';
import { head } from '@/lib/gbts/finance';
export const Route=createFileRoute('/_authenticated/despesas')({head:()=>head('Despesas','Despesas do escritório Gabriella Barreto & Thais Sardinha.'),component:Page});
function Page(){return <Workspace page="expenses"/>;}
