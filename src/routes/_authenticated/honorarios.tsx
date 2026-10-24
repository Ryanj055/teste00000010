import { createFileRoute } from '@tanstack/react-router';
import { Workspace } from '@/components/gbts/workspace';
import { head } from '@/lib/gbts/finance';
export const Route=createFileRoute('/_authenticated/honorarios')({head:()=>head('Divisão de honorários','Participações contratuais e repasses efetivos da equipe do escritório.'),component:()=> <Workspace page="fees"/>});