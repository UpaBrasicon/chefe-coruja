import type { Fonte } from '../ficha.ts'
import type { Escore, Item, Respostas } from '../escore.ts'
import { fichaAdulto, pagina } from './fonte.ts'

// Endocardite infecciosa — critérios de Duke-ISCVID 2023 (revisão PubMed de
// 09/10/2026, decisão do RT: trocar a fonte). O Manual de Medicina de
// Emergência do HCFMUSP (3ª ed., 2022) traz o Duke modificado de 2000 na
// Tabela 2 do cap. 23 (p. 324–326); ele continua citado como referência, com a
// errata. O Duke-ISCVID 2023 (Fowler et al., Clin Infect Dis 2023) muda:
// - microbiologia: lista de típicos ampliada e outros típicos com prótese;
//   hemoculturas sem exigência de tempo ou de punções separadas;
// - imagem: TC cardíaca e PET-CT com 18F-FDG;
// - novo critério maior cirúrgico;
// - categorias "possível" e "rejeitada".
// Itens conferidos na página da revista (academic.oup.com, CID 77(4):518–526).

export const DUKE_ISCVID_2023: Fonte = {
  citacao: 'Fowler VG Jr, Durack DT, Selton-Suty C, et al. The 2023 Duke-International Society for Cardiovascular Infectious Diseases Criteria for Infective Endocarditis: Updating the Modified Duke Criteria. Clin Infect Dis. 2023;77(4):518–526 (PMID 37138445).',
  url: 'https://doi.org/10.1093/cid/ciad271',
}

const maior = (id: string, rotulo: string): Item => ({ tipo: 'marca', id, rotulo, pontos: 1, grupo: 'Critérios maiores' })
const menor = (id: string, rotulo: string): Item => ({ tipo: 'marca', id, rotulo, pontos: 1, grupo: 'Critérios menores' })

const MAIORES = ['microbiologico', 'imagem', 'cirurgico']
const MENORES = ['predisposicao', 'febre', 'vascular', 'imunologico', 'microbiologico_menor', 'imagem_menor', 'exame_fisico']
const conta = (r: Respostas, ids: string[]) => ids.filter((i) => r[i] === true).length

/** Definida pela clínica: 2 maiores, ou 1 maior e 3 menores, ou 5 menores (igual no livro e no Duke-ISCVID 2023). */
export function preencheDuke(maiores: number, menores: number): boolean {
  return maiores >= 2 || (maiores >= 1 && menores >= 3) || menores >= 5
}

/** Duke-ISCVID 2023: possível com 1 maior e 1 menor, ou 3 menores. */
export function possivelDuke(maiores: number, menores: number): boolean {
  return (maiores >= 1 && menores >= 1) || menores >= 3
}

export type ClasseDuke = 'definida' | 'possivel' | 'nao_preenche'

export function classificarDuke(maiores: number, menores: number, patologico: boolean): ClasseDuke {
  if (patologico || preencheDuke(maiores, menores)) return 'definida'
  return possivelDuke(maiores, menores) ? 'possivel' : 'nao_preenche'
}

export const ERRATA_DUKE = [
  'Na p. 326 a continuação da Tabela 2 repete o cabeçalho "Critérios maiores" acima dos itens 3 a 6, que são critérios menores (continuação da numeração da p. 325).',
  '"Proteína C-reativa > 100 mg/dL" (item 6): a unidade provável é mg/L; mostrado como impresso.',
]

export const duke: Escore = {
  ficha: {
    ...fichaAdulto('adulto-duke-modificado', 'Endocardite infecciosa — critérios de Duke-ISCVID 2023 (adulto)', 'cap. 23 Endocardite infecciosa, p. 324–326 (Tabela 2, Duke modificado de 2000, como referência)'),
    versao: '2026-10-09.1',
    fontes: [
      DUKE_ISCVID_2023,
      pagina('cap. 23 Endocardite infecciosa, p. 324–326 (Tabela 2, Duke modificado de 2000, como referência)'),
    ],
    revisadoEm: '09/10/2026 (Duke-ISCVID 2023 conferido na página da revista; livro mantido como referência)',
  },
  descricao: 'Critérios de Duke-ISCVID 2023: definida com critério patológico, 2 maiores, 1 maior e 3 menores, ou 5 menores; possível com 1 maior e 1 menor, ou 3 menores.',
  itens: [
    { tipo: 'marca', id: 'patologico', rotulo: 'Critério patológico: micro-organismo (cultura, coloração, imunologia, PCR, sequenciamento ou hibridização in situ) ou histologia de endocardite ativa em vegetação, tecido cardíaco, prótese valvar ou anel, enxerto de aorta ascendente com envolvimento valvar, dispositivo endovascular ou êmbolo arterial', pontos: 1, grupo: 'Critério patológico' },
    maior('microbiologico', 'Microbiológico: típico em ≥ 2 sets de hemocultura separados (S. aureus, S. lugdunensis, E. faecalis, estreptococos exceto S. pneumoniae e S. pyogenes, Granulicatella, Abiotrophia, Gemella, HACEK; com prótese intracardíaca também estafilococo coagulase-negativo, C. striatum, C. jeikeium, S. marcescens, P. aeruginosa, C. acnes, micobactéria não tuberculosa e Candida); não típico em ≥ 3 sets; PCR ou sequenciamento no sangue para C. burnetii, Bartonella ou T. whipplei; C. burnetii IgG fase I > 1:800 ou isolado em uma hemocultura; IFA para B. henselae ou B. quintana com IgG ≥ 1:800. Não se exige intervalo nem punção separada'),
    maior('imagem', 'Imagem: eco e/ou TC cardíaca com vegetação, perfuração ou aneurisma de folheto, abscesso, pseudoaneurisma ou fístula; regurgitação valvar significativa nova (piora de prévia não conta); nova deiscência parcial de prótese; PET-CT com 18F-FDG com captação anormal em valva, enxerto, eletrodos ou outra prótese (na prótese valvar, só ≥ 3 meses após a cirurgia)'),
    maior('cirurgico', 'Cirúrgico: endocardite vista na inspeção direta durante cirurgia cardíaca, sem critério maior de imagem nem confirmação histológica ou microbiológica posterior'),
    menor('predisposicao', 'Predisposição: endocardite prévia, prótese valvar, reparo valvar prévio, cardiopatia congênita, regurgitação ou estenose mais que leve, dispositivo cardíaco endovascular, cardiomiopatia hipertrófica obstrutiva ou uso de droga injetável'),
    menor('febre', 'Febre: temperatura > 38,0 °C'),
    menor('vascular', 'Fenômenos vasculares: êmbolo arterial, infarto pulmonar séptico, abscesso cerebral ou esplênico, aneurisma micótico, hemorragia intracraniana ou conjuntival, lesões de Janeway, púrpura purulenta'),
    menor('imunologico', 'Fenômenos imunológicos: fator reumatoide positivo, nódulos de Osler, manchas de Roth ou glomerulonefrite por imunocomplexo'),
    menor('microbiologico_menor', 'Microbiológico sem critério maior: hemocultura com germe compatível; cultura, PCR ou sequenciamento de germe compatível em sítio estéril fora do coração; bactéria de pele isolada por PCR em valva ou eletrodo sem outro dado'),
    menor('imagem_menor', 'Imagem: PET-CT com 18F-FDG anormal até 3 meses depois do implante de prótese valvar, enxerto, eletrodos ou outra prótese'),
    menor('exame_fisico', 'Exame físico: regurgitação valvar nova na ausculta, só quando não há ecocardiograma (piora de sopro não basta)'),
  ],
  calcular(r) {
    const ma = conta(r, MAIORES)
    const me = conta(r, MENORES)
    const classe = classificarDuke(ma, me, r.patologico === true)
    const rotuloClasse = { definida: 'Endocardite definida', possivel: 'Endocardite possível', nao_preenche: 'Não preenche "possível"' }[classe]
    return {
      rotulo: 'Duke-ISCVID 2023',
      valor: `${ma} maior${ma === 1 ? '' : 'es'} · ${me} menor${me === 1 ? '' : 'es'}${r.patologico === true ? ' · critério patológico' : ''}`,
      nota: rotuloClasse,
      estado: classe === 'definida' ? 2 : classe === 'possivel' ? 1 : 0,
      derivados: [
        ['Definida', 'critério patológico, 2 maiores, 1 maior e 3 menores, ou 5 menores'],
        ['Possível', '1 maior e 1 menor, ou 3 menores'],
      ],
      cuidados: [
        'Rejeitada só com diagnóstico alternativo firme, resolução com menos de 4 dias de antibiótico, ausência de endocardite na cirurgia ou necropsia com menos de 4 dias de antibiótico, ou quando não preenche "possível".',
        'Colher ao menos 2 sets de hemocultura no adulto com suspeita (punções separadas continuam recomendadas quando possível).',
        'Livro (Duke modificado de 2000, Tabela 2, p. 324–326): mesma regra de "definida"; não traz "possível" nem "rejeitada", nem TC cardíaca, PET-CT ou critério cirúrgico.',
        'Ecocardiograma transesofágico se o transtorácico for negativo com suspeita importante, imagem ruim, prótese ou dispositivo (livro, p. 324).',
        ...ERRATA_DUKE.map((e) => `Errata do livro: ${e}`),
        'Sem referência pediátrica declarada.',
      ],
    }
  },
}
