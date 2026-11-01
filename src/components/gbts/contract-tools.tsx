import { useRef, useState, type FormEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { Copy, Download, Eye, FileUp, Pencil, RefreshCw, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { deleteContract, updateContract, type WorkspaceData } from '@/lib/gbts/data.functions';
import { buildContractTxt } from '@/lib/gbts/contract-export';
import { dateLabel } from '@/lib/gbts/finance';
import { modalities } from '@/lib/gbts/review';
import { Field, Modal, PaymentMethod, readMethod } from './forms';
import { useWorkspace } from './workspace';

const BUCKET = 'contract-documents';

function useOrgId() {
  const qc = useQueryClient();
  return (qc.getQueryData(['access']) as { organization?: { id?: string } } | undefined)?.organization?.id ?? '';
}

/** Anexos PDF do contrato: enviar, visualizar, baixar, substituir e remover (sem excluir o contrato). */
export function ContractDocuments({ contractId }: { contractId: string }) {
  const { data } = useWorkspace();
  const qc = useQueryClient();
  const orgId = useOrgId();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [removing, setRemoving] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const replaceRef = useRef<HTMLInputElement>(null);
  const [replaceId, setReplaceId] = useState<string | null>(null);
  const docs = data.documents.filter((d) => d.contract_id === contractId);

  async function refresh() { await qc.invalidateQueries({ queryKey: ['workspace'] }); }

  async function upload(file: File, existingId?: string) {
    setError('');
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) { setError('Envie somente arquivos PDF.'); return; }
    if (file.size > 20 * 1024 * 1024) { setError('O arquivo ultrapassa o limite de 20 MB.'); return; }
    setBusy(true);
    try {
      const path = `${orgId}/${contractId}/${crypto.randomUUID()}.pdf`;
      const up = await supabase.storage.from(BUCKET).upload(path, file, { contentType: 'application/pdf' });
      if (up.error) throw new Error('Não foi possível enviar o documento. Verifique suas permissões.');
      if (existingId) {
        const old = docs.find((d) => d.id === existingId);
        const u = await supabase.from('contract_documents').update({ file_path: path, file_name: file.name }).eq('id', existingId);
        if (u.error) throw new Error('O documento foi enviado, mas não foi possível vinculá-lo. Tente novamente.');
        if (old) await supabase.storage.from(BUCKET).remove([old.file_path]);
        toast.success('Documento substituído.');
      } else {
        const ins = await supabase.from('contract_documents').insert({ contract_id: contractId, file_path: path, file_name: file.name });
        if (ins.error) throw new Error('O documento foi enviado, mas não foi possível vinculá-lo. Tente novamente.');
        toast.success('Documento anexado ao contrato.');
      }
      await refresh();
    } catch (e) { setError(e instanceof Error ? e.message : 'Não foi possível enviar o documento.'); }
    finally { setBusy(false); }
  }

  async function view(path: string, download?: string) {
    const r = await supabase.storage.from(BUCKET).createSignedUrl(path, 60, download ? { download } : undefined);
    if (r.error || !r.data.signedUrl) { toast.error('Não foi possível abrir o documento.'); return; }
    window.open(r.data.signedUrl, '_blank', 'noopener');
  }

  async function remove(id: string) {
    const doc = docs.find((d) => d.id === id);
    if (!doc) return;
    setBusy(true);
    try {
      const del = await supabase.from('contract_documents').delete().eq('id', id);
      if (del.error) throw new Error('Não foi possível remover o anexo.');
      await supabase.storage.from(BUCKET).remove([doc.file_path]);
      toast.success('Anexo removido. O contrato não foi alterado.');
      setRemoving(null);
      await refresh();
    } catch (e) { setError(e instanceof Error ? e.message : 'Não foi possível remover o anexo.'); }
    finally { setBusy(false); }
  }

  return <div className="mt-6">
    <input ref={fileRef} type="file" accept="application/pdf,.pdf" className="hidden" aria-label="Selecionar PDF" onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload(f); e.target.value = ''; }} />
    <input ref={replaceRef} type="file" accept="application/pdf,.pdf" className="hidden" aria-label="Selecionar PDF para substituir" onChange={(e) => { const f = e.target.files?.[0]; if (f && replaceId) void upload(f, replaceId); e.target.value = ''; setReplaceId(null); }} />
    {docs.length === 0 && <div className="empty">Nenhum documento anexado a este contrato.</div>}
    {docs.map((d) => <div className="timeline-item" key={d.id}>
      <FileUp size={16} />
      <div className="flex-1"><strong>{d.file_name}</strong><small>Anexado em {dateLabel(d.created_at)}</small></div>
      <Button variant="ghost" size="icon" title="Visualizar" aria-label={`Visualizar ${d.file_name}`} onClick={() => view(d.file_path)}><Eye size={15} /></Button>
      <Button variant="ghost" size="icon" title="Baixar" aria-label={`Baixar ${d.file_name}`} onClick={() => view(d.file_path, d.file_name)}><Download size={15} /></Button>
      <Button variant="ghost" size="icon" title="Substituir" aria-label={`Substituir ${d.file_name}`} onClick={() => { setReplaceId(d.id); replaceRef.current?.click(); }}><RefreshCw size={15} /></Button>
      <Button variant="ghost" size="icon" title="Remover anexo" aria-label={`Remover ${d.file_name}`} onClick={() => setRemoving(d.id)}><Trash2 size={15} /></Button>
    </div>)}
    <Button variant="outline" className="mt-4" disabled={busy} onClick={() => fileRef.current?.click()}><FileUp size={15} />{busy ? 'Enviando…' : docs.length ? 'Anexar outro PDF' : 'Anexar PDF'}</Button>
    {error && <div role="alert" className="form-error mt-3">{error}</div>}
    {removing && <Modal title="Remover anexo" onClose={() => setRemoving(null)}><div className="modal-body"><p>Remover o anexo <strong>{docs.find((d) => d.id === removing)?.file_name}</strong>?</p><p>Somente o arquivo será removido. O cadastro do contrato não será alterado.</p></div><div className="modal-footer"><Button variant="outline" onClick={() => setRemoving(null)}>Cancelar</Button><Button variant="destructive" disabled={busy} onClick={() => remove(removing)}>Remover anexo</Button></div></Modal>}
  </div>;
}

/** Exporta as informações cadastradas do contrato em TXT ou copia para a área de transferência. */
export function ContractExport({ contractId }: { contractId: string }) {
  const { data } = useWorkspace();
  const contract = data.contracts.find((x) => x.id === contractId);
  if (!contract) return null;
  const client = data.clients.find((x) => x.id === contract.client_id);
  const installments = data.receivables.filter((x) => x.contract_id === contractId);
  const text = () => buildContractTxt(client, contract, installments);
  function download() {
    const blob = new Blob([text()], { type: 'text/plain;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `contrato-${contract?.number ?? 'dados'}.txt`;
    a.click();
    URL.revokeObjectURL(a.href);
    toast.success('Arquivo TXT baixado.');
  }
  async function copy() {
    try { await navigator.clipboard.writeText(text()); toast.success('Informações copiadas para a área de transferência.'); }
    catch { toast.error('Não foi possível copiar. Baixe o arquivo TXT.'); }
  }
  return <div className="flex flex-wrap gap-2 mt-6">
    <Button variant="outline" onClick={download}><Download size={15} />Baixar TXT</Button>
    <Button variant="outline" onClick={copy}><Copy size={15} />Copiar informações</Button>
  </div>;
}

/** Edição dos dados cadastrais do contrato; valores, parcelas e cronograma não são alterados. */
export function EditContract({ contractId, onDone }: { contractId: string; onDone?: () => void }) {
  const { data } = useWorkspace();
  const qc = useQueryClient();
  const save = useServerFn(updateContract);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const contract = data.contracts.find((x) => x.id === contractId);
  if (!contract) return null;
  const associates = [...new Set(['Gabriella Barreto', 'Thais Sardinha', ...data.associates.map((x) => x.name)])];
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true); setError('');
    try {
      await save({ data: { id: contractId, subject: String(f.get('subject')), service_description: String(f.get('service_description') ?? ''), responsible: String(f.get('responsible')), modality: String(f.get('modality')) as 'Fixos', expected_method: readMethod(f, 'expected_method'), notes: String(f.get('notes') ?? '') } });
      await qc.invalidateQueries({ queryKey: ['workspace'] });
      toast.success('Contrato atualizado.');
      setOpen(false);
      onDone?.();
    } catch (err) { setError(err instanceof Error ? err.message : 'Não foi possível salvar.'); }
    finally { setBusy(false); }
  }
  return <>
    <Button variant="outline" onClick={() => setOpen(true)}><Pencil size={15} />Editar contrato</Button>
    {open && <Modal title={`Editar contrato ${contract.number}`} onClose={() => setOpen(false)}>
      <form onSubmit={submit} className="contents"><div className="modal-body">
        <div className="form-note">Somente os dados cadastrais são editados. Valores, parcelas e recebimentos permanecem intactos.</div>
        <div className="form-grid">
          <Field label="Objeto do contrato" full><input name="subject" required minLength={2} maxLength={500} defaultValue={contract.subject} /></Field>
          <Field label="Descrição do serviço / ação" full><textarea name="service_description" maxLength={2000} rows={3} defaultValue={contract.service_description ?? ''} /></Field>
          <Field label="Pessoa responsável"><input name="responsible" required maxLength={150} list="responsibles" defaultValue={contract.responsible} /></Field>
          <Field label="Modalidade contratual"><select name="modality" defaultValue={contract.modality}>{modalities.map((x) => <option key={x.value} value={x.value}>{x.label}</option>)}</select></Field>
          <PaymentMethod name="expected_method" label="Forma de pagamento prevista" initial={contract.expected_method ?? 'Pix'} />
          <Field label="Observações" full><textarea name="notes" maxLength={2000} rows={3} defaultValue={contract.notes ?? ''} /></Field>
        </div>
        <datalist id="responsibles">{associates.map((x) => <option key={x} value={x} />)}</datalist>
        {error && <div role="alert" className="form-error">{error}</div>}
      </div><div className="modal-footer"><Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button><Button disabled={busy}>{busy ? 'Salvando…' : 'Salvar alterações'}</Button></div></form>
    </Modal>}
  </>;
}

/** Exclusão do contrato com confirmação; o banco bloqueia quando há recebimentos ou anexos. */
export function DeleteContract({ contractId, onDone }: { contractId: string; onDone?: () => void }) {
  const { data } = useWorkspace();
  const qc = useQueryClient();
  const save = useServerFn(deleteContract);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [typed, setTyped] = useState('');
  const contract = data.contracts.find((x) => x.id === contractId);
  if (!contract) return null;
  const payments = data.payments.filter((p) => data.receivables.some((i) => i.id === p.installment_id && i.contract_id === contractId)).length;
  const docs = data.documents.filter((d) => d.contract_id === contractId).length;
  const blocked = payments > 0 || docs > 0;
  async function confirm() {
    setBusy(true); setError('');
    try {
      await save({ data: { id: contractId } });
      await qc.invalidateQueries({ queryKey: ['workspace'] });
      toast.success('Contrato excluído. Cliente e processos não foram alterados.');
      setOpen(false);
      onDone?.();
    } catch (e) { setError(e instanceof Error ? e.message : 'Não foi possível excluir.'); }
    finally { setBusy(false); }
  }
  const close = () => { setOpen(false); setError(''); setTyped(''); };
  return <>
    <Button variant="outline" onClick={() => setOpen(true)}><Trash2 size={15} />Excluir contrato</Button>
    {open && <Modal title="Excluir contrato" onClose={close}><div className="modal-body">
      <p><strong>{contract.number}</strong> · {contract.subject}</p>
      {blocked ? <div role="alert" className="form-error">
        {payments > 0 && <p>Este contrato possui {payments} recebimento(s) registrado(s) e não pode ser excluído, para preservar o histórico financeiro. Utilize "Finalizar contrato".</p>}
        {docs > 0 && <p>Remova o documento anexado na aba Documento antes de excluir o contrato.</p>}
      </div> : <>
        <p>Esta ação é <strong>definitiva</strong>. Somente este contrato e suas parcelas serão excluídos. O cliente e os processos não serão alterados.</p>
        <Field label="Para confirmar, digite EXCLUIR"><input value={typed} onChange={(e) => setTyped(e.target.value)} /></Field>
      </>}
      {error && <div role="alert" className="form-error">{error}</div>}
    </div><div className="modal-footer"><Button variant="outline" onClick={close}>Cancelar</Button>{!blocked && <Button variant="destructive" disabled={busy || typed.trim().toUpperCase() !== 'EXCLUIR'} onClick={confirm}>Excluir definitivamente</Button>}</div></Modal>}
  </>;
}
