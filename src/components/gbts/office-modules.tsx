import { useMemo, useState, type FormEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { Plus, Search, Download, Upload, CircleAlert, Pencil } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { caseSchema, saveCase, saveClient } from '@/lib/gbts/data.functions';
import { clientSchema, dateLabel, money, today } from '@/lib/gbts/finance';
import { download, parseCsv, toCsv } from '@/lib/gbts/spreadsheet';
import { Field, Modal } from './forms';
import { Status, useWorkspace } from './workspace';

import { deadlineState } from '@/lib/gbts/review';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
const caseStatuses = ['Em andamento', 'Suspenso', 'Arquivado', 'Encerrado'] as const;
const partners = ['Gabriella Barreto', 'Thais Sardinha'] as const;

function Heading({ eyebrow, title, text, action }: { eyebrow: string; title: string; text: string; action?: React.ReactNode }) {
  return <div className="page-heading"><div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1><p>{text}</p></div>{action}</div>;
}

export function CasesPage() {
  const {data}=useWorkspace(); const [search,setSearch]=useState(''),[status,setStatus]=useState('Todos'),[responsible,setResponsible]=useState(''),[area,setArea]=useState(''),[from,setFrom]=useState(''),[to,setTo]=useState(''),[deadline,setDeadline]=useState(''),[order,setOrder]=useState('asc'),[edit,setEdit]=useState<string|null>(null);
  const now=today();const rows=data.cases.filter(x=>`${x.number} ${x.subject} ${data.clients.find(c=>c.id===x.client_id)?.name??''}`.toLowerCase().includes(search.toLowerCase())&&(status==='Todos'||x.status===status)&&(!responsible||x.responsible===responsible)&&(!area||(x.legal_area??'Não informada')===area)&&(!from||x.created_at.slice(0,10)>=from)&&(!to||x.created_at.slice(0,10)<=to)&&(!deadline||deadlineState(x.next_deadline,x.status,now).label===deadline)).sort((a,b)=>(a.next_deadline??'9999').localeCompare(b.next_deadline??'9999')*(order==='asc'?1:-1));
  const grouped=(get:(x:typeof rows[number])=>string)=>[...rows.reduce((m,x)=>{const k=get(x);m.set(k,(m.get(k)??0)+1);return m;},new Map<string,number>())].map(([name,value])=>({name,value}));
  const statusData=grouped(x=>x.status),deadlineData=grouped(x=>deadlineState(x.next_deadline,x.status,now).label),areaData=grouped(x=>x.legal_area??'Não informada');
  const monthly=[...new Set(rows.flatMap(x=>[x.created_at.slice(0,7),...(x.closed_at?[x.closed_at.slice(0,7)]:[])]))].sort().map(month=>({name:month.slice(5)+'/'+month.slice(0,4),created:rows.filter(x=>x.created_at.startsWith(month)).length,closed:rows.filter(x=>x.closed_at?.startsWith(month)).length}));
  function chart(title:string,values:{name:string;value:number}[],click:(name:string)=>void){return <section className="panel"><div className="table-heading"><h2>{title}</h2></div>{!values.length?<div className="empty">Nenhum processo para os filtros.</div>:<div className="chart"><ResponsiveContainer width="100%" height="100%"><BarChart data={values}><CartesianGrid stroke="var(--border)" vertical={false}/><XAxis dataKey="name" tick={{fontSize:9,fill:'var(--muted-foreground)'}} interval={0}/><YAxis allowDecimals={false} width={30}/><Tooltip/><Bar dataKey="value" name="Processos" fill="var(--info)" onClick={x=>click(String(x.name))}/></BarChart></ResponsiveContainer></div>}</section>;}
  return <><Heading eyebrow="ACOMPANHAMENTO ADMINISTRATIVO" title="Processos jurídicos" text="Processos, próximos prazos e providências do escritório." action={<Button onClick={()=>setEdit('new')}><Plus/>Novo processo</Button>}/>
  <div className="toolbar"><div className="search-field"><Search size={16}/><input aria-label="Pesquisar processos" placeholder="Número, cliente ou assunto" value={search} onChange={e=>setSearch(e.target.value)}/></div><select aria-label="Filtrar situação" value={status} onChange={e=>setStatus(e.target.value)}><option>Todos</option>{caseStatuses.map(x=><option key={x}>{x}</option>)}</select><select aria-label="Responsável" value={responsible} onChange={e=>setResponsible(e.target.value)}><option value="">Todos os responsáveis</option>{[...new Set(data.cases.map(x=>x.responsible))].map(x=><option key={x}>{x}</option>)}</select><select aria-label="Área jurídica" value={area} onChange={e=>setArea(e.target.value)}><option value="">Todas as áreas</option>{[...new Set(data.cases.map(x=>x.legal_area??'Não informada'))].map(x=><option key={x}>{x}</option>)}</select></div>
  <div className="toolbar"><Field label="Data de cadastro inicial"><input type="date" value={from} onChange={e=>setFrom(e.target.value)}/></Field><Field label="Data de cadastro final"><input type="date" value={to} onChange={e=>setTo(e.target.value)}/></Field><Field label="Situação do prazo"><select value={deadline} onChange={e=>setDeadline(e.target.value)}><option value="">Todos os prazos</option>{['Em dia','Próximo','Vencido','Sem prazo','Não aplicável'].map(x=><option key={x}>{x}</option>)}</select></Field><Field label="Ordenação por prazo"><select value={order} onChange={e=>setOrder(e.target.value)}><option value="asc">Mais próximo primeiro</option><option value="desc">Mais distante primeiro</option></select></Field></div>
  <div className="additional-stats">{[['Total',rows.length],['Ativos',rows.filter(x=>x.status==='Em andamento').length],['Encerrados',rows.filter(x=>x.status==='Encerrado').length],['Prazo próximo',rows.filter(x=>deadlineState(x.next_deadline,x.status,now).label==='Próximo').length],['Prazo vencido',rows.filter(x=>deadlineState(x.next_deadline,x.status,now).label==='Vencido').length],['Sem prazo',rows.filter(x=>!x.next_deadline).length]].map(([n,v])=><div className="mini-stat" key={n}><span>{n}</span><strong>{v}</strong></div>)}</div>
  <div className="chart-layout">{chart('Processos por status',statusData,setStatus)}{chart('Situação dos prazos',deadlineData,setDeadline)}{chart('Processos por área jurídica',areaData,setArea)}<section className="panel"><div className="table-heading"><h2>Evolução mensal · cadastro e encerramento</h2></div>{monthly.length?<div className="chart"><ResponsiveContainer width="100%" height="100%"><BarChart data={monthly}><XAxis dataKey="name" tick={{fontSize:10}}/><YAxis allowDecimals={false} width={30}/><Tooltip/><Bar name="Cadastrados" dataKey="created" fill="var(--info)"/><Bar name="Encerrados com data" dataKey="closed" fill="var(--success)"/></BarChart></ResponsiveContainer></div>:<div className="empty">Sem datas suficientes.</div>}{rows.some(x=>x.status==='Encerrado'&&!x.closed_at)&&<p className="form-note">Encerramentos sem data não entram na evolução mensal.</p>}</section></div>
  <section className="panel"><div className="table-heading"><h2>{rows.length} processos</h2></div>{!rows.length?<div className="empty">Nenhum processo encontrado.</div>:rows.map(x=>{const d=deadlineState(x.next_deadline,x.status,now);return <div className="mobile-row case-row" key={x.id}><div className="flex-1"><strong>{x.number}</strong><div className="cell-secondary">{x.subject} · {data.clients.find(c=>c.id===x.client_id)?.name}</div><div className="cell-secondary">{x.responsible} · {x.legal_area??'Área não informada'}</div><div className={d.label==='Vencido'?'text-destructive':d.label==='Próximo'?'text-info':'text-muted-foreground'}>Prazo: {dateLabel(x.next_deadline)} · {d.label}{d.days!==null&&` · ${d.days<0?'Vencido há '+Math.abs(d.days)+' dias':d.days===0?'Hoje':'Faltam '+d.days+' dias'}`}</div>{x.deadline_note&&<div className="cell-secondary">Próxima providência: {x.deadline_note}</div>}</div><div className="right"><Status value={x.status}/><Button variant="ghost" size="icon" aria-label={`Editar ${x.number}`} onClick={()=>setEdit(x.id)}><Pencil size={15}/></Button></div></div>;})}</section>{edit&&<CaseForm id={edit==='new'?undefined:edit} onClose={()=>setEdit(null)}/>}</>;
}

function CaseForm({ id, onClose }: { id?: string | undefined; onClose: () => void }) {
  const { data } = useWorkspace(); const qc = useQueryClient(); const save = useServerFn(saveCase);
  const current = data.cases.find((x) => x.id === id);
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); const f = new FormData(e.currentTarget); const g = (k: string) => String(f.get(k) ?? '');
    const parsed = caseSchema.safeParse({ id, number: g('number'), client_id: g('client_id'), subject: g('subject'), responsible: g('responsible'), status: g('status'), next_deadline: g('next_deadline') || null, deadline_note: g('deadline_note'), notes: g('notes'),legal_area:g('legal_area')||null,closed_at:g('closed_at')||null });
    if (!parsed.success) { setError('Preencha número, cliente, assunto e responsável corretamente.'); return; }
    setBusy(true); setError('');
    try { await save({ data: parsed.data }); toast.success('Processo salvo.'); await qc.invalidateQueries({ queryKey: ['workspace'] }); onClose(); }
    catch (err) { setError(err instanceof Error ? err.message : 'Não foi possível salvar.'); } finally { setBusy(false); }
  }
  return <Modal title={current ? 'Editar processo' : 'Novo processo'} onClose={onClose}><form onSubmit={submit}><div className="modal-body"><div className="form-grid">
    <Field label="Número do processo"><input name="number" required maxLength={60} defaultValue={current?.number} /></Field>
    <Field label="Cliente"><select name="client_id" required defaultValue={current?.client_id ?? ''}><option value="" disabled>Selecione</option>{data.clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
    <Field label="Assunto" full><input name="subject" required maxLength={500} defaultValue={current?.subject} /></Field>
    <Field label="Pessoa responsável"><input name="responsible" required maxLength={150} defaultValue={current?.responsible??partners[0]}/></Field><Field label="Área jurídica"><input name="legal_area" maxLength={100} defaultValue={current?.legal_area??''}/></Field><Field label="Data de encerramento (se encerrado)"><input type="date" name="closed_at" max={today()} defaultValue={current?.closed_at??''}/></Field>
    <Field label="Situação"><select name="status" defaultValue={current?.status ?? 'Em andamento'}>{caseStatuses.map((x) => <option key={x}>{x}</option>)}</select></Field>
    <Field label="Próximo prazo"><input type="date" name="next_deadline" defaultValue={current?.next_deadline ?? ''} /></Field>
    <Field label="Próxima providência / descrição do prazo"><input name="deadline_note" maxLength={300} defaultValue={current?.deadline_note ?? ''} /></Field>
    <Field label="Observações" full><textarea name="notes" rows={3} maxLength={2000} defaultValue={current?.notes ?? ''} /></Field>
  </div>{error && <div className="form-error" role="alert">{error}</div>}</div>
  <div className="modal-footer"><Button type="button" variant="outline" onClick={onClose}>Cancelar</Button><Button disabled={busy}>{busy ? 'Salvando…' : 'Salvar processo'}</Button></div></form></Modal>;
}

export function ReportsPage() {
  const { data } = useWorkspace();
  const [from, setFrom] = useState(today().slice(0, 7) + '-01'), [to, setTo] = useState(today()), [category, setCategory] = useState('');
  const [importOpen, setImportOpen] = useState(false);
  const inside = (d?: string | null) => Boolean(d && d >= from && d <= to);
  const categories = [...new Set(data.expenses.map((x) => x.category))];
  const payments = data.payments.filter((x) => inside(x.paid_at));
  const expenses = data.expenses.filter((x) => (!category || x.category === category) && inside(x.paid_at ?? x.due_date));
  const payouts = data.payoutLedger.filter(x=>inside(x.effective_date));const repassed=payouts.reduce((s,x)=>s+Number(x.amount),0);
  const ledger=data.ledger.filter(x=>inside(x.effective_date));
  const received = ledger.map(x=>({...x,amount:Number(x.amount)})).reduce((s, x) => s + x.amount, 0);
  const paid = expenses.filter((x) => x.status === 'Pago' && !x.reimbursable).reduce((s, x) => s + x.amount, 0);
  const forecast = data.receivables.filter((x) => inside(x.due_date) && Number(x.balance) > 0).reduce((s, x) => s + Number(x.balance), 0);
  const pendingExp = expenses.filter((x) => x.status === 'Pendente' && !x.reimbursable).reduce((s, x) => s + x.amount, 0);
  const months = useMemo(() => { const m = new Map<string, { in: number; out: number }>();
    ledger.forEach((p) => { const k = String(p.effective_date).slice(0, 7); const v = m.get(k) ?? { in: 0, out: 0 }; v.in += Number(p.amount); m.set(k, v); });
    expenses.filter((x) => x.status === 'Pago' && !x.reimbursable && x.paid_at).forEach((x) => { const k = String(x.paid_at).slice(0, 7); const v = m.get(k) ?? { in: 0, out: 0 }; v.out += x.amount; m.set(k, v); });
    payouts.forEach(p=>{const k=String(p.effective_date).slice(0,7);const v=m.get(k)??{in:0,out:0};v.out+=Number(p.amount);m.set(k,v);});
    return [...m.entries()].sort(([a], [b]) => a.localeCompare(b)); }, [ledger, expenses, payouts]);
  const contractOf = (id?: string | null) => data.contracts.find((c) => c.id === id);
  const clientOf = (id?: string | null) => data.clients.find((c) => c.id === id)?.name ?? '';
  const exports = {
    'recebimentos': () => toCsv(['Data', 'Contrato', 'Cliente', 'Valor', 'Forma', 'Referência'], payments.map((p) => { const inst = data.receivables.find((r) => r.id === p.installment_id); const c = contractOf(inst?.contract_id); return [dateLabel(p.paid_at), c?.number, clientOf(c?.client_id), p.amount.toFixed(2).replace('.', ','), p.method, p.reference]; })),
    'despesas': () => toCsv(['Descrição', 'Categoria', 'Vencimento', 'Pagamento', 'Valor', 'Situação', 'Reembolsável'], expenses.map((x) => [x.description, x.category, dateLabel(x.due_date), dateLabel(x.paid_at), x.amount.toFixed(2).replace('.', ','), x.status, x.reimbursable ? 'Sim' : 'Não'])),
    'contratos': () => toCsv(['Número', 'Cliente', 'Objeto', 'Valor contratado', 'Recebido', 'Saldo', 'Situação'], data.contracts.map((c) => { const r = data.receivables.filter((x) => x.contract_id === c.id); return [c.number, clientOf(c.client_id), c.subject, c.total.toFixed(2).replace('.', ','), r.reduce((s, x) => s + Number(x.paid), 0).toFixed(2).replace('.', ','), r.reduce((s, x) => s + Number(x.balance), 0).toFixed(2).replace('.', ','), c.status]; })),
    'parcelas': () => toCsv(['Contrato', 'Parcela', 'Vencimento', 'Valor', 'Pago', 'Saldo', 'Situação'], data.receivables.filter((x) => inside(x.due_date)).map((x) => [contractOf(x.contract_id)?.number, x.label, dateLabel(x.due_date), Number(x.amount).toFixed(2).replace('.', ','), Number(x.paid).toFixed(2).replace('.', ','), Number(x.balance).toFixed(2).replace('.', ','), x.status])),
  } as const;
  return <>
    <Heading eyebrow="RELATÓRIOS INSTITUCIONAIS" title="Relatórios & planilhas" text="Valores efetivamente recebidos e pagos no período, separados do que ainda está previsto." action={<Button variant="outline" onClick={() => setImportOpen(true)}><Upload />Importar clientes</Button>} />
    <div className="toolbar"><label>Período inicial<input type="date" aria-label="Data inicial" value={from} onChange={(e) => setFrom(e.target.value)} /></label><label>Período final<input type="date" aria-label="Data final" value={to} onChange={(e) => setTo(e.target.value)} /></label>
      <select aria-label="Categoria de despesa" value={category} onChange={(e) => setCategory(e.target.value)}><option value="">Todas as categorias</option>{categories.map((x) => <option key={x}>{x}</option>)}</select></div>
    <div className="additional-stats">{[['Recebido no período', money(received)], ['Repasses efetivos',money(repassed)],['Despesas pagas', money(paid)], ['Resultado de caixa', money(received - paid - repassed)], ['Previsto a receber', money(forecast)], ['Despesas pendentes', money(pendingExp)], ['Recebimentos registrados', String(payments.length)]].map(([n, v]) => <div className="mini-stat" key={n}><span>{n}</span><strong>{v}</strong></div>)}</div>
    <div className="chart-layout"><section className="panel"><div className="table-heading"><div><h2>Fluxo de caixa mensal</h2><p>Somente movimentações realizadas</p></div></div>
      {months.length === 0 ? <div className="empty">Nenhuma movimentação no período.</div> : <table className="data-table"><thead><tr><th>MÊS</th><th>RECEBIDO</th><th>PAGO</th><th>RESULTADO</th></tr></thead><tbody>{months.map(([m, v]) => <tr key={m}><td>{m.slice(5)}/{m.slice(0, 4)}</td><td className="amount">{money(v.in)}</td><td>{money(v.out)}</td><td className="amount">{money(v.in - v.out)}</td></tr>)}</tbody></table>}
    </section><section className="panel"><div className="table-heading"><div><h2>Exportar planilhas</h2><p>Arquivos CSV que abrem no Excel</p></div></div><div className="quick-actions">
      {(Object.keys(exports) as (keyof typeof exports)[]).map((k) => <Button key={k} variant="outline" className="quick-button" onClick={() => { download(`gestao-${k}-${from}-a-${to}.csv`, exports[k]()); toast.success('Planilha gerada.'); }}><Download size={18} />Exportar {k}</Button>)}
    </div></section></div>
    {importOpen && <ImportClients onClose={() => setImportOpen(false)} />}
  </>;
}

type Preview = { line: number; values: Record<string, unknown>; error?: string | undefined };
function ImportClients({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient(); const save = useServerFn(saveClient);
  const [rows, setRows] = useState<Preview[]>([]), [busy, setBusy] = useState(false), [result, setResult] = useState('');
  async function read(file?: File) {
    if (!file) return; setResult('');
    if (file.size > 1_000_000) { toast.error('Arquivo acima de 1 MB.'); return; }
    const parsed = parseCsv(await file.text()).slice(0, 500);
    if (!parsed.length) { toast.error('Planilha vazia ou sem cabeçalho.'); return; }
    setRows(parsed.map((r, i) => { const values = { name: r['nome'] ?? '', type: (r['tipo'] ?? 'PF').toUpperCase(), document: r['documento'] ?? '', email: r['email'] ?? r['e-mail'] ?? '', phone: r['telefone'] ?? '', address: r['endereco'] ?? r['endereço'] ?? '', responsible: r['responsavel'] ?? r['responsável'] ?? 'Gabriella Barreto', status: 'Ativo', notes: r['observacoes'] ?? r['observações'] ?? '' };
      const ok = clientSchema.safeParse(values); return { line: i + 2, values, error: ok.success ? undefined : ok.error.issues.map((x) => `${x.path.join('.') || 'linha'}: ${x.message}`).join('; ') }; }));
  }
  const valid = rows.filter((r) => !r.error);
  async function confirm() {
    setBusy(true); let ok = 0; const failed: string[] = [];
    for (const r of valid) { try { await save({ data: clientSchema.parse(r.values) }); ok++; } catch (e) { failed.push(`Linha ${r.line}: ${e instanceof Error ? e.message : 'erro'}`); } }
    setBusy(false); await qc.invalidateQueries({ queryKey: ['workspace'] });
    setResult(`${ok} cliente(s) importado(s).${failed.length ? ` Falhas: ${failed.join(' · ')}` : ''}`);
    if (ok) toast.success(`${ok} cliente(s) importado(s).`); setRows([]);
  }
  return <Modal title="Importar clientes" onClose={onClose}><div className="modal-body">
    <div className="form-note">Envie um CSV com as colunas: nome; tipo (PF ou PJ); documento; email; telefone; endereco; responsavel; observacoes. Você revisa as linhas antes de confirmar.</div>
    <Button variant="link" className="p-0 mb-4" onClick={() => download('modelo-clientes.csv', toCsv(['nome', 'tipo', 'documento', 'email', 'telefone', 'endereco', 'responsavel', 'observacoes'], [['Cliente Exemplo', 'PF', '', 'exemplo@email.com', '', '', 'Gabriella Barreto', '']]))}><Download size={14} />Baixar modelo</Button>
    <input type="file" accept=".csv,text/csv" aria-label="Arquivo CSV" onChange={(e) => read(e.target.files?.[0])} />
    {result && <div role="status" className="form-note mt-4">{result}</div>}
    {rows.length > 0 && <><p className="text-xs mt-4">{valid.length} válida(s) · {rows.length - valid.length} com erro</p><div className="overflow-x-auto"><table className="data-table"><thead><tr><th>LINHA</th><th>NOME</th><th>TIPO</th><th>VALIDAÇÃO</th></tr></thead><tbody>
      {rows.map((r) => <tr key={r.line}><td>{r.line}</td><td>{String(r.values['name'])}</td><td>{String(r.values['type'])}</td><td className={r.error ? 'text-destructive' : 'text-success'}>{r.error ? <span className="flex gap-1"><CircleAlert size={12} />{r.error}</span> : 'Pronta'}</td></tr>)}
    </tbody></table></div></>}
  </div><div className="modal-footer"><Button variant="outline" onClick={onClose}>Fechar</Button><Button disabled={busy || valid.length === 0} onClick={confirm}>{busy ? 'Importando…' : `Confirmar ${valid.length} cliente(s)`}</Button></div></Modal>;
}
