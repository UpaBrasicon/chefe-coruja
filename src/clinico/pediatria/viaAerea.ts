import { MANUAL_HC } from '../adulto/fonte.ts'
import type { Ficha } from '../ficha.ts'
import { CITACAO_PS_PED, DIAS_ANO, DIAS_MES, type DosePeso } from './fonteP2.ts'

// Via aérea pediátrica — livro do ICr (cap. 4, SRI; cap. 13, equipamento por
// idade e peso). Fórmulas do tubo com e sem cuff e profundidade (p. 75),
// equipamento das Tabelas 2 e 3 do cap. 13 (p. 150–151), fluxo de O₂ na apneia
// (p. 69) e doses das Tabelas 1 e 2 do cap. 4 (p. 69–70), com o texto do
// capítulo onde ele difere da tabela.
//
// O manual de emergência do HCFMUSP (Anexo 2, p. 1494) traz a mesma fórmula do
// tubo sem cuff, (idade/4) + 4; fica como segunda fonte, concordante.

export const fichaViaAereaPediatrica: Ficha = {
  id: 'ped-via-aerea',
  titulo: 'Via aérea pediátrica — tubo, equipamento e SRI',
  versao: '2026-09-27.3',
  publico: 'pediatrico',
  fontes: [
    { citacao: `${CITACAO_PS_PED} cap. 4, p. 67–78; cap. 13, p. 150–151.`, pediatrica: true },
    { citacao: `${MANUAL_HC.citacao} Anexo 2, p. 1494 (tubo sem cuff, mesma fórmula).`, pediatrica: true },
  ],
  revisadoEm: '27/09/2026 (conferido no livro, com errata anotada)',
}

// ── Tubo pela idade (p. 75) ──

export type Tubo = {
  /** diâmetro interno pela fórmula, em mm */
  calculadoMm: number
  /** tubos de 0,5 em 0,5 mm vizinhos ao valor calculado (um só se cair exato) */
  vizinhosMm: number[]
}

export type TuboIdade = {
  semCuff: Tubo
  comCuff: Tubo
}

const vizinhos = (x: number) => {
  const a = Math.floor(x * 2) / 2
  const b = Math.ceil(x * 2) / 2
  return a === b ? [a] : [a, b]
}

/**
 * Sem cuff: (idade/4) + 4; com cuff: (idade/4) + 3,5 — idade em anos completos
 * (1 a 13). O livro não diz como arredondar; a tela mostra o calculado e os
 * tamanhos vizinhos.
 */
export function tuboPorIdade(anos: number): TuboIdade | null {
  if (!Number.isFinite(anos) || anos < 1 || anos >= 14) return null
  const sem = anos / 4 + 4
  const com = anos / 4 + 3.5
  return {
    semCuff: { calculadoMm: sem, vizinhosMm: vizinhos(sem) },
    comCuff: { calculadoMm: com, vizinhosMm: vizinhos(com) },
  }
}

/** Profundidade na marca do lábio superior = 3 × diâmetro interno (p. 75), para o tubo adequado ao tamanho. */
export function profundidadeCm(diametroMm: number): number | null {
  if (!Number.isFinite(diametroMm) || diametroMm <= 0) return null
  return 3 * diametroMm
}

// ── Equipamento por idade e peso (cap. 13, Tabelas 2 e 3, p. 150–151) ──

export type LinhaEquipamento = {
  rotulo: string
  /** idade em dias: início incluído, fim excluído; null na linha do prematuro */
  de: number | null
  ate: number | null
  mascaraO2: string
  guedel: string
  laringoscopio: string
  tubo: string
  manguito: string
  jelco: string
  sondaGastrica: string
  drenoTorax: string
  foley: string
  colarCervical: string
}

const M = DIAS_MES
const A = DIAS_ANO

export const EQUIPAMENTO: LinhaEquipamento[] = [
  { rotulo: 'Prematuro — 3 kg', de: null, ate: null, mascaraO2: 'Prematuro/neonato', guedel: 'Infantil', laringoscopio: '0, lâmina reta', tubo: '2,5–3,0 sem cuff', manguito: 'Prematuro/neonato', jelco: '22–24', sondaGastrica: '8', drenoTorax: '10–14', foley: '5', colarCervical: '—' },
  { rotulo: '0–6 meses — 3,5 kg', de: 0, ate: 6 * M, mascaraO2: 'Neonato', guedel: 'Infantil/pequena', laringoscopio: '1, lâmina reta', tubo: '3,0–3,5 sem cuff', manguito: 'Neonato/infantil', jelco: '22', sondaGastrica: '10', drenoTorax: '12–18', foley: '5–8', colarCervical: '—' },
  { rotulo: '6–12 meses — 7 kg', de: 6 * M, ate: 1 * A, mascaraO2: 'Pediátrica', guedel: 'Pequena', laringoscopio: '1, lâmina reta/curva', tubo: '3,5–4,0 com ou sem cuff', manguito: 'Infantil', jelco: '22', sondaGastrica: '12', drenoTorax: '14–20', foley: '8', colarCervical: 'Pequeno' },
  { rotulo: '1–3 anos — 10–12 kg', de: 1 * A, ate: 4 * A, mascaraO2: 'Pediátrica', guedel: 'Pequena', laringoscopio: '1, lâmina curva', tubo: '4,0–4,5 com ou sem cuff', manguito: 'Infantil', jelco: '22–20', sondaGastrica: '12', drenoTorax: '14–24', foley: '10', colarCervical: 'Pequeno' },
  { rotulo: '4–7 anos — 16–18 kg', de: 4 * A, ate: 8 * A, mascaraO2: 'Pediátrica', guedel: 'Média', laringoscopio: '2, lâminas curvas', tubo: '5,0–5,5 sem cuff', manguito: 'Infantil', jelco: '20', sondaGastrica: '12', drenoTorax: '20–28', foley: '10–12', colarCervical: 'Pequeno' },
  { rotulo: '8–10 anos — 24–30 kg', de: 8 * A, ate: 11 * A, mascaraO2: 'Adulto', guedel: 'Média/grande', laringoscopio: '2–3, lâminas curvas', tubo: '5,5–6,5 com cuff', manguito: 'Infantil/adulto', jelco: '20–18', sondaGastrica: '14', drenoTorax: '28–32', foley: '12', colarCervical: 'Médio' },
]

/** Linha da tabela para a idade em dias; acima de 10 anos o livro não traz linha. */
export function equipamentoPorIdade(dias: number): LinhaEquipamento | null {
  if (!Number.isFinite(dias) || dias < 0) return null
  return EQUIPAMENTO.find((l) => l.de !== null && l.ate !== null && dias >= l.de && dias < l.ate) ?? null
}

// ── Oxigênio na apneia durante a SRI (p. 69) ──

/** Cateter nasal durante a apneia: 5 L/min abaixo de 1 ano; 10 L/min de 1 a 7 anos; 15 L/min acima de 7. */
export function fluxoApneia(dias: number): number | null {
  if (!Number.isFinite(dias) || dias < 0) return null
  if (dias < A) return 5
  return Math.floor(dias / A) <= 7 ? 10 : 15
}

// ── Doses da SRI (Tabelas 1 e 2, p. 69–70; texto p. 71–73) ──

export const DOSES_SRI: DosePeso[] = [
  { id: 'atropina', nome: 'Atropina', unidade: 'mg', porKg: [0.02, 0.02], maximo: 1, via: 'IV; não é de rotina (p. 71)', pagina: 'p. 71',
    nota: 'O livro diz "sem dose mínima". O Anexo 2 do manual HCFMUSP usa mínimo de 0,1 mg.' },
  { id: 'fentanil', nome: 'Fentanil', unidade: 'µg', porKg: [2, 7], via: 'IV; início 1 min, duração 30–60 min', pagina: 'p. 70 (Tabela 1)' },
  { id: 'tiopental', nome: 'Tiopental', unidade: 'mg', porKg: [2, 5], via: 'IV', pagina: 'p. 69 (Tabela 1)' },
  { id: 'quetamina', nome: 'Quetamina', unidade: 'mg', porKg: [1, 4], via: 'IV', pagina: 'p. 69 (Tabela 1)' },
  { id: 'diazepam', nome: 'Diazepam', unidade: 'mg', porKg: [0.2, 0.4], via: 'IV', pagina: 'p. 69 (Tabela 1)' },
  { id: 'midazolam', nome: 'Midazolam', unidade: 'mg', porKg: [0.1, 0.4], via: 'IV', pagina: 'p. 70 (Tabela 1)',
    nota: 'O texto (p. 72) cita 0,3 mg/kg como a dose em geral empregada na SRI.' },
  { id: 'etomidato', nome: 'Etomidato', unidade: 'mg', porKg: [0.2, 0.4], via: 'IV', pagina: 'p. 70 (Tabela 1)' },
  { id: 'propofol', nome: 'Propofol', unidade: 'mg', porKg: [1, 2], via: 'IV', pagina: 'p. 70 (Tabela 1)' },
  { id: 'rocuronio', nome: 'Rocurônio', unidade: 'mg', porKg: [0.9, 1.2], via: 'IV', pagina: 'p. 70 (Tabela 2)',
    nota: 'O texto (p. 73) diz que 1 mg/kg dá melhores condições de intubação que 0,6 mg/kg.' },
  { id: 'vecuronio', nome: 'Vecurônio', unidade: 'mg', porKg: [0.15, 0.2], via: 'IV', pagina: 'p. 70 (Tabela 2)' },
  { id: 'succinilcolina-menor10', nome: 'Succinilcolina — menos de 10 kg', unidade: 'mg', porKg: [1, 2], via: 'IV (pode IM)', pagina: 'p. 70 (Tabela 2)',
    errata: 'A Tabela 2 separa "< 10 kg" e "> 10 kg"; 10 kg exatos não têm linha no livro.' },
  { id: 'succinilcolina-maior10', nome: 'Succinilcolina — mais de 10 kg', unidade: 'mg', porKg: [1, 1.5], via: 'IV (pode IM)', pagina: 'p. 70 (Tabela 2)',
    errata: 'A Tabela 2 separa "< 10 kg" e "> 10 kg"; 10 kg exatos não têm linha no livro.' },
]

/** Succinilcolina: linha da tabela pelo peso; 10 kg exatos ficam sem linha (errata). */
export function succinilcolinaAplica(id: string, pesoKg: number): boolean {
  if (id === 'succinilcolina-menor10') return pesoKg < 10
  if (id === 'succinilcolina-maior10') return pesoKg > 10
  return true
}

export const NOTAS_SRI: { texto: string; pagina: string }[] = [
  { texto: 'Pré-oxigenação por 2 a 5 minutos com máscara na maior concentração disponível (o checklist do Quadro 5 cita 3 minutos).', pagina: 'p. 69, 76' },
  { texto: 'Intubação 60 a 90 segundos após o bloqueador neuromuscular.', pagina: 'p. 74' },
  { texto: 'Interromper a laringoscopia se não intubar em 20 a 30 s ou se a saturação cair abaixo de 90%.', pagina: 'p. 76 (Quadro 5)' },
  { texto: 'Menores de 2 anos: coxim sob os ombros; maiores de 2 anos: coxim sob a cabeça.', pagina: 'p. 74 (Figuras 1 e 2)' },
  { texto: 'Tubo com cuff: introduzir até o cuff ficar abaixo das cordas vocais. A regra da profundidade (3 × diâmetro) não vale se for preciso usar cânula menor ou maior que a adequada.', pagina: 'p. 75' },
  { texto: 'Defasciculação: 10% da dose habitual de vecurônio, pancurônio ou succinilcolina antes da succinilcolina, acima de 5 anos.', pagina: 'p. 71' },
]
