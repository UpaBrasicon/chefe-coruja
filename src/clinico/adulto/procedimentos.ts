import { fichaAdulto } from './fonte.ts'

// Procedimentos do Manual de Medicina de Emergência do HCFMUSP (3ª ed., 2022):
// acessos (cap. 105, p. 1395–1414) — calibres, French e intraósseo — e
// marca-passo provisório (cap. 107, p. 1445–1459). Só adulto: as profundidades
// da agulha pediátrica por idade (p. 1413) e o sítio tibial da criança não
// entram.

export const fichaAcessosAdulto = fichaAdulto('adulto-acessos-calibres', 'Acessos: calibres, French e intraósseo (adulto)', 'cap. 105 Acessos na emergência, p. 1396–1414 (Tabelas 1 e 2)')
export const fichaMarcaPassoAdulto = fichaAdulto('adulto-marca-passo-provisorio', 'Marca-passo provisório — transcutâneo e transvenoso (adulto)', 'cap. 107 Marca-passo e dispositivos, p. 1447–1459')

export type Faixa = [number, number]
const valido = (x: number) => Number.isFinite(x) && x > 0

// ---------------------------------------------------------------------------
// French (p. 1401)

/** 1 Fr = 0,33 mm, "ou seja, 3 Fr correspondem a 1 mm" (p. 1401). */
export const MM_POR_FRENCH = 0.33

export function frenchParaMm(fr: number): { mm: number; mmPorTerco: number } | null {
  if (!valido(fr)) return null
  return { mm: fr * MM_POR_FRENCH, mmPorTerco: fr / 3 }
}

export function mmParaFrench(mm: number): number | null {
  return valido(mm) ? mm * 3 : null
}

// Calibres (Tabelas 1 e 2, p. 1396–1397)

export type Calibre = { gauge: number; cor: string; mm: number }

export const AGULHADOS: Calibre[] = [
  { gauge: 19, cor: 'Branco/marrom', mm: 1.08 },
  { gauge: 21, cor: 'Verde', mm: 0.81 },
  { gauge: 23, cor: 'Azul', mm: 0.64 },
  { gauge: 25, cor: 'Laranja', mm: 0.51 },
  { gauge: 27, cor: 'Cinza/preto', mm: 0.41 },
]

export const FLEXIVEIS: Calibre[] = [
  { gauge: 14, cor: 'Laranja', mm: 2.1 },
  { gauge: 16, cor: 'Cinza', mm: 1.7 },
  { gauge: 18, cor: 'Verde', mm: 1.3 },
  { gauge: 20, cor: 'Rosa', mm: 1.1 },
  { gauge: 22, cor: 'Azul', mm: 0.9 },
  { gauge: 24, cor: 'Amarelo', mm: 0.7 },
]

/** French equivalente ao diâmetro do cateter flexível (mm × 3), para comparar com cateteres centrais. */
export const frenchDoCalibre = (c: Calibre) => c.mm * 3

// ---------------------------------------------------------------------------
// Intraósseo (p. 1410–1414)

export type AgulhaIo = { cor: string; mm: number; faixa: string } | null

/** Agulha do dispositivo com motor pelo peso (p. 1413). Entre 39 e 40 kg o livro não tem faixa. */
export function agulhaIoMotor(pesoKg: number, subcutaneoExcessivo: boolean): { agulha: AgulhaIo; nota?: string } | null {
  if (!valido(pesoKg)) return null
  if (pesoKg >= 3 && pesoKg <= 39) return { agulha: { cor: 'Rosa', mm: 15, faixa: '3 a 39 kg' } }
  if (pesoKg > 40) {
    return subcutaneoExcessivo
      ? { agulha: { cor: 'Amarela', mm: 45, faixa: '> 40 kg e tecido subcutâneo em excesso' } }
      : { agulha: { cor: 'Azul', mm: 25, faixa: '> 40 kg e tecido subcutâneo normal' } }
  }
  return { agulha: null, nota: pesoKg < 3 ? 'Abaixo de 3 kg o livro não indica agulha.' : 'Entre 39 e 40 kg o livro não tem faixa (rosa vai até 39 kg; azul e amarela, acima de 40 kg).' }
}

/** Lidocaína sem vasopressor no paciente acordado: 0,5 mg/kg em 1-2 min + flush de 10 mL de SF; repetir 0,25 mg/kg se necessário (p. 1413). */
export const LIDOCAINA_IO = { ataqueMgKg: 0.5, repeticaoMgKg: 0.25, flushMl: 10, minutos: [1, 2] as Faixa, pagina: 'p. 1413' }

export function lidocainaIo(pesoKg: number): { ataqueMg: number; repeticaoMg: number } | null {
  if (!valido(pesoKg)) return null
  return { ataqueMg: LIDOCAINA_IO.ataqueMgKg * pesoKg, repeticaoMg: LIDOCAINA_IO.repeticaoMgKg * pesoKg }
}

export const SITIOS_IO_ADULTO = [
  { sitio: 'Tíbia proximal (1ª escolha)', local: '2 cm medial e 1 cm proximal à tuberosidade da tíbia (adolescentes e adultos)', pagina: 'p. 1411' },
  { sitio: 'Fêmur distal', local: 'linha média, 1 a 2 cm acima da patela', pagina: 'p. 1411' },
  { sitio: 'Tíbia ou fíbula distal', local: '1 a 2 cm acima do maléolo medial (1ª escolha) ou lateral', pagina: 'p. 1411' },
  { sitio: 'Úmero proximal', local: 'tubérculo maior, cerca de 2 cm abaixo do acrômio', pagina: 'p. 1411' },
  { sitio: 'Manúbrio', local: 'terço superior do esterno, com agulha específica', pagina: 'p. 1411' },
]

export const PERMANENCIA_IO_MAX_H = 24

// ---------------------------------------------------------------------------
// Marca-passo transcutâneo (p. 1447–1449)

export const MPTC = { fcPpm: [60, 80] as Faixa, margemMa: [5, 10] as Faixa, inicioDescendenteMa: 200, pontePorMin: 120, pagina: 'p. 1447–1449' }

/** Corrente final = limiar de captura + 5-10 mA (p. 1448–1449). */
export function correnteMptc(limiarMa: number): Faixa | null {
  if (!valido(limiarMa)) return null
  return [limiarMa + MPTC.margemMa[0], limiarMa + MPTC.margemMa[1]]
}

// Marca-passo transvenoso (p. 1450–1457)

export const MPTV_AS_CEGAS = {
  modo: 'V00 (assíncrono)',
  fcBpm: 60,
  saidaMaxima: '10-12 V ou 20-25 mA, dependendo do modelo',
  caboCm: 20,
  avancoComBalaoCm: 10,
  balaoArMl: 1.5,
  introdutorFr: [5, 7] as Faixa,
  caboFr: [5, 6] as Faixa,
  pagina: 'p. 1450–1456',
}

/** Sensibilidade a programar = 50% do limiar de sensibilidade (p. 1456). */
export function sensibilidadeMptv(limiarMv: number): number | null {
  return valido(limiarMv) ? limiarMv * 0.5 : null
}

/** Saída programada = 2 × limiar de comando + 1 (V ou mA); transporte com saída máxima de 10 V ou 20 mA (p. 1457). */
export function saidaMptv(limiarComando: number): number | null {
  return valido(limiarComando) ? 2 * limiarComando + 1 : null
}

export const IMA_MARCA_PASSO = { fcBpm: [65, 100] as Faixa, texto: 'Ímã no marca-passo: modo assíncrono, em geral entre 65 e 100 bpm (mais baixa quanto mais perto do fim de vida; imprevisível em EOL). No CDI, suspende a taquiterapia sem alterar a função marca-passo.', pagina: 'p. 1459' }

export const ERRATA_PROCEDIMENTOS = [
  'p. 1401 — "1 Fr = 0,33 mm, ou seja, 3 Fr = 1 mm": 3 × 0,33 = 0,99 mm. A ferramenta mostra as duas contas (× 0,33 e ÷ 3).',
  'p. 1413 — agulha com motor: "rosa de 15 mm para 3 a 39 kg" e "azul/amarela para > 40 kg": entre 39 e 40 kg não há faixa.',
  'p. 1455 — Figura 8: "cabo do marca-passo transcutâneo" em legenda de eletrograma endocavitário (é o transvenoso).',
  'p. 1457 — "2 × a corrente mínima para captura acrescido de um": a unidade do "um" (V ou mA) acompanha a do gerador.',
]
