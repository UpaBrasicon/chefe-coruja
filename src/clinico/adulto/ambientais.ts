import { completo, escolha, marcadas, type Escore } from '../escore.ts'
import type { Ficha, Fonte } from '../ficha.ts'
import { fichaAdulto, pagina } from './fonte.ts'

// Emergências ambientais do Manual de Medicina de Emergência do HCFMUSP (3ª
// ed., 2022): afogamento (cap. 100, p. 1338–1348) e hipotermia acidental
// (cap. 102, p. 1360–1372). O livro não separa adulto e criança no afogamento
// (exceto o alvo de PaO2 e o fator "idade > 14 anos"); aqui é só adulto.

const AFOG = 'cap. 100 Afogamento'
const HIPO = 'cap. 102 Hipotermia acidental'

// ---------------------------------------------------------------------------
// Afogamento: graus de Szpilman (Tabela 1, p. 1340–1341)

const GRAUS = [
  { grau: '0', texto: 'Ausculta pulmonar normal, sem tosse', sobrevida: '100%' },
  { grau: 'I', texto: 'Ausculta pulmonar normal, com tosse', sobrevida: '100%' },
  { grau: 'II', texto: 'Ausculta pulmonar com estertores', sobrevida: '99%' },
  { grau: 'III', texto: 'Edema agudo de pulmão, sem hipotensão', sobrevida: '95-96%' },
  { grau: 'IV', texto: 'Edema agudo de pulmão, com hipotensão', sobrevida: '78-82%' },
  { grau: 'V', texto: 'Parada respiratória', sobrevida: '56-69%' },
  { grau: 'VI', texto: 'Parada cardiorrespiratória', sobrevida: '7-12%' },
]

export const szpilman: Escore = {
  ficha: fichaAdulto('adulto-szpilman', 'Afogamento — graus de Szpilman e prognóstico (adulto)', `${AFOG}, p. 1340–1345 (Tabela 1 e Figura 1)`),
  descricao: 'Grau 0 a VI pelos achados cardiopulmonares, com a sobrevida da Tabela 1, e os indicadores de pior prognóstico do texto.',
  itens: [
    { tipo: 'escolha', id: 'grau', rotulo: 'Achado no departamento de emergência', opcoes: GRAUS.map((g, i) => ({ rotulo: `${g.grau} — ${g.texto}`, valor: i })) },
    { tipo: 'marca', id: 'submersao', rotulo: 'Submersão por > 5 minutos', pontos: 1, grupo: 'Indicadores de pior prognóstico (p. 1341)' },
    { tipo: 'marca', id: 'sbv', rotulo: 'Tempo para início de suporte básico > 10 minutos', pontos: 1, grupo: 'Indicadores de pior prognóstico (p. 1341)' },
    { tipo: 'marca', id: 'rcp', rotulo: 'Ressuscitação com duração > 25 minutos', pontos: 1, grupo: 'Indicadores de pior prognóstico (p. 1341)' },
    { tipo: 'marca', id: 'idade', rotulo: 'Idade > 14 anos', pontos: 1, grupo: 'Indicadores de pior prognóstico (p. 1341)' },
    { tipo: 'marca', id: 'glasgow', rotulo: 'Glasgow < 5', pontos: 1, grupo: 'Indicadores de pior prognóstico (p. 1341)' },
    { tipo: 'marca', id: 'apneia', rotulo: 'Apneia persistente ou reanimação no departamento de emergência', pontos: 1, grupo: 'Indicadores de pior prognóstico (p. 1341)' },
    { tipo: 'marca', id: 'ph', rotulo: 'pH arterial < 7,1 na apresentação', pontos: 1, grupo: 'Indicadores de pior prognóstico (p. 1341)' },
  ],
  calcular(r) {
    if (!completo(szpilman, r)) return null
    const i = escolha(szpilman, r, 'grau')!.valor
    const g = GRAUS[i]
    const piores = marcadas(szpilman, r)
    return {
      rotulo: 'Szpilman',
      valor: `Grau ${g.grau}`,
      nota: `${g.texto} · sobrevida ${g.sobrevida}`,
      estado: i >= 4 ? 2 : i >= 2 ? 1 : 0,
      derivados: [
        ['Sobrevida da Tabela 1 (p. 1340–1341)', g.sobrevida],
        ['Indicadores de pior prognóstico', piores.length ? `${piores.length}: ${piores.join('; ')}` : 'nenhum marcado'],
      ],
      cuidados: [
        'Alvo de SpO2 entre 90 e 95%; aquecimento ativo se < 34 °C (p. 1340, 1342).',
        'VM protetora: volume corrente 6-8 mL/kg, platô < 30 cmH2O, PEEP inicial 5, FiO2 inicial 100%; PaO2 > 60 mmHg em adultos; não ajustar a PEEP por pelo menos 48 h (p. 1342–1343).',
        'Assintomático com oximetria > 95% ou tosse leve com exame normal: alta após observação de 4-6 h; sintomático ou exame alterado: internação em UTI (p. 1344–1345).',
        'Hipotermia terapêutica (32-34 °C por 12-72 h) é controversa; evitar T > 37 °C (p. 1343).',
        'Sem referência pediátrica declarada (o alvo de PaO2 > 80 mmHg em crianças, p. 1342, não entra).',
      ],
    }
  },
}

// ---------------------------------------------------------------------------
// Hipotermia (Tabelas 1, 5 e 6; p. 1360–1370)

// Versão .1 de 28/09/2026: diretriz ERC 2025 de circunstâncias especiais
// (hipotermia acidental), lida no texto aberto do Resuscitation Council UK,
// ao lado do manual — estágios I–IV, adrenalina só a partir de 30 °C,
// desfibrilação até 3 choques, critérios de ECPR e escore HOPE.

export const ERC_2025_HIPOTERMIA: Fonte = {
  citacao: 'European Resuscitation Council Guidelines 2025: Special Circumstances in Resuscitation. Resuscitation. 2025 (PMID 41117569); texto lido na versão aberta do Resuscitation Council UK, "2025 Resuscitation Guidelines — Special circumstances: accidental hypothermia, drowning" (Thies K, Truhlář A, Deakin CD).',
  url: 'https://www.resus.org.uk/library/2025-resuscitation-guidelines/special-circumstances-guidelines',
}

const PAG_HIPO = `${HIPO}, p. 1360–1370 (Tabelas 1, 5 e 6)`

export const fichaHipotermiaAdulto: Ficha = {
  ...fichaAdulto('adulto-hipotermia', 'Hipotermia acidental — estágio, RCP e reaquecimento (adulto)', PAG_HIPO),
  versao: '2026-09-28.1',
  fontes: [pagina(PAG_HIPO), ERC_2025_HIPOTERMIA],
  revisadoEm: '28/09/2026 (ERC/RCUK 2025 lida no texto aberto; manual mantido como base)',
}

/** Estadiamento suíço como a ERC/RCUK 2025 escreve (temperatura estimada quando não medida). */
export const ESTAGIOS_ERC_2025 = [
  { estagio: 'I (leve)', clinica: 'consciente, com tremor', tempC: '35–32 °C' },
  { estagio: 'II (moderada)', clinica: 'consciência alterada (confusão, letargia); tremor pode diminuir ou faltar', tempC: '32–28 °C' },
  { estagio: 'III (grave)', clinica: 'inconsciente, com sinais vitais (pulso, respiração)', tempC: '28–24 °C' },
  { estagio: 'IV (profunda)', clinica: 'sem sinais vitais', tempC: '< 24 °C' },
]

/** Critérios da ERC/RCUK 2025 para levar direto a um centro de ECPR (risco iminente de PCR ou em PCR). */
export function criteriosEcpr2025(e: { fc?: number; pas?: number; arritmiaVentricular?: boolean; tempC?: number }): string[] {
  const r: string[] = []
  if (Number.isFinite(e.fc) && e.fc! > 0 && e.fc! < 45) r.push('FC < 45/min')
  if (Number.isFinite(e.pas) && e.pas! > 0 && e.pas! < 90) r.push('PAS < 90 mmHg')
  if (e.arritmiaVentricular) r.push('arritmia ventricular')
  if (Number.isFinite(e.tempC) && e.tempC! > 0 && e.tempC! < 30) r.push('temperatura central < 30 °C')
  return r
}

export type ItemHipo2025 = { tema: string; erc: string; livro: string }

export const DIRETRIZ_HIPOTERMIA_2025: ItemHipo2025[] = [
  { tema: 'Sinais vitais', erc: 'Procurar sinais vitais por até 1 min no hipotérmico inconsciente; medir a temperatura central com termômetro de baixa leitura; sem medida, usar o estadiamento suíço', livro: 'procurar sinais de vida por pelo menos 1 min (p. 1366); termômetros usuais só vão até 34 °C (p. 1363)' },
  { tema: 'Estágios', erc: 'I 35–32 (consciente, tremor); II 32–28 (consciência alterada); III 28–24 (inconsciente com sinais vitais); IV < 24 °C (sem sinais vitais)', livro: 'HT I–III iguais; HT IV = sem sinais vitais, "geralmente < 24 °C" (Tabela 1, p. 1360)' },
  { tema: 'Para onde levar', erc: 'Com FC < 45, PAS < 90, arritmia ventricular ou T < 30 °C, ou em PCR: direto a um centro de ECPR para reaquecer com ECMO venoarterial; se o centro não for alcançável em tempo razoável (≈ 6 h), iniciar reaquecimento não extracorpóreo', livro: 'extracorpóreo nos instáveis, em PCR ou na falha dos demais (Tabela 5, p. 1369)' },
  { tema: 'RCP abaixo de 28 °C', erc: 'Adiar ou fazer RCP intermitente quando a contínua não for possível; considerar compressor mecânico em transporte longo ou terreno difícil', livro: '5 min de RCP / até 5 min sem (20–28 °C); / até 10 min sem (< 20 °C) (p. 1366)' },
  { tema: 'Desfibrilação', erc: 'Se a FV persistir após 3 choques, adiar novas tentativas até a temperatura central passar de 30 °C', livro: 'igual (p. 1367)' },
  { tema: 'Adrenalina', erc: 'Abaixo de 30 °C acumula e pode fazer mais mal que bem: 1 mg IV só ao atingir 30 °C (salvo ECPR iminente); entre 30 e 35 °C, intervalos de 6–10 min', livro: 'igual: nada até 30 °C; 30–35 °C intervalo dobrado 6–10 min (p. 1366)' },
  { tema: 'Amiodarona', erc: 'Dose de ataque de 300 mg se ritmo chocável; doses seguintes só acima de 30 °C', livro: '—' },
  { tema: 'Prognóstico', erc: 'Prognosticar o sucesso do reaquecimento intra-hospitalar pelo escore HOPE (Hypothermia Outcome Prediction after Extracorporeal Life Support)', livro: '—' },
  { tema: 'Afogamento', erc: 'Começar com 5 ventilações (O2 a 100% se disponível) e seguir a RCP padrão; considerar ECPR se a ressuscitação inicial falhar; imobilização cervical na água não deve atrasar a retirada', livro: 'cap. 100 (ferramenta de Szpilman)' },
]

export type EstagioHipotermia = { estagio: 'sem hipotermia' | 'HT I' | 'HT II' | 'HT III' | 'HT IV'; nome: string; reaquecimento: string; nota?: string }

const REAQUECIMENTO = {
  1: 'Passivo com ambiente aquecido, cobertores e roupas, bebidas quentes, movimentação ativa',
  23: 'Ativo com ambiente, nebulização e cobertores aquecidos, fluidos aquecidos parenterais',
  4: 'ECMO, circulação extracorpórea, irrigação aquecida de cavidade torácica na indisponibilidade deles',
}

/**
 * Estágio pela temperatura central (Tabela 1, p. 1360). O HT IV é definido
 * pela ausência de sinais vitais ("geralmente < 24 °C"), não só pela temperatura.
 * As faixas do livro se tocam em 32 e 28 °C; 32 entra em HT I e 28 em HT II.
 */
export function estagioHipotermia(tempC: number, semSinaisVitais: boolean): EstagioHipotermia | null {
  if (!Number.isFinite(tempC) || tempC < 5 || tempC > 45) return null
  if (semSinaisVitais) {
    return { estagio: 'HT IV', nome: 'Muito grave', reaquecimento: REAQUECIMENTO[4],
      nota: tempC >= 24 ? 'Sem sinais vitais com temperatura ≥ 24 °C: o livro descreve o HT IV como "geralmente < 24 °C".' : undefined }
  }
  if (tempC >= 35) return { estagio: 'sem hipotermia', nome: 'Temperatura central ≥ 35 °C', reaquecimento: '—' }
  if (tempC >= 32) return { estagio: 'HT I', nome: 'Leve (35-32 °C), consciente', reaquecimento: REAQUECIMENTO[1] }
  if (tempC >= 28) return { estagio: 'HT II', nome: 'Moderada (32-28 °C), consciência alterada', reaquecimento: REAQUECIMENTO[23] }
  return { estagio: 'HT III', nome: 'Grave (< 28 °C), inconsciente, sinais vitais presentes', reaquecimento: REAQUECIMENTO[23] }
}

export type RegraRcp = { ciclo: string; adrenalina: string; desfibrilacao: string }

/** Sequência de RCP, adrenalina e desfibrilação pela temperatura central (p. 1366–1367). null = temperatura desconhecida. */
export function rcpNaHipotermia(tempC: number | null): RegraRcp {
  const ciclo = tempC === null || (tempC >= 20 && tempC <= 28)
    ? 'RCP por no mínimo 5 min ininterruptos, seguidos por até 5 min sem RCP'
    : tempC < 20
      ? 'RCP por no mínimo 5 min ininterruptos, seguidos por até 10 min sem RCP'
      : 'O livro não traz intervalo próprio acima de 28 °C'
  const adrenalina = tempC === null
    ? 'Sem medicações até a temperatura central atingir 30 °C (temperatura desconhecida)'
    : tempC < 30
      ? 'Não fazer adrenalina nem outras medicações até 30 °C'
      : tempC <= 35
        ? 'Entre 30 e 35 °C: intervalo entre doses dobrado (6-10 min)'
        : 'Acima de 35 °C: recomendações habituais do ACLS'
  const desfibrilacao = tempC !== null && tempC > 30
    ? 'Desfibrilação conforme o habitual'
    : 'Desfibrilação aceitável em qualquer temperatura; se TV/FV persistir após 3 choques, aguardar temperatura > 30 °C'
  return { ciclo, adrenalina, desfibrilacao }
}

/** Taxa de reaquecimento em °C/h; < 0,5 °C/h é falha do aquecimento passivo (Tabela 5, p. 1369). */
export function taxaReaquecimento(tempInicialC: number, tempFinalC: number, horas: number): { cPorHora: number; falhaPassivo: boolean } | null {
  if (![tempInicialC, tempFinalC, horas].every(Number.isFinite) || horas <= 0) return null
  const cPorHora = (tempFinalC - tempInicialC) / horas
  return { cPorHora, falhaPassivo: cPorHora < 0.5 }
}

export const METODOS_REAQUECIMENTO = [
  { metodo: 'Passivo externo', indicacao: 'Todos os casos', taxa: '0,5-2 °C/hora', tecnica: 'Retirar roupas molhadas; ambiente seco e aquecido, próximo de 28 °C' },
  { metodo: 'Ativo externo', indicacao: '—', taxa: '0,6-2,5 °C (o livro não diz a unidade de tempo)', tecnica: 'Ar forçado, imersão em água quente, cobertores térmicos, radiação; aquecer o tronco antes das extremidades' },
  { metodo: 'Ativo interno', indicacao: 'Moderada ou grave, instabilidade, baixa reserva ou falha do passivo (< 0,5 °C/h), secundária', taxa: '—', tecnica: 'O2 e fluidos aquecidos, lavagem peritoneal ou torácica, cateter endovascular' },
  { metodo: 'Extracorpóreo', indicacao: 'Instáveis, em PCR ou falha das demais', taxa: 'métodos mais rápidos', tecnica: 'Hemodiálise, venovenoso, venoarterial, ECMO VA' },
]

export const OUTROS_HIPOTERMIA = [
  { texto: 'Procurar sinais de vida por pelo menos 1 minuto antes de iniciar RCP', pagina: 'p. 1366' },
  { texto: 'Manter a RCP até a temperatura central atingir 32-35 °C', pagina: 'p. 1367' },
  { texto: 'Cristaloide aquecido a 40-42 °C em alíquotas de 500 mL; evitar ringer lactato', pagina: 'p. 1367' },
  { texto: 'FC cai 50% a 28 °C e 80% a 20 °C (bradicardia não responsiva a atropina)', pagina: 'p. 1363' },
  { texto: 'Hematócrito aumenta 2% a cada 1 °C de queda; Ht no limite inferior deve ser lido como baixo', pagina: 'p. 1365' },
  { texto: 'ECG: FV < 28 °C; assistolia < 20 °C', pagina: 'p. 1365' },
  { texto: 'Termômetro esofágico no terço inferior, 24 cm abaixo da laringe; termômetros usuais só vão até 34 °C', pagina: 'p. 1363' },
  { texto: 'Moderada ou grave: internação para observação, mesmo reaquecido', pagina: 'p. 1369' },
]
