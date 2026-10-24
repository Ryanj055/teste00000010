import { describe, expect, it } from 'vitest';
import { allocate, deadlineState } from '@/lib/gbts/review';
describe('Divisão e prazos administrativos',()=>{
  it('divide R$ 1.000 em 60% e 40%',()=>expect(allocate(1000,'percent',[{associate_id:'a',value:60},{associate_id:'b',value:40}]).map(x=>x.amount)).toEqual([600,400]));
  it('exige 100% sem retenção',()=>expect(()=>allocate(1000,'percent',[{associate_id:'a',value:60}])).toThrow());
  it('concilia valores fixos com o montante',()=>{expect(()=>allocate(1000,'fixed',[{associate_id:'a',value:999}])).toThrow();expect(allocate(1000,'fixed',[{associate_id:'a',value:1000}])[0]?.amount).toBe(1000);});
  it('preserva centavos com resto na última participação',()=>expect(allocate(100.01,'percent',[{associate_id:'a',value:60},{associate_id:'b',value:40}]).map(x=>x.amount)).toEqual([60,40.01]));
  it('não classifica ativo sem prazo como em dia',()=>expect(deadlineState(null,'Em andamento','2026-10-23').label).toBe('Sem prazo'));
  it('usa prazo real vencido',()=>expect(deadlineState('2026-10-22','Em andamento','2026-10-23')).toEqual({label:'Vencido',days:-1}));
  it('identifica sete dias próximos sem inventar prazo',()=>{expect(deadlineState('2026-10-30','Em andamento','2026-10-23').label).toBe('Próximo');expect(deadlineState('2026-10-31','Em andamento','2026-10-23').label).toBe('Em dia');});
});