import { createFileRoute } from '@tanstack/react-router';
import { Workspace } from '@/components/gbts/workspace';
import { head } from '@/lib/gbts/finance';
export const Route=createFileRoute('/_authenticated/equipe')({head:()=>head('Equipe e acessos','Gestão das usuárias e permissões do escritório.'),component:Page});
function Page(){return <Workspace page="team"/>;}
