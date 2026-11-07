// Isolated contract auto-numbering checks (temporary office, cleaned up afterwards).
import { createClient } from '@supabase/supabase-js';
const url=process.env['SUPABASE_URL'],secret=process.env['SUPABASE_SERVICE_ROLE_KEY'],pub=process.env['SUPABASE_PUBLISHABLE_KEY'];
if(!url||!secret||!pub)throw new Error('Server test configuration unavailable');
const client=(key:string)=>createClient(url,key,{auth:{persistSession:false},global:{fetch:(input,init)=>{const h=new Headers(init?.headers);if(h.get('Authorization')===`Bearer ${key}`)h.delete('Authorization');h.set('apikey',key);return fetch(input,{...init,headers:h});}}});
const admin=client(secret);let org='',user='';
function check(n:string,v:unknown){if(!v)throw new Error(n);console.log('PASS: '+n);}
try{
 const email=`numbering-${crypto.randomUUID()}@example.com`,password=crypto.randomUUID()+'Aa!';
 const u=await admin.auth.admin.createUser({email,password,email_confirm:true});user=u.data.user!.id;
 org=(await admin.from('organizations').insert({name:'Numbering check',status:'active'}).select('id').single()).data!.id;
 await admin.from('organization_members').insert({organization_id:org,user_id:user,role:'member',email,can_legal:true,can_finance:true,is_general_admin:true});
 const db=client(pub);await db.auth.signInWithPassword({email,password});
 const c=(await db.from('clients').insert({name:'Numbering customer'}).select('id').single()).data!.id;
 const year=new Date().toLocaleDateString('en-CA',{timeZone:'America/Sao_Paulo'}).slice(0,4),date=`${year}-01-10`;
 const args={p_client:c,p_subject:'Teste',p_responsible:'Pessoa',p_modality:'Fixos',p_total:100,p_signed:date,p_schedule:[{label:'Única',amount:100,due_date:date}],p_notes:'',p_method:'Pix'};
 for(const n of ['CT-2026 01','CT - 2026 003','CT-2026 005'])await db.rpc('create_contract_review',{...args,p_number:n});
 check('Preview continues after highest existing number',(await db.rpc('next_contract_number')).data===`CT-${year} 006`);
 const results=await Promise.all(Array.from({length:6},()=>db.rpc('create_contract_auto',args)));
 check('Simultaneous creations all succeed',results.every(r=>!r.error));
 const nums=(await db.from('contracts').select('number').eq('organization_id',org)).data!.map(x=>x.number);
 const auto=nums.filter(n=>n.startsWith(`CT-${year} 0`)&&!['CT-2026 01','CT-2026 005'].includes(n)).sort();
 check('Simultaneous creations got unique sequential numbers',JSON.stringify(auto)===JSON.stringify(['006','007','008','009','010','011'].map(x=>`CT-${year} ${x}`)));
 check('Existing numbers untouched',['CT-2026 01','CT - 2026 003','CT-2026 005'].every(n=>nums.includes(n)));
 const last=(await db.from('contracts').select('id').eq('number',`CT-${year} 011`).single()).data!.id;
 await db.rpc('delete_contract',{p_contract:last});
 check('Deleted number is not reused',(await db.rpc('next_contract_number')).data===`CT-${year} 012`);
 check('Anonymous caller cannot generate numbers',Boolean((await client(pub).rpc('next_contract_number')).error));
}finally{
 if(org){for(const t of ['payments','installments','finance_events','audit_log','contracts','clients','organization_members','contract_number_counters'] as const)await admin.from(t).delete().eq('organization_id',org);await admin.from('organizations').delete().eq('id',org);}
 if(user)await admin.auth.admin.deleteUser(user);
}
