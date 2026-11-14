import type { Ficha, Fonte } from '../ficha.ts'
import { completo, escolha, marcadas, type Escore } from '../escore.ts'
import { fichaAdulto } from './fonte.ts'

// Anemia falciforme — cap. 80 do Manual de Medicina de Emergência do HCFMUSP
// (3ª ed., 2022), p. 1051–1061. Hidratação e analgesia da crise álgica (com a
// Tabela 5), quetamina, síndrome torácica aguda (Tabela 3) e metas. O livro
// não dá dose pediátrica neste capítulo; nada é convertido para criança.

const CAP = 'cap. 80 Anemia falciforme'

// Revisão PubMed, itens médios (decisão do RT de 06/11/2026, H6 = A): o ECR
// TASC entra como novidade no bloco da síndrome torácica aguda, sem mudar a
// conduta do livro e sem dose de anticoagulante.
export const TASC_2025: Fonte = {
  citacao: 'Mekontso Dessap A, Habibi A, Arlet JB, et al. Comparison of Prophylactic and Therapeutic Doses of Anticoagulation for Acute Chest Syndrome in Sickle Cell Disease: The TASC Double-Blind Controlled Randomized Clinical Trial. Am J Respir Crit Care Med. 2025;211(5):832–841 (PMID 40209087).',
  url: 'https://doi.org/10.1164/rccm.202409-1727OC',
}

export const NOTA_TASC_STA =
  'TASC (2025, posterior ao livro): ECR duplo-cego, 172 adultos com STA sem trombose na angio-TC, tinzaparina em dose terapêutica × profilática por 7 dias. A dose terapêutica encurtou a STA (HR 0,71; média 4,8 × 6,1 dias) e reduziu o opioide parenteral, sem sangramento maior. É um ECR único: a ferramenta não muda a conduta do livro e não traz dose de anticoagulante.'

// Lote 5 da revisão do HCFMUSP, P2 (decisão do RT de 14/11/2026), cap. 80: a
// diretriz francesa de 2025 (SRLF, GFRUP e SFMU) de urgência e doença crítica na
// falciforme foi lida no texto integral do PMC. Entra só a parte do adulto. A
// força vem da redação da diretriz: "provavelmente" é GRADE 2; "os especialistas
// sugerem" é opinião de especialistas. As doses e contas do manual não mudam.
export const SRLF_FALCIFORME_2025: Fonte = {
  citacao: 'Société de Réanimation de Langue Française (SRLF), Groupe Francophone de Réanimation et d\'Urgences Pédiatriques (GFRUP) e Société Française de Médecine d\'Urgence (SFMU). Guidelines for the management of emergencies and critical illness in pediatric and adult patients with sickle cell disease. Ann Intensive Care. 2025;15:74 (PMID 40439782; PMC12123041). Texto integral lido; GRADE e opinião de especialistas.',
  url: 'https://doi.org/10.1186/s13613-025-01479-3',
}

const SEM_ITEM_FALC = 'sem item do manual na ferramenta'

/** SRLF/SFMU 2025 × manual, na falciforme do adulto; um tema por linha. */
export const DIRETRIZ_FALCIFORME: { tema: string; diretriz: string; grau: string; fonte: string; livro: string }[] = [
  { tema: 'Onde tratar', diretriz: 'Considerar UTI no adulto que precisa de exsanguineotransfusão ou tem risco de evolução ruim: taquipneia, lesão renal aguda ou hipotensão. Em qualquer complicação aguda grave, discutir com um centro de referência em doença falciforme', grau: 'fraca a favor ("provavelmente")', fonte: 'SRLF/SFMU 2025', livro: SEM_ITEM_FALC },
  { tema: 'Analgesia', diretriz: 'Começar logo um protocolo de analgesia escalonado na crise dolorosa do adulto, ajustado à resposta de cada paciente', grau: 'opinião de especialistas', fonte: 'SRLF/SFMU 2025', livro: 'dor grave: morfina 0,15 mg/kg EV e 0,05 mg/kg a cada 20 min; porta-opioide ≤ 30 min (cap. 80, p. 1056–1058)' },
  { tema: 'Alvo de saturação', diretriz: 'SatO2 de 95% durante a crise vaso-oclusiva', grau: 'opinião de especialistas', fonte: 'SRLF/SFMU 2025', livro: 'na crise álgica, O2 se SatO2 < 90% ou PaO2 < 60 mmHg; na síndrome torácica aguda, SatO2 ≥ 95% (p. 1056 e 1058)' },
  { tema: 'Espirometria de incentivo', diretriz: 'Usar na crise vaso-oclusiva para prevenir a síndrome torácica aguda, sobretudo com dor torácica ou dorsal', grau: 'fraca a favor ("provavelmente")', fonte: 'SRLF/SFMU 2025', livro: SEM_ITEM_FALC },
  { tema: 'Hidratação', diretriz: 'Não fazer hiper-hidratação sistemática na crise vaso-oclusiva: não mostrou benefício e tem risco. Ajustar o volume, oral ou EV, à clínica, às outras entradas (como transfusão) e à necessidade diária', grau: 'fraca contra ("provavelmente não"); opinião de especialistas', fonte: 'SRLF/SFMU 2025', livro: '50 mL/kg em 24 h, SF 0,9% + SG 5% (SF se hipovolêmico) (p. 1056)' },
  { tema: 'Diagnóstico da síndrome torácica aguda', diretriz: 'Ultrassom pulmonar para melhorar o diagnóstico no adulto com sinais sugestivos', grau: 'fraca a favor ("provavelmente")', fonte: 'SRLF/SFMU 2025', livro: SEM_ITEM_FALC },
  { tema: 'Trombose de artéria pulmonar', diretriz: 'Na síndrome torácica aguda do adulto, angiotomografia conforme a probabilidade clínica, para procurar trombose de artéria pulmonar', grau: 'opinião de especialistas', fonte: 'SRLF/SFMU 2025', livro: SEM_ITEM_FALC },
  { tema: 'Corticoide', diretriz: 'Não usar corticoide sistêmico de rotina na síndrome torácica aguda', grau: 'fraca contra ("provavelmente não")', fonte: 'SRLF/SFMU 2025', livro: SEM_ITEM_FALC },
  { tema: 'VNI', diretriz: 'Não usar VNI de rotina na síndrome torácica aguda do adulto', grau: 'fraca contra ("provavelmente não")', fonte: 'SRLF/SFMU 2025', livro: SEM_ITEM_FALC },
  { tema: 'Anticoagulação', diretriz: 'Dose terapêutica sem trombose documentada: os dados não permitem recomendar. Profilaxia de TEV indicada no doente clínico agudo, inclusive com síndrome torácica aguda', grau: 'sem recomendação; boa prática', fonte: 'SRLF/SFMU 2025', livro: SEM_ITEM_FALC },
  { tema: 'Antibiótico na síndrome torácica aguda', diretriz: 'Na forma grave do adulto, antibiótico empírico contra bactérias intracelulares junto com um contra piogênicos', grau: 'opinião de especialistas', fonte: 'SRLF/SFMU 2025', livro: 'ceftriaxona 2 g EV 1×/dia + claritromicina 500 mg EV 12/12 h ou azitromicina 500 mg EV 1×/dia (p. 1057)' },
  { tema: 'Betalactâmico na infecção grave', diretriz: 'Sem insuficiência renal, dose de ataque e depois infusão contínua, ou mais doses por dia, para melhorar a farmacocinética', grau: 'fraca a favor ("provavelmente")', fonte: 'SRLF/SFMU 2025', livro: SEM_ITEM_FALC },
  { tema: 'Transfusão na crise vaso-oclusiva', diretriz: 'Não transfundir de rotina na crise vaso-oclusiva sem complicação', grau: 'opinião de especialistas', fonte: 'SRLF/SFMU 2025', livro: 'não há indicação de transfusão para a crise álgica (p. 1056)' },
  { tema: 'Transfusão na síndrome torácica aguda', diretriz: 'Transfundir o adulto com critério de gravidade: hipoxemia (precisa de O2 para manter SatO2 de 95%), hipertensão pulmonar grave (velocidade de regurgitação tricúspide > 3 m/s ou cor pulmonale agudo) ou qualquer falência orgânica', grau: 'opinião de especialistas', fonte: 'SRLF/SFMU 2025', livro: 'STA leve: transfusão com alvo de Hb ≥ 10 g/dL; moderada a grave: eritrocitoaférese com HbS < 30% e Hb ≥ 10 g/dL (p. 1058)' },
  { tema: 'Tipo de transfusão', diretriz: 'Transfusão simples se a anemia é grave (Hb total < 7 g/dL); nos demais casos, exsanguineotransfusão imediata, de preferência automatizada se houver tempo', grau: 'opinião de especialistas', fonte: 'SRLF/SFMU 2025', livro: 'eritrocitoaférese na STA moderada a grave (p. 1058)' },
]

export const DIFERENCAS_FALCIFORME: string[] = [
  'Hidratação: a diretriz francesa é contra a hiper-hidratação sistemática e ajusta o volume à clínica; o manual dá 50 mL/kg em 24 h.',
  'Alvo de saturação na crise vaso-oclusiva: 95% na diretriz; o manual dá O2 só abaixo de 90%.',
  'Transfusão na síndrome torácica aguda: a diretriz decide pela gravidade (hipoxemia, hipertensão pulmonar, falência orgânica) e prefere exsanguineotransfusão, salvo Hb < 7 g/dL; o manual transfunde a forma leve com alvo de Hb ≥ 10 g/dL.',
  'Espirometria de incentivo, ultrassom pulmonar, corticoide e VNI: a diretriz trata; a ferramenta do manual não traz.',
]

const fichaFalciformeLivro = fichaAdulto('adulto-falciforme', 'Anemia falciforme — crise álgica e síndrome torácica aguda (adulto)', `${CAP}, p. 1055–1061 (Tabela 5)`)
export const fichaFalciformeAdulto: Ficha = {
  ...fichaFalciformeLivro,
  versao: '2026-11-14.1',
  fontes: [...fichaFalciformeLivro.fontes, TASC_2025, SRLF_FALCIFORME_2025],
  revisadoEm: '14/11/2026 (diretriz SRLF/GFRUP/SFMU 2025 lida no texto integral, ao lado do manual; lote 5 da revisão do HCFMUSP; aguarda aprovação do RT); 06/11/2026 (nota do TASC na síndrome torácica aguda; revisão PubMed, itens médios)',
}

export type Faixa = [number, number]
const valido = (x: number) => Number.isFinite(x) && x > 0

/** Hidratação na crise álgica: 50 mL/kg em 24 h, SF 0,9% + SG 5% (SF se hipovolêmico) (p. 1056). */
export const HIDRATACAO_FALCIFORME = { mlKg24h: 50, pagina: 'p. 1056' }

export function hidratacaoFalciforme(pesoKg: number): { ml24h: number; mlH: number } | null {
  if (!valido(pesoKg)) return null
  const ml24h = HIDRATACAO_FALCIFORME.mlKg24h * pesoKg
  return { ml24h, mlH: ml24h / 24 }
}

/** Dor grave (8-10): morfina 0,15 mg/kg EV, repetida a cada 20 min com 0,05 mg/kg (Tabela 5, p. 1058). */
export const MORFINA_FALCIFORME = { ataqueMgKg: 0.15, repeticaoMgKg: 0.05, intervaloMin: 20, pagina: 'p. 1058' }

export function morfinaFalciforme(pesoKg: number): { ataqueMg: number; repeticaoMg: number } | null {
  if (!valido(pesoKg)) return null
  return { ataqueMg: MORFINA_FALCIFORME.ataqueMgKg * pesoKg, repeticaoMg: MORFINA_FALCIFORME.repeticaoMgKg * pesoKg }
}

export const ANALGESIA_POR_INTENSIDADE = [
  { faixa: 'Dor leve: 1-4', texto: 'Opioides ou não opioides: codeína 30 mg VO 6/6 h; tramadol 50-100 mg VO 6/6 h; AINE e analgésicos comuns se sem contraindicação', pagina: 'p. 1057' },
  { faixa: 'Dor moderada: 5-7', texto: 'Via endovenosa: tramadol 50-100 mg EV 6/6 h e analgésicos comuns (dipirona EV); sem resposta, opioides de maior potência', pagina: 'p. 1057' },
  { faixa: 'Dor grave: 8-10', texto: 'Opioides de alta potência imediatamente: morfina 0,15 mg/kg EV e 0,05 mg/kg a cada 20 min até controle; porta-opioide ≤ 30 min', pagina: 'p. 1056–1058' },
]

/**
 * Quetamina na dor refratária (p. 1056): 0,25 mg/kg intranasal; 3-5 µg/kg/min EV
 * (o livro escreve "0,1 a 0,3 mg/kg/hora"); bolus 0,3-1 mg/kg EV; máximo 1 mg/kg/h.
 */
export const QUETAMINA_FALCIFORME = { inMgKg: 0.25, infusaoUgKgMin: [3, 5] as Faixa, infusaoLivroMgKgH: [0.1, 0.3] as Faixa, bolusMgKg: [0.3, 1] as Faixa, maxMgKgH: 1, pagina: 'p. 1056' }

export const NOTA_QUETAMINA_FALCIFORME =
  'p. 1056 — 3-5 µg/kg/min equivalem a 0,18-0,3 mg/kg/h, e não 0,1-0,3 mg/kg/h como está entre parênteses. A ferramenta mostra as duas faixas; 0,1 mg/kg/h corresponde a cerca de 1,7 µg/kg/min.'

export type ContaQuetamina = { inMg: number; infusaoMgH: Faixa; infusaoLivroMgH: Faixa; bolusMg: Faixa; maxMgH: number }

export function quetaminaFalciforme(pesoKg: number): ContaQuetamina | null {
  if (!valido(pesoKg)) return null
  const q = QUETAMINA_FALCIFORME
  return {
    inMg: q.inMgKg * pesoKg,
    infusaoMgH: [(q.infusaoUgKgMin[0] * 60 * pesoKg) / 1000, (q.infusaoUgKgMin[1] * 60 * pesoKg) / 1000],
    infusaoLivroMgH: [q.infusaoLivroMgKgH[0] * pesoKg, q.infusaoLivroMgKgH[1] * pesoKg],
    bolusMg: [q.bolusMgKg[0] * pesoKg, q.bolusMgKg[1] * pesoKg],
    maxMgH: q.maxMgKgH * pesoKg,
  }
}

export const STA_ANTIBIOTICOS = [
  { texto: 'Ceftriaxone 2 g EV 1 x/dia + claritromicina 500 mg EV 12/12 h ou azitromicina 500 mg EV 1 x/dia', pagina: 'p. 1057' },
  { texto: 'Na crise hemolítica a cefotaxima pode ser superior ao ceftriaxone (risco de hemólise com o último)', pagina: 'p. 1057' },
  { texto: 'Alternativa: quinolonas respiratórias (levofloxacina ou moxifloxacina); o livro não traz dose', pagina: 'p. 1058' },
]

export const METAS_FALCIFORME = [
  { texto: 'Crise álgica: O2 se SatO2 < 90% ou PaO2 < 60 mmHg; não há indicação de transfusão para a crise álgica', pagina: 'p. 1056' },
  { texto: 'STA: O2 para SatO2 ≥ 95%; broncodilatador 4/4 ou 6/6 h', pagina: 'p. 1058' },
  { texto: 'STA leve: transfusão com alvo de Hb ≥ 10 g/dL', pagina: 'p. 1058' },
  { texto: 'STA moderada a grave (mais de um lobo, O2 ≥ 4 L/min, piora): eritrocitoaférese com alvo HbS < 30% e Hb ≥ 10 g/dL', pagina: 'p. 1058' },
  { texto: 'AVC isquêmico: HbS < 30% e Hb > 8 e < 10 g/dL; AAS 100-300 mg 1 x/dia', pagina: 'p. 1059' },
  { texto: 'Sequestro esplênico (queda de Hb ≥ 2 g/dL): concentrado de hemácias com dose 50% menor que a habitual (o livro não traz a dose habitual)', pagina: 'p. 1055, 1059' },
  { texto: 'Priapismo: < 4 h aspiração + salina + alfa-adrenérgico; > 4 h urologia; > 12 h eritrocitoaférese', pagina: 'p. 1059–1060' },
  { texto: 'Alta: leucócitos > 5.000 e < 30.000/mm³; Hb > 5 g/dL; sem infiltrado, sem sepse, estável', pagina: 'p. 1061' },
]

// Síndrome torácica aguda (Tabela 3, p. 1053)

export const criteriosSta: Escore = {
  ficha: fichaAdulto('adulto-sindrome-toracica-aguda', 'Síndrome torácica aguda — critérios diagnósticos (adulto)', `${CAP}, p. 1052–1053 (Tabela 3)`),
  descricao: 'Infiltrado novo na radiografia e pelo menos 1 dos 7 critérios da Tabela 3 do manual do HC.',
  itens: [
    { tipo: 'escolha', id: 'infiltrado', rotulo: 'Infiltrado novo na radiografia', opcoes: [{ rotulo: 'Não', valor: 0 }, { rotulo: 'Sim', valor: 1 }] },
    { tipo: 'marca', id: 'dor', rotulo: 'Dor torácica', pontos: 1 },
    { tipo: 'marca', id: 'febre', rotulo: 'Temperatura > 38,5 °C', pontos: 1 },
    { tipo: 'marca', id: 'taquipneia', rotulo: 'Taquipneia', pontos: 1 },
    { tipo: 'marca', id: 'tosse', rotulo: 'Tosse', pontos: 1 },
    { tipo: 'marca', id: 'sibilancia', rotulo: 'Sibilância', pontos: 1 },
    { tipo: 'marca', id: 'sat', rotulo: 'Diminuição de 2% ou mais na SatO2 em relação ao basal', pontos: 1 },
    { tipo: 'marca', id: 'pao2', rotulo: 'PaO2 < 60 mmHg', pontos: 1 },
  ],
  calcular(r) {
    if (!completo(criteriosSta, r)) return null
    const infiltrado = escolha(criteriosSta, r, 'infiltrado')!.valor === 1
    const criterios = marcadas(criteriosSta, r)
    const preenche = infiltrado && criterios.length >= 1
    return {
      rotulo: 'Síndrome torácica aguda',
      valor: preenche ? 'preenche' : 'não preenche',
      nota: infiltrado ? `${criterios.length} critério(s) além do infiltrado` : 'Sem infiltrado novo: a Tabela 3 não se aplica',
      estado: preenche ? 2 : 0,
      derivados: criterios.length ? [['Critérios marcados', criterios.join('; ')]] : [],
      cuidados: [
        'Mortalidade maior em adultos jovens que em crianças (p. 1053).',
        'Sem referência pediátrica declarada.',
      ],
    }
  },
}
