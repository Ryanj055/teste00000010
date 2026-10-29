// Isolated financial integration checks. Credentials come from server environment only.
import { createClient } from '@supabase/supabase-js';
const url=process.env['SUPABASE_URL'],secret=process.env['SUPABASE_SERVICE_ROLE_KEY'],pub=process.env['SUPABASE_PUBLISHABLE_KEY'];
if(!url||!secret||!pub)throw new Error('Server test configuration unavailable');
const client=(key:string)=>createClient(url,key,{auth:{persistSession:false},global:{fetch:(input,init)=>{const h=new Headers(init?.headers);if(h.get('Authorization')===`Bearer ${key}`)h.delete('Authorization');h.set('apikey',key);return fetch(input,{...init,headers:h});}}});
const admin=client(secret),orgs:string[]=[],users:string[]=[];let passed=0;
function check(name:string,value:unknown){if(!value)throw new Error(name);passed++;console.log(`PASS: ${name}`);}
function unwrap<T>(r:{data:T|null;error:unknown}):T{if(r.error||r.data===null)throw new Error('Test setup or operation failed');return r.data;}
async function account(rtg=false){const email=`review-check-${crypto.randomUUID()}@example.com`,password=crypto.randomUUID()+'Aa!';const u=unwrap(await admin.auth.admin.createUser({email,password,email_confirm:true}));if(!u.user)throw new Error('Missing test user');users.push(u.user.id);const db=client(pub);unwrap(await db.auth.signInWithPassword({email,password}));if(rtg){unwrap(await admin.from('rtg_admins').insert({user_id:u.user.id}).select('user_id').single());return {db,org:''};}const org=unwrap(await admin.from('organizations').insert({name:'Isolated review checks',status:'active'}).select('id').single()).id;orgs.push(org);unwrap(await admin.from('organization_members').insert({organization_id:org,user_id:u.user.id,role:'member',email,can_legal:true,can_finance:true}).select('id').single());return {db,org};}
try{
 const a=await account(),b=await account(),r=await account(true),db=a.db;
 const date=new Date().toLocaleDateString('en-CA',{timeZone:'America/Sao_Paulo'});
 const customer=unwrap(await db.from('clients').insert({name:'Review test customer'}).select('id').single()).id;
 const unused=unwrap(await db.from('clients').insert({name:'Unlinked test customer'}).select('id').single()).id;
 unwrap(await db.rpc('remove_client',{p_client:unused,p_archive:false}));check('Unlinked client can be removed',unwrap(await db.from('clients').select('id').eq('id',unused)).length===0);
 const contract=unwrap(await db.rpc('create_contract_review',{p_client:customer,p_number:'REVIEW-1',p_subject:'Integration check',p_responsible:'Responsible person',p_modality:'Parcelados',p_total:1000,p_signed:date,p_schedule:[{label:'P1',amount:500,due_date:date},{label:'P2',amount:500,due_date:date}],p_notes:'',p_method:'Transferência bancária'}));
 const inst=unwrap(await db.from('receivables').select('*').eq('contract_id',contract).order('label'));const first=inst[0]?.id;if(!first)throw new Error('Missing installment');
 const key=crypto.randomUUID(),args={p_installment:first,p_amount:400,p_date:date,p_method:'Pix',p_key:key,p_reference:'Test receipt',p_notes:''};
 const payment=unwrap(await db.rpc('record_payment',args));check('Same payment key is idempotent',unwrap(await db.rpc('record_payment',args))===payment);
 check('Overpayment is rejected',Boolean((await db.rpc('record_payment',{...args,p_amount:101,p_key:crypto.randomUUID()})).error));
 check('Expected method does not replace actual payment',unwrap(await db.from('payments').select('method').eq('id',payment).single()).method==='Pix');
 const associates=unwrap(await db.from('associates').insert([{name:'Participant A'},{name:'Participant B'}]).select('id,name').order('name'));const one=associates[0]?.id,two=associates[1]?.id;if(!one||!two)throw new Error('Missing associates');
 const division=unwrap(await db.rpc('save_fee_division',{p_contract:contract,p_basis:'received',p_mode:'percent',p_allocations:[{associate_id:one,value:60},{associate_id:two,value:40}],p_reason:'Explicit 60/40 allocation'}));
 check('Percentages must total 100',Boolean((await db.rpc('save_fee_division',{p_contract:contract,p_basis:'received',p_mode:'percent',p_allocations:[{associate_id:one,value:60}],p_reason:'Invalid total'})).error));
 check('Fixed amounts must match base',Boolean((await db.rpc('save_fee_division',{p_contract:contract,p_basis:'received',p_mode:'fixed',p_allocations:[{associate_id:one,value:399}],p_reason:'Invalid total'})).error));
 const payoutArgs={p_division:division,p_associate:one,p_amount:240,p_date:date,p_method:'Pix',p_key:crypto.randomUUID(),p_reference:'Effective payout'};
 const payout=unwrap(await db.rpc('record_fee_payout',payoutArgs));check('Payout retry is idempotent',unwrap(await db.rpc('record_fee_payout',payoutArgs))===payout);
 check('Payout cannot exceed received 60% share',Boolean((await db.rpc('record_fee_payout',{...payoutArgs,p_amount:1,p_key:crypto.randomUUID()})).error));
 check('Receipt reversal waits for payout reversal',Boolean((await db.rpc('void_financial_entry',{p_id:payment,p_kind:'payment',p_reason:'Correction test'})).error));
 const replacement=unwrap(await db.rpc('save_fee_division',{p_contract:contract,p_basis:'received',p_mode:'percent',p_allocations:[{associate_id:one,value:60},{associate_id:two,value:40}],p_reason:'New audited version'}));
 check('Previous payout remains counted across versions',Boolean((await db.rpc('record_fee_payout',{...payoutArgs,p_division:replacement,p_amount:1,p_key:crypto.randomUUID()})).error));
 check('Prior division is retained',unwrap(await db.from('fee_divisions').select('id').eq('contract_id',contract)).length===2);
 check('Payout reversal succeeds',!(await db.rpc('void_financial_entry',{p_id:payout,p_kind:'payout',p_reason:'Reverse payout test'})).error);
 unwrap(await db.rpc('renegotiate_contract',{p_contract:contract,p_schedule:[{label:'New 1',amount:300,due_date:date},{label:'New 2',amount:300,due_date:date}],p_reason:'Reconcile remaining balance'}));
 const after=unwrap(await db.from('receivables').select('amount,paid,balance').eq('contract_id',contract));const sum=(key:'amount'|'paid'|'balance')=>after.reduce((s,x)=>s+Math.round(Number(x[key])*100),0);
 check('Renegotiation preserves 1000 contracted, 400 paid, 600 open',sum('amount')===100000&&sum('paid')===40000&&sum('balance')===60000);
 check('Superseded installments are archived',unwrap(await db.from('installments').select('id').eq('contract_id',contract).eq('superseded',true)).length===1);
 check('Old schedule snapshot remains auditable',unwrap(await db.from('finance_events').select('id').eq('entity_id',contract).eq('action','Cronograma anterior')).length===1);
 check('Receipt reversal after renegotiation succeeds',!(await db.rpc('void_financial_entry',{p_id:payment,p_kind:'payment',p_reason:'Correct receipt after renegotiation'})).error);
 check('Reversal reopens exactly 1000, not a new fee',unwrap(await db.from('receivables').select('balance').eq('contract_id',contract)).reduce((s,x)=>s+Math.round(Number(x.balance)*100),0)===100000);
 check('Receipt ledger reconciles reversal to zero',unwrap(await db.from('receipt_ledger').select('amount')).reduce((s,x)=>s+Math.round(Number(x.amount)*100),0)===0);
 check('Payout ledger reconciles reversal to zero',unwrap(await db.from('payout_ledger').select('amount')).reduce((s,x)=>s+Math.round(Number(x.amount)*100),0)===0);
  check('Contract with open balance cannot be closed',Boolean((await db.rpc('close_contract',{p_contract:contract,p_note:''})).error));
  const paidContract=unwrap(await db.rpc('create_contract_review',{p_client:customer,p_number:'REVIEW-2',p_subject:'Close check',p_responsible:'Responsible person',p_modality:'Fixos',p_total:100,p_signed:date,p_schedule:[{label:'Única',amount:100,due_date:date}],p_notes:'',p_method:'Pix'}));
  const only=unwrap(await db.from('receivables').select('id').eq('contract_id',paidContract))[0]?.id;if(!only)throw new Error('Missing installment');
  unwrap(await db.rpc('record_payment',{p_installment:only,p_amount:100,p_date:date,p_method:'Pix',p_key:crypto.randomUUID(),p_reference:'',p_notes:''}));
  check('Settled contract is still active before closing',unwrap(await db.from('contracts').select('status').eq('id',paidContract).single()).status==='Ativo');
  check('Settled contract can be closed',!(await db.rpc('close_contract',{p_contract:paidContract,p_note:'Quitado'})).error);
  check('Closed contract keeps status and history',unwrap(await db.from('contracts').select('status').eq('id',paidContract).single()).status==='Encerrado'&&unwrap(await db.from('receivables').select('paid').eq('contract_id',paidContract)).length===1&&unwrap(await db.from('payments').select('id').eq('installment_id',only)).length===1);
  check('Closed contract cannot be closed twice',Boolean((await db.rpc('close_contract',{p_contract:paidContract,p_note:''})).error));
 check('Linked client cannot be deleted',Boolean((await db.rpc('remove_client',{p_client:customer,p_archive:false})).error));
 unwrap(await db.rpc('remove_client',{p_client:customer,p_archive:true}));check('Linked client archive preserves contract',unwrap(await db.from('contracts').select('id').eq('id',contract)).length===1);
 for(const t of ['fee_divisions','fee_payouts','associates','finance_events','receipt_ledger','payout_ledger'] as const){check(`Other office cannot read ${t}`,unwrap(await b.db.from(t).select('*')).length===0);check(`RTG cannot read ${t}`,unwrap(await r.db.from(t).select('*')).length===0);}
 check('Other office cannot change financial entry',Boolean((await b.db.rpc('void_financial_entry',{p_id:payment,p_kind:'payment',p_reason:'Tenant violation'})).error));
 console.log(`${passed} isolated financial checks passed.`);
}finally{
 for(const org of orgs){for(const table of ['fee_payouts','fee_divisions','finance_events','associates','legal_cases','payments','installments','contracts','expenses','clients','audit_log','admin_events','organization_members'] as const){const result=await admin.from(table).delete().eq('organization_id',org);if(result.error)throw new Error(`Temporary cleanup failed: ${table}`);}const result=await admin.from('organizations').delete().eq('id',org);if(result.error)throw new Error('Temporary office cleanup failed');}
 if(users.length){await admin.from('rtg_admins').delete().in('user_id',users);for(const id of users){const result=await admin.auth.admin.deleteUser(id);if(result.error)throw new Error('Temporary account cleanup failed');}}
}