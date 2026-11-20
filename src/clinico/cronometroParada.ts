import type { Ficha, Fonte } from './ficha.ts'
import { AHA_ALS_2025, AHA_2025_PCR, CHOQUE_PCR, ILCOR_COSTR_2026 } from './adulto/pcr.ts'
import { pagina } from './adulto/fonte.ts'
import { AHA_AAP_2025 } from './pediatria/rcp.ts'
import { AHA_CIRCUNSTANCIAS_2025, COREIA_PALS_2025, choquesDoPeso, dosesDoPeso, numeroDaDose } from './pediatria/dosesDaFita.ts'
import { AMPOLAS, BULA_AMIODARONA, BULA_LIDOCAINA, type Apresentacao } from './pediatria/ampolas.ts'
import { AMPOLAS_PCR_ADULTO } from './adulto/ampolasAdulto.ts'

// Cronômetro da parada (G3; construído com o RT em 18/11/2026 no protótipo
// https://claude.ai/artifact/3j35VFgsN7yNmKwuiz2f7m). Criança e adulto.
//
// Fluxo do RT: botão "Iniciar parada" → tempo total em segundo plano e ciclo de
// 2 min em destaque → os 4 ritmos na tela → tocar no ritmo abre a conduta, com
// UMA ação "agora" e a lista "próximos" com contagem (próximo choque, próxima
// epinefrina). "Uma calculadora que até uma criança saiba usar."
//
// Só na tela: nada vai ao banco nem ao prontuário; o registro com a hora de cada
// medicação e intervenção é copiado pelo médico. Doses: criança pelo módulo
// ped-doses-fita (peso digitado); adulto pela ferramenta PCR do adulto (manual do
// HCFMUSP, p. 48–49, e AHA 2025, Part 9). Este arquivo só tem a lógica de tempo
// e de ordem; a tela fica em src/components/plantonista/central/CronometroParada.tsx.

const pmc = (id: string) => `https://pmc.ncbi.nlm.nih.gov/articles/${id}/`

// Causas reversíveis com "identificar" e "tratar" (versão .2, pedido do RT; CR1–CR4 = A)
export const COREIA_ALS_2025: Fonte = {
  citacao: 'Korean Guidelines for Cardiopulmonary Resuscitation 2025: Part 4. Adult advanced life support. Clin Exp Emerg Med. 2026 (PMC13277415).',
  url: pmc('PMC13277415'),
}
export const COREIA_CIRCUNSTANCIAS_2025: Fonte = {
  citacao: 'Korean Guidelines for Cardiopulmonary Resuscitation 2025: Part 5. Special circumstances. Clin Exp Emerg Med. 2026 (PMC13277411).',
  url: pmc('PMC13277411'),
}
export const COREIA_POS_PCR_2025: Fonte = {
  citacao: 'Korean Guidelines for Cardiopulmonary Resuscitation 2025: Part 6. Post-cardiac arrest care. Clin Exp Emerg Med. 2026 (PMC13285305).',
  url: pmc('PMC13285305'),
}

// Versão .3 (RT em 19/11/2026, CL1–CL4 = A): lacunas das causas reversíveis pelo PubMed
export const ERC_CIRCUNSTANCIAS_2021: Fonte = {
  citacao: 'Lott C, et al. Kreislaufstillstand unter besonderen Umständen (ERC Leitlinien 2021, tradução alemã de "Cardiac arrest in special circumstances"). Notf Rett Med. 2021;24(4):447–523 (PMID 34127910, PMC8190767).',
  url: pmc('PMC8190767'),
}
export const ERC_PEDIATRIA_2021: Fonte = {
  citacao: 'Van de Voorde P, et al. Lebensrettende Maßnahmen bei Kindern (ERC Leitlinien 2021, tradução alemã de "Paediatric Life Support"). Notf Rett Med. 2021;24(4):650–719 (PMID 34093080, PMC8170638).',
  url: pmc('PMC8170638'),
  pediatrica: true,
}
export const ESPNIC_POCUS_2020: Fonte = {
  citacao: 'Singh Y, et al. International evidence-based guidelines on Point of Care Ultrasound (POCUS) for critically ill neonates and children issued by the POCUS Working Group of the ESPNIC. Crit Care. 2020;24:65 (PMID 32093763, PMC7041196).',
  url: pmc('PMC7041196'),
  pediatrica: true,
}
export const PEREZ_CASARES_2017: Fonte = {
  citacao: 'Pérez-Casares A, et al. Echocardiographic Evaluation of Pericardial Effusion and Cardiac Tamponade. Front Pediatr. 2017;5:79 (PMID 28484689, PMC5401877). Revisão pediátrica.',
  url: pmc('PMC5401877'),
  pediatrica: true,
}
export const ZIA_TEP_PEDIATRICO_2025: Fonte = {
  citacao: 'Zia A, Goldenberg NA, Rajpurkar M. How I treat pediatric pulmonary embolism. Blood. 2025;146(14):1643–1653 (PMID 40643104, PMC13122310). Tabela 2: protocolo de um hospital (revisão, não diretriz).',
  url: pmc('PMC13122310'),
  pediatrica: true,
}
export const LEE_LIPIDIO_PEDIATRICO_2024: Fonte = {
  citacao: 'Lee SH, Kim S, Sohn JT. Lipid emulsion treatment for local anesthetic systemic toxicity in pediatric patients: a systematic review. Medicine. 2024;103(11):e37534 (PMID 38489714, PMC10939516). Revisão sistemática de relatos de caso.',
  url: pmc('PMC10939516'),
  pediatrica: true,
}
export const BROGAN_KAWASAKI_2020: Fonte = {
  citacao: 'Brogan P, et al. Lifetime cardiovascular management of patients with previous Kawasaki disease. Heart. 2020;106(6):411–420 (PMID 31843876, PMC7057818). Consenso britânico.',
  url: pmc('PMC7057818'),
  pediatrica: true,
}
export const ANTO_POCUS_2026: Fonte = {
  citacao: 'Anto AM, et al. Point-of-care-ultrasound in cardiac arrest: a useful tool for resuscitation. Front Med. 2026;13:1795346 (PMID 41939769, PMC13047127). Revisão.',
  url: pmc('PMC13047127'),
}
export const VAN_DEN_BEMPT_AESP_2021: Fonte = {
  citacao: 'Van den Bempt S, et al. Pulseless Electrical Activity: Detection of Underlying Causes in a Prehospital Setting. Med Princ Pract. 2021;30(3):212–222 (PMID 33254164, PMC8280430). Revisão.',
  url: pmc('PMC8280430'),
}

export const fichaCronometroParada: Ficha = {
  id: 'cronometro-parada',
  titulo: 'Cronômetro da parada — ritmo, choque, epinefrina e registro (criança e adulto)',
  versao: '2026-11-20.1',
  publico: 'ambos',
  fontes: [AHA_AAP_2025, COREIA_PALS_2025, AHA_ALS_2025, AHA_CIRCUNSTANCIAS_2025, COREIA_ALS_2025, COREIA_CIRCUNSTANCIAS_2025, COREIA_POS_PCR_2025, ILCOR_COSTR_2026, ERC_CIRCUNSTANCIAS_2021, ERC_PEDIATRIA_2021, ESPNIC_POCUS_2020, PEREZ_CASARES_2017, ZIA_TEP_PEDIATRICO_2025,
    LEE_LIPIDIO_PEDIATRICO_2024, BROGAN_KAWASAKI_2020, ANTO_POCUS_2026, VAN_DEN_BEMPT_AESP_2021, pagina('cap. 2 PCR no adulto, p. 48–50 (Tabela 2)'),
    BULA_AMIODARONA, BULA_LIDOCAINA],
  revisadoEm: '20/11/2026 (mL das drogas da parada pela ampola das fichas ped-ampolas e adulto-ampolas, só quando o princípio tem uma concentração; pedido do RT: "mostrar ml auxilia e perde menos tempo"; aguarda aprovação do RT); 19/11/2026 (lacunas das causas reversíveis pelo PubMed, CL1–CL4 = A); 18/11/2026 (versão .2: causas reversíveis com identificar e tratar, CR1–CR4 = A; fluxo construído com o RT no protótipo; tempos e ordem pela AHA 2025 e pelo manual do HCFMUSP; aguarda aprovação do RT)',
}

export type PublicoParada = 'crianca' | 'adulto'
export type RitmoParada = 'tv' | 'fv' | 'aesp' | 'assistolia'

export const RITMOS_PARADA: { id: RitmoParada; nome: string; curto: string; chocavel: boolean }[] = [
  { id: 'tv', nome: 'Taquicardia ventricular sem pulso', curto: 'TV sem pulso', chocavel: true },
  { id: 'fv', nome: 'Fibrilação ventricular', curto: 'FV', chocavel: true },
  { id: 'aesp', nome: 'Atividade elétrica sem pulso', curto: 'AESP', chocavel: false },
  { id: 'assistolia', nome: 'Assistolia', curto: 'Assistolia', chocavel: false },
]
export const ritmoDaParada = (id: RitmoParada) => RITMOS_PARADA.find((r) => r.id === id)!

/** Checar o ritmo a cada 2 min; epinefrina a cada 3 a 5 min. */
export const CICLO_MS = 2 * 60_000
export const EPI_MIN_MS = 3 * 60_000
export const EPI_MAX_MS = 5 * 60_000
/** Ritmo chocável: epinefrina depois do 2º choque; antiarrítmico depois do 3º. */
export const CHOQUES_ANTES_DA_EPINEFRINA = 2
export const CHOQUES_ANTES_DO_ANTIARRITMICO = 3
/** Metrônomo das compressões: 110/min, dentro de 100 a 120/min. */
export const COMPRESSOES_POR_MIN = 110

export type TipoEvento =
  | 'inicio' | 'ritmo' | 'choque' | 'epinefrina' | 'amiodarona' | 'lidocaina'
  | 'acesso' | 'via-aerea' | 'fim-ciclo' | 'rce' | 'nova-parada' | 'som' | 'fim'

export type EventoParada = { tipo: TipoEvento; em: number; texto: string; ritmo?: RitmoParada }

export type EstadoParada = { publico: PublicoParada; pesoKg: number | null; eventos: EventoParada[] }

export type Situacao = {
  inicio: number | null
  choques: number
  epinefrinas: number
  antiarritmicos: number
  ultimaEpinefrina: number | null
  ritmo: RitmoParada | null
  ciclo: number
  inicioDoCiclo: number | null
  choqueNesteCiclo: boolean
  rce: boolean
  encerrada: boolean
}

/** Tudo o que a tela precisa sai dos eventos (o registro é a fonte da verdade). */
export function situacaoDaParada(e: EstadoParada): Situacao {
  const s: Situacao = {
    inicio: null, choques: 0, epinefrinas: 0, antiarritmicos: 0, ultimaEpinefrina: null, ritmo: null,
    ciclo: 0, inicioDoCiclo: null, choqueNesteCiclo: false, rce: false, encerrada: false,
  }
  for (const ev of e.eventos) {
    switch (ev.tipo) {
      case 'inicio': s.inicio = ev.em; s.ciclo = 1; s.inicioDoCiclo = ev.em; break
      case 'ritmo':
        // a 1ª escolha de ritmo fica no ciclo 1; cada checagem seguinte abre um ciclo novo
        if (s.ritmo !== null) { s.ciclo++; s.inicioDoCiclo = ev.em }
        s.ritmo = ev.ritmo ?? null; s.choqueNesteCiclo = false; break
      case 'choque': s.choques++; s.choqueNesteCiclo = true; s.inicioDoCiclo = ev.em; break
      case 'epinefrina': s.epinefrinas++; s.ultimaEpinefrina = ev.em; break
      case 'amiodarona': case 'lidocaina': s.antiarritmicos++; break
      case 'rce': s.rce = true; break
      case 'nova-parada': s.rce = false; s.ciclo++; s.inicioDoCiclo = ev.em; s.ritmo = null; s.choqueNesteCiclo = false; break
      case 'fim': s.encerrada = true; break
    }
  }
  return s
}

export const restaDoCiclo = (s: Situacao, agora: number) => (s.inicioDoCiclo === null ? null : CICLO_MS - (agora - s.inicioDoCiclo))
export const desdeAEpinefrina = (s: Situacao, agora: number) => (s.ultimaEpinefrina === null ? null : agora - s.ultimaEpinefrina)

/** A epinefrina já pode? Não chocável: logo; chocável: depois do 2º choque; depois, a cada 3 min ou mais. */
export function epinefrinaDevida(s: Situacao, agora: number): boolean {
  if (!s.ritmo) return false
  if (s.epinefrinas === 0) return !ritmoDaParada(s.ritmo).chocavel || s.choques >= CHOQUES_ANTES_DA_EPINEFRINA
  return (desdeAEpinefrina(s, agora) ?? 0) >= EPI_MIN_MS
}

export type AcaoAgora = 'escolher-ritmo' | 'choque' | 'epinefrina' | 'compressoes' | 'rce' | 'encerrada'

/** Uma ação só, a mais urgente: choque (chocável sem choque no ciclo) > epinefrina devida > compressões. */
export function acaoAgora(s: Situacao, agora: number): AcaoAgora {
  if (s.encerrada) return 'encerrada'
  if (s.rce) return 'rce'
  if (!s.ritmo) return 'escolher-ritmo'
  if (ritmoDaParada(s.ritmo).chocavel && !s.choqueNesteCiclo) return 'choque'
  if (epinefrinaDevida(s, agora)) return 'epinefrina'
  return 'compressoes'
}

/** Antiarrítmico já pode (ritmo chocável depois do 3º choque)? */
export const antiarritmicoLiberado = (s: Situacao) => !!s.ritmo && ritmoDaParada(s.ritmo).chocavel && s.choques >= CHOQUES_ANTES_DO_ANTIARRITMICO

/** `ml`: volume na ampola, quando o princípio tem uma concentração (RT, 20/11/2026). */
export type DoseDaParada = { valor: string; detalhe: string; ml?: string | null }

export type DosesDaParada = {
  choque: (n: number) => DoseDaParada
  epinefrina: DoseDaParada
  amiodarona: (n: number) => DoseDaParada
  lidocaina: DoseDaParada
  fonte: string
}

/** Doses mostradas no cronômetro. Criança sem peso: pede o peso (nada é estimado). */
/**
 * mL da dose na ampola, para o cronômetro (pedido do RT de 20/11/2026: mostrar o
 * mL perde menos tempo). Só quando o princípio tem uma concentração cadastrada;
 * com mais de uma, o cronômetro não escolhe por ninguém e não mostra mL.
 */
export function mlNaAmpola(doseMg: [number, number], ampolas: Apresentacao[] | undefined): string | null {
  if (!ampolas || ampolas.length !== 1) return null
  const a = ampolas[0]
  if (!doseMg.every((x) => Number.isFinite(x) && x > 0)) return null
  const ml = (x: number) => numeroDaDose(Math.round((x / a.porMl) * 100) / 100)
  const v = doseMg[0] === doseMg[1] ? ml(doseMg[0]) : `${ml(doseMg[0])} a ${ml(doseMg[1])}`
  return `${v} mL da ampola de ${numeroDaDose(a.porMl)} mg/mL${a.diluir ? ', aspirar e diluir' : ''}`
}

const comMl = (valor: string, detalhe: string, ml: string | null): DoseDaParada => ({ valor, detalhe: ml ? `${ml} · ${detalhe}` : detalhe, ml })

export function dosesDaParada(publico: PublicoParada, pesoKg: number | null): DosesDaParada | null {
  const kg = pesoKg !== null && Number.isFinite(pesoKg) && pesoKg > 0 ? pesoKg : null
  if (publico === 'adulto') {
    return {
      choque: () => ({ valor: `${CHOQUE_PCR.bifasicoJ} J bifásico`, detalhe: `monofásico ${CHOQUE_PCR.monofasicoJ} J (manual p. 48); AHA 2025: carga do fabricante, ${AHA_2025_PCR.bifasicoJ[0]}–${AHA_2025_PCR.bifasicoJ[1]} J` }),
      epinefrina: comMl(`${AHA_2025_PCR.adrenalinaMg} mg`, 'IV/IO, a cada 3 a 5 min', mlNaAmpola([AHA_2025_PCR.adrenalinaMg, AHA_2025_PCR.adrenalinaMg], AMPOLAS_PCR_ADULTO.adrenalina)),
      amiodarona: (n) => {
        const mg = n === 0 ? AHA_2025_PCR.amiodaronaMg[0] : AHA_2025_PCR.amiodaronaMg[1]
        return comMl(`${mg} mg`, n === 0 ? 'IV/IO, 1ª dose' : 'IV/IO, 2ª dose (depois do 5º choque)', mlNaAmpola([mg, mg], AMPOLAS_PCR_ADULTO.amiodarona))
      },
      lidocaina: kg
        ? comMl(`${numeroDaDose(kg)} a ${numeroDaDose(1.5 * kg)} mg`, '1 a 1,5 mg/kg, alternativa à amiodarona', mlNaAmpola([kg, 1.5 * kg], AMPOLAS_PCR_ADULTO.lidocaina))
        : { valor: '1 a 1,5 mg/kg', detalhe: 'alternativa à amiodarona; digite o peso para a dose' },
      fonte: 'Adulto: manual do HCFMUSP (p. 48–49) e AHA 2025, Part 9 — as mesmas da ferramenta PCR do adulto.',
    }
  }
  if (!kg) return null
  const doses = dosesDoPeso(kg)
  const dose = (id: string) => doses.find((d) => d.dose.id === id)!
  const epi = dose('fita-epinefrina-iv').calculo
  const amio = dose('fita-amiodarona').calculo
  const c = choquesDoPeso(kg)!
  const J = (x: number) => numeroDaDose(Math.round(x))
  return {
    choque: (n) => n === 0
      ? { valor: `${J(c.desfibrilacaoPrimeiro)} J`, detalhe: `2 J/kg · ${numeroDaDose(kg)} kg` }
      : { valor: `${J(c.desfibrilacaoSeguinte)} J`, detalhe: `4 J/kg · pode subir até ${J(c.desfibrilacaoTeto)} J (10 J/kg), sem passar da dose de adulto` },
    epinefrina: { valor: `${numeroDaDose(epi.faixa[0])} mg`, detalhe: `${numeroDaDose(epi.volumeMl![0])} mL de 0,1 mg/mL · a cada 3 a 5 min`, ml: `${numeroDaDose(epi.volumeMl![0])} mL de 0,1 mg/mL` },
    amiodarona: (n) => {
      const mg = n === 0 ? amio.faixa[0] : Math.min(amio.faixa[0], 150)
      return comMl(`${numeroDaDose(mg)} mg`, n === 0 ? '5 mg/kg (máx. 300 mg)' : '5 mg/kg (máx. 150 mg nas seguintes; até 3 doses)', mlNaAmpola([mg, mg], AMPOLAS.amiodarona))
    },
    lidocaina: (() => {
      const mg = dose('fita-lidocaina').calculo.faixa[0]
      return comMl(`${numeroDaDose(mg)} mg`, '1 mg/kg, alternativa à amiodarona', mlNaAmpola([mg, mg], AMPOLAS.lidocaina))
    })(),
    fonte: 'Criança: módulo ped-doses-fita pelo peso digitado (AHA 2025, Figura 2).',
  }
}

export const horaDoRegistro = (ms: number) => {
  const d = new Date(ms)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
}
export const minSeg = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000))
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}

/** Texto para colar no prontuário: uma linha por evento, com a hora. */
export function textoDoRegistro(e: EstadoParada, agora: number): string {
  const s = situacaoDaParada(e)
  const linhas = e.eventos.filter((ev) => ev.tipo !== 'som').map((ev) => `${horaDoRegistro(ev.em)}  ${ev.texto}`)
  const fim = e.eventos.find((ev) => ev.tipo === 'fim')?.em ?? agora
  return [
    'Registro da parada (cronômetro do Chefe Coruja; nada foi gravado no sistema)',
    ...linhas,
    s.inicio !== null ? `Duração: ${minSeg(fim - s.inicio)} · choques: ${s.choques} · epinefrinas: ${s.epinefrinas}` : '',
  ].filter(Boolean).join('\n')
}

