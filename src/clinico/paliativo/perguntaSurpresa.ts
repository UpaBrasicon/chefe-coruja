import { IDADE_ADULTO_ANOS, type Ficha } from '../ficha.ts'

// Pergunta surpresa (ponto 15 do plantonista, RT 31/10/2026): a única
// ferramenta de cuidados paliativos que entra agora, porque é a única com o
// texto da fonte confirmado (docs/plantonista/REVISAO-PLANTONISTA-2026-10.md,
// ponto 15). PPS, PPI e PaP esperam a fonte completa; PPI e PaP, quando
// entrarem, só para câncer avançado no adulto.
//
// É triagem para lembrar de avaliar as necessidades de cuidado paliativo, não
// prognóstico e não conduta: a revisão sistemática achou sensibilidade de 67%
// e especificidade de 80% (16 estudos, 11.621 pacientes), com desempenho de
// fraco a moderado. Só no adulto: a fonte é de adultos e nada se converte para
// a criança.
//
// Os mesmos itens e faixas estão em private.escala_avaliacao (migration
// 20270203000006): o servidor refaz a leitura.

export const fichaPerguntaSurpresa: Ficha = {
  id: 'paliativo-pergunta-surpresa',
  titulo: 'Pergunta surpresa — cuidados paliativos',
  versao: '2026-10-31.1',
  publico: 'adulto',
  fontes: [
    {
      citacao: 'Downar J, et al. Revisão sistemática e metanálise da pergunta surpresa. CMAJ. 2017;189(13):E484–E493 (PMID 28385893).',
      url: 'https://doi.org/10.1503/cmaj.160775',
    },
  ],
  revisadoEm: '31/10/2026 (resumo conferido no PubMed em 27/10/2026)',
}

export const PERGUNTA_SURPRESA = 'Você ficaria surpreso se este paciente morresse nos próximos 12 meses?'

/** Resposta gravada: 0 = ficaria surpreso; 1 = não ficaria surpreso (triagem positiva). */
export const OPCOES_PERGUNTA_SURPRESA: { valor: 0 | 1; rotulo: string }[] = [
  { valor: 0, rotulo: 'Sim, ficaria surpreso' },
  { valor: 1, rotulo: 'Não ficaria surpreso' },
]

export const LEITURA_PERGUNTA_SURPRESA: Record<0 | 1, string> = {
  0: 'Negativa (ficaria surpreso)',
  1: 'Positiva: avaliar as necessidades de cuidado paliativo',
}

export const AVISO_PERGUNTA_SURPRESA =
  'Triagem, não prognóstico: sensibilidade de 67% e especificidade de 80% na revisão sistemática. Não define conduta nem limite de tratamento.'

/** Só no adulto (14 anos ou mais). Sem nascimento no cadastro, não se aplica. */
export function perguntaSurpresaSeAplica(idadeAnos: number | null): boolean {
  return idadeAnos != null && idadeAnos >= IDADE_ADULTO_ANOS
}
