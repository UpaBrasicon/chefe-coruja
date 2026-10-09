import type { Fonte } from '../ficha.ts'
import { completo, escolha, type Escore } from '../escore.ts'
import { fichaAdulto } from './fonte.ts'

// Vertigem — cap. 42 do Manual de Medicina de Emergência do HCFMUSP (3ª ed.,
// 2022), p. 577–587. HINTS e HINTS plus (p. 580–583). O ABCD2 do capítulo
// (Tabela 2, p. 579–580) já existe no produto (escores/abcd2.ts) e não é
// duplicado; os números próprios do capítulo ficam anotados nos cuidados.

const CAP = 'cap. 42 Vertigem'

/** valor 1 = achado de padrão central */
// Revisão PubMed de 09/10/2026 (decisão do RT): aviso de uso pela diretriz
// GRACE-3 da SAEM (2023) — HINTS só com examinador treinado e só no paciente
// com síndrome vestibular aguda e nistagmo; sem treino o exame é impreciso.
export const GRACE3_TONTURA: Fonte = {
  citacao: 'Edlow JA, Carpenter C, Akhter M, et al. Guidelines for reasonable and appropriate care in the emergency department 3 (GRACE-3): Acute dizziness and vertigo in the emergency department. Acad Emerg Med. 2023;30(5):442–486 (PMID 37166022).',
  url: 'https://doi.org/10.1111/acem.14728',
}

export const AVISO_HINTS_GRACE3 = 'GRACE-3 (2023): use o HINTS só se tiver treino no exame e só na síndrome vestibular aguda com nistagmo. Sem nistagmo, avalie a gravidade do desequilíbrio da marcha. TC de crânio não exclui AVC; RM serve para confirmar quando o HINTS é central ou duvidoso. Sem treino, o HINTS é impreciso.'

const fichaHintsLivro = fichaAdulto('adulto-hints-plus', 'HINTS e HINTS plus — síndrome vestibular aguda (adulto)', `${CAP}, p. 580–584`)

export const hintsPlus: Escore = {
  ficha: { ...fichaHintsLivro, versao: '2026-10-09.1', fontes: [...fichaHintsLivro.fontes, GRACE3_TONTURA], revisadoEm: '09/10/2026 (aviso de uso pela GRACE-3 2023)' },
  descricao: 'Só para examinador treinado e paciente com síndrome vestibular aguda e nistagmo (GRACE-3). Impulso cefálico, nistagmo e desvio skew (HINTS), mais a audição (HINTS plus), para separar padrão periférico de central.',
  itens: [
    { tipo: 'escolha', id: 'impulso', rotulo: 'Head impulse (reflexo vestíbulo-ocular)', ajuda: 'Olhar fixo no nariz do examinador, versão cefálica rápida para cada lado (p. 581).', opcoes: [
      { rotulo: 'Alterado (atraso do olhar com sacada de correção) — padrão periférico', valor: 0 },
      { rotulo: 'Normal (olhos se mantêm fixos no alvo) — padrão central', valor: 1 },
    ] },
    { tipo: 'escolha', id: 'nistagmo', rotulo: 'Nistagmo ao olhar para os lados', opcoes: [
      { rotulo: 'Bate sempre para o mesmo lado — padrão periférico', valor: 0 },
      { rotulo: 'Muda de direção conforme o olhar — padrão central', valor: 1 },
    ] },
    { tipo: 'escolha', id: 'skew', rotulo: 'Test of skew (cobertura alternada)', opcoes: [
      { rotulo: 'Sem desalinhamento vertical — padrão periférico', valor: 0 },
      { rotulo: 'Desalinhamento vertical — padrão central', valor: 1 },
    ] },
    { tipo: 'escolha', id: 'audicao', rotulo: 'Audição (finger rubbing) — HINTS plus', opcoes: [
      { rotulo: 'Não avaliada (só HINTS)', valor: 0, naoTestavel: true },
      { rotulo: 'Sem perda auditiva nova', valor: 0 },
      { rotulo: 'Perda auditiva — sugere lesão central', valor: 1 },
    ] },
  ],
  calcular(r) {
    if (!completo(hintsPlus, r)) return null
    const nomes: Record<string, string> = { impulso: 'head impulse normal', nistagmo: 'nistagmo que muda de direção', skew: 'desvio skew', audicao: 'perda auditiva' }
    const centrais = Object.keys(nomes).filter((id) => escolha(hintsPlus, r, id)?.valor === 1).map((id) => nomes[id])
    const plus = escolha(hintsPlus, r, 'audicao')?.naoTestavel !== true
    return {
      rotulo: plus ? 'HINTS plus' : 'HINTS',
      valor: String(centrais.length),
      unidade: plus ? 'de 4 achados centrais' : 'de 3 achados centrais',
      nota: centrais.length ? 'Algum achado de padrão central' : 'Todos os achados de padrão periférico',
      estado: centrais.length ? 2 : 0,
      derivados: centrais.length ? [['Achados de padrão central', centrais.join('; ')]] : [],
      alerta: centrais.length ? 'O livro orienta conduzir a síndrome vestibular aguda de origem central como AVC agudo (p. 584).' : undefined,
      cuidados: [
        AVISO_HINTS_GRACE3,
        'Vale para a síndrome vestibular aguda (episódio único e prolongado), não para vertigem recorrente ou posicional (p. 578–579).',
        'HINTS plus: sensibilidade de 99,2% e especificidade de 97% para origem central (p. 583).',
        'RM é falso-negativa em 12 a 13,3% das vertigens centrais por AVC isquêmico nas primeiras 48 h (p. 579).',
        'ABCD2 no capítulo: AVC em 1% com ABCD2 ≤ 3 e em 8,1% com 4 a 7 (p. 580). O escore ABCD2 está em ferramenta própria.',
        'Periférico, supressores vestibulares por 2 a 3 dias: dimenidrato 50 mg EV ou VO 8/8 ou 6/6 h; meclizina 25 mg VO 8/8 ou 6/6 h (p. 584).',
        'Manobras (VPPB): Dix-Hallpike com cabeça a 45º e observação de 30 s; Epley com 30 s em cada posição; Semont com 1 min e depois 2 min (p. 584–586).',
        'Sem referência pediátrica declarada.',
      ],
    }
  },
}
