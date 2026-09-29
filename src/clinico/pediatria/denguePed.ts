import type { Ficha, Fonte } from '../ficha.ts'
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

// Versão .1 de 28/09/2026: manual do MS "Dengue: diagnóstico e manejo clínico
// — adulto e criança" (6ª ed., 2024; PDF lido) ao lado do livro do ICr — a
// hidratação dos grupos C e D do MS vale para "adulto e criança", e os
// Apêndices B–H trazem peso aproximado, sinais vitais por idade e analgésicos.

export const MS_DENGUE_2024_PED: Fonte = {
  citacao: 'Ministério da Saúde. Dengue: diagnóstico e manejo clínico — adulto e criança. 6ª ed. Brasília: MS/SVSA; 2024. Criança: p. 16, 18, 27, 30, 33–38, 55; Apêndices B–H (p. 71–77).',
  url: 'https://www.gov.br/saude/pt-br/centrais-de-conteudo/publicacoes/svsa/dengue/dengue-diagnostico-e-manejo-clinico-adulto-e-crianca',
  pediatrica: true,
}

const baseDenguePed = fichaP4('ped-dengue', 'Dengue — criança (grupos e hidratação)', 'cap. 44, p. 443–451')

export const fichaDenguePed: Ficha = {
  ...baseDenguePed,
  versao: '2026-09-28.1',
  fontes: [...baseDenguePed.fontes, MS_DENGUE_2024_PED],
  revisadoEm: '28/09/2026 (manual do MS 6ª ed. 2024 lido; livro do ICr mantido como base)',
}

/** MS 2024, grupo C (p. 33; "adulto e criança"): 10 mL/kg na 1ª hora e 10 mL/kg/h na 2ª até o Ht; máximo 20 mL/kg por fase; até 3 fases. Manutenção com SF: 25 mL/kg em 6 h e 25 mL/kg em 8 h. */
export function grupoCMs2024(pesoKg: number): { hora1Ml: number; hora2Ml: number; maxFaseMl: number; manut6hMl: number; manut6hMlH: number; manut8hMl: number; manut8hMlH: number } | null {
  if (!positivoP5(pesoKg)) return null
  const m = 25 * pesoKg
  return { hora1Ml: 10 * pesoKg, hora2Ml: 10 * pesoKg, maxFaseMl: 20 * pesoKg, manut6hMl: m, manut6hMlH: m / 6, manut8hMl: m, manut8hMlH: m / 8 }
}

/** MS 2024, Apêndice H (p. 77): dipirona e paracetamol 10 mg/kg/dose até de 6/6 h na criança ("respeitar a dose máxima por peso e idade"). */
export function analgesicosMs2024(pesoKg: number): { dipironaMg: number; paracetamolMg: number } | null {
  return positivoP5(pesoKg) ? { dipironaMg: 10 * pesoKg, paracetamolMg: 10 * pesoKg } : null
}

/** MS 2024, Apêndice B (p. 71): peso aproximado — 3 a 12 meses: idade (meses) × 0,5 + 4,5; 1 a 8 anos: idade (anos) × 2 + 8,5. Fora dessas faixas, null. */
export function pesoAproximadoMs(idadeMeses: number): number | null {
  if (!Number.isFinite(idadeMeses) || idadeMeses < 3) return null
  if (idadeMeses <= 12) return idadeMeses * 0.5 + 4.5
  const anos = idadeMeses / 12
  return anos <= 8 ? anos * 2 + 8.5 : null
}

/** MS 2024 (p. 16): até 10 anos, 5º percentil da PAS = 70 + 2 × idade (anos). */
export function pasP5Ms(idadeAnos: number): number | null {
  return Number.isFinite(idadeAnos) && idadeAnos >= 1 && idadeAnos <= 10 ? 70 + 2 * idadeAnos : null
}

/** Apêndices C, D e E (p. 72–74). */
export const SINAIS_VITAIS_MS: { tabela: string; linhas: string[] }[] = [
  { tabela: 'FC acordado / média / dormindo (Apêndice C)', linhas: ['0–2 meses: 85–205 / 140 / 80–160', '3–23 meses: 100–190 / 130 / 75–160', '2–10 anos: 60–140 / 80 / 60–90', '> 10 anos: 60–100 / 75 / 50–90'] },
  { tabela: 'FR máxima (Apêndice D)', linhas: ['< 2 meses: até 60 irpm', '2 meses a 1 ano: até 50', '1 a 5 anos: até 40', '5 a 8 anos: até 30'] },
  { tabela: 'PAS / PAD (Apêndice E)', linhas: ['Recém-nascido: 60–70 / 20–60', 'Lactente: 87–105 / 53–66', 'Pré-escolar: 95–105 / 53–66', 'Escolar: 97–112 / 57–71'] },
  { tabela: 'Bolsa do manguito (Apêndice F)', linhas: ['0–1 mês: 3 cm', '2–23 meses: 5 cm', '2–4 anos: 7 cm', '5–10 anos: 12 cm', '> 10 anos: 18 cm'] },
]

export const MS_CRIANCA_TEXTO: string[] = [
  'Caso suspeito na criança: quadro febril agudo de 2 a 7 dias, sem foco aparente, em quem vive ou veio de área com transmissão (p. 55).',
  'Na criança o agravamento costuma ser súbito e o quadro grave pode ser a primeira manifestação; < 2 anos: dor como choro persistente, adinamia e irritabilidade (p. 18).',
  'Hidratação oral dos grupos A e B (< 13 anos): até 10 kg 130 mL/kg/dia; > 10 a 20 kg 100; > 20 kg 80 (Holliday-Segar + 3% de perdas); 1/3 em SRO nas primeiras 4–6 h; manter a amamentação (Quadro 3, p. 30) — igual ao livro.',
  'Grupo D (p. 36–38): SF 20 mL/kg em até 20 min, até 3 vezes; persistindo o choque com Ht em ascensão, albumina 0,5–1 g/kg a 5%; com hemorragia, CH 10–15 mL/kg/dia; coagulopatia, plasma 10 mL/kg e crioprecipitado 1 U para 5–10 kg.',
  'Via intraóssea na criança se o acesso vascular não for obtido rapidamente (p. 40).',
  'Na criança, amostra de 5 mL de sangue total para os exames de confirmação (p. 34).',
]

export const DIFERENCAS_MS_2024_PED: string[] = [
  'Expansão do grupo C: o livro dá 10 a 20 mL/kg/h até 3 vezes (Quadro 8, p. 450); o MS 2024 dá 10 mL/kg na 1ª hora e 10 mL/kg/h na 2ª, no máximo 20 mL/kg por fase em 2 h (p. 33).',
  'Manutenção do grupo C na criança: o livro usa Holliday-Segar com solução balanceada (p. 450); o MS usa SF 25 mL/kg em 6 h e 25 mL/kg em 8 h para "adulto e criança" (Figura 2, p. 27; p. 34).',
  'Grupo B → C: o livro reclassifica com Ht > 38% e/ou plaquetas < 100.000 (p. 449); o MS fala em "hemoconcentração", sem número na criança (p. 31).',
  'Analgésicos: o MS dá 10 mg/kg/dose de dipirona e de paracetamol até de 6/6 h (Apêndice H); as doses do livro estão no Apêndice do ICr.',
]

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
