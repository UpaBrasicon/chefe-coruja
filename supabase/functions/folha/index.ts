// Edge Function: folha
//
// Monta no SERVIDOR a folha A4 de um documento assistencial já emitido
// (Fase 4.2). Roda com o token de quem imprime: a RPC folha_documento confere
// o acesso, registra a impressão e devolve o conteúdo gravado no banco, que é
// o que vai para o papel. O navegador só imprime o HTML devolvido.
//
// POST { documento_id, tipo_impressao? } → text/html
//   (origem ainda é aceita e ignorada: as folhas não usam mais imagem de fundo)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { folhaDoRegistro } from '../_shared/folhas.ts'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function erro(status: number, mensagem: string) {
  return new Response(JSON.stringify({ erro: mensagem }), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return erro(405, 'Use POST.')
  const auth = req.headers.get('Authorization')
  if (!auth) return erro(401, 'Sem sessão.')

  let corpo: { documento_id?: string; tipo_impressao?: string; origem?: string }
  try {
    corpo = await req.json()
  } catch {
    return erro(400, 'Corpo inválido.')
  }
  if (!corpo.documento_id) return erro(400, 'Informe o documento.')

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: auth } },
  })
  const { data, error } = await supabase.rpc('folha_documento', {
    p_documento: corpo.documento_id,
    p_tipo_impressao: corpo.tipo_impressao ?? null,
  })
  if (error) return erro(403, error.message)

  let html: string
  try {
    html = folhaDoRegistro(data as Parameters<typeof folhaDoRegistro>[0])
  } catch {
    return erro(422, 'Conteúdo do documento ilegível.')
  }
  return new Response(html, { headers: { ...CORS, 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } })
})
