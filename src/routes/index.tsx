import { createFileRoute, Link } from '@tanstack/react-router';
import { ArrowRight, ShieldCheck, Wallet, Scale, ChartNoAxesCombined } from 'lucide-react';
import { Button } from '@/components/ui/button';
const logo = { url: '/gbts-logo.png' };
import { head } from '@/lib/gbts/finance';
import { DeveloperSignature } from '@/components/gbts/developer-signature';

export const Route = createFileRoute('/')({
  head: () => head('Gestão Jurídica e Financeira', 'Plataforma de gestão financeira e administrativa do escritório Gabriella Barreto & Thais Sardinha.'),
  component: Index,
});

function Index() {
  const items = [
    { icon: Wallet, title: 'Financeiro conciliado', text: 'Contratos, parcelas, recebimentos e despesas com saldos calculados a partir dos registros.' },
    { icon: Scale, title: 'Processos e prazos', text: 'Acompanhamento administrativo dos processos e responsáveis.' },
    { icon: ChartNoAxesCombined, title: 'Relatórios', text: 'Fluxo de caixa por período e planilhas para o Excel.' },
    { icon: ShieldCheck, title: 'Acesso restrito', text: 'Somente pessoas convidadas, com dados isolados por escritório.' },
  ];
  return <div className="login-screen"><div className="w-full max-w-4xl">
    <img className="login-brand !max-h-[180px]" src={logo.url} alt="Gabriella Barreto & Thais Sardinha — Advogados Associados · Parceria Legal" />
    <div className="login-form text-center"><div className="eyebrow">GESTÃO JURÍDICA E FINANCEIRA</div><h1>Área restrita do escritório</h1>
      <p>Ambiente de gestão interna. O acesso é feito por convite.</p>
      <Button asChild size="lg"><Link to="/auth">Entrar<ArrowRight /></Link></Button>
      <div className="grid gap-4 sm:grid-cols-2 mt-8 text-left">{items.map((x) => <div key={x.title} className="flex gap-3"><x.icon size={18} className="text-gold shrink-0 mt-1" /><div><strong className="text-sm">{x.title}</strong><p className="!m-0 !mt-1">{x.text}</p></div></div>)}</div>
    </div>
    <footer className="login-footer">Gabriella Barreto & Thais Sardinha · Parceria Legal<DeveloperSignature /></footer>
  </div></div>;
}
