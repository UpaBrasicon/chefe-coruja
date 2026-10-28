import type { Ficha, Fonte } from '../ficha.ts'
import { fichaAdulto, pagina } from './fonte.ts'

// Cefaleia aguda no adulto (lacunas da Central, lote 2, 24/10/2026). Manual de
// Medicina de Emergência do HCFMUSP (3ª ed., 2022), cap. 41 Cefaleia (p. 564–576),
// lido no PDF (página do livro = página do PDF + 1), e a lista SNNOOP10 de Do et al.
// (Neurology 2019), conferida no resumo. O capítulo dá dose só de dexametasona,
// difenidramina, oxigênio e sumatriptano SC; para as demais drogas traz o nome e
// a via. As doses que faltavam vêm do consenso da Sociedade Brasileira de Cefaleia
// (Arq Neuropsiquiatr 2000), lido no PDF do SciELO com a página impressa; é de 2000
// e a tela diz isso. Ao lado, os níveis de recomendação da AHS 2025 para a crise no
// PS, pelo resumo (sem dose). Decisão do RT de 27/10/2026. A ACEP 2019 ficou de
// fora: o resumo traz só as perguntas, não as respostas. A conduta é do médico (ADR 0007).

export const SNNOOP10: Fonte = {
  citacao: 'Do TP, Remmers A, Schytz HW, et al. Red and orange flags for secondary headaches in clinical practice: SNNOOP10 list. Neurology. 2019;92(3):134–144 (PMID 30587518): os 15 sinais; faltam estudos prospectivos de validação.',
  url: 'https://doi.org/10.1212/WNL.0000000000006697',
}

const PAG_CEFALEIA = 'cap. 41 Cefaleia, p. 564–576 (Tabela 2, p. 566–568)'

export const SBCE_2000: Fonte = {
  citacao: 'Sociedade Brasileira de Cefaléia — Comitê Ad Hoc. Recomendações para o tratamento da crise migranosa. Consenso da Sociedade Brasileira de Cefaléia. Arq Neuropsiquiatr. 2000;58(2-A):371–389 (PMID 10849644): migrânea na emergência (p. 376) e Tabelas 1 a 3 (p. 377–378), lidas no PDF do SciELO. Consenso de 2000.',
  url: 'https://www.scielo.br/j/anp/a/NntCtQbfdbdnSBqP7W6jJXk/?format=pdf&lang=pt',
}

export const AHS_2025: Fonte = {
  citacao: 'Robblee J, Minen MT, Friedman BW, et al. 2025 guideline update to acute treatment of migraine for adults in the emergency department: the American Headache Society evidence assessment of parenteral pharmacotherapies. Headache. 2026;66(1):53–76 (PMID 41321235): níveis de recomendação lidos no resumo; o texto integral não foi acessado.',
  url: 'https://doi.org/10.1111/head.70016',
}

export const fichaCefaleiaAdulto: Ficha = {
  ...fichaAdulto('adulto-cefaleia', 'Cefaleia aguda — sinais de alarme e tratamento (adulto)', PAG_CEFALEIA),
  versao: '2026-10-27.1',
  fontes: [pagina(PAG_CEFALEIA), SNNOOP10, SBCE_2000, AHS_2025],
  revisadoEm: '27/10/2026 (doses da migrânea pelo consenso da SBCe 2000, com página; níveis da AHS 2025 pelo resumo)',
}

/** Linha da Tabela 2 do manual (p. 566–568): sinal de alarme, diferenciais e investigação. */
export type LinhaAlarme = { sinal: string; diferenciais: string; investigacao: string }

export const TABELA2: Record<string, LinhaAlarme> = {
  subita: { sinal: 'Início súbito (pico em segundos a minutos)', diferenciais: 'HSA, aneurisma, HIP, TVC, dissecção', investigacao: 'neuroimagem; estudo de vasos cranianos e cervicais; punção lombar após a neuroimagem' },
  progressiva: { sinal: 'Piora progressiva', diferenciais: 'HSD, hipertensão intracraniana (neoplasia)', investigacao: 'neuroimagem' },
  idade: { sinal: 'Início após os 50 anos', diferenciais: 'arterite de células gigantes, neoplasias, glaucoma', investigacao: 'VHS; neuroimagem' },
  sistemicos: { sinal: 'Sintomas sistêmicos (febre, emagrecimento)', diferenciais: 'meningite, encefalite, doenças autoimunes, neoplasia', investigacao: 'neuroimagem; punção lombar; hemograma e exames séricos; provas inflamatórias e autoimunes' },
  neurologico: { sinal: 'Alteração neurológica focal ou do nível de consciência', diferenciais: 'HSA, AVCh, dissecção, infecção, neoplasia', investigacao: 'neuroimagem; considerar estudo de vasos; punção lombar após a neuroimagem' },
  papiledema: { sinal: 'Papiledema', diferenciais: 'lesão expansiva, hipertensão benigna, meningite', investigacao: 'neuroimagem; punção lombar após a neuroimagem' },
  imunidade: { sinal: 'Comorbidades: HIV e neoplasia', diferenciais: 'infecções oportunistas, metástase', investigacao: 'neuroimagem; punção lombar' },
  gestacao: { sinal: 'Gestação e puerpério', diferenciais: 'trombose venosa central, dissecção arterial', investigacao: 'neuroimagem; estudo de vasos cranianos e cervicais' },
  esforco: { sinal: 'Deflagrada por esforço ou Valsalva', diferenciais: 'HSA, vasoconstrição arterial reversível', investigacao: 'neuroimagem; estudo de vasos; considerar punção lombar' },
  trauma: { sinal: 'História de traumatismo craniano', diferenciais: 'hematoma subdural, HSA, dissecção arterial', investigacao: 'neuroimagem; estudo de vasos cranianos e cervicais' },
}

/** Os 15 sinais da SNNOOP10 e, quando há, a linha correspondente da Tabela 2 do manual. */
export const SINAIS: { id: string; rotulo: string; tabela?: keyof typeof TABELA2; nota?: string }[] = [
  { id: 'sistemicos', rotulo: 'Sintomas sistêmicos, inclusive febre', tabela: 'sistemicos' },
  { id: 'neoplasia', rotulo: 'História de neoplasia', tabela: 'imunidade' },
  { id: 'neurologico', rotulo: 'Déficit neurológico ou rebaixamento da consciência', tabela: 'neurologico' },
  { id: 'subita', rotulo: 'Início súbito ou abrupto', tabela: 'subita' },
  { id: 'idade', rotulo: 'Início em idade mais avançada', tabela: 'idade', nota: 'A SNNOOP10 usa início após os 65 anos; o manual, após os 50.' },
  { id: 'padrao', rotulo: 'Mudança de padrão ou cefaleia nova de início recente' },
  { id: 'posicional', rotulo: 'Cefaleia posicional' },
  { id: 'esforco', rotulo: 'Desencadeada por espirro, tosse ou exercício', tabela: 'esforco' },
  { id: 'papiledema', rotulo: 'Papiledema', tabela: 'papiledema' },
  { id: 'progressiva', rotulo: 'Cefaleia progressiva ou apresentação atípica', tabela: 'progressiva' },
  { id: 'gestacao', rotulo: 'Gestação ou puerpério', tabela: 'gestacao' },
  { id: 'olho', rotulo: 'Olho doloroso com sinais autonômicos', nota: 'O manual lembra o glaucoma de ângulo fechado com alteração visual aguda (p. 576).' },
  { id: 'trauma', rotulo: 'Início após trauma', tabela: 'trauma' },
  { id: 'imunidade', rotulo: 'Doença do sistema imune, como HIV', tabela: 'imunidade' },
  { id: 'analgesico', rotulo: 'Uso excessivo de analgésico ou droga nova no início da dor' },
]

export type Avaliacao = { alarmes: number; linhas: LinhaAlarme[]; semLinha: string[] }

/** Junta os sinais marcados às linhas da Tabela 2 (sem repetir linha). */
export function avaliarSinais(marcados: string[]): Avaliacao {
  const sel = SINAIS.filter((s) => marcados.includes(s.id))
  const chaves = [...new Set(sel.flatMap((s) => (s.tabela ? [s.tabela] : [])))]
  return {
    alarmes: sel.length,
    linhas: chaves.map((k) => TABELA2[k]),
    semLinha: sel.filter((s) => !s.tabela).map((s) => s.rotulo),
  }
}

export type Tratamento = { droga: string; texto: string; pagina: string }

/** Tratamento das cefaleias primárias como o capítulo traz (p. 572–574); dose só onde o livro dá. */
export const TRATAMENTO: Record<'tensional' | 'migranea' | 'salvas', { titulo: string; itens: Tratamento[] }> = {
  tensional: {
    titulo: 'Cefaleia tensional',
    itens: [
      { droga: 'Analgésico comum ou AINE', texto: 'dipirona, paracetamol; cetoprofeno, ibuprofeno, nimesulida (o capítulo não traz dose; doses do consenso da SBCe 2000 abaixo)', pagina: 'p. 572' },
      { droga: 'Seguimento', texto: 'avaliar risco de cronificação e abuso de analgésico; profilaxia ambulatorial quando indicada', pagina: 'p. 572' },
    ],
  },
  migranea: {
    titulo: 'Migrânea',
    itens: [
      { droga: 'Triptano', texto: 'primeira escolha na migrânea sem aura, melhor no começo da crise; intranasal ou SC se já há náusea ou vômito. Contraindicado em arteriopatas (coronariopatia, AVCi prévio); evitar na migrânea com aura, em especial o sumatriptano SC na fase de aura (o capítulo não traz dose; doses do consenso da SBCe 2000 abaixo)', pagina: 'p. 573' },
      { droga: 'AINE e analgésico comum', texto: 'naproxeno, ibuprofeno, cetoprofeno, nimesulida; dipirona, paracetamol (o capítulo não traz dose; doses do consenso da SBCe 2000 abaixo)', pagina: 'p. 573' },
      { droga: 'Clorpromazina ou metoclopramida', texto: 'adjuvantes com efeito próprio sobre a dor. Clorpromazina parenteral com monitorização cardíaca; metoclopramida parenteral no paciente com náusea, diluída e lenta (o capítulo não traz dose; doses do consenso da SBCe 2000 abaixo)', pagina: 'p. 573' },
      { droga: 'Difenidramina', texto: '12,5 mg EV antes da metoclopramida, para prevenir acatisia', pagina: 'p. 573' },
      { droga: 'Dexametasona', texto: '10 mg EV no maior risco de recidiva em curto prazo (crise prolongada, crises recentes)', pagina: 'p. 573' },
      { droga: 'Hidratação', texto: 'adequada, fundamental para a melhora', pagina: 'p. 573' },
    ],
  },
  salvas: {
    titulo: 'Cefaleia em salvas',
    itens: [
      { droga: 'Oxigênio', texto: '10 L/min em máscara não reinalante por 10–15 minutos', pagina: 'p. 574' },
      { droga: 'Sumatriptano', texto: '6 mg SC (a via oral não tem efeito adequado)', pagina: 'p. 574' },
      { droga: 'Ponte e profilaxia', texto: 'ponte geralmente com dexametasona; encaminhar para profilaxia com verapamil (o capítulo não traz dose)', pagina: 'p. 574' },
    ],
  },
}

/** Cefaleia em thunderclap: investigação (p. 568–569). */
export const THUNDERCLAP: string[] = [
  'Neuroimagem: a tomografia pode ser preferível pela disponibilidade e rapidez.',
  'Punção lombar se a tomografia for normal, para a HSA não vista na tomografia inicial.',
  'Estudo de vasos (angiotomografia ou angiorressonância), arterial cervical e craniano e do sistema venoso cerebral.',
  'Cefaleia primária em thunderclap é diagnóstico de exclusão.',
]

// ── Doses do consenso da SBCe 2000 (Tabelas 1 a 3, p. 377–378) ───────────────

export type LinhaDose = { droga: string; dose: string; classe: string }
export type TabelaSbce = { id: 'fraca' | 'moderada' | 'forte'; titulo: string; pagina: string; linhas: LinhaDose[]; nota?: string }

/** Como o consenso traz; cada linha é uma opção. Classe = nível de evidência do consenso. */
export const SBCE_TABELAS: TabelaSbce[] = [
  {
    id: 'fraca', titulo: 'Crise fraca', pagina: 'Tabela 1, p. 377',
    linhas: [
      { droga: 'Ácido acetilsalicílico', dose: '1000 mg VO, repetir 2–4 h após s/n; máximo/dia 3 g', classe: 'I' },
      { droga: 'Paracetamol', dose: '1000 mg VO, repetir 2–4 h após s/n; máximo/dia 3 g', classe: 'I' },
      { droga: 'Naproxeno sódico', dose: '750–1250 mg VO, repetir 2–4 h após s/n; máximo/dia 1650 mg', classe: 'I' },
      { droga: 'Ibuprofeno', dose: '800–1200 mg VO, repetir 2–4 h após s/n; máximo/dia 1600 mg', classe: 'I' },
      { droga: 'Diclofenaco de sódio', dose: '50–100 mg VO, repetir 2–4 h após s/n; máximo/dia 200 mg', classe: 'I' },
      { droga: 'Ácido tolfenâmico', dose: '200–400 mg VO, repetir 2–4 h após s/n; máximo/dia 600 mg', classe: 'I' },
      { droga: 'Clonixinato de lisina', dose: '250 mg VO, repetir 2–4 h após s/n; máximo/dia 500 mg', classe: 'I' },
      { droga: 'Dipirona', dose: '500 mg VO, repetir 2–4 h após s/n; máximo/dia 2 g', classe: 'III' },
      { droga: 'Metoclopramida', dose: '20 mg VO, associada ou antes do analgésico', classe: 'I' },
      { droga: 'Domperidona', dose: '20 mg VO, associada ou antes do analgésico', classe: 'I' },
    ],
  },
  {
    id: 'moderada', titulo: 'Crise moderada', pagina: 'Tabela 2, p. 377',
    nota: 'Associar metoclopramida parenteral na vigência de vômito (o consenso não traz a dose parenteral).',
    linhas: [
      { droga: 'Ácido acetilsalicílico', dose: '1000 mg VO, repetir 2–4 h após s/n; máximo/dia 3 g', classe: 'I' },
      { droga: 'Ácido tolfenâmico', dose: '200–400 mg VO, repetir 2–4 h após s/n; máximo/dia 600 mg', classe: 'I' },
      { droga: 'Clonixinato de lisina', dose: '250 mg VO, repetir 2–4 h após s/n; máximo/dia 500 mg', classe: 'I' },
      { droga: 'Tartarato de ergotamina', dose: '1–2 mg VO, repetir 1–2 h s/n; máximo/dia 4 mg', classe: 'I' },
      { droga: 'Di-hidroergotamina (DHE)', dose: '0,5 mg em cada narina, repetir 15 min após s/n; máximo/dia 2 mg', classe: 'I' },
      { droga: 'Sumatriptano', dose: '50–100 mg VO, 20 mg IN; repetir em caso de recorrência; máximo/dia 200 mg', classe: 'I' },
      { droga: 'Naratriptano', dose: '2,5 mg VO, repetir s/n; máximo/dia 5 mg', classe: 'I' },
      { droga: 'Zolmitriptano', dose: '2,5–5 mg VO, repetir s/n; máximo/dia 7,5 mg', classe: 'I' },
      { droga: 'Rizatriptano', dose: '5–10 mg VO, 10 mg disco dispersível sobre a língua, s/n; máximo/dia 20 mg', classe: 'I' },
      { droga: 'Triptanos com recorrência frequente', dose: 'associar ácido tolfenâmico 200 mg ou naproxeno sódico 550 mg VO', classe: 'II' },
    ],
  },
  {
    id: 'forte', titulo: 'Crise forte', pagina: 'Tabela 3, p. 378',
    nota: 'Associar metoclopramida parenteral na vigência de vômito (o consenso não traz a dose parenteral).',
    linhas: [
      { droga: 'Dipirona', dose: '1000 mg IV diluída em SF 0,9%; máximo/dia 2 g', classe: 'III' },
      { droga: 'Clonixinato de lisina', dose: '200 mg IV diluído em 20 mL de SF 0,9%; máximo/dia 500 mg', classe: 'III' },
      { droga: 'Sumatriptano', dose: '6 mg SC ou 20 mg IN, ou 50–100 mg VO', classe: 'I' },
      { droga: 'Rizatriptano', dose: '5–10 mg VO, 10 mg disco dispersível sobre a língua', classe: 'I' },
      { droga: 'Zolmitriptano', dose: '2,5–5 mg VO', classe: 'I' },
      { droga: 'Indometacina', dose: '100 mg via retal, repetir em 1 h s/n; máximo/dia 200 mg', classe: 'II' },
      { droga: 'Clorpromazina', dose: '0,1–0,7 mg/kg IM ou IV diluído em SF 0,9%; repetir até 3 vezes nas 24 h', classe: 'I' },
      { droga: 'Dexametasona', dose: '4 mg IV, repetir em 12–24 h s/n', classe: 'II' },
      { droga: 'Haloperidol', dose: '5 mg IM ou IV diluído em SF 0,9%', classe: 'II' },
      { droga: 'Triptanos com recorrência frequente', dose: 'associar ácido tolfenâmico 200 mg VO ou naproxeno sódico 550 mg VO', classe: 'II' },
    ],
  },
]

/** Clorpromazina 0,1–0,7 mg/kg (Tabela 3, p. 378): faixa em mg pelo peso. */
export function clorpromazinaMg(pesoKg: number): [number, number] | null {
  if (!Number.isFinite(pesoKg) || pesoKg <= 0) return null
  return [Math.round(0.1 * pesoKg * 10) / 10, Math.round(0.7 * pesoKg * 10) / 10]
}

/** Migrânea na unidade de emergência (p. 376): esquemas 1 a 4. */
export const ESQUEMA_REFRATARIA: string[] = [
  'Esquemas 1 a 3: crise fraca, moderada e forte pelas Tabelas 1 a 3; sem melhora em 1 hora, passar ao esquema seguinte.',
  'Esquema 4 (refratária ou estado migranoso): internar, investigar cefaleia secundária, hidratar e repor eletrólitos.',
  'Dexametasona, 10 mg IV (classe II).',
  'Se a dor persistir: dexametasona 4 mg de 6/6 horas (até 48 horas) (classe II), associada a clorpromazina, 0,1 mg/kg IV, em 3 minutos, mantendo infusão de SF 0,9% (classe I) e repetindo a cada 4 horas, se necessário.',
  'O consenso cita a meperidina como último recurso (classe III); a AHS 2025 recomenda não oferecer opioide (hidromorfona) na crise.',
]

/** AHS 2025 — níveis de recomendação para a crise no PS, pelo resumo (sem dose). */
export const AHS_2025_NIVEIS: { nivel: string; drogas: string[] }[] = [
  { nivel: 'A — deve oferecer', drogas: ['proclorperazina IV', 'bloqueio do nervo occipital maior'] },
  { nivel: 'B — deveria oferecer', drogas: ['dexcetoprofeno IV', 'cetorolaco IV', 'metoclopramida IV', 'sumatriptano SC', 'bloqueio do nervo supraorbital'] },
  { nivel: 'C — pode oferecer', drogas: ['clorpromazina IV', 'dexametasona IV', 'valproato IV'] },
  { nivel: 'C — não deveria oferecer', drogas: ['paracetamol IV'] },
  { nivel: 'A — não deve oferecer', drogas: ['hidromorfona IV'] },
]
