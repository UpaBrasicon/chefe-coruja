import type { Ficha, Fonte } from '../ficha.ts'
import { GVS_2024_TETANO, NT_134_2022_RAIVA, NT_35_2026_VINRAB, NT_8_2022_RAIVA } from '../adulto/profilaxiaPosExposicao.ts'

// Tétano e raiva na criança (escores P2/P3, item P11; decisão A do RT em
// 11/11/2026). Doses só do Ministério da Saúde, pelos PDFs que o RT entregou:
// Guia de Vigilância em Saúde (6ª ed. rev., 2024, vol. 1, Tétano acidental,
// Quadros 1–4, colunas "crianças") e Notas Técnicas 8/2022, 134/2022 e 35/2026
// da raiva. Nada vem do adulto: a regra do Quadro 4 e o soro antirrábico por
// UI/kg são do MS e valem para todas as idades; o que é próprio da criança
// (antibiótico, sedativos, vacina por idade, local da vacina, volume por músculo
// e o soro caso a caso) está aqui. Tétano neonatal fora (seção sem neonato).

const ped = (f: Fonte): Fonte => ({ ...f, pediatrica: true })

export const fichaTetanoRaivaPed: Ficha = {
  id: 'ped-tetano-raiva',
  titulo: 'Tétano e raiva — profilaxia e doses na criança (MS)',
  versao: '2026-11-11.1',
  publico: 'pediatrico',
  fontes: [ped(GVS_2024_TETANO), ped(NT_8_2022_RAIVA), ped(NT_134_2022_RAIVA), ped(NT_35_2026_VINRAB)],
  revisadoEm: '11/11/2026 (escores P2/P3, item P11; PDFs do MS entregues pelo RT: GVS 2024 tétano e NTs 8/2022, 134/2022 e 35/2026 da raiva)',
}

const valido = (x: number) => Number.isFinite(x) && x > 0

// ── Tétano (GVS 2024) ────────────────────────────────────────────────────────

export const VACINA_TETANO_PED = {
  menor7: 'Antes dos 7 anos: vacina penta a partir dos 2 meses, 3 doses com 60 dias de intervalo; reforços com DTP aos 15 meses e aos 4 anos.',
  aPartir7: 'A partir dos 7 anos: dT. Sem vacina ou sem comprovação, 3 doses com 60 dias de intervalo (mínimo de 30); esquema incompleto, completar as 3 doses; reforço a cada 10 anos.',
  pagina: 'Vacinação e particularidades, p. 334',
}

export const IMUNOBIOLOGICOS_TETANO_PED = {
  ighat: 'IGHAT IM: profilática 250 UI; terapêutica 500 UI. O próprio quadro diz que estudos recentes indicam 500 UI "para crianças ou adultos" e que, a critério médico, pode chegar a 6.000 UI. Em grupo muscular diferente do da vacina.',
  sat: 'SAT: profilático 5.000 UI; terapêutico 20.000 UI, IM em duas massas musculares ou EV diluído em SF ou SG 5%; a posologia deve ser individualizada e a critério médico.',
  nota: 'O Quadro 2 não muda a dose do SAT nem da IGHAT pela idade.',
  pagina: 'Quadro 2, p. 331',
}

export const ANTIBIOTICO_TETANO_PED = {
  penicilinaUiKgDia: [50_000, 100_000] as [number, number],
  dosesPorDia: 6,
  texto: 'Penicilina G cristalina EV, 50.000 a 100.000 UI/kg/dia, de 4 em 4 horas, por 7 a 10 dias; a posologia deve ser individualizada e a critério médico.',
  metronidazol: 'Metronidazol EV de 8 em 8 horas, por 7 a 10 dias; a coluna da criança traz "7,5 mg".',
  errataMetronidazol: 'Na coluna da criança, o metronidazol vem como "7,5 mg", sem dizer se é por kg. Não é calculado.',
  semMaximo: 'O quadro não traz dose máxima para a criança.',
  pagina: 'Quadro 3, p. 331',
}

/** Penicilina G cristalina na criança (Quadro 3): UI por dia e por dose de 4/4 h. */
export function penicilinaTetanoPed(pesoKg: number): { uiDia: [number, number]; uiDose: [number, number] } | null {
  if (!valido(pesoKg)) return null
  const [a, b] = ANTIBIOTICO_TETANO_PED.penicilinaUiKgDia
  const n = ANTIBIOTICO_TETANO_PED.dosesPorDia
  return { uiDia: [a * pesoKg, b * pesoKg], uiDose: [(a * pesoKg) / n, (b * pesoKg) / n] }
}

export const SEDATIVOS_TETANO_PED = {
  texto: 'Coluna "crianças", como impressa: diazepam 0,1 a 2 mg/kg/dose EV; midazolam (em substituição ao diazepam) 0,15 a 0,2 mg/kg/dia IM; clorpromazina, acima de 6 meses, 0,55 mg/kg/dia EV, quando não houver resposta ao diazepam.',
  errata: 'O midazolam vem por dia e por via IM, sem dizer como dividir; a clorpromazina vem por dia, sem intervalo. As doses não são calculadas.',
  pagina: 'Quadro 1, p. 328',
}

// ── Raiva (NTs 8/2022, 134/2022 e 35/2026) ──────────────────────────────────

export const RAIVA_PED = {
  soroCasoACaso: 'Criança, gestante e imunocomprometido: o uso do soro deve ser avaliado caso a caso, considerando o tipo de exposição (NT 35/2026, item 4.7.3).',
  vacinaIm: 'Vacina pós-exposição IM: 4 doses, nos dias 0, 3, 7 e 14; frasco inteiro (0,5 ou 1,0 mL, conforme o laboratório). Deltoide, ou vasto lateral da coxa em crianças menores de 2 anos. Nunca no glúteo.',
  vacinaId: 'Vacina pós-exposição ID: 4 doses, nos dias 0, 3, 7 e 14; 0,2 mL divididos em duas aplicações de 0,1 mL, no antebraço ou na região do deltoide.',
  soroIm: 'O que não couber na lesão vai IM, respeitando o volume máximo do grupo muscular mais próximo e nunca no mesmo grupo muscular da vacina.',
  pagina: 'NT 8/2022, itens 2.2 e 2.6; NT 35/2026, item 4.7.3',
}

/** NT 8/2022, Anexo 1: volume máximo de qualquer medicação por grupo muscular (adaptado de Malkin, 2008). */
export const VOLUME_MAXIMO_MUSCULO: { idade: string; deltoide: string; ventrogluteo: string; dorsogluteo: string; vastoLateral: string }[] = [
  { idade: 'Lactentes', deltoide: '—', ventrogluteo: '—', dorsogluteo: '—', vastoLateral: '1,0 mL' },
  { idade: 'Crianças de 3 a 6 anos', deltoide: '—', ventrogluteo: '1,5 mL', dorsogluteo: '1,0 mL', vastoLateral: '1,5 mL' },
  { idade: 'Crianças de 6 a 14 anos', deltoide: '0,5 mL', ventrogluteo: '1,5 a 2,0 mL', dorsogluteo: '1,5 a 2,0 mL', vastoLateral: '1,5 mL' },
  { idade: 'Adolescentes', deltoide: '1,0 mL', ventrogluteo: '2,0 a 2,5 mL', dorsogluteo: '2,0 a 2,5 mL', vastoLateral: '1,5 a 2,0 mL' },
]
export const ERRATA_VOLUME_MUSCULO = 'O quadro da NT 8/2022 (Anexo 1) não tem linha para 1 a 3 anos: passa de "lactentes" para "crianças de 3 a 6 anos". Mostrado como impresso.'
