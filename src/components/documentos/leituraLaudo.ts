// Leitura de laudo anexado (PDF ou imagem) no aparelho — o mesmo caminho da
// leitura de arquivo de Dados do Paciente (pdf.js para o texto do PDF,
// tesseract.js para imagem e para PDF digitalizado). Nada sai do aparelho.
//
// O resumo é EXTRATIVO: só entra o que está escrito no laudo (analito e valor,
// conclusão/impressão, data). Sem resultado reconhecível, a leitura diz que
// não conseguiu, em vez de inventar. Se o nome do paciente não aparece no
// texto, a linha não entra sozinha no campo (evita troca de exames).

export type EstadoAnexo = 'lendo' | 'ok' | 'sem-resultado' | 'nome-diferente' | 'nao-suportado' | 'erro'
export type AnexoLaudo = { id: string; nome: string; estado: EstadoAnexo; resumo: string; tipo: 'pdf' | 'imagem'; origem?: 'texto' | 'ocr' }

const MAX_BYTES = 10 * 1024 * 1024

async function pdfjs() {
  const lib = await import('pdfjs-dist')
  lib.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString()
  return lib
}

async function textoDoPdf(file: File) {
  const lib = await pdfjs()
  const pdf = await lib.getDocument({ data: await file.arrayBuffer() }).promise
  let texto = ''
  for (let i = 1; i <= pdf.numPages; i++) {
    const pg = await pdf.getPage(i)
    const tc = await pg.getTextContent()
    texto += tc.items.map((it) => ('str' in it ? it.str : '')).join(' ') + '\n'
  }
  return texto
}

/** Primeira página do PDF como imagem, para o laudo que só tem figura (ECG, imagem). */
async function primeiraPaginaComoImagem(file: File): Promise<Blob | null> {
  const lib = await pdfjs()
  const pdf = await lib.getDocument({ data: await file.arrayBuffer() }).promise
  const pg = await pdf.getPage(1)
  const vp = pg.getViewport({ scale: 2 })
  const canvas = document.createElement('canvas')
  canvas.width = vp.width
  canvas.height = vp.height
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  await pg.render({ canvasContext: ctx, viewport: vp, canvas }).promise
  return new Promise((ok) => canvas.toBlob((b) => ok(b), 'image/png'))
}

async function ocr(img: Blob | File) {
  const { createWorker } = await import('tesseract.js')
  const worker = await createWorker('por')
  try {
    const r = await worker.recognize(img)
    return r.data.text
  } finally {
    await worker.terminate()
  }
}

const sem = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

// Analitos comuns na porta: rótulo curto e o padrão do nome no laudo.
const ANALITOS: [string, RegExp][] = [
  ['Hb', /hemoglobina(?! glicada)/i], ['Ht', /hemat[oó]crito/i], ['Leucócitos', /leuc[oó]citos(?: totais)?/i],
  ['Plaquetas', /plaquetas/i], ['Creatinina', /creatinina/i], ['Ureia', /ur[eé]ia/i], ['Na', /s[oó]dio/i],
  ['K', /pot[aá]ssio/i], ['PCR', /prote[ií]na c reativa|\bPCR\b/i], ['TGO', /\bTGO\b|\bAST\b/i], ['TGP', /\bTGP\b|\bALT\b/i],
  ['Glicose', /glicose|glicemia/i], ['Lactato', /lactato/i], ['Troponina', /troponina/i], ['INR', /\bINR\b|RNI/i],
  ['Bilirrubina total', /bilirrubina total/i], ['Amilase', /amilase/i], ['Lipase', /lipase/i], ['pH', /\bpH\b/],
  ['pCO₂', /pCO2|pCO₂/i], ['HCO₃', /HCO3|HCO₃|bicarbonato/i], ['D-dímero', /d-?d[ií]mero/i],
]

/** Os pontos principais do texto do laudo — só o que está escrito nele. */
export function resumirLaudo(texto: string): string {
  const plano = texto.replace(/\s+/g, ' ').trim()
  if (!plano) return ''
  const partes: string[] = []
  for (const [rot, re] of ANALITOS) {
    const m = new RegExp(`(?:${re.source})[^0-9\\n]{0,40}?(\\d{1,3}(?:[.,]\\d{3})*(?:[.,]\\d+)?)\\s*(%|g/dL|mg/dL|mEq/L|mmol/L|U/L|/mm³|/mm3|mil/mm³|ng/mL|ng/L|mm/h|mmHg)?`, re.flags.includes('i') ? 'i' : '').exec(plano)
    if (m) partes.push(`${rot} ${m[1]}${m[2] ? ` ${m[2]}` : ''}`)
  }
  const conc = /(conclus[aã]o|impress[aã]o(?: diagn[oó]stica)?|laudo)\s*:?\s*(.{10,300}?)(?:\.|$)/i.exec(plano)
  const data = /\b(\d{2}\/\d{2}\/\d{4})\b/.exec(plano)?.[1]
  if (!partes.length && !conc) return ''
  return [data ? `(${data})` : '', partes.join('; '), conc ? `Conclusão: ${conc[2].trim()}` : ''].filter(Boolean).join(' ')
}

/**
 * Lê um arquivo e devolve o anexo pronto (estado e resumo). `nomePaciente`
 * confere se o laudo é deste paciente.
 */
export async function lerLaudo(file: File, nomePaciente: string): Promise<AnexoLaudo> {
  const id = crypto.randomUUID()
  const ehPdf = /pdf$/i.test(file.type) || /\.pdf$/i.test(file.name)
  const ehImg = /^image\//i.test(file.type) || /\.(png|jpe?g|webp)$/i.test(file.name)
  const base = { id, nome: file.name, tipo: (ehPdf ? 'pdf' : 'imagem') as AnexoLaudo['tipo'] }
  if (!ehPdf && !ehImg) return { ...base, estado: 'nao-suportado', resumo: 'Formato não suportado: envie PDF ou imagem.' }
  if (file.size > MAX_BYTES) return { ...base, estado: 'erro', resumo: 'Arquivo acima de 10 MB.' }
  try {
    let texto = ''
    let origem: AnexoLaudo['origem'] = 'texto'
    if (ehPdf) {
      texto = await textoDoPdf(file)
      if (!resumirLaudo(texto)) {
        const img = await primeiraPaginaComoImagem(file)
        if (img) {
          texto = `${texto}\n${await ocr(img)}`
          origem = 'ocr'
        }
      }
    } else {
      texto = await ocr(file)
      origem = 'ocr'
    }
    const resumo = resumirLaudo(texto)
    if (!resumo) return { ...base, origem, estado: 'sem-resultado', resumo: 'Não encontrei resultado escrito neste laudo. Digite os pontos principais.' }
    // primeiro e último nome (o social, se houver, vem antes do parêntese)
    const nome = sem(nomePaciente.split('(')[0]).replace(/[^a-z ]/g, ' ').trim()
    const partes = nome.split(/\s+/).filter((x) => x.length > 2)
    const chave = [partes[0], partes[partes.length - 1]].filter(Boolean)
    const bate = !chave.length || chave.every((p) => sem(texto).includes(p))
    return { ...base, origem, estado: bate ? 'ok' : 'nome-diferente', resumo: `${file.name.replace(/\.[^.]+$/, '')} ${resumo}` }
  } catch (e) {
    return { ...base, estado: 'erro', resumo: e instanceof Error ? e.message : 'Não foi possível ler o arquivo.' }
  }
}
