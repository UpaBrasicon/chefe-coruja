// Notas de atualização do Manual HCFMUSP (2022), lote 1 da revisão (decisão do RT
// de 13/11/2026, L1–L3 = A; docs/clinico/HCFMUSP-LOTE1-DIAGNOSTICO.md).
//
// O livro não é editado. Cada nota diz, por capítulo, onde a diretriz mais
// recente diz outra coisa, e entra na biblioteca da IA ao lado do texto do
// manual. NADA aqui é escrito à mão: os itens vêm das listas que as fichas da
// Central já conferiram (com página e fonte). Cada nota é uma ficha, com versão,
// e passa pela aprovação do RT na Revisão Clínica (L3).
import type { Fonte, Ficha } from '../ficha.ts'
import { DIRETRIZES_ANAFILAXIA, fichaAnafilaxiaAdulto } from './anafilaxia.ts'
import { DIFERENCAS_ANTICOAG_2025, fichaAnticoagulacaoPlenaAdulto } from './anticoagulacao.ts'
import { DIRETRIZ_AVC_2026, fichaTromboliseAvcAdulto } from './avcTrombolise.ts'
import { DIFERENCAS_2024, fichaCadEhhTratamento } from './glicemia.ts'
import { CARVAO_CTRC_2026, CARVAO_INDICACAO, fichaIntoxicacoesAdulto } from './intoxicacoes.ts'
import { COSTR_2026_PCR, DIRETRIZ_ALS_2025, fichaPcrAdulto } from './pcr.ts'
import { METAS_ERC_2025, METAS_POS_PCR, fichaPosPcrAdulto } from './posPcr.ts'
import { DIRETRIZES_2026, fichaRessuscitacaoAdulto } from './ressuscitacaoVolemica.ts'

export type ItemNota = { tema: string; diretriz: string; manual: string }
export type NotaHcfmusp = {
  ficha: Ficha
  capitulos: string
  /** ficha da Central de onde os itens vêm (para "abrir na Central") */
  fichaCentral: string
  itens: ItemNota[]
}

const VERSAO = '2026-11-13.1'
const REVISADO = '13/11/2026 (lote 1 da revisão do HCFMUSP: itens tirados da ficha da Central, já conferidos com a diretriz; aguarda aprovação do RT)'
const MANUAL = 'Manual de Medicina de Emergência do HCFMUSP, 3ª ed., 2022'
const semManual = (fontes: Fonte[]) => fontes.filter((f) => !/Manual de Medicina de Emergência/.test(f.citacao))

function nota(id: string, titulo: string, capitulos: string, central: Ficha, itens: ItemNota[], fontes?: Fonte[]): NotaHcfmusp {
  return {
    ficha: { id, titulo, versao: VERSAO, publico: 'adulto', fontes: fontes ?? semManual(central.fontes), revisadoEm: REVISADO },
    capitulos,
    fichaCentral: central.id,
    itens,
  }
}

const sem = (s?: string) => (s && s.trim() && s.trim() !== '—' ? s : 'não trata do ponto')

/** cap. 2: AHA 2025 (Part 9) e CoSTR 2026 do ILCOR. */
export const notaHcfmuspCap2 = nota('nota-hcfmusp-cap2-pcr', 'Nota de atualização — manual HC, cap. 2: PCR no adulto', 'cap. 2, p. 43–53', fichaPcrAdulto, [
  ...DIRETRIZ_ALS_2025.map((d) => ({ tema: d.tema, diretriz: `AHA 2025, ${d.onde}: ${d.aha}${d.nota ? ` Nota: ${d.nota}` : ''}`, manual: sem(d.livro) })),
  ...COSTR_2026_PCR.map((c) => ({ tema: c.tema, diretriz: `ILCOR, CoSTR 2026 (${c.codigo}; ${c.forca}): ${c.recomendacao}`, manual: 'não trata do ponto' })),
])

/** cap. 6: metas do ERC-ESICM 2025 ao lado das do livro, pelo mesmo parâmetro. */
export const notaHcfmuspCap6 = nota('nota-hcfmusp-cap6-pos-pcr', 'Nota de atualização — manual HC, cap. 6: cuidados pós-parada', 'cap. 6, p. 98–113', fichaPosPcrAdulto,
  METAS_ERC_2025.map((m) => {
    const livro = METAS_POS_PCR.find((l) => l.id === m.id)
    return { tema: m.parametro, diretriz: `${m.pagina}: ${m.meta}`, manual: livro ? `${livro.meta} (${livro.pagina})` : 'não trata do ponto' }
  }))

/** cap. 4 e 7: SSC 2026 e ILAS jul/2026. */
export const notaHcfmuspCap7 = nota('nota-hcfmusp-cap4-7-sepse', 'Nota de atualização — manual HC, cap. 4 e 7: choque e sepse', 'cap. 4, p. 66–79; cap. 7, p. 114–129', fichaRessuscitacaoAdulto,
  DIRETRIZES_2026.map((d) => ({
    tema: d.tema,
    diretriz: [d.ssc && `SSC 2026, ${d.ssc.pagina}: ${d.ssc.texto}`, d.ilas && `ILAS jul/2026, ${d.ilas.pagina}: ${d.ilas.texto}`, d.nota && `Nota: ${d.nota}`].filter(Boolean).join(' '),
    manual: d.livro ? `${d.livro.texto} (${d.livro.pagina})` : 'não trata do ponto',
  })))

/** cap. 11: WAO 2020, practice parameter 2023 e consenso GALEN 2024. */
export const notaHcfmuspCap11 = nota('nota-hcfmusp-cap11-anafilaxia', 'Nota de atualização — manual HC, cap. 11: anafilaxia', 'cap. 11, p. 168–181', fichaAnafilaxiaAdulto,
  DIRETRIZES_ANAFILAXIA.map((d) => ({ tema: d.tema, diretriz: `${d.onde}: ${d.texto}`, manual: sem(d.livro) })))

/** cap. 13 e 14: anticoagulação na SCA pela AHA/ACC 2025 e ESC 2023. */
export const notaHcfmuspCap13 = nota('nota-hcfmusp-cap13-14-sca', 'Nota de atualização — manual HC, cap. 13 e 14: síndrome coronariana aguda', 'cap. 13, p. 199–211; cap. 14, p. 212–222', fichaAnticoagulacaoPlenaAdulto,
  DIFERENCAS_ANTICOAG_2025.map((t) => ({ tema: t.split(':')[0], diretriz: t, manual: 'no próprio item, com a página' })))

/** cap. 38: AHA/ASA 2026. */
export const notaHcfmuspCap38 = nota('nota-hcfmusp-cap38-avc', 'Nota de atualização — manual HC, cap. 38: AVC isquêmico', 'cap. 38, p. 513–541', fichaTromboliseAvcAdulto,
  DIRETRIZ_AVC_2026.map((d) => ({ tema: d.tema, diretriz: `AHA/ASA 2026, ${d.pagina} (${d.classe}): ${d.texto}`, manual: sem(d.livro) })))

/** cap. 64: consenso ADA/EASD/JBDS 2024 (a tela da Central já calcula por ele). */
export const notaHcfmuspCap64 = nota('nota-hcfmusp-cap64-cad-ehh', 'Nota de atualização — manual HC, cap. 64: emergências hiperglicêmicas', 'cap. 64, p. 864–876', fichaCadEhhTratamento,
  DIFERENCAS_2024.map((d) => ({ tema: d.tema, diretriz: `Consenso ADA/EASD/JBDS 2024: ${d.consenso}`, manual: d.manual })))

/** cap. 97–99: carvão ativado pelo consenso CTRC 2026, ao lado do que o livro traz. */
const PAR_CARVAO: Record<string, string> = { 'ctrc-janela': 'janela', 'ctrc-sem-papel': 'nao-adsorviveis', 'ctrc-multiplas': 'multiplas', 'ctrc-via-aerea': 'contraindicacoes' }
export const notaHcfmuspCap97 = nota('nota-hcfmusp-cap97-99-intoxicacoes', 'Nota de atualização — manual HC, cap. 97 a 99: intoxicações (carvão ativado)', 'cap. 97, p. 1297–1306; cap. 98, p. 1307–1324; cap. 99, p. 1325–1337', fichaIntoxicacoesAdulto,
  CARVAO_CTRC_2026.map((c) => {
    const livro = CARVAO_INDICACAO.find((l) => l.id === PAR_CARVAO[c.id])
    return { tema: c.nome.replace(/ \(CTRC 2026\)$/, ''), diretriz: `CTRC 2026: ${c.texto}`, manual: livro ? `${livro.texto} (${livro.pagina})` : 'não trata do ponto' }
  }))

export const NOTAS_HCFMUSP_LOTE1: NotaHcfmusp[] = [
  notaHcfmuspCap2, notaHcfmuspCap6, notaHcfmuspCap7, notaHcfmuspCap11, notaHcfmuspCap13, notaHcfmuspCap38, notaHcfmuspCap64, notaHcfmuspCap97,
]

// Fichas, para a migration (npm run fichas:sql) e a Revisão Clínica.
export const fichaNotaHcfmuspCap2 = notaHcfmuspCap2.ficha
export const fichaNotaHcfmuspCap6 = notaHcfmuspCap6.ficha
export const fichaNotaHcfmuspCap7 = notaHcfmuspCap7.ficha
export const fichaNotaHcfmuspCap11 = notaHcfmuspCap11.ficha
export const fichaNotaHcfmuspCap13 = notaHcfmuspCap13.ficha
export const fichaNotaHcfmuspCap38 = notaHcfmuspCap38.ficha
export const fichaNotaHcfmuspCap64 = notaHcfmuspCap64.ficha
export const fichaNotaHcfmuspCap97 = notaHcfmuspCap97.ficha

/** Texto da nota para a biblioteca (Markdown), sem nada além dos itens e das fontes. */
export function textoNota(n: NotaHcfmusp, rotaCentral?: string): string {
  const linhas = [
    `# ${n.ficha.titulo}`,
    '',
    `O ${MANUAL} (${n.capitulos}) é anterior às diretrizes abaixo. Onde elas dizem outra coisa, vale a diretriz mais recente; o manual fica como referência histórica.`,
    `Fontes: ${n.ficha.fontes.map((f) => f.citacao.replace(/[.\s]+$/, '')).join(' · ')}.`,
    rotaCentral ? `A ferramenta da Central que segue a diretriz: ${rotaCentral}.` : '',
    '',
  ]
  const ponto = (t: string) => t.replace(/[.\s]+$/, '') + '.'
  for (const i of n.itens) linhas.push(`## ${i.tema}`, '', `Diretriz atual: ${ponto(i.diretriz)}`, '', `Manual de 2022: ${ponto(i.manual)}`, '')
  return linhas.join('\n')
}
