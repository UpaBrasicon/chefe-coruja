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
import { DIFERENCAS_ANTICOAG_2025, DIRETRIZ_SCA_2025, fichaAnticoagulacaoPlenaAdulto, fichaFibrinoliticosAdulto } from './anticoagulacao.ts'
import { DIRETRIZ_AVC_2026, fichaTromboliseAvcAdulto } from './avcTrombolise.ts'
import { GINA_ITENS, fichaAsmaAdulto } from './asmaDpoc.ts'
import { DBHA_2025_ALVOS, DIFERENCAS_EH_2025, fichaEmergenciaHipertensivaAdulto } from './emergenciaHipertensiva.ts'
import { DIFERENCAS_FA_2024, DOSES_FA_2024, fichaFibrilacaoAtrialAdulto } from './fibrilacaoAtrial.ts'
import { DIRETRIZ_ICA_2026, fichaIcAgudaAdulto } from './insuficienciaCardiacaAguda.ts'
import { DIFERENCAS_2024, fichaCadEhhTratamento } from './glicemia.ts'
import { DIVERGENCIA_MANUAL_HC, fichaHiperpotassemia } from '../hiperpotassemia.ts'
import { CARVAO_CTRC_2026, CARVAO_INDICACAO, fichaIntoxicacoesAdulto } from './intoxicacoes.ts'
import { COSTR_2026_PCR, DIFERENCAS_BRADI_2025, DIRETRIZ_ALS_2025, fichaBradicardiaAdulto, fichaPcrAdulto } from './pcr.ts'
import { METAS_ERC_2025, METAS_POS_PCR, fichaPosPcrAdulto } from './posPcr.ts'
import { DIRETRIZES_2026, fichaRessuscitacaoAdulto } from './ressuscitacaoVolemica.ts'

export type ItemNota = { tema: string; diretriz: string; manual: string }
export type NotaHcfmusp = {
  ficha: Ficha
  capitulos: string
  /** ficha da Central de onde os itens vêm (para "abrir na Central") */
  fichaCentral: string
  /** nome do assunto, repetido no título de cada item para a busca achar a nota */
  assunto: string
  itens: ItemNota[]
}

const VERSAO = '2026-11-13.1'
const REVISADO = '13/11/2026 (lote 1 da revisão do HCFMUSP: itens tirados da ficha da Central, já conferidos com a diretriz; aguarda aprovação do RT)'
const MANUAL = 'Manual de Medicina de Emergência do HCFMUSP, 3ª ed., 2022'
const semManual = (fontes: Fonte[]) => fontes.filter((f) => !/Manual de Medicina de Emergência/.test(f.citacao))

function nota(id: string, titulo: string, capitulos: string, central: Ficha, itens: ItemNota[], fontes?: Fonte[]): NotaHcfmusp {
  return {
    assunto: ASSUNTO[id] ?? titulo,
    ficha: { id, titulo, versao: VERSAO, publico: 'adulto', fontes: fontes ?? semManual(central.fontes), revisadoEm: REVISADO },
    capitulos,
    fichaCentral: central.id,
    itens,
  }
}

// rótulo de busca de cada nota (não é conteúdo clínico)
const ASSUNTO: Record<string, string> = {
  'nota-hcfmusp-cap2-pcr': 'parada cardiorrespiratória (PCR) no adulto',
  'nota-hcfmusp-cap6-pos-pcr': 'cuidados pós-parada cardíaca (pós-PCR)',
  'nota-hcfmusp-cap4-7-sepse': 'sepse e choque séptico',
  'nota-hcfmusp-cap11-anafilaxia': 'anafilaxia',
  'nota-hcfmusp-cap13-14-sca': 'síndrome coronariana aguda (IAM com e sem supra de ST)',
  'nota-hcfmusp-cap38-avc': 'AVC isquêmico',
  'nota-hcfmusp-cap64-cad-ehh': 'cetoacidose diabética (CAD) e estado hiperosmolar (EHH) no adulto',
  'nota-hcfmusp-cap97-99-intoxicacoes': 'intoxicações exógenas (carvão ativado)',
  'nota-hcfmusp-cap15-bradiarritmias': 'bradicardia e bradiarritmias no adulto',
  'nota-hcfmusp-cap17-fa': 'fibrilação atrial (FA) no adulto',
  'nota-hcfmusp-cap19-emergencia-hipertensiva': 'emergência hipertensiva e elevação da pressão arterial no adulto',
  'nota-hcfmusp-cap30-asma': 'crise de asma no adulto',
  'nota-hcfmusp-cap67-hiperpotassemia': 'hiperpotassemia (potássio alto) no adulto',
  'nota-hcfmusp-cap21-ic-aguda': 'insuficiência cardíaca aguda (IC descompensada) e edema agudo de pulmão (EAP) no adulto',
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

/** cap. 13 e 14: reperfusão, fibrinolíticos e anticoagulação pela AHA/ACC 2025 e ESC 2023
 *  (listas das fichas de fibrinolíticos e de anticoagulação plena). Antiagregação (AAS e
 *  inibidor de P2Y12) não entra: nenhuma ficha da Central compara essa parte. */
export const notaHcfmuspCap13 = nota('nota-hcfmusp-cap13-14-sca', 'Nota de atualização — manual HC, cap. 13 e 14: síndrome coronariana aguda', 'cap. 13, p. 199–211; cap. 14, p. 212–222', fichaFibrinoliticosAdulto, [
  ...DIRETRIZ_SCA_2025.map((d) => ({ tema: d.tema, diretriz: `${d.fonte}: ${d.diretriz}`, manual: sem(d.livro) })),
  ...DIFERENCAS_ANTICOAG_2025.map((t) => ({ tema: `Anticoagulação — ${t.split(':')[0]}`, diretriz: t, manual: 'no próprio item, com a página' })),
], semManual([...fichaFibrinoliticosAdulto.fontes, ...fichaAnticoagulacaoPlenaAdulto.fontes]).filter((f, i, a) => a.findIndex((x) => x.citacao === f.citacao) === i))
// versão .2: a .1 (já na homologação) tinha só os 3 itens de anticoagulação
notaHcfmuspCap13.ficha.versao = '2026-11-13.2'

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

// ── Lote 2 (decisão do RT de 13/11/2026, M1–M3 = A; docs/clinico/HCFMUSP-LOTE2-DIAGNOSTICO.md).
// Só os capítulos cuja ficha já tem a lista manual × diretriz e nenhuma diretriz mais nova.
const REVISADO_LOTE2 = '13/11/2026 (lote 2 da revisão do HCFMUSP: itens tirados da ficha da Central, já conferidos com a diretriz; aguarda aprovação do RT)'
function notaLote2(...a: Parameters<typeof nota>): NotaHcfmusp {
  const n = nota(...a)
  n.ficha.revisadoEm = REVISADO_LOTE2
  return n
}
/** Item de uma lista `string[]` em que a frase já traz o manual e a diretriz, com a página. */
/** O tema é o começo da própria frase (até o primeiro ':' ou ';'), cortado em 60 caracteres. */
function temaDaFrase(t: string): string {
  const s = t.split(/[:;]/)[0].trim().replace(/\.$/, '')
  return s.length <= 60 ? s : `${s.slice(0, s.lastIndexOf(' ', 60))}…`
}
const frase = (t: string) => ({ tema: temaDaFrase(t), diretriz: t, manual: 'no próprio item, com a página' })

/** cap. 15: AHA 2025 (Part 9, seção 19) e ERC/RCUK 2025. */
export const notaHcfmuspCap15 = notaLote2('nota-hcfmusp-cap15-bradiarritmias', 'Nota de atualização — manual HC, cap. 15: bradiarritmias', 'cap. 15, p. 223–232', fichaBradicardiaAdulto,
  DIFERENCAS_BRADI_2025.map(frase))

/** cap. 17: ESC 2024 e SBC/SOBRAC 2025 (M3: a base fica nessas duas). */
export const notaHcfmuspCap17 = notaLote2('nota-hcfmusp-cap17-fa', 'Nota de atualização — manual HC, cap. 17: fibrilação atrial', 'cap. 17, p. 243–256', fichaFibrilacaoAtrialAdulto, [
  ...DIFERENCAS_FA_2024.map(frase),
  ...DOSES_FA_2024.map((d) => ({ tema: `Dose IV na FA — ${d.droga}`, diretriz: `ESC 2024: ${d.esc}. SBC 2025: ${d.sbc}`, manual: d.livro })),
])

/** cap. 19: DBHA 2025 (M3: a base fica nela). */
export const notaHcfmuspCap19 = notaLote2('nota-hcfmusp-cap19-emergencia-hipertensiva', 'Nota de atualização — manual HC, cap. 19: emergências hipertensivas', 'cap. 19, p. 270–276', fichaEmergenciaHipertensivaAdulto, [
  ...DBHA_2025_ALVOS.map((d) => ({ tema: d.tema, diretriz: `DBHA 2025 (${d.forca}): ${d.dbha}${d.nota ? `. Nota: ${d.nota}` : ''}`, manual: sem(d.livro) })),
  ...DIFERENCAS_EH_2025.map(frase),
])

/** cap. 30: GINA 2026. */
export const notaHcfmuspCap30 = notaLote2('nota-hcfmusp-cap30-asma', 'Nota de atualização — manual HC, cap. 30: asma', 'cap. 30, p. 406–416', fichaAsmaAdulto,
  GINA_ITENS.map((g) => ({ tema: g.tema, diretriz: `GINA 2026, ${g.pagina}: ${g.gina}`, manual: sem(g.livro) })))

/** cap. 67, só a hiperpotassemia do adulto (a hipocalemia espera a leitura, M2). */
export const notaHcfmuspCap67 = notaLote2('nota-hcfmusp-cap67-hiperpotassemia', 'Nota de atualização — manual HC, cap. 67: hiperpotassemia', 'cap. 67, p. 900–917', fichaHiperpotassemia,
  DIVERGENCIA_MANUAL_HC.diferencas.map((t) => {
    const item = frase(t.replace(/desta tela/g, 'da ferramenta da Central').replace(/nesta tela/g, 'na ferramenta da Central').replace(/esta tela/g, 'a ferramenta da Central'))
    return { ...item, diretriz: `Ferramenta da Central (Geldermann, Emerg Med J 2026): ${item.diretriz}` }
  }),
  semManual(fichaHiperpotassemia.fontes).filter((f) => !f.pediatrica))

/** cap. 21 (M2): ESC 2026, recomendações da IC descompensada pelos slides oficiais da ESC; a ficha foi atualizada antes. */
export const notaHcfmuspCap21 = notaLote2('nota-hcfmusp-cap21-ic-aguda', 'Nota de atualização — manual HC, cap. 21: insuficiência cardíaca aguda', 'cap. 21, p. 286–303', fichaIcAgudaAdulto,
  DIRETRIZ_ICA_2026.map((d) => ({ tema: d.tema, diretriz: `ESC 2026 (${d.classe}; ${d.slide}): ${d.esc2026}`, manual: sem(d.livro) })))

export const NOTAS_HCFMUSP_LOTE2: NotaHcfmusp[] = [notaHcfmuspCap15, notaHcfmuspCap17, notaHcfmuspCap19, notaHcfmuspCap21, notaHcfmuspCap30, notaHcfmuspCap67]
export const NOTAS_HCFMUSP: NotaHcfmusp[] = [...NOTAS_HCFMUSP_LOTE1, ...NOTAS_HCFMUSP_LOTE2]

// Fichas, para a migration (npm run fichas:sql) e a Revisão Clínica.
export const fichaNotaHcfmuspCap2 = notaHcfmuspCap2.ficha
export const fichaNotaHcfmuspCap6 = notaHcfmuspCap6.ficha
export const fichaNotaHcfmuspCap7 = notaHcfmuspCap7.ficha
export const fichaNotaHcfmuspCap11 = notaHcfmuspCap11.ficha
export const fichaNotaHcfmuspCap13 = notaHcfmuspCap13.ficha
export const fichaNotaHcfmuspCap38 = notaHcfmuspCap38.ficha
export const fichaNotaHcfmuspCap64 = notaHcfmuspCap64.ficha
export const fichaNotaHcfmuspCap97 = notaHcfmuspCap97.ficha
export const fichaNotaHcfmuspCap15 = notaHcfmuspCap15.ficha
export const fichaNotaHcfmuspCap17 = notaHcfmuspCap17.ficha
export const fichaNotaHcfmuspCap19 = notaHcfmuspCap19.ficha
export const fichaNotaHcfmuspCap30 = notaHcfmuspCap30.ficha
export const fichaNotaHcfmuspCap67 = notaHcfmuspCap67.ficha
export const fichaNotaHcfmuspCap21 = notaHcfmuspCap21.ficha

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
  for (const i of n.itens) linhas.push(`## ${i.tema} — ${n.assunto}`, '', `Diretriz atual: ${ponto(i.diretriz)}`, '', `Manual de 2022: ${ponto(i.manual)}`, '')
  return linhas.join('\n')
}
