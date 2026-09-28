import { fichaP4, type DoseLivro } from './fonteP4.ts'
import type { Faixa } from './fonteP2.ts'
import { positivoP5, type ItemLivro } from './fonteP5.ts'

// Coma (cap. 37, p. 368–377) e hipertensão intracraniana (cap. 41, p. 415–422)
// na criança — livro do ICr. Só o que não está na ferramenta de TCE (cap. 16):
// escore GCS-Pupilas, PPC e metas por idade (Tabela 9), PIC normal, bainha do
// nervo óptico (Tabela 7), glicose e midazolam do algoritmo do coma e
// dexametasona do edema vasogênico. A Glasgow pediátrica e as doses
// hiperosmolares do TCE já estão em `tceDecisao.ts`. Sem valor neonatal.

export const fichaComaHicPed = fichaP4('ped-coma-hic', 'Coma e hipertensão intracraniana — criança', 'cap. 37, p. 368–377; cap. 41, p. 415–422; Apêndice, p. 896')

/** Escore de resposta pupilar (p. 374): ambas não reativas = 2; uma = 1; nenhuma = 0. GCS-P = Glasgow − escore. */
export function gcsPupilas(glasgow: number, pupilasNaoReativas: 0 | 1 | 2): number | null {
  if (!Number.isInteger(glasgow) || glasgow < 3 || glasgow > 15) return null
  return glasgow - pupilasNaoReativas
}

/** PPC = PAM − PIC (p. 416). */
export function ppc(pam: number, pic: number): number | null {
  return positivoP5(pam) && Number.isFinite(pic) && pic >= 0 ? pam - pic : null
}

/** Tabela 9 (p. 421): PPC adequada — 0 a 5 anos 40–50 mmHg; 6 a 17 anos 50–60 mmHg (anos completos). */
export function ppcAlvo(anosCompletos: number): Faixa | null {
  if (!Number.isFinite(anosCompletos) || anosCompletos < 0) return null
  return anosCompletos <= 5 ? [40, 50] : [50, 60]
}

/** PIC normal na criança: 9 a 21 mmHg (12 a 28 cmH2O) (p. 415). */
export const PIC_NORMAL_MMHG: Faixa = [9, 21]

/** Tabela 7 (p. 419–420): diâmetro da bainha do nervo óptico. Aos 12 meses exatos a tabela não define. */
export function bainhaOpticaCorte(idadeMeses: number, fontanelaAberta: boolean): { corteMm: number; sensEsp: string } | 'indefinido' | null {
  if (!Number.isFinite(idadeMeses) || idadeMeses < 0) return null
  if (idadeMeses < 12 || fontanelaAberta) return { corteMm: 5.2, sensEsp: '85%/76%' }
  if (idadeMeses === 12) return 'indefinido'
  return { corteMm: 5.8, sensEsp: '86%/70%' }
}

export const DOSES_COMA: DoseLivro[] = [
  { id: 'glicose25', nome: 'Glicose 25% — hipoglicemia ou glicemia indisponível', unidade: 'mL', porKgDose: [2, 4], via: 'EV (0,5 a 1 g/kg de glicose)', pagina: 'p. 375; Figura 2, p. 376' },
  { id: 'midazolam', nome: 'Midazolam — estado de mal epiléptico (algoritmo do coma)', unidade: 'mg', porKgDose: [0.2, 0.2], maxDose: 10, fonteMaximo: 'máx. do Apêndice: 10 mg (IM e IV > 5 anos); IV < 5 anos: 6 mg (p. 896)', via: 'IV ou IM; prosseguir com o algoritmo de EME', pagina: 'Figura 2, p. 376',
    nota: 'Em menores de 5 anos por via IV o Apêndice limita a 6 mg; confira a via e a idade.' },
  { id: 'dexa-hic', nome: 'Dexametasona — edema vasogênico (tumores, abscessos)', unidade: 'mg', porKgDose: [0.25, 0.5], doses: [4, 4], maxDia: 16, via: 'a cada 6 horas; sem indicação em infartos, hemorragias ou trauma', pagina: 'p. 421' },
]

export const METAS_HIC: ItemLivro[] = [
  { texto: 'Cabeça elevada e centralizada na linha média (ver errata sobre "15 a 30%").', pagina: 'p. 420' },
  { texto: 'Intubação: hipóxia refratária, hipoventilação, Glasgow < 8 (ou < 12 em declínio rápido), perda de reflexos protetores, sinais de herniação.', pagina: 'p. 420' },
  { texto: 'PaCO2 entre 35 e 40 mmHg; 30 a 35 mmHg só temporariamente até medida definitiva; < 30 mmHg apenas na herniação aguda.', pagina: 'p. 420–421' },
  { texto: 'Punção lombar com pressão > 20 mmHg (27 cmH2O) confirma HIC idiopática — só depois de a imagem afastar lesão expansiva.', pagina: 'p. 419' },
  { texto: 'Anticonvulsivante profilático (fenitoína, fenobarbital ou levetiracetam) em lesão parenquimatosa, fratura com contusão ou TCE grave.', pagina: 'p. 421' },
  { texto: 'Solução salina 3% com mais benefício que manitol 20% em HIC infecciosa e no TCE grave (doses: ferramenta de TCE).', pagina: 'p. 421' },
  { texto: 'Evitar: nitroprussiato, solução hipotônica, cetamina e propofol contínuo > 12 h (Tabela 10).', pagina: 'p. 422' },
  { texto: 'Bainha do nervo óptico > 5 mm corresponderia a PIC > 20 mmHg (sensibilidade 95%, especificidade 87% no ultrassom).', pagina: 'p. 419' },
]

export const METAS_COMA: ItemLivro[] = [
  { texto: 'Via aérea avançada com Glasgow < 8 se o tratamento etiológico não for imediato, ou na suspeita de HIC.', pagina: 'p. 374' },
  { texto: 'Hiperventilação na HIC mantendo pCO2 entre 30 e 35 mmHg; cabeceira a 30°.', pagina: 'p. 374–375' },
  { texto: 'Bradicardia com alteração do ritmo respiratório e PA alta indica HIC grave com risco de herniação.', pagina: 'p. 375' },
  { texto: 'Suspeita infecciosa: ceftriaxona + vancomicina + aciclovir até o LCR (Figura 2); LCR só após TC de crânio.', pagina: 'p. 376' },
  { texto: 'Glasgow pediátrica modificada (James, 1985): Tabela 5 — a mesma escala está na ferramenta de TCE.', pagina: 'p. 373–374' },
]

export const ERRATAS_COMA_HIC: string[] = [
  'p. 420 (conferido no PDF): "cabeça deve ser mantida elevada de 15 a 30%" — o sinal "%" não cabe; o cap. 37 fala em cabeceira a 30° (p. 375) e o cap. 36 em 20 a 30° (p. 364).',
  'p. 417: "FSC + PPC/RVC" — pelo texto (FSC diretamente relacionado à PPC e inversamente à RVC), o sinal deveria ser "=". Não usado em cálculo.',
]
