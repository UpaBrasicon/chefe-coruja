import { fichaP4 } from './fonteP4.ts'
import type { Faixa } from './fonteP2.ts'
import { porPeso, positivoP5, type ItemLivro } from './fonteP5.ts'

// Dengue na criança — livro do ICr, cap. 44 "Arboviroses" (p. 443–460).
// Grupos A–D como o capítulo descreve (p. 448–450), hidratação do Quadro 8
// (p. 450) com os volumes por faixa de peso da CRIANÇA e a linha do
// adolescente como o livro escreve, prova do laço (Quadro 5, p. 447) e os
// limiares de hematócrito e plaquetas. Substitui o "casco" pediátrico de
// `dengue.ts` (que só tem volumes do adulto). O grupo sai dos achados que o
// médico marca; a conduta é dele (ADR 0007). Sem valor neonatal no capítulo.

export const fichaDenguePed = fichaP4('ped-dengue', 'Dengue — criança (grupos e hidratação)', 'cap. 44, p. 443–451')

/** Quadro 2 (p. 445–446): sinais de alarme. */
export const SINAIS_ALARME: { id: string; texto: string }[] = [
  { id: 'dor', texto: 'Dor abdominal intensa e contínua' },
  { id: 'vomitos', texto: 'Vômitos persistentes' },
  { id: 'liquidos', texto: 'Acúmulo de líquidos em cavidades' },
  { id: 'hipotensaoPostural', texto: 'Hipotensão postural' },
  { id: 'hepatomegalia', texto: 'Hepatomegalia > 2 cm abaixo do rebordo costal' },
  { id: 'mucosas', texto: 'Sangramento de mucosas' },
  { id: 'letargia', texto: 'Letargia e/ou irritabilidade' },
  { id: 'ht', texto: 'Aumento progressivo do hematócrito associado à plaquetopenia' },
]

/** Grupo D (p. 450): choque (Quadro 9), sangramento grave ou disfunção grave de órgãos; Quadro 3 (p. 446). */
export const SINAIS_GRAVIDADE: { id: string; texto: string }[] = [
  { id: 'choque', texto: 'Sinais de choque (Quadro 9: taquicardia, pulso fino, TEC > 2 s, oligúria < 1 mL/kg/h, hipotensão tardia)' },
  { id: 'sangramentoGrave', texto: 'Sangramento grave' },
  { id: 'orgaos', texto: 'Disfunção grave de órgãos (AST ou ALT ≥ 1.000, rebaixamento de consciência, falência de órgãos)' },
  { id: 'respiratorio', texto: 'Acúmulo de líquidos com insuficiência respiratória' },
]

/** Grupo B (p. 449): manifestação hemorrágica espontânea, prova do laço positiva ou alto risco (Quadro 6). */
export const ACHADOS_GRUPO_B: { id: string; texto: string }[] = [
  { id: 'hemorragiaEspontanea', texto: 'Manifestação hemorrágica espontânea (sem repercussão hemodinâmica)' },
  { id: 'laco', texto: 'Prova do laço positiva' },
  { id: 'lactente', texto: 'Alto risco — lactente < 2 anos (Quadro 6)' },
  { id: 'doencaBase', texto: 'Alto risco — doença de base (cardiovascular, diabetes, pneumopatia, hematológica crônica/falciforme, renal crônica, ácido-péptica, autoimune) (Quadro 6)' },
  { id: 'gestante', texto: 'Alto risco — gestante (Quadro 6)' },
]

export type GrupoDenguePed = 'A' | 'B' | 'C' | 'D'

/** Grupo pelo achado mais grave marcado (p. 448–450). */
export function grupoDenguePed(marcados: Set<string>): GrupoDenguePed {
  if (SINAIS_GRAVIDADE.some((s) => marcados.has(s.id))) return 'D'
  if (SINAIS_ALARME.some((s) => marcados.has(s.id))) return 'C'
  if (ACHADOS_GRUPO_B.some((s) => marcados.has(s.id))) return 'B'
  return 'A'
}

/**
 * Grupo B → C (p. 449): hematócrito > 38% na criança e/ou plaquetas < 100.000/mm³.
 * Devolve null se nada foi informado.
 */
export function grupoBParaC(htPct: number, plaquetasMm3: number): boolean | null {
  const temHt = positivoP5(htPct)
  const temPlaq = positivoP5(plaquetasMm3)
  if (!temHt && !temPlaq) return null
  return (temHt && htPct > 38) || (temPlaq && plaquetasMm3 < 100_000)
}

export const ERRATA_HT =
  'O limiar de hematócrito da criança não é o mesmo nas duas passagens: "valores superiores a 42% em crianças" para hemoconcentração (p. 447) e "Ht aumentado em > 38% em crianças" para reclassificar o grupo B em C (p. 449, conferido no PDF). A ferramenta usa 38% só na reclassificação do grupo B, como impresso, e mostra os dois.'

/** Quadro 5 (p. 447): valor médio da prova do laço. */
export function pressaoMediaLaco(pas: number, pad: number): number | null {
  return positivoP5(pas, pad) && pas >= pad ? (pas + pad) / 2 : null
}

export const ERRATA_LACO =
  'Quadro 5 (p. 447, conferido no PDF): "pressão arterial sistólica + pressão arterial diastólica/2" — lido literalmente somaria a sistólica com metade da diastólica. O próprio quadro chama de "valor médio"; a ferramenta usa (PAS + PAD) ÷ 2.'

/** Prova do laço na criança (Quadro 5): 3 minutos; positiva com 10 ou mais petéquias no quadrado de 2,5 cm. */
export const LACO_CRIANCA = { minutos: 3, petequias: 10 }

export type Etapa = { etapa: string; regra: string; volumeMl: Faixa | null; mlH?: Faixa | null }

/** Quadro 8 (p. 450), criança: mL/kg/dia por faixa de peso. 10 e 20 kg entram em "10 a 20 kg". */
export function mlKgDiaCrianca(pesoKg: number): number | null {
  if (!positivoP5(pesoKg)) return null
  if (pesoKg < 10) return 130
  if (pesoKg <= 20) return 100
  return 80
}

export type Perfil = 'crianca' | 'adolescente'

/**
 * Hidratação oral dos grupos A e B (Quadro 8): criança pela faixa de peso; adolescente 60 mL/kg/dia.
 * 1/3 em SRO em 4 a 6 h e 2/3 em líquidos caseiros no restante do dia.
 */
export function hidratacaoOral(pesoKg: number, perfil: Perfil): { mlKgDia: number; dia: number; sro: number; caseiros: number; sroMlH: Faixa } | null {
  const mlKgDia = perfil === 'crianca' ? mlKgDiaCrianca(pesoKg) : positivoP5(pesoKg) ? 60 : null
  if (mlKgDia === null) return null
  const dia = mlKgDia * pesoKg
  return { mlKgDia, dia, sro: dia / 3, caseiros: (2 * dia) / 3, sroMlH: [dia / 3 / 6, dia / 3 / 4] }
}

/** Grupo C (Quadro 8): expansão com cristaloide 10 a 20 mL/kg/h, até 3 vezes (criança e adolescente). */
export const expansaoGrupoC = (pesoKg: number) => porPeso([10, 20], pesoKg)

/** Adolescente, manutenção do grupo C (Quadro 8 e p. 450): 25 mL/kg em 6 h e, após, 25 mL/kg em 8 h (1/3 SF + 2/3 SG). */
export function manutencaoAdolescente(pesoKg: number): Etapa[] | null {
  if (!positivoP5(pesoKg)) return null
  const v = 25 * pesoKg
  return [
    { etapa: 'Primeiras 6 h', regra: '25 mL/kg (1/3 SF + 2/3 SG)', volumeMl: [v, v], mlH: [v / 6, v / 6] },
    { etapa: '8 h seguintes', regra: '25 mL/kg (1/3 SF + 2/3 SG)', volumeMl: [v, v], mlH: [v / 8, v / 8] },
  ]
}

/** Grupo D (Quadro 8 e p. 450): SF 20 mL/kg em até 20 minutos, até 3 vezes. */
export const expansaoGrupoD = (pesoKg: number) => porPeso([20, 20], pesoKg)

/**
 * Albumina 5% no grupo D com Ht em ascensão: 20 mL/kg (Quadro 8) ou 10 a 20 mL/kg (p. 451).
 * Preparo do livro: cada 100 mL = 25 mL de albumina 20% + 75 mL de SF 0,9%.
 */
export function albumina5(pesoKg: number): { volume: Faixa; albumina20: Faixa; sf: Faixa; gramas: Faixa } | null {
  const volume = porPeso([10, 20], pesoKg)
  if (!volume) return null
  return {
    volume,
    albumina20: [volume[0] * 0.25, volume[1] * 0.25],
    sf: [volume[0] * 0.75, volume[1] * 0.75],
    gramas: [volume[0] * 0.05, volume[1] * 0.05],
  }
}

export const NOTA_ALBUMINA =
  'Quadro 8 (p. 450): "20 mL/kg (0,5 a 1 g/kg) de albumina a 5%"; texto (p. 451): "10 a 20 mL/kg com albumina a 5%". A ferramenta mostra 10 a 20 mL/kg (0,5 a 1 g/kg), que cobre as duas passagens.'

export const NOTA_MANUTENCAO_CRIANCA =
  'Criança (Quadro 8 e p. 450): após a expansão, manutenção pela necessidade hídrica basal (Holliday-Segar) com solução balanceada, internado por 48 h. O volume de Holliday-Segar sai do cap. 77 do mesmo livro.'

/** Quadro 7 (p. 449): critérios de internação. */
export const INTERNACAO: string[] = [
  'Preocupação excessiva da família',
  'Impossibilidade de seguimento ambulatorial',
  'Baixa ingesta de líquidos e alimentos',
  'Sangramento espontâneo',
  'Plaquetas ≤ 20.000/mm³ e/ou hematócrito elevado',
  'Dor abdominal intensa e vômitos',
  'Desidratação significativa exigindo reposição endovenosa',
  'Comprometimento respiratório (dor torácica, dificuldade respiratória, MV diminuído ou outros sinais de gravidade)',
  'Sinais de alarme e/ou de choque',
]

/** Quadro 10 (p. 451): critérios de alta hospitalar. */
export const ALTA: string[] = [
  'Estabilidade hemodinâmica por > 48 h',
  'Ausência de febre > 48 h',
  'Melhora clínica',
  'Hematócrito normal e estável > 24 h',
  'Plaquetas em elevação e acima de 50.000/mm³',
]

export const REFERENCIAS_DENGUE: ItemLivro[] = [
  { texto: 'Suspeita sem sinais de alarme (Quadro 1): febre de 2 a 7 dias + ao menos 2 entre cefaleia, dor retro-orbitária, mialgia, artralgia, exantema, vômitos/náuseas, leucopenia, prova do laço positiva; área de transmissão nos últimos 15 dias.', pagina: 'p. 445' },
  { texto: 'Hemoconcentração nos grupos com alarme ou grave: aumento de 20% do Ht basal ou valores > 42% em crianças.', pagina: 'p. 447' },
  { texto: 'Grupo A: hidratação oral durante todo o período febril e por 24 a 48 h após a defervescência; reavaliar no 1º dia sem febre ou no 5º dia de doença.', pagina: 'p. 449' },
  { texto: 'Grupo C: reavaliação clínica a cada 1 h e hematócrito a cada 2 h; sem melhora após até 3 expansões, conduzir como grupo D.', pagina: 'p. 450' },
  { texto: 'Grupo D: reavaliação clínica a cada 15 a 30 min e hematócrito a cada 2 h; com melhora, reclassificar para C.', pagina: 'p. 450–451' },
  { texto: 'Ht em queda com choque: investigar sangramento/CIVD. PFC e vitamina K se TP/TTPA alterados (atividade < 40% e INR > 1,25). CH: perda > 10%, hemólise, sangramento oculto. Plaquetas: hemorragia visceral importante com < 50.000/mm³ ou contagem < 20.000/mm³.', pagina: 'p. 451' },
  { texto: 'Sem evidência para corticosteroide na dengue grave. Na reabsorção do plasma pode haver hipervolemia: suspender fluidos e considerar diurético.', pagina: 'p. 451' },
  { texto: 'Evitar salicilatos e anti-inflamatórios não hormonais.', pagina: 'p. 449' },
]
