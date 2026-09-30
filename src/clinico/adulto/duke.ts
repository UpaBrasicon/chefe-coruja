import type { Escore, Item, Respostas } from '../escore.ts'
import { fichaAdulto } from './fonte.ts'

// Critérios de Duke modificados como o Manual de Medicina de Emergência do
// HCFMUSP (3ª ed., 2022) traz: Tabela 2 do cap. 23 (p. 324–326). O livro dá só
// a regra do diagnóstico definido (2 maiores, 1 maior + 3 menores ou 5
// menores); as categorias "possível" e "rejeitada" do artigo original não
// estão no livro e não aparecem. Duke-ISCVID 2023 fica para o RT.

const maior = (id: string, rotulo: string): Item => ({ tipo: 'marca', id, rotulo, pontos: 1, grupo: 'Critérios maiores' })
const menor = (id: string, rotulo: string): Item => ({ tipo: 'marca', id, rotulo, pontos: 1, grupo: 'Critérios menores' })

const MAIORES = ['microbiologico', 'endocardico']
const MENORES = ['predisposicao', 'febre', 'vascular', 'imunologico', 'hemocultura', 'outros']
const conta = (r: Respostas, ids: string[]) => ids.filter((i) => r[i] === true).length

/** Regra do livro: 2 maiores, ou 1 maior e 3 menores, ou 5 menores. */
export function preencheDuke(maiores: number, menores: number): boolean {
  return maiores >= 2 || (maiores >= 1 && menores >= 3) || menores >= 5
}

export const ERRATA_DUKE = [
  'Na p. 326 a continuação da Tabela 2 repete o cabeçalho "Critérios maiores" acima dos itens 3 a 6, que são critérios menores (continuação da numeração da p. 325).',
  '"Proteína C-reativa > 100 mg/dL" (item 6): a unidade provável é mg/L; mostrado como impresso.',
  'O item 6 ("outros critérios": esplenomegalia, PCR, baqueteamento digital) é contado como um critério menor, como o livro o numera.',
]

export const duke: Escore = {
  ficha: {
    ...fichaAdulto('adulto-duke-modificado', 'Critérios de Duke modificados — endocardite infecciosa (adulto)', 'cap. 23 Endocardite infecciosa, p. 324–326 (Tabela 2)'),
    versao: '2026-09-30.1',
    revisadoEm: '30/09/2026 (conferido no texto do livro; aguarda aprovação do RT)',
  },
  descricao: 'Dois critérios maiores e seis menores da Tabela 2 do manual do HC. Diagnóstico com 2 maiores, 1 maior e 3 menores, ou 5 menores.',
  itens: [
    maior('microbiologico', 'Microbiológico: agente típico em duas hemoculturas distintas (S. aureus, estreptococo viridans, S. gallolyticus, HACEK, enterococo comunitário sem foco primário), hemoculturas persistentemente positivas, ou cultura/sorologia (IgG > 1:800) para Coxiella burnetii'),
    maior('endocardico', 'Envolvimento endocárdico: ecocardiograma positivo (vegetação, abscesso ou nova deiscência parcial de prótese) ou sopro valvar novo (aumento ou mudança de sopro prévio não conta)'),
    menor('predisposicao', 'Predisposição: droga injetável ou cardiopatia compatível (valvopatia com insuficiência importante, turbulência de fluxo, prótese)'),
    menor('febre', 'Febre ≥ 38 °C'),
    menor('vascular', 'Fenômenos vasculares: embolia arterial importante, infarto pulmonar séptico, aneurisma micótico, hemorragia intracraniana ou conjuntival, lesões de Janeway'),
    menor('imunologico', 'Fenômenos imunológicos: fator reumatoide, glomerulonefrite, nódulos de Osler, manchas de Roth'),
    menor('hemocultura', 'Hemocultura positiva que não preenche critério maior, ou sorologia de infecção ativa (exclui cultura única de estafilococo coagulase-negativo ou de germe que raramente causa endocardite)'),
    menor('outros', 'Outros: esplenomegalia, proteína C-reativa > 100 mg/dL (sic), baqueteamento digital de início recente'),
  ],
  calcular(r) {
    const ma = conta(r, MAIORES)
    const me = conta(r, MENORES)
    const ok = preencheDuke(ma, me)
    return {
      rotulo: 'Duke modificado',
      valor: `${ma} maior${ma === 1 ? '' : 'es'} · ${me} menor${me === 1 ? '' : 'es'}`,
      nota: ok ? 'Preenche a regra de diagnóstico do livro' : 'Não preenche a regra de diagnóstico do livro',
      estado: ok ? 2 : 0,
      derivados: [['Regra da Tabela 2 (p. 324)', '2 maiores, ou 1 maior e 3 menores, ou 5 menores']],
      cuidados: [
        'O livro não traz as categorias "possível" e "rejeitada": não preencher a regra não exclui endocardite.',
        'Ecocardiograma transesofágico se o transtorácico for negativo com suspeita importante, imagem ruim, prótese ou dispositivo (p. 324).',
        ...ERRATA_DUKE.map((e) => `Errata: ${e}`),
        'Sem referência pediátrica declarada.',
      ],
    }
  },
}
