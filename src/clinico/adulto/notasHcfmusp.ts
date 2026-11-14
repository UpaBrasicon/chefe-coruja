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
import { DIRETRIZ_DPOC_GOLD_2026, GINA_ITENS, fichaAsmaAdulto, fichaDpocAdulto } from './asmaDpoc.ts'
import { DBHA_2025_ALVOS, DIFERENCAS_EH_2025, DIRETRIZ_AORTA_2024, fichaEmergenciaHipertensivaAdulto, fichaSindromeAorticaAdulto } from './emergenciaHipertensiva.ts'
import { DIFERENCAS_FA_2024, DOSES_FA_2024, fichaFibrilacaoAtrialAdulto } from './fibrilacaoAtrial.ts'
import { DAS_2025, DIRETRIZ_DAS_2025, fichaIsrAdulto } from './isr.ts'
import { DIRETRIZ_ICA_2026, fichaIcAgudaAdulto } from './insuficienciaCardiacaAguda.ts'
import { ACEP_2024_RECOMENDACOES, DIFERENCAS_AGITACAO_2024, fichaAgitacaoAdulto } from './agitacao.ts'
import { DIRETRIZ_HSA_2023, NOTA_ESO_ANTIFIBRINOLITICO, NOTA_NCS_FENITOINA, fichaHsaAdulto } from './hsa.ts'
import { DIRETRIZ_PAC_2026, NOTA_IDSA_PAC_2026, fichaPacAntibioticoAdulto } from './tepPac.ts'
import { DIRETRIZ_HIC_ESO_2025, ESO_HIC_2025, fichaReversaoAnticoagulacaoAdulto } from './reversaoAnticoagulacao.ts'
import { BAVENO_VIII_2026, DIRETRIZ_HDA, ESGE_UGIH_2026, fichaHemorragiaDigestiva } from './hemorragiaDigestiva.ts'
import { DIRETRIZ_HIPONATREMIA, ERA_HIPONATREMIA_2024, EUROPEIA_HIPONATREMIA_2014, fichaHiponatremia } from './sodio.ts'
import { DIRETRIZ_TRAUMA, EAST_TXA_2025, EUROPEIA_SANGRAMENTO_TRAUMA_2023, fichaTraumaAdulto } from './trauma.ts'
import { ABHH_NF_2024, DIRETRIZ_NF, MASCC_2026, fichaNeutropeniaFebrilAdulto } from './neutropeniaFebril.ts'
import { BAP_SUBSTANCIAS_2026, DIRETRIZ_SAA, fichaAbstinenciaAlcoolica } from './abstinenciaAlcoolica.ts'
import { DIRETRIZ_IA, DIRETRIZ_TT, ESE_ES_IA_GLICOCORTICOIDE_2024, ES_IA_PRIMARIA_2016, ETA_TEMPESTADE_2026, SFE_CRISE_ADRENAL_2016, fichaCriseTireotoxica, fichaInsuficienciaAdrenal } from './endocrino.ts'
import { DIRETRIZ_CALCIO, ES_HIPERCALCEMIA_MALIGNIDADE_2023, SFE_HIPERCALCEMIA_2016, SFE_HIPOCALCEMIA_2016, fichaHipercalcemia } from './eletrolitos.ts'
import { DIRETRIZ_MENINGITE, EAN_ESCMID_ENCEFALITE_2026, ESCMID_MENINGITE_2016, fichaMeningiteAdulto } from './meningite.ts'
import { AHA_TEP_2026, DIRETRIZ_TEP_2026 } from './tep2026.ts'
import { AARC_TRE_2024, ATS_IRPA_2026, ATS_SDRA_2024, DEFINICAO_GLOBAL_SDRA_2024, DIRETRIZ_SDRA_2024, ESICM_SDRA_2023, NOTA_AARC_TRE, NOTA_ATS_POS_EXTUBACAO, NOTA_SCCM_BNM, SCCM_BNM_2026, fichaSdraAdulto } from './ventilacaoMecanica.ts'
import { ASH_TEV_2020, DIRETRIZ_TVP } from './tvp2026.ts'
import { ADA_HIPOGLICEMIA_2026, DIFERENCAS_2024, DIRETRIZ_HIPOGLICEMIA, ENDOCRINE_HIPOGLICEMIA_2023, fichaCadEhhTratamento, fichaHipoglicemia } from './glicemia.ts'
import { DIVERGENCIA_MANUAL_HC, fichaHiperpotassemia } from '../hiperpotassemia.ts'
import { CARVAO_CTRC_2026, CARVAO_INDICACAO, fichaIntoxicacoesAdulto } from './intoxicacoes.ts'
import { COSTR_2026_PCR, DIFERENCAS_BRADI_2025, DIRETRIZ_ALS_2025, DIRETRIZ_TAQUI_2025, fichaBradicardiaAdulto, fichaPcrAdulto, fichaTaquiarritmiaAdulto } from './pcr.ts'
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
  'nota-hcfmusp-cap3-via-aerea': 'via aérea, intubação orotraqueal e sequência rápida de intubação (IOT, SRI, ISR) no adulto, via aérea difícil e cricotireoidostomia',
  'nota-hcfmusp-cap15-bradiarritmias': 'bradicardia e bradiarritmias no adulto',
  'nota-hcfmusp-cap17-fa': 'fibrilação atrial (FA) no adulto',
  'nota-hcfmusp-cap18-taquiarritmias': 'taquicardia e taquiarritmias com pulso no adulto (QRS largo, QRS estreito ou taquicardia supraventricular (TSV), TV polimórfica e torsades)',
  'nota-hcfmusp-cap19-emergencia-hipertensiva': 'emergência hipertensiva e elevação da pressão arterial no adulto',
  'nota-hcfmusp-cap20-sindrome-aortica': 'síndrome aórtica aguda (dissecção de aorta), hematoma intramural, úlcera penetrante e aneurisma de aorta no adulto',
  'nota-hcfmusp-cap30-asma': 'crise de asma no adulto',
  'nota-hcfmusp-cap31-dpoc': 'exacerbação de DPOC (doença pulmonar obstrutiva crônica) no adulto',
  'nota-hcfmusp-cap32-tep': 'tromboembolismo pulmonar (TEP, embolia pulmonar) agudo no adulto',
  'nota-hcfmusp-cap67-hiperpotassemia': 'hiperpotassemia (potássio alto) no adulto',
  'nota-hcfmusp-cap33-pac': 'pneumonia adquirida na comunidade (PAC) no adulto: antibiótico, duração, corticoide e vírus respiratório',
  'nota-hcfmusp-cap40-hsa': 'hemorragia subaracnóidea (HSA) aneurismática no adulto',
  'nota-hcfmusp-cap76-agitacao': 'paciente agitado e agitação grave no adulto (sedação: droperidol, antipsicótico, midazolam, cetamina)',
  'nota-hcfmusp-cap66-sodio': 'hiponatremia no adulto: NaCl 3%, bolus, limite de correção, hipercorreção, SIADH, restrição hídrica, ureia e vaptana (distúrbios do sódio)',
  'nota-hcfmusp-cap47-trauma': 'politraumatizado e sangramento no trauma (ácido tranexâmico, hipotensão permissiva, Ringer lactato no TCE, transfusão maciça, fibrinogênio, cálcio, pelve, reversão de anticoagulante)',
  'nota-hcfmusp-cap65-hipoglicemia': 'hipoglicemia no adulto (níveis 1, 2 e 3, glicose oral 15 g, glucagon, recorrência, sulfonilureia, acarbose)',
  'nota-hcfmusp-cap81-neutropenia': 'neutropenia febril no adulto (antibiótico empírico, cefepima, piperacilina-tazobactam, carbapenêmico, vancomicina, antifúngico, quando parar, MASCC)',
  'nota-hcfmusp-cap78-abstinencia': 'síndrome de abstinência alcoólica e delirium tremens (benzodiazepínico, esquema de dose, fenobarbital, antipsicótico, tiamina e Wernicke, magnésio)',
  'nota-hcfmusp-cap25-tvp': 'trombose venosa profunda (TVP): tratamento em casa, DOAC ou varfarina, duração da anticoagulação, filtro de veia cava, trombólise, aspirina na prevenção secundária',
  'nota-hcfmusp-cap37-vm': 'ventilação mecânica e SDRA no adulto (volume corrente, PEEP, prona, recrutamento, bloqueio neuromuscular, corticoide, ECMO, cânula nasal de alto fluxo, desmame e pós-extubação)',
  'nota-hcfmusp-cap72-adrenal': 'insuficiência adrenal e crise adrenal (addisoniana) no adulto: hidrocortisona, volume, teste com ACTH, fludrocortisona, glicocorticoide em uso, dose de estresse',
  'nota-hcfmusp-cap70-tireotoxica': 'crise tireotóxica (tempestade tireoidiana) no adulto: Burch-Wartofsky, betabloqueador, propranolol, esmolol, metimazol, propiltiouracil (PTU), iodo, Lugol, hidrocortisona, plasmaférese',
  'nota-hcfmusp-cap68-calcio': 'distúrbios do cálcio no adulto: hipercalcemia (da malignidade, bisfosfonato, ácido zoledrônico, pamidronato, denosumabe, calcitonina, hidratação) e hipocalcemia (gluconato de cálcio, magnésio)',
  'nota-hcfmusp-cap50-hda': 'hemorragia digestiva alta (HDA) no adulto: úlcera péptica sangrante e varizes esofágicas (transfusão, endoscopia, IBP, vasoativo, antibiótico, TIPS, profilaxia)',
  'nota-hcfmusp-cap43-neuroinfeccao': 'meningite bacteriana, encefalite e neuroinfecção no adulto (antibiótico, dexametasona, aciclovir, profilaxia de contatos)',
  'nota-hcfmusp-cap39-hic': 'hemorragia intracerebral (intraparenquimatosa) espontânea, AVC hemorrágico (HIC, HIP) no adulto',
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
], semManual([...fichaFibrinoliticosAdulto.fontes, ...fichaAnticoagulacaoPlenaAdulto.fontes]).filter((f, i, a) => f !== AHA_TEP_2026 && f !== ASH_TEV_2020 && a.findIndex((x) => x.citacao === f.citacao) === i))
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

/** cap. 3: DAS 2025 (M2), lida no texto integral em 14/11/2026; consenso, sem classe. */
export const notaHcfmuspCap3 = notaLote2('nota-hcfmusp-cap3-via-aerea', 'Nota de atualização — manual HC, cap. 3: manejo da via aérea', 'cap. 3, p. 54–65', fichaIsrAdulto,
  DIRETRIZ_DAS_2025.map((d) => ({ tema: d.tema, diretriz: `DAS 2025 (${d.onde}): ${d.das}`, manual: sem(d.livro) })),
  [DAS_2025])
notaHcfmuspCap3.ficha.versao = '2026-11-14.1'
notaHcfmuspCap3.ficha.revisadoEm = '14/11/2026 (lote 2 da revisão do HCFMUSP: itens tirados da lista da DAS 2025, lida no texto integral; aguarda aprovação do RT)'

/** cap. 15: AHA 2025 (Part 9, seção 19) e ERC/RCUK 2025. */
export const notaHcfmuspCap15 = notaLote2('nota-hcfmusp-cap15-bradiarritmias', 'Nota de atualização — manual HC, cap. 15: bradiarritmias', 'cap. 15, p. 223–232', fichaBradicardiaAdulto,
  DIFERENCAS_BRADI_2025.map(frase))

/** cap. 17: ESC 2024 e SBC/SOBRAC 2025 (M3: a base fica nessas duas). */
export const notaHcfmuspCap17 = notaLote2('nota-hcfmusp-cap17-fa', 'Nota de atualização — manual HC, cap. 17: fibrilação atrial', 'cap. 17, p. 243–256', fichaFibrilacaoAtrialAdulto, [
  ...DIFERENCAS_FA_2024.map(frase),
  ...DOSES_FA_2024.map((d) => ({ tema: `Dose IV na FA — ${d.droga}`, diretriz: `ESC 2024: ${d.esc}. SBC 2025: ${d.sbc}`, manual: d.livro })),
])

/** cap. 18: AHA 2025 (Part 9), seções de taquicardia com pulso (M2), lidas em 14/11/2026. */
export const notaHcfmuspCap18 = notaLote2('nota-hcfmusp-cap18-taquiarritmias', 'Nota de atualização — manual HC, cap. 18: outras taquiarritmias', 'cap. 18, p. 257–269', fichaTaquiarritmiaAdulto,
  DIRETRIZ_TAQUI_2025.map((d) => ({ tema: d.tema, diretriz: `AHA 2025 (${d.classe}; ${d.onde}): ${d.aha}`, manual: sem(d.livro) })))
notaHcfmuspCap18.ficha.versao = '2026-11-14.1'
notaHcfmuspCap18.ficha.revisadoEm = '14/11/2026 (lote 2 da revisão do HCFMUSP: itens tirados da lista da AHA 2025, lida no texto integral; aguarda aprovação do RT)'

/** cap. 19: DBHA 2025 (M3: a base fica nela). */
export const notaHcfmuspCap19 = notaLote2('nota-hcfmusp-cap19-emergencia-hipertensiva', 'Nota de atualização — manual HC, cap. 19: emergências hipertensivas', 'cap. 19, p. 270–276', fichaEmergenciaHipertensivaAdulto, [
  ...DBHA_2025_ALVOS.map((d) => ({ tema: d.tema, diretriz: `DBHA 2025 (${d.forca}): ${d.dbha}${d.nota ? `. Nota: ${d.nota}` : ''}`, manual: sem(d.livro) })),
  ...DIFERENCAS_EH_2025.map(frase),
])

/** cap. 20: ESC 2024 de aorta (M2), pelo slideset oficial. */
export const notaHcfmuspCap20 = notaLote2('nota-hcfmusp-cap20-sindrome-aortica', 'Nota de atualização — manual HC, cap. 20: síndrome aórtica aguda', 'cap. 20, p. 277–285', fichaSindromeAorticaAdulto,
  DIRETRIZ_AORTA_2024.map((d) => ({ tema: d.tema, diretriz: `ESC 2024 (${d.classe}; ${d.slide}): ${d.esc2024}`, manual: sem(d.livro) })))

/** cap. 30: GINA 2026. */
export const notaHcfmuspCap30 = notaLote2('nota-hcfmusp-cap30-asma', 'Nota de atualização — manual HC, cap. 30: asma', 'cap. 30, p. 406–416', fichaAsmaAdulto,
  GINA_ITENS.map((g) => ({ tema: g.tema, diretriz: `GINA 2026, ${g.pagina}: ${g.gina}`, manual: sem(g.livro) })))

/** cap. 31: GOLD 2026, capítulo 4 (M2), pelo PDF do relatório. */
export const notaHcfmuspCap31 = notaLote2('nota-hcfmusp-cap31-dpoc', 'Nota de atualização — manual HC, cap. 31: exacerbação de DPOC', 'cap. 31, p. 417–428', fichaDpocAdulto,
  DIRETRIZ_DPOC_GOLD_2026.map((d) => ({ tema: d.tema, diretriz: `GOLD 2026 (${d.onde}): ${d.gold}`, manual: sem(d.livro) })))

/** cap. 32: AHA/ACC 2026 de TEP (M2), lida no texto integral em 14/11/2026. */
export const notaHcfmuspCap32 = notaLote2('nota-hcfmusp-cap32-tep', 'Nota de atualização — manual HC, cap. 32: tromboembolismo pulmonar', 'cap. 32, p. 429–449', fichaFibrinoliticosAdulto,
  DIRETRIZ_TEP_2026.map((d) => ({ tema: d.tema, diretriz: `AHA/ACC 2026 (${d.classe}; ${d.onde}): ${d.aha}`, manual: sem(d.livro) })),
  [AHA_TEP_2026])
notaHcfmuspCap32.ficha.versao = '2026-11-14.1'
notaHcfmuspCap32.ficha.revisadoEm = '14/11/2026 (lote 2 da revisão do HCFMUSP: itens tirados da lista da AHA/ACC 2026, lida no texto integral; aguarda aprovação do RT)'

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

export const NOTAS_HCFMUSP_LOTE2: NotaHcfmusp[] = [notaHcfmuspCap3, notaHcfmuspCap15, notaHcfmuspCap17, notaHcfmuspCap18, notaHcfmuspCap19, notaHcfmuspCap20, notaHcfmuspCap21, notaHcfmuspCap30, notaHcfmuspCap31, notaHcfmuspCap32, notaHcfmuspCap67]
// ── Lote 3 (decisão do RT de 14/11/2026, N1–N3 = A; docs/clinico/HCFMUSP-LOTE3-DIAGNOSTICO.md).
// N1: capítulos cuja ficha já tem a lista manual × diretriz e nenhuma diretriz mais nova.
const REVISADO_LOTE3 = '14/11/2026 (lote 3 da revisão do HCFMUSP: itens tirados da ficha da Central, já conferidos com a diretriz; aguarda aprovação do RT)'
function notaLote3(...a: Parameters<typeof nota>): NotaHcfmusp {
  const n = nota(...a)
  n.ficha.versao = '2026-11-14.1'
  n.ficha.revisadoEm = REVISADO_LOTE3
  return n
}

/** cap. 33: ATS 2025 (lida no texto integral) e o comunicado da IDSA de 2026 (N3). */
export const notaHcfmuspCap33 = notaLote3('nota-hcfmusp-cap33-pac', 'Nota de atualização — manual HC, cap. 33: pneumonia adquirida na comunidade', 'cap. 33, p. 450–467', fichaPacAntibioticoAdulto, [
  ...DIRETRIZ_PAC_2026.map((d) => ({ tema: d.tema, diretriz: `ATS 2026 (${d.forca}): ${d.ats}`, manual: sem(d.livro) })),
  { tema: 'A IDSA não endossa a ATS 2025', diretriz: NOTA_IDSA_PAC_2026, manual: 'não trata do ponto' },
])

/** cap. 40: AHA/ASA 2023, com as notas da ESO/EANS/ESMINT 2026 e da NCS 2026. */
export const notaHcfmuspCap40 = notaLote3('nota-hcfmusp-cap40-hsa', 'Nota de atualização — manual HC, cap. 40: hemorragia subaracnóidea não traumática', 'cap. 40, p. 550–563', fichaHsaAdulto, [
  ...DIRETRIZ_HSA_2023.map((d) => ({ tema: d.tema, diretriz: `AHA/ASA 2023 (${d.classe}; ${d.pagina}): ${d.aha}${d.nota ? `. Nota: ${d.nota}` : ''}`, manual: sem(d.livro) })),
  frase(NOTA_ESO_ANTIFIBRINOLITICO),
  frase(NOTA_NCS_FENITOINA),
])

/** cap. 76: ACEP 2024 (agitação grave). */
const LIVRO_ACEP: Record<string, string> = {
  B: 'haloperidol + prometazina e midazolam + haloperidol; midazolam isolado na agitação moderada (p. 1011)',
  'C (consenso)': 'quetamina 5 mg/kg IM como 1ª escolha na agitação grave (Tabela 4, p. 1011)',
}
export const notaHcfmuspCap76 = notaLote3('nota-hcfmusp-cap76-agitacao', 'Nota de atualização — manual HC, cap. 76: o paciente agitado', 'cap. 76, p. 1005–1017', fichaAgitacaoAdulto, [
  ...ACEP_2024_RECOMENDACOES.filter((r) => r.nivel !== 'A').map((r) => ({ tema: `ACEP 2024, nível ${r.nivel}`, diretriz: `ACEP 2024 (nível ${r.nivel}): ${r.texto}`, manual: sem(LIVRO_ACEP[r.nivel]) })),
  ...DIFERENCAS_AGITACAO_2024.map(frase),
])

export const notaHcfmuspCap39 = nota('nota-hcfmusp-cap39-hic', 'Nota de atualização — manual HC, cap. 39: hemorragias intraparenquimatosas', 'cap. 39, p. 542–549', fichaReversaoAnticoagulacaoAdulto,
  DIRETRIZ_HIC_ESO_2025.map((d) => ({ tema: d.tema, diretriz: `ESO/EANS 2025 (${d.forca}; ${d.onde}): ${d.eso}`, manual: sem(d.livro) })),
  [ESO_HIC_2025])
notaHcfmuspCap39.ficha.versao = '2026-11-14.1'
notaHcfmuspCap39.ficha.revisadoEm = '14/11/2026 (lote 3 da revisão do HCFMUSP: itens tirados da lista da ESO/EANS 2025, lida no texto integral; aguarda aprovação do RT)'

/** cap. 43: ESCMID 2016 (meningite bacteriana) e EAN–ESCMID 2026 (encefalite), lidas no texto integral. */
export const notaHcfmuspCap43 = nota('nota-hcfmusp-cap43-neuroinfeccao', 'Nota de atualização — manual HC, cap. 43: neuroinfecção', 'cap. 43, p. 589–597', fichaMeningiteAdulto,
  DIRETRIZ_MENINGITE.map((d) => ({ tema: d.tema, diretriz: `${d.fonte} (${d.grau}): ${d.diretriz}`, manual: sem(d.livro) })),
  [ESCMID_MENINGITE_2016, EAN_ESCMID_ENCEFALITE_2026])
notaHcfmuspCap43.ficha.versao = '2026-11-14.1'
notaHcfmuspCap43.ficha.revisadoEm = '14/11/2026 (lote 3 da revisão do HCFMUSP: itens tirados da lista da ESCMID 2016 e da EAN–ESCMID 2026, lidas no texto integral; aguarda aprovação do RT)'

/** cap. 50: ESGE 2026 (úlcera péptica) e Baveno VIII (varizes), lidos no texto integral. */
export const notaHcfmuspCap50 = nota('nota-hcfmusp-cap50-hda', 'Nota de atualização — manual HC, cap. 50: hemorragia digestiva alta', 'cap. 50, p. 694–706', fichaHemorragiaDigestiva,
  DIRETRIZ_HDA.map((d) => ({ tema: d.tema, diretriz: `${d.fonte} (${d.grau}): ${d.diretriz}`, manual: sem(d.livro) })),
  [ESGE_UGIH_2026, BAVENO_VIII_2026])
notaHcfmuspCap50.ficha.versao = '2026-11-14.1'
notaHcfmuspCap50.ficha.revisadoEm = '14/11/2026 (lote 3 da revisão do HCFMUSP: itens tirados da lista da ESGE 2026 e do Baveno VIII, lidos no texto integral; aguarda aprovação do RT)'

/** cap. 66, só a hiponatremia: europeia 2014 (graduada) e ERA 2024 (revisão), lidas no texto integral. */
export const notaHcfmuspCap66 = nota('nota-hcfmusp-cap66-sodio', 'Nota de atualização — manual HC, cap. 66: distúrbios do sódio (hiponatremia)', 'cap. 66, p. 882–891', fichaHiponatremia,
  DIRETRIZ_HIPONATREMIA.map((d) => ({ tema: d.tema, diretriz: `${d.fonte} (${d.grau}): ${d.diretriz}`, manual: sem(d.livro) })),
  [EUROPEIA_HIPONATREMIA_2014, ERA_HIPONATREMIA_2024])
notaHcfmuspCap66.ficha.versao = '2026-11-14.1'
notaHcfmuspCap66.ficha.revisadoEm = '14/11/2026 (lote 3 da revisão do HCFMUSP: itens tirados da diretriz europeia de 2014 e da revisão da ERA de 2024, lidas no texto integral; aguarda aprovação do RT)'

/** cap. 47: europeia 2023 de sangramento no trauma (texto integral) e EAST 2025 de ácido tranexâmico (resumo). */
export const notaHcfmuspCap47 = nota('nota-hcfmusp-cap47-trauma', 'Nota de atualização — manual HC, cap. 47: atendimento inicial do politraumatizado', 'cap. 47, p. 636–657', fichaTraumaAdulto,
  DIRETRIZ_TRAUMA.map((d) => ({ tema: d.tema, diretriz: `${d.fonte} (${d.grau}): ${d.diretriz}`, manual: sem(d.livro) })),
  [EUROPEIA_SANGRAMENTO_TRAUMA_2023, EAST_TXA_2025])
notaHcfmuspCap47.ficha.versao = '2026-11-14.1'
notaHcfmuspCap47.ficha.revisadoEm = '14/11/2026 (lote 3 da revisão do HCFMUSP: itens tirados da diretriz europeia de 2023, lida no texto integral, e da EAST 2025, lida no resumo; aguarda aprovação do RT)'

/** cap. 65: ADA 2026, seção 6 (texto integral), e Endocrine Society 2023 (resumo). */
export const notaHcfmuspCap65 = nota('nota-hcfmusp-cap65-hipoglicemia', 'Nota de atualização — manual HC, cap. 65: hipoglicemia', 'cap. 65, p. 877–881', fichaHipoglicemia,
  DIRETRIZ_HIPOGLICEMIA.map((d) => ({ tema: d.tema, diretriz: `${d.fonte} (${d.grau}): ${d.diretriz}`, manual: sem(d.livro) })),
  [ADA_HIPOGLICEMIA_2026, ENDOCRINE_HIPOGLICEMIA_2023])
notaHcfmuspCap65.ficha.versao = '2026-11-14.1'
notaHcfmuspCap65.ficha.revisadoEm = '14/11/2026 (lote 3 da revisão do HCFMUSP: itens tirados da ADA 2026, lida no texto integral, e da Endocrine Society 2023, lida no resumo; aguarda aprovação do RT)'

/** cap. 81: consenso da ABHH 2024 (texto integral) e MASCC 2026 (resumo). */
export const notaHcfmuspCap81 = nota('nota-hcfmusp-cap81-neutropenia', 'Nota de atualização — manual HC, cap. 81: neutropenia febril', 'cap. 81, p. 1062–1072', fichaNeutropeniaFebrilAdulto,
  DIRETRIZ_NF.map((d) => ({ tema: d.tema, diretriz: `${d.fonte} (${d.grau}): ${d.diretriz}`, manual: sem(d.livro) })),
  [ABHH_NF_2024, MASCC_2026])
notaHcfmuspCap81.ficha.versao = '2026-11-14.1'
notaHcfmuspCap81.ficha.revisadoEm = '14/11/2026 (lote 3 da revisão do HCFMUSP: itens tirados do consenso da ABHH 2024, lido no texto integral, e do MASCC 2026, lido no resumo; aguarda aprovação do RT)'

/** cap. 78: BAP 2026 (parte de álcool), lida no texto integral. */
export const notaHcfmuspCap78 = nota('nota-hcfmusp-cap78-abstinencia', 'Nota de atualização — manual HC, cap. 78: síndrome de abstinência alcoólica', 'cap. 78, p. 1024–1035', fichaAbstinenciaAlcoolica,
  DIRETRIZ_SAA.map((d) => ({ tema: d.tema, diretriz: `${d.fonte} (${d.grau}): ${d.diretriz}`, manual: sem(d.livro) })),
  [BAP_SUBSTANCIAS_2026])
notaHcfmuspCap78.ficha.versao = '2026-11-14.1'
notaHcfmuspCap78.ficha.revisadoEm = '14/11/2026 (lote 3 da revisão do HCFMUSP: itens tirados da BAP 2026, lida no texto integral; aguarda aprovação do RT)'

/** cap. 25: ASH 2020 de tratamento do TEV, lida no texto integral (só a TVP). */
export const notaHcfmuspCap25 = nota('nota-hcfmusp-cap25-tvp', 'Nota de atualização — manual HC, cap. 25: trombose venosa profunda', 'cap. 25, p. 345–357', fichaAnticoagulacaoPlenaAdulto,
  DIRETRIZ_TVP.map((d) => ({ tema: d.tema, diretriz: `${d.fonte} (${d.grau}): ${d.diretriz}`, manual: sem(d.livro) })),
  [ASH_TEV_2020])
notaHcfmuspCap25.ficha.versao = '2026-11-14.1'
notaHcfmuspCap25.ficha.revisadoEm = '14/11/2026 (lote 3 da revisão do HCFMUSP: itens tirados da ASH 2020, lida no texto integral; aguarda aprovação do RT)'

export const NOTAS_HCFMUSP_LOTE3: NotaHcfmusp[] = [notaHcfmuspCap25, notaHcfmuspCap33, notaHcfmuspCap39, notaHcfmuspCap40, notaHcfmuspCap43, notaHcfmuspCap47, notaHcfmuspCap50, notaHcfmuspCap65, notaHcfmuspCap66, notaHcfmuspCap76, notaHcfmuspCap78, notaHcfmuspCap81]
// ── Lote 4 (decisão do RT de 14/11/2026, O1–O4 = A; docs/clinico/HCFMUSP-LOTE4-DIAGNOSTICO.md).
// O1: o cap. 37 já tem a lista manual × diretriz (ATS 2024 e ESICM 2023) e as notas da SCCM 2026, da AARC 2024 e da ATS 2026.
const REVISADO_LOTE4 = '14/11/2026 (lote 4 da revisão do HCFMUSP: itens tirados da ficha da Central, já conferidos com a diretriz; aguarda aprovação do RT)'
function notaLote4(...a: Parameters<typeof nota>): NotaHcfmusp {
  const n = nota(...a)
  n.ficha.versao = '2026-11-14.1'
  n.ficha.revisadoEm = REVISADO_LOTE4
  return n
}

const LIVRO_BNM = DIRETRIZ_SDRA_2024.find((d) => d.tema === 'Bloqueio neuromuscular')?.livro

/** cap. 37: ATS 2024, ESICM 2023 e definição global 2024 (lidas no texto integral), mais as notas de 2024–2026. */
export const notaHcfmuspCap37 = notaLote4('nota-hcfmusp-cap37-vm', 'Nota de atualização — manual HC, cap. 37: ventilação mecânica no departamento de emergência', 'cap. 37, p. 498–512', fichaSdraAdulto, [
  ...DIRETRIZ_SDRA_2024.map((d) => ({ tema: d.tema, diretriz: `${d.fonte} (${d.forca}): ${d.diretriz}`, manual: sem(d.livro) })),
  { tema: 'Bloqueio neuromuscular (SCCM 2026)', diretriz: NOTA_SCCM_BNM, manual: sem(LIVRO_BNM) },
  { tema: 'Teste de respiração espontânea', diretriz: NOTA_AARC_TRE, manual: 'critérios de prontidão e de falência do TRE na Figura 5 (p. 510)' },
  { tema: 'Depois da extubação', diretriz: NOTA_ATS_POS_EXTUBACAO, manual: 'sem item do manual na ferramenta' },
], [DEFINICAO_GLOBAL_SDRA_2024, ATS_SDRA_2024, ESICM_SDRA_2023, SCCM_BNM_2026, AARC_TRE_2024, ATS_IRPA_2026])

/** cap. 72: Endocrine Society 2016, SfE 2016 e ESE/ES 2024, lidas no texto integral (só o adulto). */
export const notaHcfmuspCap72 = nota('nota-hcfmusp-cap72-adrenal', 'Nota de atualização — manual HC, cap. 72: insuficiência adrenal', 'cap. 72, p. 964–973', fichaInsuficienciaAdrenal,
  DIRETRIZ_IA.map((d) => ({ tema: d.tema, diretriz: `${d.fonte} (${d.grau}): ${d.diretriz}`, manual: sem(d.livro) })),
  [ES_IA_PRIMARIA_2016, SFE_CRISE_ADRENAL_2016, ESE_ES_IA_GLICOCORTICOIDE_2024])
notaHcfmuspCap72.ficha.versao = '2026-11-14.1'
notaHcfmuspCap72.ficha.revisadoEm = '14/11/2026 (lote 4 da revisão do HCFMUSP: itens tirados da Endocrine Society 2016, da SfE 2016 e da ESE/ES 2024, lidas no texto integral; aguarda aprovação do RT)'

/** cap. 70: consenso ETA/BTA/SfE 2026 de tempestade tireoidiana, lido no texto integral. */
export const notaHcfmuspCap70 = nota('nota-hcfmusp-cap70-tireotoxica', 'Nota de atualização — manual HC, cap. 70: crise tireotóxica', 'cap. 70, p. 947–957', fichaCriseTireotoxica,
  DIRETRIZ_TT.map((d) => ({ tema: d.tema, diretriz: `${d.fonte} (${d.grau}): ${d.diretriz}`, manual: sem(d.livro) })),
  [ETA_TEMPESTADE_2026])
notaHcfmuspCap70.ficha.versao = '2026-11-14.1'
notaHcfmuspCap70.ficha.revisadoEm = '14/11/2026 (lote 4 da revisão do HCFMUSP: itens tirados do consenso ETA/BTA/SfE 2026, lido no texto integral; aguarda aprovação do RT)'

/** cap. 68: Endocrine Society 2023 (hipercalcemia da malignidade) e SfE 2016 (hipercalcemia e hipocalcemia), lidas no texto integral. */
export const notaHcfmuspCap68 = nota('nota-hcfmusp-cap68-calcio', 'Nota de atualização — manual HC, cap. 68: distúrbios do cálcio', 'cap. 68, p. 918–930', fichaHipercalcemia,
  DIRETRIZ_CALCIO.map((d) => ({ tema: `${d.parte === 'hipo' ? 'Hipocalcemia' : 'Hipercalcemia'} — ${d.tema}`, diretriz: `${d.fonte} (${d.grau}): ${d.diretriz}`, manual: sem(d.livro) })),
  [ES_HIPERCALCEMIA_MALIGNIDADE_2023, SFE_HIPERCALCEMIA_2016, SFE_HIPOCALCEMIA_2016])
notaHcfmuspCap68.ficha.versao = '2026-11-14.1'
notaHcfmuspCap68.ficha.revisadoEm = '14/11/2026 (lote 4 da revisão do HCFMUSP: itens tirados da Endocrine Society 2023 e da SfE 2016, lidas no texto integral; aguarda aprovação do RT)'

export const NOTAS_HCFMUSP_LOTE4: NotaHcfmusp[] = [notaHcfmuspCap37, notaHcfmuspCap68, notaHcfmuspCap70, notaHcfmuspCap72]

export const NOTAS_HCFMUSP: NotaHcfmusp[] = [...NOTAS_HCFMUSP_LOTE1, ...NOTAS_HCFMUSP_LOTE2, ...NOTAS_HCFMUSP_LOTE3, ...NOTAS_HCFMUSP_LOTE4]

// Fichas, para a migration (npm run fichas:sql) e a Revisão Clínica.
export const fichaNotaHcfmuspCap2 = notaHcfmuspCap2.ficha
export const fichaNotaHcfmuspCap6 = notaHcfmuspCap6.ficha
export const fichaNotaHcfmuspCap7 = notaHcfmuspCap7.ficha
export const fichaNotaHcfmuspCap11 = notaHcfmuspCap11.ficha
export const fichaNotaHcfmuspCap13 = notaHcfmuspCap13.ficha
export const fichaNotaHcfmuspCap38 = notaHcfmuspCap38.ficha
export const fichaNotaHcfmuspCap64 = notaHcfmuspCap64.ficha
export const fichaNotaHcfmuspCap97 = notaHcfmuspCap97.ficha
export const fichaNotaHcfmuspCap3 = notaHcfmuspCap3.ficha
export const fichaNotaHcfmuspCap15 = notaHcfmuspCap15.ficha
export const fichaNotaHcfmuspCap17 = notaHcfmuspCap17.ficha
export const fichaNotaHcfmuspCap18 = notaHcfmuspCap18.ficha
export const fichaNotaHcfmuspCap19 = notaHcfmuspCap19.ficha
export const fichaNotaHcfmuspCap20 = notaHcfmuspCap20.ficha
export const fichaNotaHcfmuspCap30 = notaHcfmuspCap30.ficha
export const fichaNotaHcfmuspCap31 = notaHcfmuspCap31.ficha
export const fichaNotaHcfmuspCap32 = notaHcfmuspCap32.ficha
export const fichaNotaHcfmuspCap67 = notaHcfmuspCap67.ficha
export const fichaNotaHcfmuspCap33 = notaHcfmuspCap33.ficha
export const fichaNotaHcfmuspCap40 = notaHcfmuspCap40.ficha
export const fichaNotaHcfmuspCap76 = notaHcfmuspCap76.ficha
export const fichaNotaHcfmuspCap39 = notaHcfmuspCap39.ficha
export const fichaNotaHcfmuspCap43 = notaHcfmuspCap43.ficha
export const fichaNotaHcfmuspCap50 = notaHcfmuspCap50.ficha
export const fichaNotaHcfmuspCap66 = notaHcfmuspCap66.ficha
export const fichaNotaHcfmuspCap47 = notaHcfmuspCap47.ficha
export const fichaNotaHcfmuspCap37 = notaHcfmuspCap37.ficha
export const fichaNotaHcfmuspCap72 = notaHcfmuspCap72.ficha
export const fichaNotaHcfmuspCap70 = notaHcfmuspCap70.ficha
export const fichaNotaHcfmuspCap68 = notaHcfmuspCap68.ficha
export const fichaNotaHcfmuspCap25 = notaHcfmuspCap25.ficha
export const fichaNotaHcfmuspCap78 = notaHcfmuspCap78.ficha
export const fichaNotaHcfmuspCap81 = notaHcfmuspCap81.ficha
export const fichaNotaHcfmuspCap65 = notaHcfmuspCap65.ficha
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
