import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';

export type AccessSuggestion = { legal: boolean; finance: boolean; rationale: string };

const INSTRUCTIONS = `Você ajuda a administração de um escritório de advocacia brasileiro a definir acessos de uma pessoa da equipe no sistema "Gestão Jurídica e Financeira".
Existem só dois acessos:
- Jurídico: clientes e processos jurídicos (consulta e edição).
- Financeiro: contratos, honorários, cobranças, recebimentos, despesas, divisão de honorários, repasses e relatórios financeiros.
Aplique o princípio do menor privilégio: recomende o financeiro somente quando as responsabilidades descritas exigirem lidar com valores, cobranças, pagamentos, despesas ou relatórios financeiros. Recomende o jurídico quando a pessoa atender clientes ou acompanhar processos. Se a descrição for vaga, seja conservador.
Nunca recomende funções administrativas; isso não faz parte da sua resposta.
Escreva a justificativa em português do Brasil, com linguagem neutra quanto a gênero, em no máximo 3 frases, sem repetir dados pessoais.`;

/** Sugere acessos a partir das responsabilidades descritas. Não altera nada: quem aplica é a administração, pela regra de acesso já existente. */
export const suggestAccess = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ responsibilities: z.string().trim().min(10).max(2000) }).parse(i))
  .handler(async ({ data, context }): Promise<AccessSuggestion> => {
    const [{ data: rtg }, { data: admin }] = await Promise.all([context.supabase.rpc('is_rtg_admin'), context.supabase.rpc('is_general_admin')]);
    if (!rtg && !admin) throw new Error('Somente a administração do escritório pode usar a sugestão de acessos.');
    const [{ streamText, Output, NoObjectGeneratedError }, { lovableResponses, DEFAULT_MODEL }] = await Promise.all([import('ai'), import('./ai-gateway.server')]);
    const schema = z.object({ legal: z.boolean(), finance: z.boolean(), rationale: z.string() });
    const result = streamText({
      model: lovableResponses().responses(DEFAULT_MODEL),
      instructions: INSTRUCTIONS,
      messages: [{ role: 'user', content: `Responsabilidades descritas pela administração:\n"""${data.responsibilities}"""` }],
      output: Output.object({ schema }),
      maxRetries: 0,
      providerOptions: { openai: { store: false, forceReasoning: true, reasoningEffort: 'low', reasoningSummary: 'auto', include: ['reasoning.encrypted_content'] } },
    });
    try {
      const out = await result.output;
      return { legal: out.legal, finance: out.finance, rationale: out.rationale.slice(0, 600) };
    } catch (err) {
      if (NoObjectGeneratedError.isInstance(err)) throw new Error('A sugestão não pôde ser gerada. Reformule a descrição e tente de novo.');
      const status = (err as { statusCode?: number }).statusCode;
      console.error('suggestAccess', status, err);
      if (status === 429) throw new Error('Muitas solicitações no momento. Aguarde um minuto e tente de novo.');
      if (status === 402 || status === 403) throw new Error('A sugestão por inteligência artificial está indisponível no momento (créditos ou permissão do espaço de trabalho).');
      throw new Error('Não foi possível gerar a sugestão agora. Tente novamente mais tarde.');
    }
  });
