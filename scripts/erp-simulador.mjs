#!/usr/bin/env node
// ERP de mentira (Fase 5C, tarefa 3, etapa 3.3): faz o papel do ERP contra a
// porta financeiro da API, para testar sem ERP real.
//
// Busca as versões das contas faturadas e dos plantões fechados. Para cada
// versão vigente sem retorno, responde "lancada" com o valor do total (ou com
// R$ 0,01 a menos, em --divergir) e um id de TESTE. Para cada versão
// substituída que não foi estornada, responde "estornada". Reenvia o primeiro
// retorno uma vez, para mostrar que o reenvio igual não muda nada.
//
// Só roda com chave de homologação (cc_test_); chave de produção (cc_live_) é
// recusada.
//
// Uso:
//   ERP_URL=https://<projeto>.supabase.co/functions/v1/api/v1 ERP_CHAVE=cc_test_... node scripts/erp-simulador.mjs
//   --so contas|plantoes  trata só um dos dois (o padrão é os dois)
//   --desde ISO           só o que mudou a partir deste momento
//   --divergir            lança R$ 0,01 a menos, para ver a divergência
//   --limite N            quantas versões tratar de cada tipo (padrão 10)

const url = process.env.ERP_URL?.replace(/\/+$/, '')
const chave = process.env.ERP_CHAVE
if (!url || !chave) { console.error('Defina ERP_URL e ERP_CHAVE.'); process.exit(1) }
if (!chave.startsWith('cc_test_')) { console.error('O simulador só roda com chave de homologação (cc_test_).'); process.exit(1) }
const opc = (nome) => { const i = process.argv.indexOf(nome); return i > 0 ? process.argv[i + 1] : undefined }
const so = opc('--so')
if (so && !['contas', 'plantoes'].includes(so)) { console.error('--so contas ou --so plantoes.'); process.exit(1) }
const desde = opc('--desde')
const divergir = process.argv.includes('--divergir')
const limite = Number(opc('--limite')) || 10

async function chamar(metodo, caminho, corpo) {
  const r = await fetch(url + caminho, {
    method: metodo,
    headers: { Authorization: `Bearer ${chave}`, ...(corpo ? { 'Content-Type': 'application/json' } : {}) },
    body: corpo ? JSON.stringify(corpo) : undefined,
  })
  const j = await r.json().catch(() => ({}))
  return { status: r.status, j }
}

const reais = (v) => `R$ ${Number(v ?? 0).toFixed(2).replace('.', ',')}`
let reenviou = false

async function responder(rotulo, caminhoRetorno, v) {
  let corpo
  if (v.situacao === 'vigente' && v.conciliacao === 'pendente') {
    const valor = divergir ? Math.max(0, Math.round((Number(v.total) - 0.01) * 100) / 100) : Number(v.total)
    corpo = { acao: 'lancada', erp_id: `TESTE-${v.id.slice(0, 8)}`, valor_lancado: valor }
  } else if (v.situacao === 'substituida' && v.conciliacao !== 'estornada') {
    corpo = { acao: 'estornada' }
  } else {
    console.log(`  ${rotulo} v${v.versao}: ${v.situacao}, ${v.conciliacao} — nada a fazer`)
    return
  }
  const r = await chamar('POST', caminhoRetorno, corpo)
  console.log(`  ${rotulo} v${v.versao}: ${corpo.acao} → ${r.status} ${r.j.conciliacao ?? r.j.detail ?? ''}`
    + (corpo.acao === 'lancada' ? ` (total ${reais(v.total)}, lançado ${reais(corpo.valor_lancado)})` : ''))
  if (!reenviou && r.status === 200) {
    reenviou = true
    const de = await chamar('POST', caminhoRetorno, corpo)
    console.log(`  ${rotulo} v${v.versao}: reenvio igual → ${de.status} ${de.j.conciliacao ?? de.j.detail ?? ''} (nada muda)`)
  }
}

const filtro = new URLSearchParams({ limite: String(limite), ...(desde ? { desde } : {}) })
if (so !== 'plantoes') {
  const r = await chamar('GET', `/financeiro/contas?${filtro}`)
  if (r.status !== 200) { console.error(`contas: ${r.status} ${r.j.detail ?? ''}`); process.exit(1) }
  console.log(`Contas: ${r.j.dados.length} versão(ões)`)
  for (const v of r.j.dados) await responder(`conta ${v.numero}`, `/financeiro/contas/${v.conta_id}/versoes/${v.versao}/retorno`, v)
}
if (so !== 'contas') {
  const r = await chamar('GET', `/financeiro/plantoes?${filtro}`)
  if (r.status !== 200) { console.error(`plantões: ${r.status} ${r.j.detail ?? ''}`); process.exit(1) }
  console.log(`Plantões: ${r.j.dados.length} versão(ões)`)
  for (const v of r.j.dados) await responder(`plantões ${v.competencia}`, `/financeiro/plantoes/${v.id}/retorno`, v)
}
