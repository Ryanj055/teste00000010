import { createFileRoute } from '@tanstack/react-router';
import { Workspace } from '@/components/gbts/workspace';
import { head } from '@/lib/gbts/finance';
export const Route=createFileRoute('/_authenticated/backups')({head:()=>head('Central de Backups','Central de Backups do escritório na Gestão Jurídica e Financeira.'),component:()=> <Workspace page="backups"/>});
