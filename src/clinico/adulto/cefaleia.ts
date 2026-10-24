import type { Ficha, Fonte } from '../ficha.ts'
import { fichaAdulto, pagina } from './fonte.ts'

// Cefaleia aguda no adulto (lacunas da Central, lote 2, 24/10/2026). Manual de
// Medicina de Emergência do HCFMUSP (3ª ed., 2022), cap. 41 Cefaleia (p. 564–576),
// lido no PDF (página do livro = página do PDF + 1), e a lista SNNOOP10 de Do et al.
// (Neurology 2019), conferida no resumo. O capítulo dá dose só de dexametasona,
// difenidramina, oxigênio e sumatriptano SC; para as demais drogas traz o nome e
// a via, e a tela não inventa dose. A ACEP 2019 ficou de fora: o resumo traz só
// as perguntas, não as respostas. A conduta é do médico (ADR 0007).

export const SNNOOP10: Fonte = {
  citacao: 'Do TP, Remmers A, Schytz HW, et al. Red and orange flags for secondary headaches in clinical practice: SNNOOP10 list. Neurology. 2019;92(3):134–144 (PMID 30587518): os 15 sinais; faltam estudos prospectivos de validação.',
  url: 'https://doi.org/10.1212/WNL.0000000000006697',
}

const PAG_CEFALEIA = 'cap. 41 Cefaleia, p. 564–576 (Tabela 2, p. 566–568)'

export const fichaCefaleiaAdulto: Ficha = {
  ...fichaAdulto('adulto-cefaleia', 'Cefaleia aguda — sinais de alarme e tratamento (adulto)', PAG_CEFALEIA),
  versao: '2026-10-24.1',
  fontes: [pagina(PAG_CEFALEIA), SNNOOP10],
  revisadoEm: '24/10/2026 (lacunas da Central, lote 2; texto conferido no manual, com página; SNNOOP10 pelo resumo)',
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
      { droga: 'Analgésico comum ou AINE', texto: 'dipirona, paracetamol; cetoprofeno, ibuprofeno, nimesulida (o capítulo não traz dose)', pagina: 'p. 572' },
      { droga: 'Seguimento', texto: 'avaliar risco de cronificação e abuso de analgésico; profilaxia ambulatorial quando indicada', pagina: 'p. 572' },
    ],
  },
  migranea: {
    titulo: 'Migrânea',
    itens: [
      { droga: 'Triptano', texto: 'primeira escolha na migrânea sem aura, melhor no começo da crise; intranasal ou SC se já há náusea ou vômito. Contraindicado em arteriopatas (coronariopatia, AVCi prévio); evitar na migrânea com aura, em especial o sumatriptano SC na fase de aura (o capítulo não traz dose)', pagina: 'p. 573' },
      { droga: 'AINE e analgésico comum', texto: 'naproxeno, ibuprofeno, cetoprofeno, nimesulida; dipirona, paracetamol (o capítulo não traz dose)', pagina: 'p. 573' },
      { droga: 'Clorpromazina ou metoclopramida', texto: 'adjuvantes com efeito próprio sobre a dor. Clorpromazina parenteral com monitorização cardíaca; metoclopramida parenteral no paciente com náusea, diluída e lenta (o capítulo não traz dose)', pagina: 'p. 573' },
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
