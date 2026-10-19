#!/usr/bin/env node
// LIS de mentira (Fase 5C, tarefa 1, etapa 1.3; decisão 7a do RT): faz o papel
// do sistema do laboratório contra a porta FHIR, para testar sem LIS real.
//
// Busca os pedidos pendentes (GET /fhir/ServiceRequest) e, para cada um,
// registra a coleta (Specimen), põe em análise (DiagnosticReport preliminar) e
// devolve o laudo final com um analito de TESTE e um PDF de TESTE. Reenvia o
// mesmo laudo uma vez, para mostrar que não vira versão nova.
//
// Não inventa valor de exame: o resultado é o texto "TESTE — simulador, não é
// exame real". Só roda com chave de homologação (cc_test_); chave de produção
// (cc_live_) é recusada.
//
// Uso:
//   LIS_URL=https://<projeto>.supabase.co/functions/v1/api/v1 LIS_CHAVE=cc_test_... node scripts/lis-simulador.mjs [--critico] [--limite 5]
//   --critico   marca o analito de teste como crítico do laboratório (AA), para ver o aviso
//   --limite N  quantos pedidos tratar (padrão 5)
//   --sem-pdf   não manda o laudo em PDF (só o analito de teste)

const url = process.env.LIS_URL?.replace(/\/+$/, '')
const chave = process.env.LIS_CHAVE
if (!url || !chave) { console.error('Defina LIS_URL e LIS_CHAVE.'); process.exit(1) }
if (!chave.startsWith('cc_test_')) { console.error('O simulador só roda com chave de homologação (cc_test_).'); process.exit(1) }
const critico = process.argv.includes('--critico')
const semPdf = process.argv.includes('--sem-pdf')
const iLim = process.argv.indexOf('--limite')
const limite = iLim > 0 ? Number(process.argv[iLim + 1]) || 5 : 5

const cab = { Authorization: `Bearer ${chave}`, 'Content-Type': 'application/fhir+json', Accept: 'application/fhir+json' }
async function chamar(metodo, caminho, corpo) {
  const r = await fetch(`${url}${caminho}`, { method: metodo, headers: cab, body: corpo ? JSON.stringify(corpo) : undefined })
  const j = await r.json().catch(() => ({}))
  const msg = j.resourceType === 'OperationOutcome' ? j.issue?.[0]?.diagnostics : ''
  return { status: r.status, corpo: j, msg }
}

// PDF mínimo e válido, com a marca de teste
function pdfDeTeste(texto) {
  const conteudo = `BT /F1 14 Tf 50 750 Td (${texto.replace(/[()\\]/g, '')}) Tj ET`
  const objs = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    `<< /Length ${conteudo.length} >>\nstream\n${conteudo}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ]
  let pdf = '%PDF-1.4\n'
  const pos = []
  objs.forEach((o, i) => { pos.push(pdf.length); pdf += `${i + 1} 0 obj\n${o}\nendobj\n` })
  const xref = pdf.length
  pdf += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${pos.map((p) => `${String(p).padStart(10, '0')} 00000 n \n`).join('')}`
  pdf += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`
  return Buffer.from(pdf, 'latin1').toString('base64')
}

const meta = await chamar('GET', '/fhir/metadata')
console.log(`metadata: ${meta.status} (${meta.corpo.implementation?.description ?? '—'})`)
const busca = await chamar('GET', `/fhir/ServiceRequest?_count=${limite}`)
if (busca.status !== 200) { console.error(`busca dos pedidos: ${busca.status} ${busca.msg}`); process.exit(1) }
const pedidos = (busca.corpo.entry ?? []).map((e) => e.resource)
console.log(`pedidos pendentes nesta página: ${pedidos.length}`)

for (const p of pedidos) {
  const ref = `ServiceRequest/${p.id}`
  const nome = p.code?.text ?? p.id
  const identificador = `SIM-${p.id.slice(0, 8)}`
  console.log(`\n• ${nome} (${p.priority}) — ${p.contained?.[0]?.name?.[0]?.text ?? 'paciente'}`)
  const col = await chamar('POST', '/fhir/Specimen', { resourceType: 'Specimen', request: [{ reference: ref }], collection: { collectedDateTime: new Date().toISOString() } })
  console.log(`  coleta: ${col.status} ${col.msg}`)
  const pre = await chamar('POST', '/fhir/DiagnosticReport', { resourceType: 'DiagnosticReport', status: 'preliminary', basedOn: [{ reference: ref }], identifier: [{ value: identificador }] })
  console.log(`  em análise: ${pre.status} ${pre.msg}`)
  const laudo = {
    resourceType: 'DiagnosticReport', status: 'final', basedOn: [{ reference: ref }], identifier: [{ value: identificador }],
    conclusion: 'Laudo de TESTE gerado pelo simulador de LIS.',
    contained: [{
      resourceType: 'Observation', id: 'teste', status: 'final', code: { text: `${nome} (teste)` },
      valueString: 'TESTE — simulador, não é exame real',
      ...(critico ? { interpretation: [{ coding: [{ code: 'AA' }] }] } : {}),
    }],
    result: [{ reference: '#teste' }],
    ...(semPdf ? {} : { presentedForm: [{ contentType: 'application/pdf', title: `teste-${identificador}.pdf`, data: pdfDeTeste(`TESTE - simulador de LIS - ${nome}`) }] }),
  }
  const fin = await chamar('POST', '/fhir/DiagnosticReport', laudo)
  console.log(`  laudo final: ${fin.status} ${fin.msg}`)
  const rep = await chamar('POST', '/fhir/DiagnosticReport', laudo)
  console.log(`  reenvio do mesmo laudo: ${rep.status} ${rep.msg}`)
}
console.log('\nFim. Veja os resultados na aba Exames do atendimento ou no caderno da internação.')
