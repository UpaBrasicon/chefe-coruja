import { completo, somar, type Escore } from '../escore.ts'
import type { Fonte } from '../ficha.ts'

// ABCD2: risco de AVC depois do AIT. Porte do protótipo (neurologia/ABCD2,
// atualizado em 29/08/2026). Saíram (ADR 0007) "conduta vigente", "conduta da
// coorte original" e as ordens de investigação; fica a referência das
// diretrizes de que o escore não estratifica sozinho.
// Versão de 06/11/2026 (revisão PubMed, itens médios): nota da coorte da
// unidade de observação nos EUA (2026) e da metanálise em rede (2025), pelos
// resumos. Pontos e faixas não mudam.

const AVC_2D = ['1,0%', '4,1%', '8,1%']
const AVC_7D = ['1,2%', '5,9%', '11,7%']

export const LUMIA_ABCD2_2026: Fonte = {
  citacao: 'Lumia S, Iobst W, Khan Z, et al. Performance of the ABCD2 Score in a US Emergency Department Observation Unit. Crit Pathw Cardiol. 2026;25(1):e0413 (PMID 41718567).',
  url: 'https://doi.org/10.1097/HPC.0000000000000413',
}

export const DERIS_ESCORES_AIT_2025: Fonte = {
  citacao: 'Deris D, Mastroianni S, Kan J, et al. Performance of Stratification Scores on the Risk of Stroke After a Transient Ischemic Attack: A Systematic Review and Network Meta-Analysis. J Clin Med. 2025;14(17):6268 (PMID 40944027).',
  url: 'https://doi.org/10.3390/jcm14176268',
}

export const NOTA_ABCD2_BAIXO_RISCO =
  'Unidade de observação do pronto-socorro nos EUA (2026; 340 pacientes com suspeita de AIT): o ABCD2 pôs 45,0% no risco baixo (0 a 3), e 17,7% deles (27 de 153) tiveram AVC agudo diagnosticado no próprio atendimento; os autores concluem que o escore não serve para descartar AVC agudo. Numa metanálise em rede (2025; 9 estudos), todos os escores de risco depois do AIT tiveram desempenho baixo para AVC em 90 dias (sensibilidade de 48% a 64%, especificidade de 59% a 72%), sem um claramente melhor.'

export const abcd2: Escore = {
  ficha: {
    id: 'abcd2',
    titulo: 'ABCD2 — risco de AVC depois do AIT',
    versao: '2026-11-06.1',
    publico: 'adulto',
    fontes: [
      { citacao: 'Johnston SC, Rothwell PM, Nguyen-Huynh MN, et al. Validation and refinement of scores to predict very early stroke risk after transient ischaemic attack. Lancet. 2007;369(9558):283–292.', url: 'https://doi.org/10.1016/S0140-6736(07)60150-0' },
      { citacao: 'Amin HP, et al. Diagnosis, workup, risk reduction of transient ischemic attack in the emergency department setting: a scientific statement from the American Heart Association. Stroke. 2023;54(3):e109–e121.', url: 'https://doi.org/10.1161/STR.0000000000000418' },
      { citacao: 'NICE. Stroke and transient ischaemic attack in over 16s: diagnosis and initial management. NG128, atualizado em 2023.', url: 'https://www.nice.org.uk/guidance/ng128' },
      { citacao: 'Amarenco P, Lavallée PC, Labreuche J, et al. One-Year Risk of Stroke after Transient Ischemic Attack or Minor Stroke. N Engl J Med. 2016;374(16):1533–1542.', url: 'https://doi.org/10.1056/NEJMoa1412981' },
      LUMIA_ABCD2_2026,
      DERIS_ESCORES_AIT_2025,
    ],
    revisadoEm: '06/11/2026 (nota do AVC no próprio atendimento no risco baixo; revisão PubMed, itens médios; porte do protótipo em 27/09/2026)',
  },
  descricao: 'Risco de AVC em 2 e 7 dias após ataque isquêmico transitório',
  itens: [
    { tipo: 'escolha', id: 'idade', rotulo: 'Idade', opcoes: [{ rotulo: 'Abaixo de 60 anos', valor: 0 }, { rotulo: '60 anos ou mais', valor: 1 }] },
    { tipo: 'escolha', id: 'pa', rotulo: 'Pressão arterial na avaliação', opcoes: [{ rotulo: 'Abaixo de 140/90 mmHg', valor: 0 }, { rotulo: '140/90 mmHg ou mais', valor: 1 }] },
    { tipo: 'escolha', id: 'clinica', rotulo: 'Quadro clínico', opcoes: [
      { rotulo: 'Outro déficit', valor: 0 }, { rotulo: 'Alteração de fala sem fraqueza', valor: 1 }, { rotulo: 'Fraqueza unilateral', valor: 2 },
    ] },
    { tipo: 'escolha', id: 'duracao', rotulo: 'Duração do déficit', opcoes: [
      { rotulo: 'Abaixo de 10 minutos', valor: 0 }, { rotulo: '10 a 59 minutos', valor: 1 }, { rotulo: '60 minutos ou mais', valor: 2 },
    ] },
    { tipo: 'escolha', id: 'dm', rotulo: 'Diabetes', opcoes: [{ rotulo: 'Não', valor: 0 }, { rotulo: 'Sim', valor: 1 }] },
  ],
  calcular(r) {
    if (!completo(abcd2, r)) return null
    const total = somar(abcd2, r)
    const banda = total >= 6 ? 2 : total >= 4 ? 1 : 0
    return {
      rotulo: 'ABCD2',
      valor: String(total),
      unidade: 'de 7',
      nota: ['risco menor', 'risco moderado', 'alto risco'][banda] + ' · AVC em 2 dias ' + AVC_2D[banda],
      estado: banda as 0 | 1 | 2,
      derivados: [
        ['Faixa', ['0 a 3 pontos', '4 a 5 pontos', '6 a 7 pontos'][banda]],
        ['AVC em 2 dias', AVC_2D[banda]],
        ['AVC em 7 dias', AVC_7D[banda]],
      ],
      alerta: 'Escore baixo não reduz a gravidade do AIT: as diretrizes atuais (AHA 2023, NICE 2023) consideram todo AIT suspeito como alto risco, e o ABCD2 entra só como parte de uma avaliação mais ampla.',
      cuidados: [
        'Só se aplica se o déficit já resolveu. Déficit presente não é AIT.',
        'O escore não vê estenose carotídea grave nem fibrilação atrial.',
        'A AHA mantém o ABCD2 apenas como componente de avaliação abrangente, reconhecendo discriminação modesta.',
        'Os percentuais são da coorte de validação de 2007, anteriores ao antiagregante duplo precoce.',
        NOTA_ABCD2_BAIXO_RISCO,
        'Sem referência pediátrica declarada.',
      ],
    }
  },
}
