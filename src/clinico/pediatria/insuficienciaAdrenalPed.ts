import { fichaP4 } from './fonteP4.ts'
import type { Faixa } from './fonteP2.ts'
import { porPeso, porSC, positivoP5, type ItemLivro } from './fonteP5.ts'

// Crise adrenal — livro do ICr, cap. 53 "Insuficiência adrenal" (p. 527–531).
// Hidrocortisona por SUPERFÍCIE CORPÓREA (75 a 100 mg/m² em bolo e 75 a 100
// mg/m²/dia de 6/6 h, reduzindo para 75 e até 50 mg/m²/dia), expansão de 20
// mL/kg e 9α-fluor-hidrocortisona 100 a 200 µg. A superfície corpórea é
// informada pelo médico (o livro não traz fórmula). A alternativa por peso do
// Apêndice (2 a 3 mg/kg) já está em `bolus.ts` e é só reaproveitada na tela.

export const fichaInsuficienciaAdrenalPed = fichaP4('ped-insuficiencia-adrenal', 'Crise adrenal — hidrocortisona por m²', 'cap. 53, p. 527–531; Apêndice, p. 902–903')

/** Bolo inicial EV (ou IM): 75 a 100 mg/m² (p. 530). */
export const hidrocortisonaBolusMg = (scM2: number) => porSC([75, 100], scM2)

/** Manutenção EV: 75 a 100 mg/m²/dia dividida de 6/6 h (p. 530). */
export function hidrocortisonaManutencao(scM2: number): { dia: Faixa; porDose: Faixa } | null {
  const dia = porSC([75, 100], scM2)
  return dia ? { dia, porDose: [dia[0] / 4, dia[1] / 4] } : null
}

/** Redução gradual: para 75 e até 50 mg/m²/dia, quando pode passar para VO (p. 530). */
export const hidrocortisonaReducao = (scM2: number) => porSC([50, 75], scM2)

/**
 * 9α-fluor-hidrocortisona 100 a 200 µg VO/SNG 1x/dia (p. 530); dispensável se a
 * hidrocortisona EV passa de 50 mg em 24 h. Devolve null sem dose diária informada.
 */
export function fludrocortisonaDispensavel(hidrocortisonaMgDia: number): boolean | null {
  return positivoP5(hidrocortisonaMgDia) ? hidrocortisonaMgDia > 50 : null
}

export const FLUDROCORTISONA_UG: Faixa = [100, 200]

/** Expansão: SF 20 mL/kg a cada 20 minutos até remissão do choque (p. 530). */
export const expansaoAdrenalMl = (pesoKg: number) => porPeso([20, 20], pesoKg)

export const NOTA_APENDICE =
  'Apêndice (p. 903): hidrocortisona na insuficiência adrenal aguda 2 a 3 mg/kg/dose e manutenção 1 a 5 mg/kg/dose 4x ao dia (máx. 100 mg/dose). O capítulo usa mg/m²; as duas referências são do mesmo livro e são mostradas lado a lado, sem converter uma na outra.'

export const NOTA_FLUDRO_APENDICE =
  'Apêndice (p. 902): fludrocortisona 0,05 a 0,2 mg/dia (1 ou 2x/dia) ou 150 a 250 µg/m²/dia. O capítulo dá 100 a 200 µg 1x/dia na crise.'

export const REFERENCIAS_ADRENAL: ItemLivro[] = [
  { texto: 'Crise adrenal: deterioração aguda com hipotensão absoluta ou relativa que melhora com glicocorticoide parenteral — hipotensão em até 1 h e sinais/sintomas em até 2 h. Sem melhora da hipotensão em 1 h, pensar em outra causa.', pagina: 'p. 527' },
  { texto: 'Suspeitar em insuficiência adrenal conhecida, interrupção abrupta de corticoterapia prolongada ou choque refratário às medidas habituais.', pagina: 'p. 528–529' },
  { texto: 'Laboratório: hiponatremia (> 90%), hipercalemia (50%), hipoglicemia, acidose metabólica, redução moderada da função renal, hipercalcemia, anemia, eosinofilia, linfocitose.', pagina: 'p. 528' },
  { texto: 'Colher hemograma, sódio, potássio, glicemia, gasometria venosa, ureia e creatinina (e culturas se infecção); cortisol e ACTH não mudam a abordagem inicial. O tratamento começa com a hipótese.', pagina: 'p. 529' },
]
