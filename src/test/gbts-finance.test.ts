import { describe, expect, it } from 'vitest';
import { cents, financialStatus, schedule, validatePayment, validDocument } from '@/lib/gbts/finance';
describe('Regras financeiras GBTS',()=>{
 it('concilia entrada e parcelas sem perder centavos',()=>{const rows=schedule(1000,100,3,'2026-10-31');expect(rows.map(x=>x.amount)).toEqual([100,300,300,300]);expect(rows.reduce((s,x)=>s+cents(x.amount),0)).toBe(100000);expect(rows[2]?.due_date).toBe('2026-11-30');});
 it('distribui resto decimal na última parcela',()=>{expect(schedule(100,0,3,'2026-10-15').map(x=>x.amount)).toEqual([33.33,33.33,33.34]);});
 it('mantém atraso após recebimento parcial',()=>{expect(financialStatus(1000,400,'2026-10-01','2026-10-15')).toBe('Vencido');});
 it('identifica pagamento parcial a vencer',()=>{expect(financialStatus(1000,400,'2026-10-20','2026-10-15')).toBe('Parcialmente pago');});
 it('identifica quitação apenas com pagamento real',()=>{expect(financialStatus(1000,1000,'2026-10-01','2026-10-15')).toBe('Pago');expect(financialStatus(1000,0,'2026-10-20','2026-10-15')).toBe('A vencer');});
 it('bloqueia recebimento acima do saldo',()=>{expect(()=>validatePayment(601,600)).toThrow();expect(validatePayment(600,600)).toBe(600);});
 it('exige pagamentos positivos',()=>{expect(()=>validatePayment(0,600)).toThrow();expect(()=>validatePayment(-1,600)).toThrow();});
 it('não permite entrada superior ao contratado',()=>{expect(()=>schedule(100,101,3,'2026-10-15')).toThrow();});
 it('rejeita documentos repetidos e inválidos',()=>{expect(validDocument('11111111111')).toBe(false);expect(validDocument('12345678900')).toBe(false);expect(validDocument('')).toBe(true);});
});