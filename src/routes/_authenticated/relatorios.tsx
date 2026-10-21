import { createFileRoute } from '@tanstack/react-router';
import { Workspace } from '@/components/gbts/workspace';
import { head } from '@/lib/gbts/finance';
export const Route=createFileRoute('/_authenticated/relatorios')({head:()=>head('Relatórios e planilhas','Relatórios financeiros, exportação e importação de planilhas do escritório Gabriella Barreto & Thais Sardinha.'),component:Page});
function Page(){return <Workspace page="reports"/>;}
