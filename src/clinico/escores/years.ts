import { completo, numero, somar, type Escore } from '../escore.ts'
import type { Fonte } from '../ficha.ts'

// YEARS: três itens e o limiar de D-dímero que depende deles (van der Hulle
// 2017). Entrou em 28/09/2026 por decisão do RT. O YEARS do protótipo usava
// "neoplasia" como terceiro item; o artigo usa "TEP como diagnóstico mais
// provável", e é esse que vale aqui. A tela não emite conduta (ADR 0007):
// mostra o limiar e diz como o estudo leu o D-dímero abaixo dele.
// Versão de 06/11/2026 (revisão PubMed, itens médios): nota do ECR Hydra no
// câncer ativo (JAMA 2026), pelo resumo. Itens e limiares não mudam.

const ns = [{ rotulo: 'Não', valor: 0 }, { rotulo: 'Sim', valor: 1 }]
const fmt = (x: number) => String(Math.round(x)).replace(/\B(?=(\d{3})+(?!\d))/g, '.')

export const HYDRA_YEARS_CANCER_2026: Fonte = {
  citacao: 'Akerboom B, Martens ESL, Stals MAM, et al. YEARS Algorithm for Diagnosis of Suspected Pulmonary Embolism in Patients With Cancer: A Randomized Clinical Trial. JAMA. 2026;336(8):655–663 (PMID 42437322).',
  url: 'https://doi.org/10.1001/jama.2026.10676',
}

export const NOTA_YEARS_CANCER =
  'Câncer ativo (Hydra, JAMA 2026): ECR com 698 pacientes com câncer ativo e suspeita de TEP. O YEARS foi não inferior à angio-TC: TEV sintomático ou morte possivelmente por TEP em 90 dias, após excluir TEP, em 1,8% vs 5,5%. Dispensou a angio-TC em 22%.'

export const years: Escore = {
  ficha: {
    id: 'years',
    titulo: 'YEARS — suspeita de embolia pulmonar',
    versao: '2026-11-06.1',
    publico: 'adulto',
    fontes: [
      { citacao: 'van der Hulle T, Cheung WY, Kooij S, et al. Simplified diagnostic management of suspected pulmonary embolism (the YEARS study): a prospective, multicentre, cohort study. Lancet. 2017;390(10091):289–297. Itens e limiares no resumo.', url: 'https://doi.org/10.1016/S0140-6736(17)30885-1' },
      HYDRA_YEARS_CANCER_2026,
    ],
    revisadoEm: '06/11/2026 (nota do Hydra no câncer ativo; revisão PubMed, itens médios; fonte primária em 28/09/2026)',
  },
  descricao: 'Três itens clínicos e o limiar de D-dímero de 1000 ou 500 ng/mL que eles definem',
  itens: [
    { tipo: 'escolha', id: 'tvp', rotulo: 'Sinais clínicos de trombose venosa profunda', opcoes: ns },
    { tipo: 'escolha', id: 'hemoptise', rotulo: 'Hemoptise', opcoes: ns },
    { tipo: 'escolha', id: 'provavel', rotulo: 'TEP é o diagnóstico mais provável', opcoes: ns },
    { tipo: 'numero', id: 'ddimero', rotulo: 'D-dímero', unidade: 'ng/mL', min: 0, max: 100000, passo: 1, opcional: true, ajuda: 'ng/mL é o mesmo que µg/L. Sem o valor, a tela mostra só o limiar.' },
  ],
  calcular(r) {
    if (!completo(years, r)) return null
    if (r.ddimero !== undefined && numero(years, r, 'ddimero') === undefined) return null
    const itens = somar(years, r, ['tvp', 'hemoptise', 'provavel'])
    const limiar = itens === 0 ? 1000 : 500
    const dd = numero(years, r, 'ddimero')
    const abaixo = dd !== undefined && dd < limiar
    return {
      rotulo: 'YEARS',
      valor: String(itens),
      unidade: itens === 1 ? 'item de 3' : 'itens de 3',
      nota: 'limiar de D-dímero ' + fmt(limiar) + ' ng/mL' + (dd === undefined ? '' : abaixo ? ' · D-dímero ABAIXO do limiar' : ' · D-dímero no limiar ou acima'),
      estado: dd === undefined ? (itens === 0 ? 0 : 1) : abaixo ? 0 : 1,
      derivados: [
        ['Itens presentes', String(itens)],
        ['Limiar do D-dímero', itens === 0 ? '1.000 ng/mL · nenhum item' : '500 ng/mL · um item ou mais'],
        ['D-dímero informado', dd === undefined ? 'não informado' : fmt(dd) + ' ng/mL'],
        ['Leitura do estudo', dd === undefined
          ? 'sem o D-dímero não há leitura'
          : abaixo ? 'abaixo do limiar, o estudo considerou o TEP excluído' : 'no limiar ou acima, o estudo não considerou o TEP excluído'],
      ],
      cuidados: [
        'O YEARS não se lê sem o D-dímero: o número de itens só decide qual limiar usar.',
        'O terceiro item é “TEP como diagnóstico mais provável”, e não neoplasia.',
        'A unidade do D-dímero e o tipo do ensaio variam entre laboratórios. Conferir a do laudo antes de comparar com 500 ou 1000.',
        'Na gestante há uma adaptação própria do YEARS, e esta tela não a faz.',
        NOTA_YEARS_CANCER,
        'Não tem validação pediátrica declarada.',
      ],
    }
  },
}
