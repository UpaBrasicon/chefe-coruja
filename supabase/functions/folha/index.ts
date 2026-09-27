// Edge Function: folha
//
// Monta no SERVIDOR a folha A4 de um documento assistencial já emitido
// (Fase 4.2). Roda com o token de quem imprime: a RPC folha_documento confere
// o acesso, registra a impressão e devolve o conteúdo gravado no banco, que é
// o que vai para o papel. O navegador só imprime o HTML devolvido.
//
// POST { documento_id, tipo_impressao?, origem } → text/html
//   origem: endereço do app (as imagens de fundo das folhas moram nele).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { montarFolha, rodapeEmitido, type TipoFolha } from '../_shared/folhas.ts'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const TIPOS: TipoFolha[] = ['atestado', 'receita', 'encaminhamento', 'pedido_exames', 'prescricao', 'laudo_aih']

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
  // só aceita origem http(s) sem caminho — ela entra em <img src>
  const origem = /^https?:\/\/[^/\s"'<>]+$/.test(corpo.origem ?? '') ? corpo.origem! : ''

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: auth } },
  })
  const { data, error } = await supabase.rpc('folha_documento', {
    p_documento: corpo.documento_id,
    p_tipo_impressao: corpo.tipo_impressao ?? null,
  })
  if (error) return erro(403, error.message)
  const d = data as { tipo: TipoFolha; conteudo: string; numero: string; versao: number; autor: string; codigo: string; protocolo: string; impresso_em: string }
  if (!TIPOS.includes(d.tipo)) return erro(422, 'Este tipo de documento ainda não tem folha no servidor.')

  let conteudo: unknown
  try {
    conteudo = JSON.parse(d.conteudo)
  } catch {
    return erro(422, 'Conteúdo do documento ilegível.')
  }
  const emitido = new Date(d.impresso_em).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })
  const html = montarFolha(d.tipo, conteudo, rodapeEmitido({
    numero: d.numero, versao: d.versao, protocolo: d.protocolo, emitido, autor: d.autor ?? '—', codigo: d.codigo,
  }), origem)
  return new Response(html, { headers: { ...CORS, 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } })
})
