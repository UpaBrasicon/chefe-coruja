// Edge Function: folha
//
// Monta no SERVIDOR a folha A4 de um documento assistencial (Fase 4.2) ou de
// um relatório de várias linhas (onda 6). Roda com o token de quem imprime:
// as RPCs folha_documento / folha_relatorio conferem o acesso, registram a
// impressão e devolvem o que está gravado no banco, que é o que vai para o
// papel. O navegador só imprime o HTML devolvido.
//
// POST { documento_id, tipo_impressao? } → text/html
// POST { relatorio, paciente_id?, internacao_id?, episodio_id?, ids? } → text/html
// POST { relatorio: 'notificaveis', unidade_id, de?, ate?, cids? } → text/html (folha 08)
//   (origem ainda é aceita e ignorada: as folhas não usam mais imagem de fundo)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { contextoDoBanco, folhaDoRegistro, montarRelatorio, type TipoRelatorio } from '../_shared/folhas.ts'
import { chavePublica } from '../_shared/chaves.ts'
import { comRelato, relatarErro } from '../_shared/sentry.ts'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function erro(status: number, mensagem: string) {
  return new Response(JSON.stringify({ erro: mensagem }), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })
}
const html = (h: string) => new Response(h, { headers: { ...CORS, 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } })

Deno.serve(comRelato('folha', async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return erro(405, 'Use POST.')
  const auth = req.headers.get('Authorization')
  if (!auth) return erro(401, 'Sem sessão.')

  let corpo: {
    documento_id?: string; tipo_impressao?: string; origem?: string
    relatorio?: TipoRelatorio; paciente_id?: string; internacao_id?: string; episodio_id?: string; ids?: string[]
    unidade_id?: string; de?: string; ate?: string; cids?: string[]
  }
  try {
    corpo = await req.json()
  } catch {
    return erro(400, 'Corpo inválido.')
  }
  if (!corpo.documento_id && !corpo.relatorio) return erro(400, 'Informe o documento ou o relatório.')

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, chavePublica(), {
    global: { headers: { Authorization: auth } },
  })

  if (corpo.relatorio === 'notificaveis') {
    // folha 08: relatório da unidade (folha_notificaveis), não de um paciente
    const { data, error } = await supabase.rpc('folha_notificaveis', {
      p_unidade: corpo.unidade_id ?? null,
      p_de: corpo.de ?? null,
      p_ate: corpo.ate ?? null,
      p_cids: corpo.cids?.length ? corpo.cids : null,
    })
    if (error) return erro(403, error.message)
    const r = data as Parameters<typeof contextoDoBanco>[0] & { dados: unknown }
    return html(montarRelatorio('notificaveis', r.dados, contextoDoBanco(r, true)))
  }

  if (corpo.relatorio) {
    const { data, error } = await supabase.rpc('folha_relatorio', {
      p_tipo: corpo.relatorio,
      p_paciente: corpo.paciente_id ?? null,
      p_internacao: corpo.internacao_id ?? null,
      p_episodio: corpo.episodio_id ?? null,
      p_ids: corpo.ids?.length ? corpo.ids : null,
    })
    if (error) return erro(403, error.message)
    const r = data as Parameters<typeof contextoDoBanco>[0] & { dados: unknown }
    return html(montarRelatorio(corpo.relatorio, r.dados, contextoDoBanco(r, true)))
  }

  const { data, error } = await supabase.rpc('folha_documento', {
    p_documento: corpo.documento_id,
    p_tipo_impressao: corpo.tipo_impressao ?? null,
  })
  if (error) return erro(403, error.message)
  try {
    return html(folhaDoRegistro(data as Parameters<typeof folhaDoRegistro>[0]))
  } catch (e) {
    relatarErro('folha', 'documento_ilegivel', e)
    return erro(422, 'Conteúdo do documento ilegível.')
  }
}))
