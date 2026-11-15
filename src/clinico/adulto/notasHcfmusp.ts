// Notas de atualização do Manual HCFMUSP (2022), lote 1 da revisão (decisão do RT
// de 13/11/2026, L1–L3 = A; docs/clinico/HCFMUSP-LOTE1-DIAGNOSTICO.md).
//
// O livro não é editado. Cada nota diz, por capítulo, onde a diretriz mais
// recente diz outra coisa, e entra na biblioteca da IA ao lado do texto do
// manual. NADA aqui é escrito à mão: os itens vêm das listas que as fichas da
// Central já conferiram (com página e fonte). Cada nota é uma ficha, com versão,
// e passa pela aprovação do RT na Revisão Clínica (L3).
import type { Fonte, Ficha } from '../ficha.ts'
import { ACG_ALD_2024, ACG_IHA_2023, DIRETRIZ_IHA_2023 } from './hepatopata.ts'
import { DIRETRIZ_SSJ_NET_2025, LATAM_SSJ_NET_2025, fichaDermatosesAdulto } from './dermatoses.ts'
import { DIRETRIZ_SINCOPE_2024, EUSEM_SINCOPE_2024, sincopeSanFrancisco } from './sincopeSanFrancisco.ts'
import { DIRETRIZ_DOR_TORACICA_2025, SBC_DOR_TORACICA_2025, heart } from '../escores/heart.ts'
import { DIRETRIZ_SGB_2023, EAN_PNS_SGB_2023, fichaSgbAdulto } from './guillainBarre.ts'
import { AHS_2025, AHS_2025_NIVEIS, fichaCefaleiaAdulto } from './cefaleia.ts'
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
import { AAO_HNS_EPISTAXE_2020, ANNEXA_I, DIRETRIZ_HIC_ESO_2025, ESO_HIC_2025, SBTH_2026, fichaReversaoAnticoagulacaoAdulto } from './reversaoAnticoagulacao.ts'
import { SOHO_2026, fichaOxigenacaoAdulto } from './oxigenacao.ts'
import { AABB_2023, AABB_IAM_2025, AABB_PLAQUETAS_2025, HEMOTION_2024, SAHARA_2025, TRAIN_2024, fichaTransfusaoAdulto } from './transfusao.ts'
import { DIRETRIZ_AFOGAMENTO, DIRETRIZ_HIPOTERMIA_2025, ERC_2025_HIPOTERMIA, WMS_AFOGAMENTO_2024, fichaHipotermiaAdulto, szpilman } from './ambientais.ts'
import { ACG_HDB_2023, BAVENO_VIII_2026, DIRETRIZ_HDA, DIRETRIZ_HDB_2023, ESGE_UGIH_2026, fichaHemorragiaDigestiva, fichaOakland } from './hemorragiaDigestiva.ts'
import { DIRETRIZ_HIPONATREMIA, ERA_HIPONATREMIA_2024, EUROPEIA_HIPONATREMIA_2014, fichaHiponatremia } from './sodio.ts'
import { DIRETRIZ_TRAUMA, EAST_TXA_2025, EUROPEIA_SANGRAMENTO_TRAUMA_2023, fichaTraumaAdulto } from './trauma.ts'
import { ABHH_NF_2024, DIRETRIZ_NF, MASCC_2026, fichaNeutropeniaFebrilAdulto } from './neutropeniaFebril.ts'
import { BAP_SUBSTANCIAS_2026, DIRETRIZ_SAA, fichaAbstinenciaAlcoolica } from './abstinenciaAlcoolica.ts'
import { CONSENSO_MIXEDEMA_2026, DIRETRIZ_IA, DIRETRIZ_MIXEDEMA, DIRETRIZ_TT, ESE_ES_IA_GLICOCORTICOIDE_2024, ES_IA_PRIMARIA_2016, ETA_TEMPESTADE_2026, SFE_CRISE_ADRENAL_2016, fichaCriseTireotoxica, fichaInsuficienciaAdrenal, fichaMixedema } from './endocrino.ts'
import { DIRETRIZ_CALCIO, ES_HIPERCALCEMIA_MALIGNIDADE_2023, SFE_HIPERCALCEMIA_2016, SFE_HIPOCALCEMIA_2016, fichaHipercalcemia } from './eletrolitos.ts'
import { BSH_SLT_2025, DIRETRIZ_SLT, fichaLiseTumoralAdulto } from './liseTumoral.ts'
import { AASLD_ASCITE_2021, ACG_EH_2026, ADQI_ICA_2024, DIRETRIZ_EH, DIRETRIZ_PBE_SHR, fichaAsciteShr, fichaInsuficienciaHepatica } from './hepatopata.ts'
import { DIRETRIZ_EI, ESC_EI_2023, duke } from './duke.ts'
import { DIRETRIZ_LRA, ENMC_RABDO_2025, KDIGO_LRA_2012, fichaLesaoRenalAguda, fichaRabdomiolise } from './renal.ts'
import { GRACE3_TONTURA, hintsPlus } from './vertigem.ts'
import { IDSA_ITU_DURACAO_2025, IDSA_ITU_EMPIRICO_2025, IDSA_ITU_EV_VO_2025, fichaItuAdulto } from './itu.ts'
import { DIRETRIZ_FALCIFORME, SRLF_FALCIFORME_2025, TASC_2025, fichaFalciformeAdulto } from './falciforme.ts'
import { ACEP_SEDACAO_2026, DIRETRIZ_SAP, fichaSedacaoProcedimentoAdulto } from './sedacaoProcedimento.ts'
import { DIRETRIZ_DENGUE_OMS, MS_DENGUE_2024, OMS_ARBOVIROSES_2025, fichaDengue } from '../dengue.ts'
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
  'nota-hcfmusp-cap84-lise-tumoral': 'síndrome de lise tumoral e emergências oncológicas no adulto: hidratação, alopurinol, febuxostate, rasburicase, G6PD, hipercalemia, diálise',
  'nota-hcfmusp-cap57-58-pbe-shr': 'peritonite bacteriana espontânea (PBE), paracentese, albumina e síndrome hepatorrenal (SHR, HRS-AKI) no cirrótico: antibiótico, terlipressina, norepinefrina, profilaxia',
  'nota-hcfmusp-cap59-encefalopatia': 'encefalopatia hepática no cirrótico: lactulose, enema, rifaximina, polietilenoglicol, amônia, fator precipitante, West Haven, prevenção da recorrência, proteína',
  'nota-hcfmusp-cap23-endocardite': 'endocardite infecciosa no adulto: hemocultura, ecocardiograma transtorácico e transesofágico, antibiótico empírico, indicação e prazo de cirurgia, anticoagulação, antibiótico oral',
  'nota-hcfmusp-cap61-lra': 'lesão renal aguda (LRA, insuficiência renal aguda) no adulto: KDIGO, estádio, diurético, fluido, contraste, aminoglicosídeo, nutrição, quando iniciar diálise',
  'nota-hcfmusp-cap22-pericardite-miocardite': 'pericardite aguda e miocardite aguda no adulto: internação, AAS, AINE, colchicina, corticoide, pericardiocentese, tamponamento, imunossupressão',
  'nota-hcfmusp-cap45-primeira-crise': 'primeira crise epiléptica (convulsão) não provocada no adulto: risco de recorrência, EEG, imagem, quando iniciar antiepiléptico',
  'nota-hcfmusp-cap27-irpa': 'insuficiência respiratória aguda (IRpA) hipoxêmica e hipercápnica no adulto: oxigênio, cateter nasal de alto fluxo, VNI, CPAP, pré-oxigenação, pós-extubação',
  'nota-hcfmusp-cap79-hemostasia': 'sangramento em uso de anticoagulante (varfarina, DOAC, dabigatrana, rivaroxabana, apixabana): reversão, complexo protrombínico, idarucizumabe, andexanete, carvão ativado, epistaxe',
  'nota-hcfmusp-cap82-transfusao': 'transfusão de hemácias e plaquetas no adulto: limiar de hemoglobina, IAM, lesão cerebral, plaquetopenia, cateter central, dengue',
  'nota-hcfmusp-cap102-hipotermia': 'hipotermia acidental no adulto: estágios, RCP, desfibrilação, adrenalina, amiodarona, ECMO, reaquecimento, afogamento',
  'nota-hcfmusp-cap71-mixedema': 'coma mixedematoso, estado mixedematoso, hipotireoidismo grave no adulto: levotiroxina EV, liotironina, hidrocortisona, aquecimento, escore',
  'nota-hcfmusp-cap80-falciforme': 'doença falciforme (anemia falciforme) no adulto: crise vaso-oclusiva (crise álgica), síndrome torácica aguda, analgesia, hidratação, transfusão, exsanguineotransfusão, antibiótico',
  'nota-hcfmusp-cap10-sedacao': 'sedação e analgesia para procedimentos no adulto (sedação procedural): jejum, GLP-1, ASA, capnografia, oxigênio, propofol, cetamina, midazolam, fentanil, flumazenil, naloxona, alta',
  'nota-hcfmusp-cap91-dengue': 'dengue no adulto: hidratação oral e venosa, cristaloide, paracetamol, dipirona, anti-inflamatório (AINE), corticoide, transfusão de plaquetas, enchimento capilar, lactato',
  'nota-hcfmusp-cap100-afogamento': 'afogamento no adulto: via aérea, oxigênio, desfibrilador, Heimlich, coluna cervical, hipotermia, ventilação, exames, antibiótico, corticoide, alta em 4–6 h, Szpilman',
  'nota-hcfmusp-cap83-plaquetopenia': 'plaquetopenia no adulto: PTI (púrpura trombocitopênica imune) com sangramento, PTT (púrpura trombocitopênica trombótica), trombocitopenia induzida por heparina (TIH, escore 4Ts), corticoide, imunoglobulina, rituximabe, agonista de trombopoetina',
  'nota-hcfmusp-cap24-oclusao-arterial': 'oclusão arterial aguda, isquemia aguda de membro no adulto: heparina, revascularização, trombólise, fasciotomia, síndrome compartimental, amputação',
  'nota-hcfmusp-cap34-pneumotorax': 'pneumotórax espontâneo no adulto: tratamento conservador, aspiração por agulha, dreno torácico, ambulatorial, cirurgia, viagem de avião',
  'nota-hcfmusp-cap41-cefaleia': 'cefaleia e crise de migrânea no adulto no pronto-socorro: proclorperazina, metoclopramida, clorpromazina, dexametasona, cetorolaco, sumatriptano, valproato, bloqueio do nervo occipital, opioide (hidromorfona), paracetamol EV',
  'nota-hcfmusp-cap44-paralisias-flacidas': 'paralisia flácida aguda no adulto: síndrome de Guillain-Barré (imunoglobulina, plasmaférese, corticoide, segundo curso, dor, mEGRIS, mEGOS) e botulismo (antitoxina botulínica, vigilância respiratória, antibiótico, aminoglicosídeo)',
  'nota-hcfmusp-cap12-dor-toracica': 'dor torácica no adulto na emergência: ECG em 10 minutos, oxigênio, troponina de alta sensibilidade (0/1 h, 0/2 h, dosagem única), CK-MB, escore HEART, alta, angiotomografia de coronárias, AAS, dissecção de aorta (ADD-RS), embolia pulmonar (Wells, Genebra, PERC)',
  'nota-hcfmusp-cap16-sincope': 'síncope e perda transitória da consciência no adulto no pronto-socorro: ECG em 10 minutos, exames, glicemia, hemoglobina, troponina, estratificação de risco, risco intermediário, monitorização, alta ou internação',
  'nota-hcfmusp-cap96-dermatoses': 'síndrome de Stevens-Johnson e necrólise epidérmica tóxica (SSJ/NET) no adulto: suspender a droga, ALDEN, SCORTEN, UTI, corticoide, imunoglobulina, ciclosporina, líquidos, via aérea, curativo, olhos, antibiótico, tromboprofilaxia',
  'nota-hcfmusp-cap60-hepatites-graves': 'hepatites graves e insuficiência hepática aguda (hepatite fulminante) no adulto: transplante, King\'s College, MELD, coagulopatia, plasma, antibiótico profilático, noradrenalina, vasopressina, amônia, diálise, acetilcisteína, paracetamol, hepatite B, cogumelo (Amanita), hepatite alcoólica',
  'nota-hcfmusp-cap88-hiv': 'complicações agudas do HIV no adulto (Aids): neurotoxoplasmose, meningite criptocócica, tuberculose do sistema nervoso central, síndrome inflamatória de reconstituição imune (IRIS), início da terapia antirretroviral (TARV)',
  'nota-hcfmusp-cap95-febre-amarela': 'febre amarela grave no adulto: hidratação, sobrecarga de volume, noradrenalina, plasma, plaquetas, coagulopatia, antiviral, sofosbuvir, diálise, troca plasmática, intubação, encefalopatia, transplante hepático, corticoide',
  'nota-hcfmusp-cap5-rebaixamento': 'rebaixamento do nível de consciência e coma no adulto: escala FOUR, escala de coma de Glasgow, eletroencefalograma (EEG), exame neurológico',
  'nota-hcfmusp-cap42-vertigem': 'vertigem e tontura aguda no adulto: HINTS, nistagmo, síndrome vestibular aguda, marcha, tomografia, ressonância, AVC de fossa posterior',
  'nota-hcfmusp-cap63-rabdomiolise': 'rabdomiólise no adulto: CPK, diagnóstico, escore de McMahon, lesão renal aguda, hidratação, bicarbonato',
  'nota-hcfmusp-cap89-itu': 'infecção do trato urinário (ITU) complicada e pielonefrite no adulto: antibiótico empírico, duração, troca de via venosa para oral, bacteremia, prostatite',
  'nota-hcfmusp-cap51-hdb': 'hemorragia digestiva baixa (HDB, hematoquezia) no adulto: escore de Oakland, alta, transfusão, varfarina, DOAC, reversão, ácido tranexâmico, angiotomografia, embolização, colonoscopia, anticoagulante',
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

/** cap. 84: BSH 2025 de lise tumoral (texto integral), só o adulto. */
export const notaHcfmuspCap84 = nota('nota-hcfmusp-cap84-lise-tumoral', 'Nota de atualização — manual HC, cap. 84: emergências oncológicas (síndrome de lise tumoral)', 'cap. 84, p. 1097–1118', fichaLiseTumoralAdulto,
  DIRETRIZ_SLT.map((d) => ({ tema: d.tema, diretriz: `${d.fonte} (${d.grau}): ${d.diretriz}`, manual: sem(d.livro) })),
  [BSH_SLT_2025])
notaHcfmuspCap84.ficha.versao = '2026-11-14.1'
notaHcfmuspCap84.ficha.revisadoEm = '14/11/2026 (lote 4 da revisão do HCFMUSP: itens tirados da BSH 2025, lida no texto integral; aguarda aprovação do RT)'

/** cap. 57 e 58: AASLD 2021 e ADQI-ICA 2024, lidas no texto integral. */
export const notaHcfmuspCap57 = nota('nota-hcfmusp-cap57-58-pbe-shr', 'Nota de atualização — manual HC, cap. 57 e 58: peritonite bacteriana espontânea e síndrome hepatorrenal', 'cap. 57, p. 779–788; cap. 58, p. 789–798', fichaAsciteShr,
  DIRETRIZ_PBE_SHR.map((d) => ({ tema: d.tema, diretriz: `${d.fonte} (${d.grau}): ${d.diretriz}`, manual: sem(d.livro) })),
  [AASLD_ASCITE_2021, ADQI_ICA_2024])
notaHcfmuspCap57.ficha.versao = '2026-11-14.1'
notaHcfmuspCap57.ficha.revisadoEm = '14/11/2026 (lote 4 da revisão do HCFMUSP: itens tirados da AASLD 2021 e do ADQI-ICA 2024, lidos no texto integral; aguarda aprovação do RT)'

/** cap. 59: ACG 2026, lida no texto integral. */
export const notaHcfmuspCap59 = nota('nota-hcfmusp-cap59-encefalopatia', 'Nota de atualização — manual HC, cap. 59: encefalopatia hepática', 'cap. 59, p. 799–806', fichaInsuficienciaHepatica,
  DIRETRIZ_EH.map((d) => ({ tema: d.tema, diretriz: `${d.fonte} (${d.grau}): ${d.diretriz}`, manual: sem(d.livro) })),
  [ACG_EH_2026])
notaHcfmuspCap59.ficha.versao = '2026-11-14.1'
notaHcfmuspCap59.ficha.revisadoEm = '14/11/2026 (lote 4 da revisão do HCFMUSP: itens tirados da ACG 2026, lida no texto integral; aguarda aprovação do RT)'

/** cap. 23: ESC 2023, lida no texto integral. */
export const notaHcfmuspCap23 = nota('nota-hcfmusp-cap23-endocardite', 'Nota de atualização — manual HC, cap. 23: endocardite infecciosa', 'cap. 23, p. 321–331', duke.ficha,
  DIRETRIZ_EI.map((d) => ({ tema: d.tema, diretriz: `${d.fonte} (${d.grau}): ${d.diretriz}`, manual: sem(d.livro) })),
  [ESC_EI_2023])
notaHcfmuspCap23.ficha.versao = '2026-11-14.1'
notaHcfmuspCap23.ficha.revisadoEm = '14/11/2026 (lote 4 da revisão do HCFMUSP: itens tirados da ESC 2023, lida no texto integral; aguarda aprovação do RT)'

/** cap. 61: KDIGO 2012 (a KDIGO 2026 ainda era rascunho). */
export const notaHcfmuspCap61 = nota('nota-hcfmusp-cap61-lra', 'Nota de atualização — manual HC, cap. 61: lesão renal aguda', 'cap. 61, p. 824–841', fichaLesaoRenalAguda,
  DIRETRIZ_LRA.map((d) => ({ tema: d.tema, diretriz: `${d.fonte} (${d.grau}): ${d.diretriz}`, manual: sem(d.livro) })),
  [KDIGO_LRA_2012])
notaHcfmuspCap61.ficha.versao = '2026-11-14.2'
notaHcfmuspCap61.ficha.revisadoEm = '14/11/2026 (lote 4 da revisão do HCFMUSP: itens tirados da KDIGO 2012, porque a KDIGO 2026 ainda era rascunho; aguarda aprovação do RT)'

// Lote 4, O3 = A (decisão do RT de 14/11/2026): cap. 22 e 45 não têm ficha de adulto
// na Central. A nota liga só ao capítulo do manual e não cria ferramenta nova.
export const ESC_MIOPERICARDITE_2025: Fonte = {
  citacao: 'Schulz-Menger J, Collini V, Gröschel J, et al. 2025 ESC Guidelines for the management of myocarditis and pericarditis. Eur Heart J. 2025;46(40):3952–4041 (PMID 40878297). Lida no site da revista: tabela 19 (recomendações de classe I e III) e tabela 16 (alto risco na pericardite).',
  url: 'https://doi.org/10.1093/eurheartj/ehaf192',
}
export const ACEP_CRISE_2024: Fonte = {
  citacao: 'American College of Emergency Physicians Clinical Policies Subcommittee on Seizures. Clinical Policy: Critical Issues in the Management of Adult Patients Presenting to the Emergency Department With Seizures. Ann Emerg Med. 2024;84(1):e1–e12 (PMID 38906639). Texto integral lido no site da revista; uma pergunta crítica, nível A.',
  url: 'https://doi.org/10.1016/j.annemergmed.2024.02.018',
}
export const AAN_AES_PRIMEIRA_CRISE_2015: Fonte = {
  citacao: 'Krumholz A, Wiebe S, Gronseth GS, et al. Evidence-based guideline: Management of an unprovoked first seizure in adults: Report of the Guideline Development Subcommittee of the American Academy of Neurology and the American Epilepsy Society. Neurology. 2015;84(16):1705–1713 (PMID 25901057). Recomendações lidas no resumo do PMC (PMC4409581); níveis A a C da AAN.',
  url: 'https://doi.org/10.1212/WNL.0000000000001487',
}

/** Nota sem ficha de adulto na Central (O3 do lote 4): liga só ao capítulo do manual. */
function notaSoManual(id: string, titulo: string, capitulos: string, itens: ItemNota[], fontes: Fonte[]): NotaHcfmusp {
  return {
    assunto: ASSUNTO[id] ?? titulo,
    ficha: { id, titulo, versao: '2026-11-14.1', publico: 'adulto', fontes, revisadoEm: '14/11/2026 (lote 4 da revisão do HCFMUSP, O3: nota sem ficha de adulto na Central; aguarda aprovação do RT)' },
    capitulos,
    fichaCentral: '',
    itens,
  }
}

/** cap. 22: ESC 2025 de miocardite e pericardite. */
export const notaHcfmuspCap22 = notaSoManual('nota-hcfmusp-cap22-pericardite-miocardite', 'Nota de atualização — manual HC, cap. 22: pericardites e miocardites agudas', 'cap. 22, p. 304–320', [
    { tema: 'Avaliação inicial', diretriz: 'ESC 2025 (I, C; I, B): História, exame físico, radiografia de tórax, biomarcadores, ECG e ecocardiograma em toda suspeita de miocardite ou pericardite (I, C). Ressonância cardíaca para confirmar a inflamação de forma não invasiva (I, B)', manual: 'não comparado nesta nota' },
    { tema: 'Internação', diretriz: 'ESC 2025 (I, B; I, C): Internar a pericardite de alto risco (I, B) e a miocardite de risco moderado a alto (I, C). Na pericardite, os marcadores maiores de alto risco são febre > 38 °C, início subagudo, derrame pericárdico grande (> 20 mm no eco), tamponamento e falta de resposta a AAS ou AINE depois de pelo menos 1 semana', manual: 'internar com febre, troponina elevada, pericardite recorrente, trauma, anticoagulante, imunocomprometido, "derrame pleural significativo" (como impresso), tamponamento, disfunção de VE ou falha do tratamento ambulatorial em 7 dias (cap. 22, p. 309)' },
    { tema: 'AAS, AINE e colchicina', diretriz: 'ESC 2025 (I, B; I, A): AAS em dose alta ou AINE, com inibidor de bomba de prótons, como primeira linha na pericardite (I, B). Colchicina como primeira linha, junto com AAS, AINE ou corticoide, para reduzir recorrência (I, A)', manual: 'ibuprofeno 600–800 mg VO 3 vezes ao dia ou AAS 2–4 g/dia, com colchicina 0,5 mg 2 vezes ao dia por 3 meses (peso > 70 kg) ou 0,5 mg/dia (< 70 kg) (cap. 22, p. 309)' },
    { tema: 'Corticoide', diretriz: 'ESC 2025 (III, C): Corticoide não é a primeira opção na pericardite sem indicação específica', manual: 'prednisona 0,25–0,5 mg/kg/dia nos refratários; corticoide em dose baixa se houver contraindicação a AINE (cap. 22, p. 309)' },
    { tema: 'Pericardite recorrente', diretriz: 'ESC 2025 (I, A): Anti-IL-1 (anakinra ou rilonacepte) na pericardite recorrente depois de falha da primeira linha, com dependência de corticoide e PCR elevada, para reduzir recorrência e permitir retirar o corticoide', manual: 'não comparado nesta nota' },
    { tema: 'Pericardiocentese e drenagem', diretriz: 'ESC 2025 (I, C): Pericardiocentese guiada por eco, TC ou fluoroscopia no tamponamento, na suspeita de pericardite bacteriana ou neoplásica, ou no derrame moderado a grande sintomático apesar do tratamento. Drenagem cirúrgica quando a punção não é possível ou o derrame é purulento', manual: 'tamponamento: volume para hipotensão, pericardiocentese guiada por ultrassom e UTI para todos (cap. 22, p. 310)' },
    { tema: 'Suspeita de síndrome coronariana', diretriz: 'ESC 2025 (I, C): Coronariografia invasiva ou angiotomografia de coronárias, conforme a probabilidade clínica, quando houver suspeita de síndrome coronariana aguda', manual: 'não comparado nesta nota' },
    { tema: 'Sorologia viral', diretriz: 'ESC 2025 (III, C): Não pedir sorologia viral de rotina na miocardite ou pericardite, exceto hepatite C, HIV e doença de Lyme', manual: 'não comparado nesta nota' },
    { tema: 'Miocardite com insuficiência cardíaca ou choque', diretriz: 'ESC 2025 (I, C): Tratar pela diretriz de insuficiência cardíaca da ESC quando houver disfunção sistólica ou insuficiência cardíaca. Com instabilidade hemodinâmica, discutir logo com o time de choque o suporte circulatório. Biópsia endomiocárdica na miocardite de alto risco ou com instabilidade', manual: 'não comparado nesta nota' },
    { tema: 'Imunossupressão', diretriz: 'ESC 2025 (III, C): Não usar imunossupressor de rotina na miocardite aguda com função do VE preservada', manual: 'imunossupressão só com etiologia responsiva comprovada por biópsia endomiocárdica (cap. 22, p. 320)' },
    { tema: 'Seguimento da miocardite', diretriz: 'ESC 2025 (I, C): Clínica, biomarcadores, ECG, teste de esforço, Holter, ecocardiograma e ressonância em até 6 meses depois da internação', manual: 'não comparado nesta nota' },
  ], [ESC_MIOPERICARDITE_2025])

/** cap. 45: AAN/AES 2015 da primeira crise não provocada. */
export const notaHcfmuspCap45 = notaSoManual('nota-hcfmusp-cap45-primeira-crise', 'Nota de atualização — manual HC, cap. 45: primeira crise epiléptica', 'cap. 45, p. 609–622', [
    { tema: 'Fontes desta nota', diretriz: 'ACEP 2024 e AAN/AES 2015 (sem nível): A clinical policy da ACEP de 2024 só atualizou o estado de mal refratário ao benzodiazepínico; as perguntas da primeira crise (tratar, internar) ficaram com a policy anterior da ACEP. Para a primeira crise, a nota usa a AAN/AES 2015, que o próprio manual cita', manual: 'Tabela 7 adaptada da Academia Americana de Neurologia de 2015 (cap. 45, p. 619)' },
    { tema: 'Crise que não para com benzodiazepínico', diretriz: 'ACEP 2024 (nível A): Estado de mal convulsivo que segue apesar de benzodiazepínico em dose adequada: tratar com droga de segunda linha. Fosfenitoína, levetiracetam ou valproato têm eficácia parecida. As doses de ataque da ACEP são as do ESETT, as mesmas da ferramenta de estado de mal da Central (cap. 46)', manual: 'o estado de mal fica no cap. 46; não comparado nesta nota' },
    { tema: 'Risco de recorrência', diretriz: 'AAN/AES 2015 (nível A): Informar que o risco de nova crise é maior nos 2 primeiros anos, de 21% a 45%', manual: 'preditores de recorrência e risco por fator na Tabela 7 (cap. 45, p. 619)' },
    { tema: 'Fatores de risco', diretriz: 'AAN/AES 2015 (níveis A e B): Aumentam o risco: lesão cerebral prévia (A), EEG com atividade epileptiforme (A), alteração significativa na imagem do encéfalo (B) e crise noturna (B)', manual: 'Tabela 7: crise sintomática remota; EEG normal 30%, com alteração não epileptiforme 45% e epileptiforme 60%; neuroimagem alterada (cap. 45, p. 619)' },
    { tema: 'Antiepiléptico logo após a primeira crise', diretriz: 'AAN/AES 2015 (níveis B e C): Começar o antiepiléptico logo, em vez de esperar a segunda crise, provavelmente reduz a recorrência nos 2 primeiros anos (B), mas pode não melhorar a qualidade de vida (C). Depois de 3 anos, não muda a chance de remissão (B)', manual: 'previne uma segunda crise nos 2 anos seguintes (reduz em 35% o risco absoluto) e não previne refratariedade futura (cap. 45, p. 620)' },
    { tema: 'Efeitos adversos', diretriz: 'AAN/AES 2015 (nível B): Risco de efeito adverso do antiepiléptico de 7% a 31%, em geral leve e reversível', manual: 'efeitos colaterais estimados em 7–31% (cap. 45, p. 620)' },
    { tema: 'Decisão de tratar', diretriz: 'AAN/AES 2015 (sem nível): Decidir caso a caso: pesar o risco de recorrência contra os efeitos adversos, ouvir a preferência informada do paciente e explicar que o tratamento imediato reduz o risco nos 2 anos seguintes, mas não muda o prognóstico de longo prazo', manual: 'decidir pelo risco de recorrência, pelas consequências sociais e profissionais de nova crise e pela tolerabilidade do fármaco (cap. 45, p. 618–620)' },
  ], [ACEP_CRISE_2024, AAN_AES_PRIMEIRA_CRISE_2015])
notaHcfmuspCap45.ficha.versao = '2026-11-14.2'
notaHcfmuspCap45.ficha.revisadoEm = '14/11/2026, .2: ACEP 2024 lida no texto integral (o RT abriu a página); só atualizou o estado de mal refratário. Lote 4 da revisão do HCFMUSP, O3; aguarda aprovação do RT'

export const NOTAS_HCFMUSP_LOTE4: NotaHcfmusp[] = [notaHcfmuspCap22, notaHcfmuspCap23, notaHcfmuspCap37, notaHcfmuspCap45, notaHcfmuspCap57, notaHcfmuspCap59, notaHcfmuspCap61, notaHcfmuspCap68, notaHcfmuspCap70, notaHcfmuspCap72, notaHcfmuspCap84]

// ── Lote 5 (decisão do RT de 14/11/2026, P1–P4 = A; docs/clinico/HCFMUSP-LOTE5-DIAGNOSTICO.md).
// P1: capítulos cuja ficha já cita diretriz recente; os itens vêm da ficha, já conferidos.
const REVISADO_LOTE5 = '14/11/2026 (lote 5 da revisão do HCFMUSP: itens tirados da ficha da Central, já conferidos com a diretriz; aguarda aprovação do RT)'
function notaLote5(...a: Parameters<typeof nota>): NotaHcfmusp {
  const n = nota(...a)
  n.ficha.versao = '2026-11-14.1'
  n.ficha.revisadoEm = REVISADO_LOTE5
  return n
}

/** cap. 27: ATS 2026 e SOHO, já nas fichas de oxigenação e VNI. */
export const notaHcfmuspCap27 = notaLote5('nota-hcfmusp-cap27-irpa', 'Nota de atualização — manual HC, cap. 27: insuficiência respiratória', 'cap. 27, p. 370–386', fichaOxigenacaoAdulto, [
    { tema: 'IRpA hipoxêmica', diretriz: 'ATS 2026 (forte; condicional): cateter nasal de alto fluxo como primeira escolha (forte); VNI ou CPAP como alternativa (condicional); vigiar de perto e escalar o suporte sem atraso. O benefício é na necessidade de intubação', manual: 'cateter nasal de alto fluxo até 60 L/min em adultos (cap. 27, p. 378–379)' },
    { tema: 'Alto fluxo e mortalidade', diretriz: 'SOHO, NEJM 2026 (ECR; 1.110 adultos com P/F ≤ 200): o alto fluxo não reduziu a mortalidade em 28 dias (14,6% nos dois grupos), reduziu a intubação (42,4% × 48,4%) e teve mais parada cardíaca ou pneumotórax durante a respiração espontânea (2,3% × 1,1%). O alto fluxo não deve atrasar a intubação indicada', manual: 'não comparado nesta nota' },
    { tema: 'IRpA hipercápnica', diretriz: 'ATS 2026 (forte; condicional): VNI para reduzir mortalidade e intubação (forte). Alto fluxo só na hipercapnia menos grave, com acidemia leve (por exemplo, pH > 7,25), vigilância e escalada rápida para VNI (condicional)', manual: 'VNI na IRpA hipercápnica (cap. 27, p. 378–386), como a ATS' },
    { tema: 'Pré-oxigenação para intubar', diretriz: 'ATS 2026 (forte): alto fluxo ou VNI para pré-oxigenar antes da intubação, para evitar hipoxemia', manual: 'não comparado nesta nota' },
    { tema: 'Depois da extubação', diretriz: 'ATS 2026 (condicional): alto fluxo no paciente de baixo risco e VNI no de alto risco, para reduzir reintubação', manual: 'não comparado nesta nota' },
  ], [ATS_IRPA_2026, SOHO_2026])

/** cap. 79: consenso SBTH 2026, ANNEXA-I e AAO-HNS 2020, já na ficha de reversão; a ESO 2025 de HIC está na nota do cap. 39. */
export const notaHcfmuspCap79 = notaLote5('nota-hcfmusp-cap79-hemostasia', 'Nota de atualização — manual HC, cap. 79: distúrbios da hemostasia', 'cap. 79, p. 1037–1050', fichaReversaoAnticoagulacaoAdulto, [
    { tema: 'Quando reverter', diretriz: 'Consenso brasileiro SBTH 2026: reversor ou agente hemostático só com as duas condições: sangramento maior ou com risco de vida e anticoagulante em nível circulante significativo (DOAC dosado ou tomado há menos de 24 h; antagonista da vitamina K com INR ≥ 2)', manual: 'conduta da varfarina pelo INR × sangramento (Tabela 4, p. 1043) e dos DOAC pelo sangramento maior × menor (Tabela 6, p. 1044–1045)' },
    { tema: 'Carvão ativado', diretriz: 'Consenso brasileiro SBTH 2026: carvão ativado se o anticoagulante foi tomado nas últimas 4 h', manual: '< 2 h (Tabela 6, p. 1044–1045)' },
    { tema: 'Inibidor do fator Xa', diretriz: 'Consenso brasileiro SBTH 2026: andexanete ou complexo protrombínico; o andexanete com cautela, porque foi retirado do mercado em alguns países. ANNEXA-I (NEJM 2024, hemorragia intracerebral): mais controle do hematoma com andexanete (67,0% × 53,1%) e mais trombose (10,3% × 5,6%)', manual: 'complexo protrombínico de 4 fatores (o manual registra que não estava disponível no DE do HC) e antifibrinolítico (Tabela 6, p. 1044–1045)' },
    { tema: 'Epistaxe em quem usa anticoagulante', diretriz: 'AAO-HNS 2020: sem sangramento com risco de vida, começar pelo tratamento local (compressão, tamponamento, cauterização) antes de reverter ou suspender o anticoagulante', manual: 'medidas hemostáticas locais no sangramento menor (Tabela 6, p. 1044–1045)' },
    ...DIRETRIZ_HIC_ESO_2025.filter((d) => ['Antagonista da vitamina K', 'Dabigatrana', 'Antiagregante'].includes(d.tema)).map((d) => ({ tema: `${d.tema} (hemorragia intracerebral)`, diretriz: `ESO/EANS 2025 (${d.forca}; ${d.onde}): ${d.eso}`, manual: sem(d.livro) })),
  ], [SBTH_2026, ANNEXA_I, AAO_HNS_EPISTAXE_2020, ESO_HIC_2025])

/** cap. 82: AABB 2023, AABB 2025 (IAM), AABB/ICTMG 2025 e os ECR da lesão cerebral, já na ficha de transfusão. */
export const notaHcfmuspCap82 = notaLote5('nota-hcfmusp-cap82-transfusao', 'Nota de atualização — manual HC, cap. 82: transfusão de hemocomponentes', 'cap. 82, p. 1075–1085', fichaTransfusaoAdulto, [
    { tema: 'Paciente estável', diretriz: 'AABB 2023 (forte, evidência moderada): transfundir hemácias com Hb < 7 g/dL no adulto hospitalizado estável, inclusive crítico. Boa prática: decidir também por sintomas, sinais e preferências; o limiar não vale no sangramento maciço, na hipoxemia grave nem na instabilidade', manual: 'considerar Hb < 10 g/dL na anemia sintomática (Tabela 1, p. 1076)' },
    { tema: 'Cirurgia cardíaca, ortopédica ou doença cardiovascular', diretriz: 'AABB 2023 (observação da recomendação 1): 7,5 g/dL na cirurgia cardíaca; 8 g/dL na cirurgia ortopédica ou na doença cardiovascular preexistente', manual: 'considerar Hb ≤ 8 g/dL (p. 1076)' },
    { tema: 'Infarto agudo do miocárdio', diretriz: 'AABB 2025 (condicional, evidência baixa; resumo lido): estratégia liberal, com Hb < 10 g/dL, no IAM hospitalizado; 7–8 g/dL pode aumentar a mortalidade', manual: 'Hb < 8 g/dL na síndrome coronariana aguda (Tabela 1, p. 1076)' },
    { tema: 'Lesão cerebral aguda', diretriz: 'TRAIN (JAMA 2024): Hb < 9 g/dL em vez de < 7 reduziu o desfecho neurológico desfavorável em 180 dias (62,6% × 72,6%). HEMOTION (NEJM 2024, TCE) e SAHaRA (NEJM 2025, HSA aneurismática) não mostraram diferença significativa. A evidência é dividida', manual: 'não comparado nesta nota' },
    { tema: 'Plaquetas sem sangramento', diretriz: 'AABB/ICTMG 2025 (forte; resumo lido): transfundir com < 10.000/µL na plaquetopenia hipoproliferativa sem sangramento', manual: '< 20.000/µL com febre ou infecção (Tabela 3, p. 1078)' },
    { tema: 'Plaquetas para cateter central', diretriz: 'AABB/ICTMG 2025 (condicional): < 10.000/µL em sítio compressível', manual: '< 20.000/µL (Tabela 3, p. 1078)' },
    { tema: 'Dengue', diretriz: 'AABB/ICTMG 2025 (forte): não transfundir plaquetas na dengue com plaquetopenia, sem sangramento maior', manual: 'o cap. 82 não trata do tema' },
    { tema: 'Hemorragia intracraniana com antiagregante', diretriz: 'AABB/ICTMG 2025 (condicional): não transfundir plaquetas na hemorragia intracraniana sem cirurgia, com plaquetas > 100.000/µL, mesmo em uso de antiagregante', manual: 'sangramento do sistema nervoso central com < 100.000/µL (Tabela 3, p. 1078)' },
  ], [AABB_2023, AABB_IAM_2025, AABB_PLAQUETAS_2025, TRAIN_2024, HEMOTION_2024, SAHARA_2025])

/** cap. 102: ERC 2025, já com a lista na ficha de hipotermia. */
export const notaHcfmuspCap102 = notaLote5('nota-hcfmusp-cap102-hipotermia', 'Nota de atualização — manual HC, cap. 102: hipotermia acidental', 'cap. 102, p. 1360–1373', fichaHipotermiaAdulto,
  DIRETRIZ_HIPOTERMIA_2025.map((d) => ({ tema: d.tema, diretriz: `ERC 2025: ${d.erc}`, manual: sem(d.livro) })),
  [ERC_2025_HIPOTERMIA])

/** cap. 71: consenso BTA/ETA/SfE/WEDS 2026, lido no texto integral. */
export const notaHcfmuspCap71 = notaLote5('nota-hcfmusp-cap71-mixedema', 'Nota de atualização — manual HC, cap. 71: estado mixedematoso', 'cap. 71, p. 958–963', fichaMixedema,
  DIRETRIZ_MIXEDEMA.map((d) => ({ tema: d.tema, diretriz: `${d.fonte} (${d.grau}): ${d.diretriz}`, manual: sem(d.livro) })),
  [CONSENSO_MIXEDEMA_2026])
notaHcfmuspCap71.ficha.revisadoEm = '14/11/2026 (lote 5 da revisão do HCFMUSP: itens tirados do consenso 2026, lido no texto integral; aguarda aprovação do RT)'

/** cap. 80: diretriz SRLF/GFRUP/SFMU 2025, lida no texto integral. */
export const notaHcfmuspCap80 = notaLote5('nota-hcfmusp-cap80-falciforme', 'Nota de atualização — manual HC, cap. 80: anemia falciforme', 'cap. 80, p. 1051–1061', fichaFalciformeAdulto,
  DIRETRIZ_FALCIFORME.map((d) => ({ tema: d.tema, diretriz: `${d.fonte} (${d.grau}): ${d.diretriz}`, manual: sem(d.livro) })),
  [SRLF_FALCIFORME_2025, TASC_2025])
notaHcfmuspCap80.ficha.revisadoEm = '14/11/2026 (lote 5 da revisão do HCFMUSP: itens tirados da diretriz SRLF/GFRUP/SFMU 2025, lida no texto integral; aguarda aprovação do RT)'

/** cap. 10: consenso Delphi da ACEP 2026 (parte 2), lido no texto integral. */
export const notaHcfmuspCap10 = notaLote5('nota-hcfmusp-cap10-sedacao', 'Nota de atualização — manual HC, cap. 10: sedação e analgesia em procedimentos', 'cap. 10, p. 153–167', fichaSedacaoProcedimentoAdulto,
  DIRETRIZ_SAP.map((d) => ({ tema: d.tema, diretriz: `${d.fonte} (${d.grau}): ${d.diretriz}`, manual: sem(d.livro) })),
  [ACEP_SEDACAO_2026])
notaHcfmuspCap10.ficha.revisadoEm = '14/11/2026 (lote 5 da revisão do HCFMUSP: itens tirados do consenso da ACEP 2026, lido no texto integral; aguarda aprovação do RT)'

/** cap. 91: OMS 2025 de arboviroses; a ferramenta segue o Ministério da Saúde 2024. */
export const notaHcfmuspCap91 = notaLote5('nota-hcfmusp-cap91-dengue', 'Nota de atualização — manual HC, cap. 91: dengue', 'cap. 91, p. 1227–1240', fichaDengue, [
    { tema: 'Fonte da ferramenta', diretriz: 'Ministério da Saúde 2024, 6ª ed.: a ferramenta de classificação e hidratação da Central segue esse manual, mais novo que o do HC', manual: 'manual do HC de 2022, cap. 91' },
    ...DIRETRIZ_DENGUE_OMS.map((d) => ({ tema: d.tema, diretriz: `${d.fonte} (${d.grau}): ${d.diretriz}`, manual: sem(d.livro) })),
  ], [OMS_ARBOVIROSES_2025, MS_DENGUE_2024])
notaHcfmuspCap91.ficha.revisadoEm = '14/11/2026 (lote 5 da revisão do HCFMUSP: itens da OMS 2025, resumo oficial das recomendações lido; aguarda aprovação do RT)'

/** cap. 100: WMS 2024 de afogamento, lida no texto integral. */
export const notaHcfmuspCap100 = notaLote5('nota-hcfmusp-cap100-afogamento', 'Nota de atualização — manual HC, cap. 100: afogamento', 'cap. 100, p. 1338–1348', szpilman.ficha,
  DIRETRIZ_AFOGAMENTO.map((d) => ({ tema: d.tema, diretriz: `${d.fonte} (${d.grau}): ${d.diretriz}`, manual: sem(d.livro) })),
  [WMS_AFOGAMENTO_2024])
notaHcfmuspCap100.ficha.versao = '2026-11-14.3'
notaHcfmuspCap100.ficha.revisadoEm = '14/11/2026 (lote 5 da revisão do HCFMUSP: itens tirados da WMS 2024, lida no texto integral; aguarda aprovação do RT)'

// Lote 5, P3 = A (decisão do RT de 14/11/2026): cap. 83, 24 e 34 não têm ficha de
// adulto na Central. A nota liga só ao capítulo do manual (conferido no PDF).
export const MCMASTER_PTI_2026: Fonte = {
  citacao: 'Chowdhury SR, Sirotich E, Guyatt G, et al. Guideline on the emergency management of critical bleeding in patients with immune thrombocytopenia. Blood Adv. 2026;10(16):5558–5575 (PMID 41637560; PMC13487680). Resumo lido; GRADE.',
  url: 'https://doi.org/10.1182/bloodadvances.2025018818',
}
export const ASH_PTI_2026: Fonte = {
  citacao: 'Cuker A, Terrell DR, Sowdagar H, et al. American Society of Hematology 2026 guidelines for immune thrombocytopenia: initial and second-line therapy for adults with primary ITP. Blood Adv. 2026;10(20):7076–7097 (PMID 42617047; PMC13696133). Resumo lido; GRADE.',
  url: 'https://doi.org/10.1182/bloodadvances.2026021269',
}
export const ISTH_PTT_2025: Fonte = {
  citacao: 'Zheng XL, Al-Housni Z, Cataland SR, et al. 2025 focused update of the 2020 ISTH guidelines for management of thrombotic thrombocytopenic purpura. J Thromb Haemost. 2025;23(11):3711–3732 (PMID 40533296; PMC13470878). Resumo lido; GRADE.',
  url: 'https://doi.org/10.1016/j.jtha.2025.06.002',
}
export const ASH_TIH_2018: Fonte = {
  citacao: 'Cuker A, Arepally GM, Chong BH, et al. American Society of Hematology 2018 guidelines for management of venous thromboembolism: heparin-induced thrombocytopenia. Blood Adv. 2018;2(22):3360–3392 (PMID 30482768; PMC6258919). Resumo lido; GRADE.',
  url: 'https://doi.org/10.1182/bloodadvances.2018024489',
}
export const ACC_AHA_DAP_2024: Fonte = {
  citacao: 'ACC/AHA e sociedades associadas. 2024 ACC/AHA/AACVPR/APMA/ABC/SCAI/SVM/SVN/SVS/SIR/VESS Guideline for the Management of Lower Extremity Peripheral Artery Disease. Circulation. 2024;149(24):e1313–e1410 (PMID 38743805; PMC12782132). Seção de isquemia aguda de membro lida no texto integral; classe de recomendação.',
  url: 'https://doi.org/10.1161/CIR.0000000000001251',
}
export const ERS_PNEUMOTORAX_2024: Fonte = {
  citacao: 'Walker S, Hallifax R, Ricciardi S, et al. Joint ERS/EACTS/ESTS clinical practice guidelines on adults with spontaneous pneumothorax. Eur Respir J. 2024;63(5):2300797 (PMID 38806203). Texto integral lido no site da revista; GRADE.',
  url: 'https://doi.org/10.1183/13993003.00797-2023',
}

function notaSoManualLote5(...a: Parameters<typeof notaSoManual>): NotaHcfmusp {
  const n = notaSoManual(...a)
  n.ficha.revisadoEm = '14/11/2026 (lote 5 da revisão do HCFMUSP, P3: nota sem ficha de adulto na Central; aguarda aprovação do RT)'
  return n
}

/** cap. 83: McMaster 2026, ASH 2026, ISTH 2025 e ASH 2018. */
export const notaHcfmuspCap83 = notaSoManualLote5('nota-hcfmusp-cap83-plaquetopenia', 'Nota de atualização — manual HC, cap. 83: plaquetopenia', 'cap. 83, p. 1086–1096', [
    { tema: 'PTI com sangramento crítico', diretriz: 'McMaster 2026 (forte; certeza baixa a muito baixa): Sangramento crítico na PTI (intracraniano ou com instabilidade): usar juntos corticoide em dose alta, imunoglobulina EV em dose alta, transfusão de plaquetas, ácido tranexâmico e agonista do receptor de trombopoetina. Esplenectomia de urgência se o resto falhar (condicional). Não usar fator VIIa recombinante, pelo risco de trombose (condicional)', manual: 'sangramento com risco à vida e plaquetas < 10.000/µL: transfundir plaquetas (aférese); grave: metilprednisolona 1 g EV por 3 dias ou imunoglobulina 0,4 g/kg por 5 dias ou 1 g/kg por 2 dias, com preferência pela metilprednisolona (cap. 83, p. 1093)' },
    { tema: 'PTI: tratamento inicial', diretriz: 'ASH 2026 (condicional): No adulto com PTI primária, corticoide junto com rituximabe ou com agonista de trombopoetina, em vez de corticoide sozinho', manual: 'sangramento leve: prednisona 1 mg/kg; alternativa, dexametasona 40 mg/dia por 4 dias (p. 1092–1093)' },
    { tema: 'PTI: depois do corticoide', diretriz: 'ASH 2026 (forte; condicional): Se o corticoide falhar: agonista de trombopoetina (forte) ou rituximabe (condicional)', manual: 'sem resposta, considerar esplenectomia no ambulatório (p. 1092)' },
    { tema: 'PTT imune', diretriz: 'ISTH 2025 (atualização focada): Sem mudança das recomendações de 2020 para a PTT imune; a revisão considerou os dados novos de caplacizumabe somado à troca plasmática, ao corticoide e ao rituximabe', manual: 'o cap. 83 cita a PTT entre as causas de plaquetopenia e não detalha o tratamento (Tabelas 1 e 2, p. 1087–1090)' },
    { tema: 'Trombocitopenia induzida por heparina', diretriz: 'ASH 2018 (forte; condicional): Escore 4Ts em vez de impressão clínica para a probabilidade pré-teste (forte). Com 4Ts de baixa probabilidade, não pedir exame de TIH nem tratar empiricamente (forte). Na TIH aguda, anticoagulante não heparínico: argatrobana, bivalirudina, danaparoide, fondaparinux ou DOAC; a escolha é condicional', manual: 'TIH citada entre as causas de plaquetopenia com trombose (p. 1090)' },
  ], [MCMASTER_PTI_2026, ASH_PTI_2026, ISTH_PTT_2025, ASH_TIH_2018])

/** cap. 24: ACC/AHA 2024, seção de isquemia aguda de membro. */
export const notaHcfmuspCap24 = notaSoManualLote5('nota-hcfmusp-cap24-oclusao-arterial', 'Nota de atualização — manual HC, cap. 24: oclusão arterial aguda', 'cap. 24, p. 332–344', [
    { tema: 'Avaliação inicial', diretriz: 'ACC/AHA 2024 (classe 1; 2b): Avaliar em caráter de emergência, por profissional experiente em julgar a viabilidade do membro (1). A avaliação clínica inicial da viabilidade e da chance de salvamento não precisa esperar imagem não invasiva (1). Com história complicada de revascularizações, pode ser razoável a imagem antes de revascularizar (2b)', manual: 'classificação de Rutherford para a viabilidade; angiotomografia ou angiografia a critério da cirurgia vascular (cap. 24, p. 332–344)' },
    { tema: 'Anticoagulação', diretriz: 'ACC/AHA 2024 (classe 1): Heparina não fracionada sistêmica no diagnóstico, qualquer que seja a causa ou o nível da oclusão, salvo contraindicação', manual: 'anticoagular no diagnóstico, antes da imagem, com heparina de baixo peso molecular ou heparina não fracionada em bomba (p. 340)' },
    { tema: 'Revascularização', diretriz: 'ACC/AHA 2024 (classe 1; 2a; 2b; 3: dano): Membro salvável: revascularizar, por via endovascular ou cirúrgica, incluindo trombólise por cateter (1); procedimento adjuvante depois da trombólise (2a). Em estado pró-trombótico (quimioterapia, infecção viral), planejar com mais calma (2b). Membro inviável: não revascularizar tecido não viável (3: dano)', manual: 'o cirurgião vascular define a revascularização se o membro é viável, ou a amputação primária se inviável; trombólise intra-arterial é opção (p. 341–343)' },
    { tema: 'Síndrome compartimental', diretriz: 'ACC/AHA 2024 (classe 1; 2a): Vigiar e tratar a síndrome compartimental com fasciotomia depois da revascularização (1); fasciotomia profilática no membro ameaçado mas salvável, categorias IIa ou IIb (2a); amputação precoce junto com a revascularização na isquemia prolongada (2a)', manual: 'fasciotomia para a síndrome compartimental depois da revascularização na isquemia avançada (p. 343)' },
    { tema: 'Causa', diretriz: 'ACC/AHA 2024 (classe 1; 2a): História e exame físico completos para a causa da trombose ou embolia (1); investigar causa cardiovascular de tromboembolismo (2a)', manual: 'causas e mecanismos na Tabela 1 (p. 333)' },
  ], [ACC_AHA_DAP_2024])

/** cap. 34: ERS/EACTS/ESTS 2024 de pneumotórax espontâneo. */
export const notaHcfmuspCap34 = notaSoManualLote5('nota-hcfmusp-cap34-pneumotorax', 'Nota de atualização — manual HC, cap. 34: pneumotórax', 'cap. 34, p. 468–472', [
    { tema: 'Tratamento conservador', diretriz: 'ERS/EACTS/ESTS 2024 (condicional; certeza muito baixa): Pneumotórax espontâneo primário pouco sintomático e estável: tratamento conservador, qualquer que seja o tamanho', manual: 'pequeno (< 2 cm, sem desvio): O2 em alto fluxo, observar 4–6 h e dar alta se estável e sem aumento (cap. 34, p. 468–472)' },
    { tema: 'Aspiração ou dreno', diretriz: 'ERS/EACTS/ESTS 2024 (forte; certeza baixa): No primário, aspiração por agulha antes de dreno torácico', manual: 'moderado (> 2 cm, sem gravidade): punção e aspiração, dreno fino (Seldinger, pigtail) ou dreno tubular; aspirado > 2–3 L sugere fístula (p. 468–472)' },
    { tema: 'Manejo ambulatorial', diretriz: 'ERS/EACTS/ESTS 2024 (condicional): Primário: manejo ambulatorial em centro com estrutura e fluxo para isso (certeza baixa). Secundário: não usar dispositivo ambulatorial fino de 8 Fr no tratamento inicial (certeza muito baixa)', manual: 'dreno fino com válvula de Heimlich dá mais liberdade ao paciente (p. 468–472)' },
    { tema: 'Cirurgia precoce', diretriz: 'ERS/EACTS/ESTS 2024 (condicional; certeza baixa): Considerar cirurgia precoce no primário quando o paciente prioriza evitar a recidiva', manual: 'não comparado nesta nota' },
    { tema: 'Fuga aérea persistente', diretriz: 'ERS/EACTS/ESTS 2024 (condicional; certeza muito baixa): Secundário com fuga aérea persistente e sem condição cirúrgica: considerar pleurodese com sangue autólogo (blood patch)', manual: 'não comparado nesta nota' },
    { tema: 'Viagem de avião', diretriz: 'ERS/EACTS/ESTS 2024 (condicional; revisão narrativa): Não voar com pneumotórax não tratado; esperar pelo menos 7 dias depois da resolução radiológica', manual: 'drenar se o paciente for viajar de avião em cabine pressurizada (p. 468–472)' },
    { tema: 'Tabagismo', diretriz: 'ERS/EACTS/ESTS 2024 (condicional; revisão narrativa): Quem fuma tem mais recidiva: usar o episódio para orientar a parada do cigarro', manual: 'não comparado nesta nota' },
  ], [ERS_PNEUMOTORAX_2024])

export const NOTAS_HCFMUSP_LOTE5: NotaHcfmusp[] = [notaHcfmuspCap10, notaHcfmuspCap24, notaHcfmuspCap27, notaHcfmuspCap34, notaHcfmuspCap71, notaHcfmuspCap79, notaHcfmuspCap80, notaHcfmuspCap82, notaHcfmuspCap83, notaHcfmuspCap91, notaHcfmuspCap100, notaHcfmuspCap102]

// ── Lote 6 (decisão do RT de 14/11/2026, Q1–Q4 = A; docs/clinico/HCFMUSP-LOTE6-DIAGNOSTICO.md).
// Q1: o cap. 41 tem ficha que já cita a AHS 2025; os itens vêm da lista da ficha.
const REVISADO_LOTE6 = '14/11/2026 (lote 6 da revisão do HCFMUSP: itens tirados da ficha da Central, já conferidos com a diretriz; aguarda aprovação do RT)'
function notaLote6(...a: Parameters<typeof nota>): NotaHcfmusp {
  const n = nota(...a)
  n.ficha.versao = '2026-11-14.1'
  n.ficha.revisadoEm = REVISADO_LOTE6
  return n
}

/** O que o cap. 41 diz de cada nível da AHS 2025 (conferido no PDF, p. 573). */
const MANUAL_AHS_2025: Record<string, string> = {
  'A — deve oferecer': 'não cita proclorperazina nem bloqueio de nervo; os bloqueadores dopaminérgicos do capítulo são clorpromazina e metoclopramida, como adjuvantes (p. 573)',
  'B — deveria oferecer': 'triptano é a primeira escolha na migrânea sem aura, SC ou intranasal se há náusea; AINE (naproxeno, ibuprofeno, cetoprofeno, nimesulida); metoclopramida parenteral na náusea, diluída e lenta (p. 573)',
  'C — pode oferecer': 'clorpromazina parenteral com monitorização cardíaca; dexametasona 10 mg EV no maior risco de recidiva; não cita valproato (p. 573)',
  'C — não deveria oferecer': 'dipirona e paracetamol entre os analgésicos comuns da crise, sem dizer a via (p. 573)',
  'A — não deve oferecer': 'não cita opioide no tratamento da crise (p. 573)',
}

/** cap. 41: AHS 2025 da crise de migrânea no PS, já na ficha de cefaleia. */
export const notaHcfmuspCap41 = notaLote6('nota-hcfmusp-cap41-cefaleia', 'Nota de atualização — manual HC, cap. 41: cefaleia', 'cap. 41, p. 564–576', fichaCefaleiaAdulto,
  AHS_2025_NIVEIS.map((n) => ({ tema: `Crise de migrânea no PS: nível ${n.nivel}`, diretriz: `AHS 2025 (nível ${n.nivel}; resumo lido, sem dose): ${n.drogas.join(', ')}`, manual: sem(MANUAL_AHS_2025[n.nivel]) })),
  [AHS_2025])

// Q2: cap. 44. A lista da SGB vem da ficha (EAN/PNS 2023); a do botulismo, do guia
// do CDC de 2021 (texto integral) e do Guia de Vigilância do MS 2024 (p. 371), porque não há
// ficha de botulismo na Central.
export const CDC_BOTULISMO_2021: Fonte = {
  citacao: 'Rao AK, Sobel J, Chatham-Stephens K, Luquez C. Clinical guidelines for diagnosis and treatment of botulism, 2021. MMWR Recomm Rep. 2021;70(2):1–30 (PMID 33956777; PMC8112830). Texto integral lido; sem graduação das recomendações (revisões sistemáticas e especialistas).',
  url: 'https://doi.org/10.15585/mmwr.rr7002a1',
}
export const MS_BOTULISMO_2024: Fonte = {
  citacao: 'Brasil. Ministério da Saúde. Guia de vigilância em saúde: volume 1. 6. ed. rev. Brasília: Ministério da Saúde, 2024. Botulismo, tratamento específico (p. 371). Lido no PDF.',
  url: 'https://bvsms.saude.gov.br/bvs/publicacoes/guia_vigilancia_saude_6edrev_v1.pdf',
}
const BOTULISMO_NO_MANUAL = 'o cap. 44 só cita o botulismo entre as causas de paralisia flácida aguda, na junção neuromuscular (Tabela 2, p. 599–600)'
const DIRETRIZ_BOTULISMO_2021: ItemNota[] = [
  { tema: 'Botulismo no Brasil: soro antibotulínico', diretriz: 'Ministério da Saúde 2024: colher todas as amostras clínicas antes do tratamento específico. Soro antibotulínico (SAB), equino, bi ou trivalente, o mais cedo possível, até 7 dias do início dos sintomas neurológicos; depois pode não ser mais eficaz. Dose: uma ampola EV, diluída em SF 0,9% na proporção 1:10, em cerca de 1 hora. No botulismo de ferida, desbridar, de preferência depois do SAB', manual: BOTULISMO_NO_MANUAL },
  { tema: 'Botulismo: quando dar antitoxina', diretriz: 'CDC 2021: tratar com antitoxina botulínica o paciente sintomático com suspeita clínica, sem esperar a confirmação laboratorial. O maior benefício é nos 2 primeiros dias; com os sinais ainda progredindo, tratar qualquer que seja o tempo desde o início', manual: BOTULISMO_NO_MANUAL },
  { tema: 'Botulismo: dose da antitoxina', diretriz: 'CDC 2021: antitoxina heptavalente equina (BAT, o produto dos EUA), dose padrão do adulto de um frasco EV. Segunda dose só se a paralisia claramente progride depois do tempo de efeito e a suspeita é alta; progressão por mais de 1 dia depois do frasco: pensar em outro diagnóstico', manual: BOTULISMO_NO_MANUAL },
  { tema: 'Botulismo: vigilância respiratória', diretriz: 'CDC 2021: medir de forma seriada a função respiratória e bulbar (espirometria, CO2 expirado ou gasometria). O guia usa os cortes da SGB: CVF < 20 mL/kg, PImáx < 30 cmH2O e PEmáx < 40 cmH2O se associam a ventilação mecânica; pCO2 ou CO2 expirado subindo prediz ventilação; a oximetria pode não avisar cedo. Monitor cardíaco contínuo', manual: 'critérios de ventilação só da SGB: 1 maior (pCO2 > 48, pO2 < 56, CVF < 15 mL/kg, PImáx < 30) ou 2 menores (Tabela 4, p. 602)' },
  { tema: 'Botulismo: antibiótico', diretriz: 'CDC 2021: antimicrobiano não trata o botulismo; no botulismo de ferida, o centro é o desbridamento. Aminoglicosídeo, magnésio, clindamicina, tetraciclina ou cálcio só depois de pesar o risco e com monitorização (o risco comprovado é o do aminoglicosídeo); bloqueador neuromuscular, evitar ou usar com cautela', manual: BOTULISMO_NO_MANUAL },
  { tema: 'Botulismo, SGB ou miastenia', diretriz: 'CDC 2021: pensar em botulismo quando se suspeita de miastenia ou de SGB. Na SGB a proteína do liquor costuma subir, sobretudo na 2ª semana; o teste do edrofônio costuma ser negativo no botulismo', manual: 'Tabela 2 (p. 599–600) separa as causas pela topografia; liquor da SGB com proteína > 50 mg/dL e até 4 células (p. 603)' },
]

/** cap. 44: EAN/PNS 2023 (SGB, na ficha) e CDC 2021 (botulismo). */
export const notaHcfmuspCap44 = notaLote6('nota-hcfmusp-cap44-paralisias-flacidas', 'Nota de atualização — manual HC, cap. 44: paralisias flácidas agudas', 'cap. 44, p. 598–608', fichaSgbAdulto, [
    ...DIRETRIZ_SGB_2023.map((d) => ({ tema: `SGB: ${d.tema.charAt(0).toLowerCase()}${d.tema.slice(1)}`, diretriz: `${d.fonte} (${d.grau}; resumo lido): ${d.diretriz}`, manual: sem(d.livro) })),
    ...DIRETRIZ_BOTULISMO_2021,
  ], [EAN_PNS_SGB_2023, CDC_BOTULISMO_2021, MS_BOTULISMO_2024])
notaHcfmuspCap44.ficha.versao = '2026-11-14.2'
notaHcfmuspCap44.ficha.revisadoEm = '14/11/2026 (lote 6 da revisão do HCFMUSP: SGB pela EAN/PNS 2023, pelo resumo; botulismo pelo CDC 2021, no texto integral, e pelo Guia de Vigilância do MS 2024; aguarda aprovação do RT)'

/** cap. 12: SBC 2025 de dor torácica, já na ficha do HEART. */
export const notaHcfmuspCap12 = notaLote6('nota-hcfmusp-cap12-dor-toracica', 'Nota de atualização — manual HC, cap. 12: abordagem inicial da dor torácica', 'cap. 12, p. 183–198', heart.ficha,
  DIRETRIZ_DOR_TORACICA_2025.map((d) => ({ tema: d.tema, diretriz: `${d.fonte} (${d.grau}): ${d.diretriz}`, manual: sem(d.livro) })),
  [SBC_DOR_TORACICA_2025])
notaHcfmuspCap12.ficha.revisadoEm = '14/11/2026 (lote 6 da revisão do HCFMUSP: itens tirados da SBC 2025, lida no texto integral; aguarda aprovação do RT)'

/** cap. 16: consenso da EUSEM 2024, já na ficha da regra de San Francisco. */
export const notaHcfmuspCap16 = notaLote6('nota-hcfmusp-cap16-sincope', 'Nota de atualização — manual HC, cap. 16: perda transitória da consciência', 'cap. 16, p. 233–242', sincopeSanFrancisco.ficha,
  DIRETRIZ_SINCOPE_2024.map((d) => ({ tema: d.tema, diretriz: `${d.fonte} (${d.grau}): ${d.diretriz}`, manual: sem(d.livro) })),
  [EUSEM_SINCOPE_2024])
notaHcfmuspCap16.ficha.revisadoEm = '14/11/2026 (lote 6 da revisão do HCFMUSP: itens tirados do consenso da EUSEM 2024, lido no texto integral; aguarda aprovação do RT)'

/** cap. 96: diretriz latino-americana de SSJ/NET 2025, já na ficha de dermatoses graves. */
export const notaHcfmuspCap96 = notaLote6('nota-hcfmusp-cap96-dermatoses', 'Nota de atualização — manual HC, cap. 96: dermatoses graves (SSJ/NET)', 'cap. 96, p. 1277–1296', fichaDermatosesAdulto,
  DIRETRIZ_SSJ_NET_2025.map((d) => ({ tema: `SSJ/NET: ${d.tema.charAt(0).toLowerCase()}${d.tema.slice(1)}`, diretriz: `${d.fonte} (${d.grau}): ${d.diretriz}`, manual: sem(d.livro) })),
  [LATAM_SSJ_NET_2025])
notaHcfmuspCap96.ficha.revisadoEm = '14/11/2026 (lote 6 da revisão do HCFMUSP: itens tirados da diretriz latino-americana de SSJ/NET 2025, lida no texto integral; aguarda aprovação do RT)'

/** cap. 60: ACG 2023 de insuficiência hepática aguda (na ficha) e ACG 2024 da hepatite alcoólica (na ficha do Maddrey). */
export const notaHcfmuspCap60 = notaLote6('nota-hcfmusp-cap60-hepatites-graves', 'Nota de atualização — manual HC, cap. 60: hepatites graves', 'cap. 60, p. 808–823', fichaInsuficienciaHepatica, [
    ...DIRETRIZ_IHA_2023.map((d) => ({ tema: `Insuficiência hepática aguda: ${d.tema.charAt(0).toLowerCase()}${d.tema.slice(1)}`, diretriz: `${d.fonte} (${d.grau}): ${d.diretriz}`, manual: sem(d.livro) })),
    { tema: 'Hepatite alcoólica grave', diretriz: 'ACG 2024: o MELD é o escore mais acurado para estratificar, e MELD > 20 define a forma grave. O benefício do corticoide em 28 dias aparece com MELD de 21 a 39, é limitado entre 40 e 50 e não existe acima de 50. O Lille no dia 4 do corticoide é tão acurado quanto no dia 7', manual: 'Maddrey > 32: prednisona 40 mg ao dia por 4 semanas; pentoxifilina ou acetilcisteína podem ter benefício (cap. 60, p. 817)' },
  ], [ACG_IHA_2023, ACG_ALD_2024])
notaHcfmuspCap60.ficha.revisadoEm = '14/11/2026 (lote 6 da revisão do HCFMUSP: itens da ACG 2023 de insuficiência hepática aguda, lida no texto integral, e da ACG 2024 da hepatite alcoólica, já na ficha do Maddrey; aguarda aprovação do RT)'

// Q3 = A: cap. 88, 95 e 5 não têm ficha de adulto na Central. A nota liga só ao
// capítulo do manual (conferido no PDF).
export const DGN_HIV_2026: Fonte = {
  citacao: 'Hahn K, Arendt G, Eggers C, et al. Guideline of the German Society of Neurology (DGN): diagnosis and therapy of HIV-1-associated neurological disorders. Neurol Res Pract. 2026;8 (PMID 42596004; PMC13474671). Texto integral lido; sem graduação das recomendações; doses baseadas na EACS.',
  url: 'https://doi.org/10.1186/s42466-026-00519-y',
}
export const COLOMBIA_FEBRE_AMARELA_2025: Fonte = {
  citacao: 'Forero-Delgadillo AJ, Morales-Olivera JA, Celis-Guzmán JF, et al. Colombian consensus on the care of critically ill patients with suspected or confirmed severe yellow fever. Lancet Reg Health Am. 2025;48:101144 (PMID 40585555; PMC12197880). Texto integral lido; Delphi com GRADE, voltado à UTI; o rótulo de força de cada recomendação não veio no texto do PMC.',
  url: 'https://doi.org/10.1016/j.lana.2025.101144',
}
export const EAN_COMA_2020: Fonte = {
  citacao: 'Kondziella D, Bender A, Diserens K, et al. European Academy of Neurology guideline on the diagnosis of coma and other disorders of consciousness. Eur J Neurol. 2020;27(5):741–756 (PMID 32090418). Resumo lido; GRADE (sugestões).',
  url: 'https://doi.org/10.1111/ene.14151',
}

function notaSoManualLote6(...a: Parameters<typeof notaSoManual>): NotaHcfmusp {
  const n = notaSoManual(...a)
  n.ficha.versao = '2026-11-14.1'
  n.ficha.revisadoEm = '14/11/2026 (lote 6 da revisão do HCFMUSP, Q3: nota sem ficha de adulto na Central; aguarda aprovação do RT)'
  return n
}

const SEM_DGN = 'DGN 2026 (sem grau)'

/** cap. 88: DGN 2026 (complicações neurológicas do HIV). O resumo da EACS 2025 aberto no PMC não traz as tabelas de infecção oportunista. */
export const notaHcfmuspCap88 = notaSoManualLote6('nota-hcfmusp-cap88-hiv', 'Nota de atualização — manual HC, cap. 88: complicações agudas do paciente com HIV', 'cap. 88, p. 1188–1208', [
    { tema: 'Início da terapia antirretroviral', diretriz: `${SEM_DGN}: diagnosticado o HIV, a terapia antirretroviral está indicada qualquer que seja o CD4 e a apresentação clínica`, manual: 'o cap. 88 não trata do ponto' },
    { tema: 'Neurotoxoplasmose: diagnóstico', diretriz: `${SEM_DGN}: lesão focal com realce e IgG positiva bastam para a suspeita e para começar o tratamento; IgM não ajuda; sorologia negativa não exclui. Biópsia cerebral se o tratamento de prova falha em 2–3 semanas`, manual: 'diagnóstico presuntivo com CD4 < 100, quadro compatível, IgG positiva e realce anelar; biópsia raramente necessária (cap. 88, p. 1197)' },
    { tema: 'Neurotoxoplasmose: tratamento', diretriz: `${SEM_DGN}: pirimetamina VO 200 mg no 1º dia e depois 75 mg/dia (≥ 60 kg) ou 50 mg/dia (< 60 kg), com sulfadiazina 3.000 mg 2 vezes ao dia (≥ 60 kg) ou 2.000 mg 2 vezes ao dia (< 60 kg). Adjuvante: o texto da DGN escreve "folic acid" 15 mg/dia, e o manual traz ácido folínico 10–25 mg/dia; os dois não são a mesma droga. Intolerância a sulfa: clindamicina 600 mg 4 vezes ao dia com pirimetamina. Segunda linha: sulfametoxazol-trimetoprima, 5 mg/kg de trimetoprima 2 vezes ao dia`, manual: 'sulfadiazina 1.000 mg 4 vezes ao dia (< 60 kg) ou 1.500 mg 4 vezes ao dia (> 60 kg), pirimetamina 100–200 mg no 1º dia e 50–75 mg/dia, e ácido folínico 10–25 mg/dia, por 3–6 semanas; sulfametoxazol-trimetoprima como alternativa (Tabela 5, p. 1198)' },
    { tema: 'Meningite criptocócica', diretriz: `${SEM_DGN}: indução por 2 semanas com anfotericina B lipossomal 3 mg/kg e flucitosina 100 mg/kg/dia em 4 doses; consolidação com fluconazol 400 mg/dia por 8 semanas; manutenção com 200 mg/dia por pelo menos 1 ano, que pode parar com CD4 > 100 e carga viral baixa ou indetectável por 3 meses ou mais`, manual: 'indução por pelo menos 2 semanas com anfotericina B desoxicolato 0,7–1 mg/kg/dia, com ou sem flucitosina 100 mg/kg/dia; consolidação com fluconazol 400–800 mg/dia por 8 semanas; manutenção com 200 mg/dia até CD4 > 200 por 6 meses; medir a pressão de abertura do liquor (p. 1200–1201)' },
    { tema: 'Tuberculose do sistema nervoso central', diretriz: `${SEM_DGN}: não começar a terapia antirretroviral junto com o tratamento da tuberculose, só depois de pelo menos 2 semanas. Com CD4 < 100, considerar prednisona preventiva ao iniciar a terapia antirretroviral: 40 mg VO por 2 semanas e depois 20 mg por 2 semanas`, manual: 'o cap. 88 não trata do ponto' },
    { tema: 'Síndrome inflamatória de reconstituição imune (IRIS)', diretriz: `${SEM_DGN}: pensar em IRIS na infecção oportunista que surge nos primeiros meses de terapia antirretroviral eficaz (em geral < 4 meses). Conduta: manter a terapia antirretroviral e tratar as complicações; o corticoide é controverso`, manual: 'o cap. 88 não trata do ponto' },
  ], [DGN_HIV_2026])
notaHcfmuspCap88.ficha.revisadoEm = '14/11/2026 (lote 6 da revisão do HCFMUSP, Q3: itens da DGN 2026, lida no texto integral, sem graduação; o resumo aberto da EACS 2025 não traz as tabelas de infecção oportunista; aguarda aprovação do RT)'

const FA = 'Consenso colombiano 2025 (Delphi com GRADE, para UTI; força não conferida no texto)'

/** cap. 95: consenso colombiano 2025 de febre amarela grave. */
export const notaHcfmuspCap95 = notaSoManualLote6('nota-hcfmusp-cap95-febre-amarela', 'Nota de atualização — manual HC, cap. 95: febre amarela', 'cap. 95, p. 1267–1275', [
    { tema: 'Volume', diretriz: `${FA}: evitar sobrecarga de volume na ressuscitação com cristaloide isotônico, guiando por avaliação à beira do leito com ultrassom`, manual: 'tratamento de suporte do choque, sem detalhar (cap. 95, p. 1274)' },
    { tema: 'Choque', diretriz: `${FA}: não atrasar a noradrenalina, primeiro vasopressor no choque`, manual: 'tratamento de suporte do choque, sem detalhar (cap. 95, p. 1274)' },
    { tema: 'Plasma e plaquetas', diretriz: `${FA}: não usar plasma, outros fatores ou plaquetas de rotina ou como profilaxia para corrigir exames de coagulação. Plasma ou fatores no sangramento ativo ou antes de procedimento. Plaquetas com limiar de 30.000/µL se houver disfunção orgânica e de 50.000/µL com sangramento ativo ou terapia extracorpórea`, manual: 'tratamento de suporte da coagulopatia, sem detalhar (cap. 95, p. 1274)' },
    { tema: 'Antiviral', diretriz: `${FA}: nenhuma recomendação a favor ou contra antiviral específico; nenhum ensaio clínico mostrou eficácia`, manual: 'não há tratamento específico; sofosbuvir com bons resultados experimentais (cap. 95, p. 1274)' },
    { tema: 'Diálise e troca plasmática', diretriz: `${FA}: terapia renal substitutiva precoce, de preferência contínua, com encefalopatia grau 2, amônia > 70 µmol/L ou lesão renal aguda grave. Troca plasmática na insuficiência hepática aguda ou com amônia > 70 µmol/L, como ponte para a recuperação`, manual: 'tratamento de suporte da insuficiência renal, sem detalhar (cap. 95, p. 1274)' },
    { tema: 'Via aérea', diretriz: `${FA}: intubação precoce para proteger a via aérea na encefalopatia de West Haven > 2`, manual: 'o cap. 95 não trata do ponto' },
    { tema: 'Linfo-histiocitose hemofagocítica', diretriz: `${FA}: com HScore > 160, iniciar metilprednisolona em dose alta, ou equivalente`, manual: 'o cap. 95 não trata do ponto' },
    { tema: 'Transplante hepático', diretriz: `${FA}: nenhuma recomendação a favor ou contra encaminhar para transplante`, manual: 'transplante hepático considerado nos casos graves (cap. 95, p. 1274)' },
  ], [COLOMBIA_FEBRE_AMARELA_2025])
notaHcfmuspCap95.ficha.revisadoEm = '14/11/2026 (lote 6 da revisão do HCFMUSP, Q3: itens do consenso colombiano 2025, lido no texto integral; o rótulo de força não veio no texto do PMC; aguarda aprovação do RT)'

/** cap. 5: EAN 2020, pelo resumo; diretriz de diagnóstico de distúrbio de consciência. */
export const notaHcfmuspCap5 = notaSoManualLote6('nota-hcfmusp-cap5-rebaixamento', 'Nota de atualização — manual HC, cap. 5: rebaixamento do nível de consciência', 'cap. 5, p. 80–97', [
    { tema: 'Escala na fase aguda', diretriz: 'EAN 2020 (sugestão, GRADE; resumo lido): usar a escala FOUR em vez da escala de coma de Glasgow na fase aguda', manual: 'escala de coma de Glasgow (Tabela 3, cap. 5, p. 88)' },
    { tema: 'Eletroencefalograma', diretriz: 'EAN 2020 (sugestão, GRADE; resumo lido): obter EEG clínico padrão', manual: 'o cap. 5 não trata do ponto' },
    { tema: 'Exame neurológico', diretriz: 'EAN 2020 (sugestão, GRADE; resumo lido): além do exame neurológico completo, procurar movimentos oculares voluntários com um espelho', manual: 'avaliação sistemática: Glasgow, pares cranianos, reflexos de tronco, resposta motora e fundo de olho (cap. 5, p. 88)' },
  ], [EAN_COMA_2020])
notaHcfmuspCap5.ficha.revisadoEm = '14/11/2026 (lote 6 da revisão do HCFMUSP, Q3: itens da EAN 2020, pelo resumo; diretriz voltada ao diagnóstico dos distúrbios de consciência; aguarda aprovação do RT)'

export const NOTAS_HCFMUSP_LOTE6: NotaHcfmusp[] = [notaHcfmuspCap5, notaHcfmuspCap12, notaHcfmuspCap16, notaHcfmuspCap41, notaHcfmuspCap44, notaHcfmuspCap60, notaHcfmuspCap88, notaHcfmuspCap95, notaHcfmuspCap96]

// ── Lote 7 (decisão do RT de 14/11/2026, Q1–Q4 = A; docs/clinico/HCFMUSP-LOTE7-DIAGNOSTICO.md).
// Q1: cap. 42, 63 e 89, cuja ficha já cita a diretriz recente; os itens vêm da ficha.
const REVISADO_LOTE7 = '14/11/2026 (lote 7 da revisão do HCFMUSP: itens tirados da ficha da Central, já conferidos com a diretriz; aguarda aprovação do RT)'
function notaLote7(...a: Parameters<typeof nota>): NotaHcfmusp {
  const n = nota(...a)
  n.ficha.versao = '2026-11-14.1'
  n.ficha.revisadoEm = REVISADO_LOTE7
  return n
}

/** cap. 42: GRACE-3 (SAEM 2023), já no aviso da ficha do HINTS. */
export const notaHcfmuspCap42 = notaLote7('nota-hcfmusp-cap42-vertigem', 'Nota de atualização — manual HC, cap. 42: vertigem', 'cap. 42, p. 577–588', hintsPlus.ficha, [
    { tema: 'Quem pode usar o HINTS', diretriz: 'GRACE-3 2023: usar o HINTS só se o examinador tiver treino no exame e só na síndrome vestibular aguda com nistagmo; sem treino, o HINTS é impreciso', manual: 'HINTS e HINTS plus na síndrome vestibular aguda; os três itens juntos têm mais sensibilidade e especificidade que a ressonância para AVC isquêmico (cap. 42, p. 580–583)' },
    { tema: 'Tontura sem nistagmo', diretriz: 'GRACE-3 2023: sem nistagmo, avaliar a gravidade do desequilíbrio da marcha', manual: 'não comparado nesta nota' },
    { tema: 'Imagem', diretriz: 'GRACE-3 2023: a TC de crânio não exclui AVC; a ressonância serve para confirmar quando o HINTS é central ou duvidoso', manual: 'TC com baixa sensibilidade para isquemia de fossa posterior; ressonância falso-negativa em 12 a 13,3% nas primeiras 48 h (cap. 42, p. 579)' },
  ], [GRACE3_TONTURA])

/** cap. 63: workshop ENMC 2024 (publicado em 2025), já na nota da ficha de rabdomiólise. */
export const notaHcfmuspCap63 = notaLote7('nota-hcfmusp-cap63-rabdomiolise', 'Nota de atualização — manual HC, cap. 63: rabdomiólise', 'cap. 63, p. 852–861', fichaRabdomiolise, [
    { tema: 'Diagnóstico', diretriz: 'ENMC 2025 (consenso de especialistas): sintomas musculares (edema intenso, fraqueza ou mialgia) com CPK > 10.000 UI/L na rabdomiólise por esforço ou > 5.000 UI/L na não relacionada ao esforço; pico em 1 a 4 dias e normalização em 1 a 2 semanas de repouso; com doença neuromuscular de base, CPK acima de 5 a 10 vezes o basal', manual: 'estímulo miotóxico ou urina escura com CPK > 5–10 × o limite superior, usualmente > 1.000 UI/L, sem corte rigoroso (cap. 63, p. 854)' },
    { tema: 'Quem tratar', diretriz: 'ENMC 2025 (consenso de especialistas): tratar só quando o risco de lesão renal aguda é alto, estimado pelo escore de McMahon', manual: 'medidas para prevenir a lesão renal com CPK > 5.000 UI/L ou lesão muscular grave (Tabela 3, cap. 63, p. 858); escore de McMahon (p. 856–857)' },
  ], [ENMC_RABDO_2025])

/** cap. 89: IDSA 2025 de ITU complicada, já na ficha de ITU. */
export const notaHcfmuspCap89 = notaLote7('nota-hcfmusp-cap89-itu', 'Nota de atualização — manual HC, cap. 89: infecção do trato urinário', 'cap. 89, p. 1209–1216', fichaItuAdulto, [
    { tema: 'Antibiótico empírico', diretriz: 'IDSA 2025 (resumo lido): escolher o antibiótico empírico da ITU complicada em 4 passos: gravidade, risco de resistência, fatores do paciente e, na sepse, o antibiograma local', manual: 'esquemas por quadro: cistite, pielonefrite e ITU associada à sonda (cap. 89, p. 1212–1215)' },
    { tema: 'Duração', diretriz: 'IDSA 2025 (resumo lido): em quem melhora, 5–7 dias de fluoroquinolona ou 7 dias de outra classe, com ou sem bacteremia por Gram-negativo; 10–14 dias no homem febril com suspeita de prostatite', manual: 'pielonefrite: 7 a 14 dias (cap. 89, p. 1213)' },
    { tema: 'Troca da via venosa para oral', diretriz: 'IDSA 2025 (resumo lido): passar para via oral quando o paciente melhora, aceita medicação oral e há opção oral eficaz', manual: 'não comparado nesta nota' },
  ], [IDSA_ITU_EMPIRICO_2025, IDSA_ITU_DURACAO_2025, IDSA_ITU_EV_VO_2025])

/** cap. 51: ACG 2023 de HDB, já na ficha do Oakland. */
export const notaHcfmuspCap51 = notaLote7('nota-hcfmusp-cap51-hdb', 'Nota de atualização — manual HC, cap. 51: hemorragia digestiva baixa', 'cap. 51, p. 707–716', fichaOakland,
  DIRETRIZ_HDB_2023.map((d) => ({ tema: d.tema, diretriz: `${d.fonte} (${d.grau}): ${d.diretriz}`, manual: sem(d.livro) })),
  [ACG_HDB_2023])
notaHcfmuspCap51.ficha.revisadoEm = '14/11/2026 (lote 7 da revisão do HCFMUSP: itens da ACG 2023, lida no texto integral; aguarda aprovação do RT)'

export const NOTAS_HCFMUSP_LOTE7: NotaHcfmusp[] = [notaHcfmuspCap42, notaHcfmuspCap51, notaHcfmuspCap63, notaHcfmuspCap89]

export const NOTAS_HCFMUSP: NotaHcfmusp[] = [...NOTAS_HCFMUSP_LOTE1, ...NOTAS_HCFMUSP_LOTE2, ...NOTAS_HCFMUSP_LOTE3, ...NOTAS_HCFMUSP_LOTE4, ...NOTAS_HCFMUSP_LOTE5, ...NOTAS_HCFMUSP_LOTE6, ...NOTAS_HCFMUSP_LOTE7]

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
export const fichaNotaHcfmuspCap22 = notaHcfmuspCap22.ficha
export const fichaNotaHcfmuspCap45 = notaHcfmuspCap45.ficha
export const fichaNotaHcfmuspCap61 = notaHcfmuspCap61.ficha
export const fichaNotaHcfmuspCap23 = notaHcfmuspCap23.ficha
export const fichaNotaHcfmuspCap59 = notaHcfmuspCap59.ficha
export const fichaNotaHcfmuspCap57 = notaHcfmuspCap57.ficha
export const fichaNotaHcfmuspCap84 = notaHcfmuspCap84.ficha
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
