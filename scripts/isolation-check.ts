// Verificação de isolamento entre escritórios. Uso: bun scripts/isolation-check.ts (requer variáveis do servidor).
import { createClient } from '@supabase/supabase-js';
const url=process.env.SUPABASE_URL!, srk=process.env.SUPABASE_SERVICE_ROLE_KEY!, pub=process.env.SUPABASE_PUBLISHABLE_KEY!;
const shim=(key:string)=>({fetch:(i:any,init:any={})=>{const h=new Headers(init.headers);if(h.get('Authorization')===`Bearer ${key}`)h.delete('Authorization');h.set('apikey',key);return fetch(i,{...init,headers:h});}});
const admin=createClient(url,srk,{auth:{persistSession:false},global:shim(srk)});
const pw='T'+crypto.randomUUID()+'!a';const ids:string[]=[];const out:string[]=[];
const ok=(name:string,cond:boolean)=>{out.push(`${cond?'PASSOU':'FALHOU'} · ${name}`);};
async function user(email:string){const {data,error}=await admin.auth.admin.createUser({email,password:pw,email_confirm:true});if(error)throw error;ids.push(data.user.id);const c=createClient(url,pub,{auth:{persistSession:false},global:shim(pub)});const s=await c.auth.signInWithPassword({email,password:pw});if(s.error)throw s.error;return {id:data.user.id,c};}
let ORG_A='',orgB='';const day=new Date().toLocaleDateString('en-CA',{timeZone:'America/Sao_Paulo'});
try{
 const a=await user(`iso-a-${Date.now()}@example.com`),b=await user(`iso-b-${Date.now()}@example.com`),r=await user(`iso-rtg-${Date.now()}@example.com`);
 ORG_A=(await admin.from('organizations').insert({name:'Teste isolamento A',status:'active'}).select('id').single()).data!.id;
 const ob=await admin.from('organizations').insert({name:'Teste isolamento B',status:'active'}).select('id').single();orgB=ob.data!.id;
 await admin.from('organization_members').insert([{organization_id:ORG_A,user_id:a.id,role:'member',email:'a',can_finance:true},{organization_id:orgB,user_id:b.id,role:'member',email:'b',can_finance:true}]);
 const seed=(await a.c.from('clients').insert({name:'Cliente Teste A'}).select('id').single()).data!.id;await a.c.rpc('create_contract',{p_client:seed,p_number:'A-1',p_subject:'Teste',p_responsible:'Teste',p_modality:'Parcelados',p_total:100,p_signed:day,p_schedule:[{label:'P1',amount:100,due_date:day}] as any});
 await admin.from('rtg_admins').insert({user_id:r.id});
 const aCount=(await a.c.from('clients').select('id',{count:'exact',head:true})).count??0;ok(`Escritório A vê os próprios clientes (${aCount})`,aCount>0);
 ok('Escritório B não vê clientes de A',((await b.c.from('clients').select('id')).data??[]).length===0);
 ok('Escritório B não vê recebíveis de A',((await b.c.from('receivables').select('id')).data??[]).length===0);
 ok('Escritório B não grava no escritório A',!!(await b.c.from('clients').insert({name:'Intruso',organization_id:ORG_A})).error);
 const aInst=(await a.c.from('installments').select('id').limit(1)).data![0]!.id;
 ok('Escritório B não registra pagamento em parcela de A',!!(await b.c.rpc('record_payment',{p_installment:aInst,p_amount:1,p_date:new Date().toISOString().slice(0,10),p_method:'Pix',p_key:crypto.randomUUID()})).error);
 const aClient=(await a.c.from('clients').select('id').limit(1)).data![0]!.id;
 ok('Escritório B não altera cliente de A',((await b.c.from('clients').update({notes:'x'}).eq('id',aClient).select('id')).data??[]).length===0);
 const cb=await b.c.from('clients').insert({name:'Cliente Teste B'}).select('id,organization_id').single();ok('Cliente de B fica no escritório B',cb.data?.organization_id===orgB);
 ok('Escritório A não vê cliente de B',((await a.c.from('clients').select('id').eq('id',cb.data!.id)).data??[]).length===0);
 ok('RTG não vê clientes',((await r.c.from('clients').select('id')).data??[]).length===0);
 ok('RTG não vê pagamentos',((await r.c.from('payments').select('id')).data??[]).length===0);
 ok('RTG vê escritórios',((await r.c.from('organizations').select('id')).data??[]).length>=2);
 ok('Usuária comum não altera assinatura',!!(await b.c.rpc('rtg_save_org',{p_id:orgB,p_name:'x',p_contact_name:'',p_contact_email:'',p_contact_phone:'',p_support:'',p_plan:'x',p_status:'active',p_trial:null as any,p_start:null as any,p_end:null as any})).error);
 // contrato, pagamento parcial e renegociação em B
 const today=day;
 const ct=await b.c.rpc('create_contract',{p_client:cb.data!.id,p_number:'T-1',p_subject:'Teste',p_responsible:'Gabriella Barreto',p_modality:'Parcelados',p_total:1000,p_signed:today,p_schedule:[{label:'P1',amount:500,due_date:today},{label:'P2',amount:500,due_date:today}] as any});
 ok('Contrato criado com cronograma',!ct.error);
 const inst=(await b.c.from('receivables').select('id,label').eq('contract_id',ct.data as string).order('label')).data!;
 ok('Pagamento parcial registrado',!(await b.c.rpc('record_payment',{p_installment:inst[0]!.id!,p_amount:300,p_date:today,p_method:'Pix',p_key:crypto.randomUUID()})).error);
 ok('Pagamento acima do saldo recusado',!!(await b.c.rpc('record_payment',{p_installment:inst[0]!.id!,p_amount:300,p_date:today,p_method:'Pix',p_key:crypto.randomUUID()})).error);
 ok('Renegociação com total errado recusada',!!(await b.c.rpc('renegotiate_contract',{p_contract:ct.data as string,p_schedule:[{label:'1/1',amount:100,due_date:today}] as any,p_reason:'teste'})).error);
 ok('Renegociação do saldo de R$ 700',!(await b.c.rpc('renegotiate_contract',{p_contract:ct.data as string,p_schedule:[{label:'1/2',amount:350,due_date:today},{label:'2/2',amount:350,due_date:today}] as any,p_reason:'Acordo'})).error);
 const after=(await b.c.from('receivables').select('amount,paid,balance,status').eq('contract_id',ct.data as string)).data!;
 const sum=(k:'amount'|'paid'|'balance')=>after.reduce((s,x)=>s+Number(x[k]),0);
 ok(`Após renegociar: total ${sum('amount')}, pago ${sum('paid')}, saldo ${sum('balance')}`,sum('amount')===1000&&sum('paid')===300&&sum('balance')===700);
 await admin.from('organizations').update({status:'suspended'}).eq('id',orgB);
 ok('Escritório suspenso não acessa clientes',((await b.c.from('clients').select('id')).data??[]).length===0);
 ok('Escritório suspenso não grava',!!(await b.c.from('clients').insert({name:'Depois da suspensão'})).error);
 ok('Dados preservados na suspensão',((await admin.from('clients').select('id').eq('organization_id',orgB)).data??[]).length===1);
 await admin.from('organizations').update({status:'trial',trial_ends_at:'2020-01-01'}).eq('id',orgB);
 ok('Teste vencido bloqueia pela data do servidor',((await b.c.from('clients').select('id')).data??[]).length===0);
}catch(e){out.push('ERRO '+(e as Error).message);}finally{
 for(const o of [ORG_A,orgB].filter(Boolean)){for(const t of ['finance_events','audit_log','payments','installments','contracts','clients','admin_events','organization_members'])await admin.from(t).delete().eq('organization_id',o);await admin.from('organizations').delete().eq('id',o);}
 await admin.from('organization_members').delete().in('user_id',ids);await admin.from('rtg_admins').delete().in('user_id',ids);
 for(const id of ids)await admin.auth.admin.deleteUser(id);
}
console.log(out.join('\n'));
