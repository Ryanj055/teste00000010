import { createFileRoute } from '@tanstack/react-router';
import { Workspace } from '@/components/gbts/workspace';
import { head } from '@/lib/gbts/finance';
export const Route=createFileRoute('/_authenticated/perfil')({head:()=>head('Meu perfil','Meu perfil do escritório na Gestão Jurídica e Financeira.'),component:()=> <Workspace page="profile"/>});
