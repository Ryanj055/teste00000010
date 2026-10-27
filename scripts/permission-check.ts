// Verificação das permissões jurídicas, financeiras e da designação RTG. Uso: bun scripts/permission-check.ts (requer variáveis do servidor).
// Cria escritórios e contas temporárias e apaga tudo ao final; não toca nos dados reais.
import { createClient } from '@supabase/supabase-js';
const url=process.env.SUPABASE_URL!, srk=process.env.SUPABASE_SERVICE_ROLE_KEY!, pub=process.env.SUPABASE_PUBLISHABLE_KEY!;
const shim=(key:string)=>({fetch:(i:any,init:any={})=>{const h=new Headers(init.headers);if(h.get('Authorization')===`Bearer ${key}`)h.delete('Authorization');h.set('apikey',key);return fetch(i,{...init,headers:h});}});
const admin=createClient(url,srk,{auth:{persistSession:false},global:shim(srk)});
const pw='T'+crypto.randomUUID()+'!a';const ids:string[]=[];const orgs:string[]=[];const out:string[]=[];let failed=0;
const ok=(name:string,cond:boolean)=>{if(!cond)failed++;out.push(`${cond?'PASSOU':'FALHOU'} · ${name}`);};
async function user(tag:string){const email=`perm-${tag}-${Date.now()}@example.com`;const {data,error}=await admin.auth.admin.createUser({email,password:pw,email_confirm:true});if(error)throw error;ids.push(data.user.id);const c=createClient(url,pub,{auth:{persistSession:false},global:shim(pub)});const s=await c.auth.signInWithPassword({email,password:pw});if(s.error)throw s.error;return {id:data.user.id,email,c};}
const today=new Date().toLocaleDateString('en-CA',{timeZone:'America/Sao_Paulo'});
const rows=async(q:PromiseLike<{data:unknown[]|null}>)=>((await q).data??[]).length;
try{
 const oa=(await admin.from('organizations').insert({name:'Permissões A',status:'active'}).select('id').single()).data!.id;orgs.push(oa);
 const ob=(await admin.from('organizations').insert({name:'Permissões B',status:'active'}).select('id').single()).data!.id;orgs.push(ob);
 const ga=await user('ga'),fin=await user('fin'),leg=await user('leg'),other=await user('other'),rtg=await user('rtg');
 const ins=await admin.from('organization_members').insert([
  {organization_id:oa,user_id:ga.id,email:ga.email,role:'member',can_legal:true,can_finance:true},
  {organization_id:oa,user_id:fin.id,email:fin.email,role:'member',can_legal:false,can_finance:true},
  {organization_id:oa,user_id:leg.id,email:leg.email,role:'member',can_legal:true,can_finance:false},
  {organization_id:ob,user_id:other.id,email:other.email,role:'member',can_legal:true,can_finance:true}]).select('id,user_id');
 const mid=(u:string)=>ins.data!.find(x=>x.user_id===u)!.id;
 ok('Servidor não consegue criar administrador geral sem a RTG',!!(await admin.from('organization_members').update({is_general_admin:true}).eq('id',mid(ga.id))).error);
 await admin.from('rtg_admins').insert({user_id:rtg.id});
 // designação pela RTG
 ok('Membro comum não se designa administrador geral',!!(await leg.c.rpc('rtg_set_general_admin',{p_org:oa,p_member:mid(leg.id)})).error);
 ok('RTG designa o administrador geral',!(await rtg.c.rpc('rtg_set_general_admin',{p_org:oa,p_member:mid(ga.id)})).error);
 ok('RTG não designa conta de outro escritório',!!(await rtg.c.rpc('rtg_set_general_admin',{p_org:oa,p_member:mid(other.id)})).error);
 ok('RTG não designa conta inexistente',!!(await rtg.c.rpc('rtg_set_general_admin',{p_org:oa,p_member:crypto.randomUUID()})).error);
 ok('Administrador geral não transfere a função',!!(await ga.c.rpc('rtg_set_general_admin',{p_org:oa,p_member:mid(fin.id)})).error);
 ok('Administrador geral não se torna RTG',!!(await ga.c.from('rtg_admins').insert({user_id:ga.id})).error&&((await admin.from('rtg_admins').select('user_id').eq('user_id',ga.id)).data??[]).length===0);
 ok('Administrador geral não altera assinatura',!!(await ga.c.rpc('rtg_save_org',{p_id:oa,p_name:'x',p_contact_name:'',p_contact_email:'',p_contact_phone:'',p_support:'',p_plan:'x',p_status:'active',p_trial:null as any,p_start:null as any,p_end:null as any})).error);
 ok('Administrador geral não altera as próprias permissões',!!(await ga.c.rpc('set_member_access',{p_member:mid(ga.id),p_active:true,p_legal:true,p_finance:true})).error);
 ok('Administrador geral não gerencia outro escritório',!!(await ga.c.rpc('set_member_access',{p_member:mid(other.id),p_active:false,p_legal:true,p_finance:false})).error);
 ok('Financeiro não gerencia usuários',!!(await fin.c.rpc('set_member_access',{p_member:mid(leg.id),p_active:true,p_legal:true,p_finance:true})).error);
 ok('Jurídico não concede financeiro a si próprio',!!(await leg.c.rpc('set_member_access',{p_member:mid(leg.id),p_active:true,p_legal:true,p_finance:true})).error);
 // dados de teste no escritório A
 const client=(await ga.c.from('clients').insert({name:'Cliente Permissões'}).select('id').single()).data!.id;
 const ct=await ga.c.rpc('create_contract',{p_client:client,p_number:'P-1',p_subject:'Teste',p_responsible:'Teste',p_modality:'Parcelados',p_total:1000,p_signed:today,p_schedule:[{label:'P1',amount:1000,due_date:today}] as any});
 ok('Administrador geral com financeiro cria contrato',!ct.error);
 const inst=(await ga.c.from('installments').select('id').eq('contract_id',ct.data as string)).data![0]!.id;
 // jurídico sem financeiro
 ok('Jurídico vê clientes',await rows(leg.c.from('clients').select('id'))===1);
 ok('Jurídico cadastra processo',!(await leg.c.from('legal_cases').insert({number:'0001-'+Date.now(),client_id:client,subject:'Teste',responsible:'Teste'})).error);
 for(const t of ['contracts','installments','payments','expenses','associates','fee_divisions','fee_payouts','finance_events','receivables','receipt_ledger','payout_ledger'])ok(`Jurídico não lê ${t}`,await rows(leg.c.from(t as any).select('*'))===0);
 ok('Jurídico não registra recebimento',!!(await leg.c.rpc('record_payment',{p_installment:inst,p_amount:10,p_date:today,p_method:'Pix',p_key:crypto.randomUUID()})).error);
 ok('Jurídico não cria contrato',!!(await leg.c.rpc('create_contract',{p_client:client,p_number:'P-2',p_subject:'x',p_responsible:'x',p_modality:'Parcelados',p_total:10,p_signed:today,p_schedule:[{label:'P1',amount:10,due_date:today}] as any})).error);
 ok('Jurídico não renegocia',!!(await leg.c.rpc('renegotiate_contract',{p_contract:ct.data as string,p_schedule:[{label:'1',amount:1000,due_date:today}] as any,p_reason:'teste'})).error);
 ok('Jurídico não grava despesa',!!(await leg.c.from('expenses').insert({description:'x',category:'x',amount:1,due_date:today})).error);
 ok('Jurídico não cadastra associado',!!(await leg.c.from('associates').insert({name:'x'})).error);
 ok('Jurídico não lê histórico financeiro',await rows(leg.c.from('audit_log').select('id').eq('entity','contracts'))===0);
 // financeiro sem jurídico
 ok('Financeiro registra recebimento',!(await fin.c.rpc('record_payment',{p_installment:inst,p_amount:100,p_date:today,p_method:'Pix',p_key:crypto.randomUUID()})).error);
 ok('Financeiro vê recebíveis',await rows(fin.c.from('receivables').select('id'))===1);
 ok('Financeiro não lê processos',await rows(fin.c.from('legal_cases').select('id'))===0);
 ok('Financeiro não altera cliente',!!(await fin.c.from('clients').insert({name:'x'})).error);
 ok('Financeiro não remove cliente',!!(await fin.c.rpc('remove_client',{p_client:client,p_archive:true})).error);
 // concessão e revogação imediata pelo administrador geral
 ok('Administrador geral concede financeiro',!(await ga.c.rpc('set_member_access',{p_member:mid(leg.id),p_active:true,p_legal:true,p_finance:true})).error);
 ok('Concessão vale imediatamente',await rows(leg.c.from('contracts').select('id'))===1);
 ok('Administrador geral revoga financeiro',!(await ga.c.rpc('set_member_access',{p_member:mid(leg.id),p_active:true,p_legal:true,p_finance:false})).error);
 ok('Revogação vale imediatamente',await rows(leg.c.from('contracts').select('id'))===0);
 // substituição e proteção do administrador geral
 ok('Administrador geral não pode ser desativado',!!(await admin.from('organization_members').update({active:false}).eq('id',mid(ga.id))).error);
 ok('RTG substitui o administrador geral',!(await rtg.c.rpc('rtg_set_general_admin',{p_org:oa,p_member:mid(fin.id)})).error);
 const after=(await admin.from('organization_members').select('id,is_general_admin,can_legal,can_finance').eq('organization_id',oa)).data!;
 ok('Anterior perde a função e só um permanece',after.filter(x=>x.is_general_admin).length===1&&after.find(x=>x.id===mid(fin.id))!.is_general_admin);
 ok('Substituição não altera acessos de módulo',after.find(x=>x.id===mid(fin.id))!.can_legal===false&&after.find(x=>x.id===mid(ga.id))!.can_finance===true);
 ok('Antigo administrador não gerencia mais',!!(await ga.c.rpc('set_member_access',{p_member:mid(leg.id),p_active:true,p_legal:true,p_finance:true})).error);
 ok('Histórico registra as designações',((await admin.from('admin_events').select('id').eq('organization_id',oa).eq('action','Administrador geral designado')).data??[]).length===2);
 // RTG e isolamento
 ok('RTG não lê clientes',await rows(rtg.c.from('clients').select('id'))===0);
 ok('RTG não lê recebimentos',await rows(rtg.c.from('payments').select('id'))===0);
 ok('Outro escritório não lê clientes de A',await rows(other.c.from('clients').select('id').eq('organization_id',oa))===0);
 await admin.from('organizations').update({status:'suspended'}).eq('id',oa);
 ok('Assinatura suspensa bloqueia financeiro',await rows(fin.c.from('receivables').select('id'))===0);
}catch(e){failed++;out.push('ERRO '+(e as Error).message);}finally{
 for(const o of orgs){for(const t of ['fee_payouts','fee_divisions','associates','finance_events','audit_log','payments','installments','contracts','legal_cases','expenses','clients','admin_events','organization_members'])await admin.from(t).delete().eq('organization_id',o);await admin.from('organizations').delete().eq('id',o);}
 await admin.from('rtg_admins').delete().in('user_id',ids);
 for(const id of ids)await admin.auth.admin.deleteUser(id);
}
console.log(out.join('\n'));console.log(`\n${out.length-failed} de ${out.length} verificações aprovadas.`);
