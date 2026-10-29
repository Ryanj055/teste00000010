import { createOpenAI } from '@ai-sdk/openai';

const GATEWAY = 'https://ai.gateway.lovable.dev/v1';
export const DEFAULT_MODEL = 'openai/gpt-6-astra';

/** Provedor da IA do Lovable criado a cada requisição; a chave fica só no servidor. */
export function lovableResponses() {
  const apiKey = process.env['LOVABLE_API_KEY'];
  if (!apiKey) throw new Error('A inteligência artificial não está configurada.');
  let runId: string | undefined;
  const fetchWithRun = async (input: RequestInfo | URL, init?: RequestInit) => {
    const headers = new Headers(init?.headers);
    if (runId && !headers.has('X-Lovable-AIG-Run-ID')) headers.set('X-Lovable-AIG-Run-ID', runId);
    const res = await fetch(input, { ...init, headers });
    runId ??= res.headers.get('X-Lovable-AIG-Run-ID')?.trim() || undefined;
    return res;
  };
  return createOpenAI({ baseURL: GATEWAY, apiKey, headers: { 'Lovable-API-Key': apiKey, 'X-Lovable-AIG-SDK': 'vercel-ai-sdk' }, fetch: fetchWithRun });
}
