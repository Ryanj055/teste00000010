import { createFileRoute } from '@tanstack/react-router';
import { Workspace } from '@/components/gbts/workspace';
import { head } from '@/lib/gbts/finance';
export const Route=createFileRoute('/_authenticated/cobrancas')({head:()=>head('Cobranças','Controle manual de parcelas, recebimentos, saldos e estornos do escritório.'),component:()=> <Workspace page="receivables"/>});