// GERADO por scripts/copiar-folhas.mjs a partir de src/lib/folhas.ts — não edite aqui.
// ─────────────────────────────────────────────────────────────────────────────
// Folhas A4 dos documentos assistenciais (Fase 4.2) — FONTE ÚNICA.
//
// O servidor (edge function `folha`) monta a folha do documento emitido a
// partir do conteúdo gravado no banco; o aparelho só usa este módulo para a
// FOLHA PROVISÓRIA, quando não há conexão. Os dois precisam desenhar a mesma
// folha, então este arquivo não importa nada do app: é TypeScript puro, lido
// também pelo Deno. `npm run folhas:copiar` copia para
// supabase/functions/_shared/folhas.ts (um teste confere que são iguais).
// ─────────────────────────────────────────────────────────────────────────────

export type TipoFolha = 'atestado' | 'receita' | 'encaminhamento' | 'pedido_exames' | 'prescricao' | 'laudo_aih'

export const TIPO_RECEITUARIO: { value: 'branca' | 'verde' | 'azul' | 'amarela'; label: string; cor: string }[] = [
  { value: 'branca', label: 'Branca (comum)', cor: '#ffffff' },
  { value: 'verde', label: 'Verde (antibióticos — B1)', cor: '#dcfce7' },
  { value: 'azul', label: 'Azul (controle especial — B2)', cor: '#dbeafe' },
  { value: 'amarela', label: 'Amarela (entorpecentes/psicotrópicos — A)', cor: '#fef3c7' },
]

// deno-lint-ignore no-explicit-any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Json = any

function esc(s: unknown): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
function data(iso: unknown): string {
  const s = String(iso ?? '')
  if (!/^\d{4}-\d{2}-\d{2}/.test(s)) return ''
  const [y, m, d] = s.slice(0, 10).split('-')
  return `${d}/${m}/${y}`
}
const BASE = `@page{size:A4 portrait;margin:0}
html,body{margin:0;padding:0;-webkit-print-color-adjust:exact;print-color-adjust:exact}`
const ASSINATURA = `_________________________________________<br>Assinatura / Carimbo do Médico`

function pagina(titulo: string, estilo: string, corpo: string, rodape: string): string {
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(titulo)}</title><style>${estilo}</style></head><body>${corpo}${rodape}</body></html>`
}

function alergia(pac: Json, pad = '6px'): string {
  const a = String(pac?.alergias ?? '').trim()
  return a && a.toUpperCase() !== 'NEGA'
    ? `<div style="background:#dc2626;color:#fff;padding:${pad};text-align:center;font-weight:800;margin-bottom:10px;">⚠️ ALERGIA: ${esc(a).toUpperCase()} ⚠️</div>`
    : ''
}

function receita(d: Json, rodape: string): string {
  const itens = (d.receita?.itens ?? []).filter((i: Json) => String(i.medicamento ?? '').trim())
  const tipo = TIPO_RECEITUARIO.find((t) => t.value === d.receita?.tipo) ?? TIPO_RECEITUARIO[0]
  const linhas = itens
    .map((i: Json, idx: number) =>
      `<tr><td style="border:1px solid #000;padding:6px;width:6%;text-align:center;">${idx + 1}</td><td style="border:1px solid #000;padding:6px;"><strong>${esc(i.medicamento).toUpperCase()}</strong>${i.dose ? ` <span style="font-weight:normal;">· ${esc(i.dose)}</span>` : ''}</td><td style="border:1px solid #000;padding:6px;width:9%;">${esc(i.quantidade)}</td></tr><tr><td style="border:1px solid #000;padding:2px 6px;font-style:italic;" colspan="3">Uso: ${esc(i.posologia) || '…'}</td></tr>`)
    .join('')
  const estilo = `${BASE}
.folha{position:relative;width:210mm;min-height:297mm;padding:18mm;box-sizing:border-box;background:#fff}
.rec{border:2px solid #000;background:#fff;padding:8mm;border-radius:6px;min-height:245mm;box-sizing:border-box}
.rec-titulo{text-align:center;font-size:15px;font-weight:800;letter-spacing:1px;text-transform:uppercase;border-bottom:2px solid #000;padding-bottom:4mm;margin-bottom:8mm}
.rec-cabec{display:flex;justify-content:space-between;font-size:12px;margin-bottom:6mm;border:1px solid #000;padding:4mm 5mm}
table{border-collapse:collapse;width:100%;font-size:12px;color:#000}
th{background:#f1f5f9;border:1px solid #000;padding:5px;font-size:10px;text-transform:uppercase}
.ass{margin-top:18mm;text-align:center;font-size:12px}
.obs{margin-top:8mm;border:1px dashed #000;padding:4mm;font-size:11px}`
  const corpo = `<div class="folha"><div class="rec" style="background:${tipo.cor};">
<div class="rec-titulo">Receituário ${esc(tipo.label).toUpperCase()}</div>
<div class="rec-cabec"><span><strong>Paciente:</strong> ${esc(d.paciente?.nome) || '____________________'}</span><span><strong>Data:</strong> ${data(d.paciente?.dataAtual) || '____/___/____'}</span></div>
${alergia(d.paciente)}
${itens.length ? `<table><thead><tr><th style="width:6%;text-align:center;">Nº</th><th>Medicamento</th><th style="width:9%;">Qtd</th></tr></thead><tbody>${linhas}</tbody></table>` : '<p style="text-align:center;color:#999;">Nenhum item preenchido.</p>'}
<div class="ass">${ASSINATURA}</div>
${d.receita?.obs ? `<div class="obs">Observações: ${esc(d.receita.obs)}</div>` : ''}
</div></div>`
  return pagina('Receituário', estilo, corpo, rodape)
}

function atestado(d: Json, rodape: string): string {
  const a = d.atestado ?? {}
  const titulo = a.tipo === 'comparecimento' ? 'ATESTADO DE COMPARECIMENTO' : a.tipo === 'afastamento' ? 'ATESTADO DE AFASTAMENTO' : 'ATESTADO DE REPOUSO'
  const nome = esc(d.paciente?.nome).toUpperCase() || '_________________________________'
  const dt = data(d.paciente?.dataAtual)
  const dias = esc(a.dias) || '…'
  const corpoTexto =
    a.tipo === 'comparecimento'
      ? `Atesto, para os devidos fins, que ${nome} compareceu a esta unidade em ${dt}, necessitando de ${dias} dia(s) de afastamento de suas atividades.`
      : a.tipo === 'afastamento'
        ? `Atesto, para os devidos fins, que ${nome} esteve sob cuidados médicos, necessitando de ${dias} dia(s) de afastamento de suas atividades laborais${a.cid ? ` (CID: ${esc(a.cid)})` : ''}.`
        : `Atesto, para os devidos fins, que ${nome} necessita de ${dias} dia(s) de repouso, devendo manter-se em observação clínica.`
  const estilo = `${BASE}
.folha{width:210mm;min-height:297mm;padding:20mm;box-sizing:border-box;background:#fff}
.doc{border:2px solid #000;padding:12mm;min-height:250mm;box-sizing:border-box;display:flex;flex-direction:column}
.titulo{text-align:center;font-size:16px;font-weight:800;letter-spacing:1px;border-bottom:2px solid #000;padding-bottom:5mm;margin-bottom:12mm;text-transform:uppercase}
.corpo{flex-grow:1;font-size:13px;line-height:1.8;text-align:justify}
.ass{margin-top:20mm;text-align:center;font-size:12px}
.rodape{margin-top:8mm;text-align:center;font-size:10px;color:#666}`
  const corpo = `<div class="folha"><div class="doc">
<div class="titulo">${titulo}</div>
<div class="corpo">${corpoTexto}</div>
${a.texto ? `<div class="corpo" style="margin-top:6mm;">Observações: ${esc(a.texto)}</div>` : ''}
<div class="ass">${dt || '____/___/____'}<br>${ASSINATURA}</div>
<div class="rodape">Documento válido somente com assinatura e carimbo do profissional responsável.</div>
</div></div>`
  return pagina(titulo, estilo, corpo, rodape)
}

function encaminhamento(d: Json, rodape: string): string {
  const e = d.encaminhamento ?? {}
  const nome = esc(d.paciente?.nome).toUpperCase() || '_________________________________'
  const dt = data(d.paciente?.dataAtual)
  const estilo = `${BASE}
.folha{width:210mm;min-height:297mm;padding:20mm;box-sizing:border-box;background:#fff}
.doc{border:2px solid #000;padding:12mm;min-height:250mm;box-sizing:border-box;display:flex;flex-direction:column}
.titulo{text-align:center;font-size:16px;font-weight:800;letter-spacing:1px;border-bottom:2px solid #000;padding-bottom:5mm;margin-bottom:10mm;text-transform:uppercase}
.linha{display:flex;gap:8mm;font-size:12px;margin-bottom:4mm}
.campo{flex:1;border:1px solid #000;padding:3mm}
.campo strong{display:block;font-size:9px;text-transform:uppercase;margin-bottom:2mm;color:#444}
.corpo{flex-grow:1;border:1px solid #000;padding:4mm;font-size:12px;line-height:1.7;margin-top:4mm;text-align:justify}
.ass{margin-top:14mm;text-align:center;font-size:12px}`
  const corpo = `<div class="folha"><div class="doc">
<div class="titulo">Encaminhamento Médico</div>
<div class="linha"><div class="campo"><strong>Paciente</strong>${nome}</div><div class="campo"><strong>Data</strong>${dt || '____/___/____'}</div></div>
<div class="linha"><div class="campo"><strong>Especialidade de destino</strong>${esc(e.especialidade) || '______________________'}</div><div class="campo"><strong>Prioridade</strong>${esc(e.prioridade) || 'Rotina'}</div></div>
<div class="campo" style="margin-top:4mm;"><strong>Hipótese diagnóstica</strong>${esc(d.paciente?.diagnostico) || '____________________'}</div>
<div class="corpo"><strong style="font-size:9px;text-transform:uppercase;color:#444;">Resumo clínico</strong><br><br>${esc(e.resumo || 'Resumo clínico do atendimento. ').replace(/\n/g, '<br>')}</div>
<div class="ass">${dt}<br>${ASSINATURA}</div>
</div></div>`
  return pagina('Encaminhamento', estilo, corpo, rodape)
}

// Porta ({paciente, pedido:{texto}}) e internação ({paciente, exames:{texto}}) usam a mesma folha.
function pedidoExames(d: Json, rodape: string, origem: string): string {
  const texto = String(d.pedido?.texto ?? d.exames?.texto ?? '').trim()
  const paciente = esc(d.paciente?.nome).trim().toUpperCase() || 'PACIENTE NÃO IDENTIFICADO'
  const linhas = texto.split(/\n+/).map((l) => l.replace(/^[-*•]\s*/, '')).filter(Boolean)
  const lista = linhas.map((l) => `<div style="margin-bottom:6px;">• ${esc(l)}</div>`).join('')
  const estilo = `@page{size:A4 landscape;margin:0}
html,body{width:297mm;height:210mm;margin:0;padding:0;-webkit-print-color-adjust:exact;print-color-adjust:exact;background:transparent}
.folha{position:relative;width:297mm;height:209mm;overflow:hidden}
.folha>img{position:absolute;top:0;left:0;width:100%;height:100%;object-fit:cover;z-index:1;display:block}
.overlay{position:absolute;z-index:10;background:transparent}
.nome{top:40mm;left:33mm;font-family:Arial;font-weight:bold;font-size:14px;color:black;white-space:nowrap}
.data{top:193mm;left:20mm;font-family:Arial;font-weight:bold;font-size:14px;color:black;white-space:nowrap}
.exames{top:80mm;left:20mm;width:250mm;height:110mm;font-family:Arial;font-weight:bold;font-size:14px;color:black}`
  const corpo = `<div class="folha">
<img src="${origem}/plantao/MODELO_EXAMES.png">
<div class="overlay nome">${paciente}</div>
<div class="overlay data">DATA: ${data(d.paciente?.dataAtual)}</div>
<div class="overlay exames">${lista}</div>
</div>`
  return pagina('Pedido de Exames', estilo, corpo, rodape)
}

// {paciente, itens:[{med, via, pos, apr}], obs}
function prescricao(d: Json, rodape: string, origem: string): string {
  const p = d.paciente ?? {}
  const tbody = (d.itens ?? [])
    .map((i: Json, idx: number) =>
      `<tr><td>${String(idx + 1).padStart(2, '0')}</td><td><strong>${esc(i.med)}</strong></td><td>${esc(i.via)}</td><td>${esc(i.pos)}</td><td>${esc(i.apr ?? '')}</td></tr>`)
    .join('')
  const estilo = `${BASE}
.folha{position:relative;width:210mm;min-height:297mm;overflow:hidden}
.folha>img{position:absolute;top:0;left:0;width:100%;height:100%;object-fit:cover;z-index:1}
.conteudo{position:relative;z-index:10;margin:120px auto 0;width:90%}
.cabec{border:1px solid #000;padding:6px 10px;margin-bottom:12px;font-size:13px;line-height:1.6;text-transform:uppercase;background:#fff}
table{border-collapse:collapse;width:100%;background:#fff;color:#000;font-size:12px}
th,td{border:1px solid #000;padding:6px;text-align:left;vertical-align:top}
th{background:#fff;font-size:11px}
td:first-child,th:first-child{width:6%;text-align:center}
td:nth-child(2){width:44%}
td:nth-child(3){width:8%;text-align:center}
td:nth-child(4){width:9.5%}
.ass{margin-top:2cm;text-align:center;font-size:13px;background:#fff}
.obs{margin-top:10px;border:1px dashed #000;padding:8px;font-size:11px;background:#fff}`
  const corpo = `<div class="folha">
<img src="${origem}/plantao/background.png">
<div class="conteudo">
<div class="cabec">
<div style="display:flex;justify-content:space-between"><strong>Nome:</strong> ${esc(p.nome) || '____________________'}${p.peso ? ` <strong>Peso:</strong> ${esc(p.peso)} kg` : ''}</div>
<div style="display:flex;justify-content:space-between;margin-top:4px"><strong>Leito:</strong> ${esc(p.leito) || '___'} <strong>Data:</strong> ${data(p.dataAtual)} <strong>Diagnóstico:</strong> ${esc(p.diagnostico) || '____'}</div>
</div>
${alergia(p, '8px')}
<table><thead><tr><th>ITEM</th><th>NOME</th><th>VIA</th><th>POSOLOGIA</th><th>APRAZAMENTO</th></tr></thead><tbody>${tbody}</tbody></table>
<div class="ass">${ASSINATURA}</div>
${d.obs ? `<div class="obs">Observações: ${esc(d.obs)}</div>` : ''}
</div></div>`
  return pagina('Prescrição', estilo, corpo, rodape)
}

// {paciente, campos:[{rotulo, valor, textarea?}]} — campos da AIH já resolvidos pela tela
function laudoAih(d: Json, rodape: string): string {
  const rows = (d.campos ?? [])
    .map((c: Json) => c.textarea
      ? `<div class="row"><div class="label">${esc(c.rotulo)}</div><div class="valor ta">${(esc(c.valor) || '&nbsp;').replace(/\n/g, '<br>')}</div></div>`
      : `<div class="row"><div class="label">${esc(c.rotulo)}</div><div class="valor">${esc(c.valor) || '&nbsp;'}</div></div>`)
    .join('')
  const estilo = `@page{size:A4 portrait;margin:6mm 8mm}
html,body{margin:0;padding:0;font-family:Arial,Helvetica,sans-serif;font-size:10px;color:#000;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.form{border:2px solid #000;background:#fff;width:100%;box-sizing:border-box}
.header{display:grid;grid-template-columns:60px 1fr 1fr;align-items:center;border-bottom:2px solid #000;padding:4px 8px;min-height:38px}
.titulo{font-size:12px;font-weight:800;text-align:center;text-transform:uppercase}
.row{display:grid;grid-template-columns:34% 1fr;border-bottom:1px solid #000;min-height:24px}
.label{font-size:7px;font-weight:700;text-transform:uppercase;padding:2px 4px;border-right:1px solid #000;display:flex;align-items:center}
.valor{font-size:10px;padding:2px 4px;word-wrap:break-word;overflow-wrap:break-word}
.valor.ta{white-space:pre-wrap;font-size:9px}
.sec{background:#e8e8e8;font-weight:800;font-size:10px;padding:3px 6px;border-top:1px solid #000;border-bottom:1px solid #000;text-transform:uppercase}`
  const corpo = `<div class="form">
<div class="header">
<div style="font-size:14px;font-weight:900;color:#003d7a;">SUS<div style="font-size:6px;">Sistema Único de Saúde</div></div>
<div>Ministério da Saúde</div>
<div class="titulo">Laudo para Solicitação de<br>Autorização de Internação Hospitalar</div>
</div>
<div class="sec">Identificação do Estabelecimento de Saúde</div>
${rows}
</div>`
  return pagina('Laudo AIH', estilo, corpo, rodape)
}

/** Rodapé do documento emitido: número, protocolo da impressão, autor e código de conferência. */
export function rodapeEmitido(m: { numero: string; protocolo: string; emitido: string; autor: string; codigo: string; versao: number }): string {
  return `<div style="position:fixed;left:0;right:0;bottom:4mm;text-align:center;font:9px system-ui,sans-serif;color:#475569">` +
    `Documento nº ${esc(m.numero)}${m.versao > 1 ? ` (versão ${m.versao})` : ''} · emitido por ${esc(m.autor)} · ` +
    `Impressão ${esc(m.protocolo)} em ${esc(m.emitido)} · Código de conferência ${esc(m.codigo)} — Chefe Coruja</div>`
}

/**
 * Monta a folha do documento. `origem` é o endereço do app (as imagens de
 * fundo moram nele); `rodape` já vem pronto (emitido ou provisório).
 */
export function montarFolha(tipo: TipoFolha, dados: Json, rodape: string, origem: string): string {
  switch (tipo) {
    case 'receita': return receita(dados, rodape)
    case 'atestado': return atestado(dados, rodape)
    case 'encaminhamento': return encaminhamento(dados, rodape)
    case 'pedido_exames': return pedidoExames(dados, rodape, origem)
    case 'prescricao': return prescricao(dados, rodape, origem)
    case 'laudo_aih': return laudoAih(dados, rodape)
  }
}
