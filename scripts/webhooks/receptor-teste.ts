// Receptor de teste dos webhooks (Fase 5C, tarefa 4, etapa 4.2): SÓ HOMOLOGAÇÃO.
// Faz o papel do sistema do cliente: confere a assinatura Standard Webhooks e
// o horário, descarta o webhook-id repetido e responde. Não guarda o corpo.
//
// Fica fora de supabase/functions de propósito: o deploy de produção publica
// a pasta inteira. Para publicar na homologação (infra/webhooks.md):
//   mkdir supabase/functions/webhook-receptor-teste
//   cp scripts/webhooks/receptor-teste.ts supabase/functions/webhook-receptor-teste/index.ts
//   npx supabase functions deploy webhook-receptor-teste --no-verify-jwt --project-ref kswurfyxxvfydpjfrivy
//   rm -r supabase/functions/webhook-receptor-teste
//
// O segredo do destino vai na própria URL do destino de teste (?segredo=whsec_...),
// para não depender de segredo de função. Só serve para destino temporário de teste.
// ?status=503 (ou outro) força a resposta, para testar as novas tentativas.
// Cada chamada aparece no log da função: tipo, webhook-id, assinatura ok ou não.

const vistos = new Set<string>()

async function assinatura(segredo: string, id: string, ts: string, corpo: string): Promise<string> {
  const bytes = Uint8Array.from(atob(segredo.replace(/^whsec_/, '')), (c) => c.charCodeAt(0))
  const chave = await crypto.subtle.importKey('raw', bytes, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const mac = new Uint8Array(await crypto.subtle.sign('HMAC', chave, new TextEncoder().encode(`${id}.${ts}.${corpo}`)))
  return btoa(String.fromCharCode(...mac))
}

Deno.serve(async (req) => {
  const url = new URL(req.url)
  const id = req.headers.get('webhook-id') ?? ''
  const ts = req.headers.get('webhook-timestamp') ?? ''
  const recebidas = (req.headers.get('webhook-signature') ?? '').split(' ').map((s) => s.split(',')[1]).filter(Boolean)
  const corpo = await req.text()
  const segredo = url.searchParams.get('segredo') ?? ''
  const esperada = segredo && id && ts ? await assinatura(segredo, id, ts, corpo) : ''
  const assinaturaOk = esperada !== '' && recebidas.includes(esperada)
  const horarioOk = Math.abs(Date.now() / 1000 - Number(ts)) <= 300
  let tipo = '?'
  try { tipo = JSON.parse(corpo).type } catch { /* corpo inválido */ }
  const repetido = vistos.has(id)
  console.log(JSON.stringify({ receptor: 'teste', tipo, webhook_id: id, assinatura_ok: assinaturaOk, horario_ok: horarioOk, repetido }))
  if (!assinaturaOk || !horarioOk) return new Response('assinatura ou horário inválido', { status: 401 })
  const forcado = Number(url.searchParams.get('status') ?? '0')
  if (forcado) return new Response('forçado pelo teste', { status: forcado })
  vistos.add(id)
  return new Response(null, { status: 204 })
})
