// PAdES: espaço da assinatura no PDF, metadados de saúde e gravação do CMS (LG7).
//
// prepararPdf() acrescenta ao PDF o campo de assinatura com /Contents vazio
// (reservado) e /ByteRange provisório, a política DocMDP P=2 (o VALIDAR pede
// DocMDP para não dar "Assinatura Indeterminada") e os OIDs de saúde no
// dicionário de informações do documento. Depois:
//   faixas()      → os bytes que a assinatura cobre (tudo menos o /Contents);
//   gravarCms()   → escreve o CMS em hexadecimal no espaço reservado.
import { PDFArray, PDFDict, PDFDocument, PDFHexString, PDFName, PDFString } from 'pdf-lib'

import { OID_SAUDE } from './politica.ts'

/** Bytes reservados para o CMS (certificado + cadeia + assinatura cabem com folga). */
export const ESPACO_CMS = 24 * 1024
const MARCA = '/ByteRange [0 /********** /********** /**********]'

export type MetadadosSaude = {
  tipo: keyof typeof OID_SAUDE.tipo
  crmNumero: string
  crmUf: string
  nomeMedico: string
  motivo: string
  local: string
  quando: Date
}

export async function prepararPdf(pdf: Uint8Array, m: MetadadosSaude): Promise<Uint8Array> {
  const doc = await PDFDocument.load(pdf, { updateMetadata: false })
  const ctx = doc.context
  const pagina = doc.getPage(0)

  // Metadados de saúde (VALIDAR): chave = OID, valor = texto. O lugar exato
  // (Info × XMP) segue o ADE-ICP-04.01 e é conferido na homologação.
  const info = ctx.lookup(doc.context.trailerInfo.Info) as PDFDict
  info.set(PDFName.of(OID_SAUDE.tipo[m.tipo]), PDFString.of(m.tipo))
  info.set(PDFName.of(OID_SAUDE.crmNumero), PDFString.of(m.crmNumero))
  info.set(PDFName.of(OID_SAUDE.crmUf), PDFString.of(m.crmUf))

  const docMdp = ctx.obj({
    Type: 'SigRef',
    TransformMethod: 'DocMDP',
    TransformParams: ctx.obj({ Type: 'TransformParams', P: 2, V: PDFName.of('1.2') }),
  })
  const assinatura = ctx.obj({
    Type: 'Sig',
    Filter: 'Adobe.PPKLite',
    SubFilter: 'ETSI.CAdES.detached',
    ByteRange: PDFArray.withContext(ctx),
    Contents: PDFHexString.of('0'.repeat(ESPACO_CMS * 2)),
    Name: PDFString.of(m.nomeMedico),
    Reason: PDFString.of(m.motivo),
    Location: PDFString.of(m.local),
    M: PDFString.fromDate(m.quando),
    Reference: ctx.obj([docMdp]),
  })
  const ref = ctx.register(assinatura)
  const campo = ctx.register(
    ctx.obj({
      Type: 'Annot',
      Subtype: 'Widget',
      FT: 'Sig',
      Rect: [0, 0, 0, 0],
      V: ref,
      T: PDFString.of('Assinatura ICP-Brasil'),
      F: 132, // impressa e travada
      P: pagina.ref,
    }),
  )
  const anotacoes = pagina.node.lookup(PDFName.of('Annots'))
  if (anotacoes instanceof PDFArray) anotacoes.push(campo)
  else pagina.node.set(PDFName.of('Annots'), ctx.obj([campo]))
  doc.catalog.set(PDFName.of('AcroForm'), ctx.obj({ Fields: [campo], SigFlags: 3 }))
  // sem /Perms: o VALIDAR desaconselha /Perms com /DocMDP (compatibilidade com o Adobe)

  // pdf-lib não escreve o /ByteRange com marcadores: grava vazio e troca o texto depois
  const salvo = await doc.save({ useObjectStreams: false })
  const texto = Buffer.from(salvo).toString('latin1')
  const achados = [...texto.matchAll(/\/ByteRange \[\s*\]/g)]
  if (achados.length !== 1) throw new Error('PDF: /ByteRange não encontrado uma única vez')
  const i = achados[0].index!
  const vazio = achados[0][0]
  // o marcador tem o mesmo tamanho dos números finais (preenchidos com espaço)
  return Buffer.concat([Buffer.from(texto.slice(0, i), 'latin1'), Buffer.from(MARCA, 'latin1'), Buffer.from(texto.slice(i + vazio.length), 'latin1')])
}

/** Posição do /Contents reservado e o /ByteRange certo, já gravado no PDF. */
export function fecharByteRange(pdf: Uint8Array): { pdf: Uint8Array; faixa: [number, number, number, number] } {
  const b = Buffer.from(pdf)
  const texto = b.toString('latin1')
  const iMarca = texto.indexOf(MARCA)
  if (iMarca < 0) throw new Error('PDF sem o espaço da assinatura')
  const iContents = texto.indexOf('/Contents <')
  const inicioHex = texto.indexOf('<', iContents)
  const fimHex = texto.indexOf('>', inicioHex)
  if (iContents < 0 || fimHex - inicioHex - 1 !== ESPACO_CMS * 2) throw new Error('PDF: /Contents reservado não encontrado')
  const faixa: [number, number, number, number] = [0, inicioHex, fimHex + 1, b.length - (fimHex + 1)]
  const numeros = `/ByteRange [${faixa.join(' ')}]`
  if (numeros.length > MARCA.length) throw new Error('PDF grande demais para o espaço do /ByteRange')
  const novo = Buffer.from(b)
  novo.write(numeros.padEnd(MARCA.length, ' '), iMarca, 'latin1')
  return { pdf: novo, faixa }
}

/** Os bytes que a assinatura cobre: tudo menos o hexadecimal do /Contents. */
export function bytesCobertos(pdf: Uint8Array, faixa: [number, number, number, number]): Uint8Array {
  const b = Buffer.from(pdf)
  return Buffer.concat([b.subarray(faixa[0], faixa[0] + faixa[1]), b.subarray(faixa[2], faixa[2] + faixa[3])])
}

/** Grava o CMS no /Contents reservado (hexadecimal, completado com zeros). */
export function gravarCms(pdf: Uint8Array, faixa: [number, number, number, number], cms: Uint8Array): Uint8Array {
  const hex = Buffer.from(cms).toString('hex')
  if (hex.length > ESPACO_CMS * 2) throw new Error(`CMS maior que o espaço reservado (${cms.length} bytes)`)
  const novo = Buffer.from(pdf)
  novo.write(hex.padEnd(ESPACO_CMS * 2, '0'), faixa[1] + 1, 'latin1')
  return novo
}

/** Lê de volta o /ByteRange e o CMS de um PDF assinado (para conferir). */
export function lerAssinatura(pdf: Uint8Array): { faixa: [number, number, number, number]; cms: Uint8Array } {
  const texto = Buffer.from(pdf).toString('latin1')
  const m = /\/ByteRange \[(\d+) (\d+) (\d+) (\d+)\s*\]/.exec(texto)
  if (!m) throw new Error('PDF sem /ByteRange')
  const faixa = [1, 2, 3, 4].map((i) => Number(m[i])) as [number, number, number, number]
  const bruto = Buffer.from(texto.slice(faixa[1] + 1, faixa[2] - 1), 'hex')
  // o tamanho vem do cabeçalho DER (SEQUENCE com comprimento longo ou curto)
  if (bruto[0] !== 0x30) throw new Error('CMS não começa por SEQUENCE')
  let tamanho = bruto[1]
  let cabeca = 2
  if (tamanho & 0x80) {
    const n = tamanho & 0x7f
    tamanho = 0
    for (let k = 0; k < n; k++) tamanho = tamanho * 256 + bruto[2 + k]
    cabeca = 2 + n
  }
  return { faixa, cms: bruto.subarray(0, cabeca + tamanho) }
}

