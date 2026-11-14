import { marcadas, type Escore, type Item } from '../escore.ts'
import type { Fonte } from '../ficha.ts'
import { fichaAdulto } from './fonte.ts'

// Regra de San Francisco como o Manual de Medicina de Emergência do HCFMUSP
// (3ª ed., 2022) traz: Tabela 3 do capítulo de síncope (p. 238), com o texto
// da p. 237–238 (sensibilidade 98% e especificidade 56% para eventos graves
// em 1 ano; risco com pelo menos 1 fator presente).

// Lote 6 da revisão do HCFMUSP (Q2 = A, decisão do RT de 14/11/2026): o consenso
// da EUSEM 2024, lido no texto integral, ao lado do manual. É um consenso de
// processo (Delphi), sem graduação, montado sobre a ESC 2018.
export const EUSEM_SINCOPE_2024: Fonte = {
  citacao: 'Möckel M, Janssens KAC, Pudasaini S, et al. The syncope core management process in the emergency department: a consensus statement of the EUSEM syncope group. Eur J Emerg Med. 2024;31(4):250–259 (PMID 38874507; PMC11198953). Texto integral lido; consenso Delphi sobre a ESC 2018, sem graduação das recomendações.',
  url: 'https://doi.org/10.1097/MEJ.0000000000001146',
}

const FICHA_SF_LIVRO = fichaAdulto('adulto-sincope-san-francisco', 'Regra de San Francisco — síncope (adulto)', 'cap. 16 Perda transitória da consciência, p. 237–238 (Tabela 3)')

const GRAU_EUSEM = 'consenso de processo, sem graduação'

/** EUSEM 2024 ao lado do cap. 16 do manual do HC (conferido no PDF). */
export const DIRETRIZ_SINCOPE_2024: { tema: string; diretriz: string; grau: string; fonte: string; livro: string }[] = [
  { tema: 'Ordem do atendimento', diretriz: 'Triagem; afastar trauma e choque; sinais vitais, ECG e exames em paralelo; depois história, exame físico e teste ortostático (Schellong) quando couber', grau: GRAU_EUSEM, fonte: 'EUSEM 2024', livro: 'história e exame físico; a hipotensão ortostática não exclui diagnóstico grave; características da Tabela 2 (p. 237)' },
  { tema: 'Eletrocardiograma', diretriz: 'Interpretar o ECG em até 10 minutos do registro. Só o ECG normal é de baixo risco; o consenso lista achados maiores e menores de alto risco', grau: GRAU_EUSEM, fonte: 'EUSEM 2024', livro: 'ECG em todos; pesquisar QT curto ou longo, Brugada, onda épsilon, Wolff-Parkinson-White, taquicardias, BAV Mobitz II e de 3º grau e pausa ≥ 2 s (p. 238)' },
  { tema: 'Exames de laboratório', diretriz: 'Mínimo: glicemia e hemoglobina. Troponina seriada e D-dímero só conforme a suspeita (infarto, embolia pulmonar, dissecção de aorta)', grau: GRAU_EUSEM, fonte: 'EUSEM 2024', livro: 'outros exames conforme a etiologia suspeita; o hematócrito da regra de San Francisco não torna o exame obrigatório (p. 238–239)' },
  { tema: 'Estratificação de risco', diretriz: 'Pelas categorias de risco baixo e alto da ESC 2018; o consenso não usa escores como San Francisco ou o canadense', grau: GRAU_EUSEM, fonte: 'EUSEM 2024', livro: 'regra de San Francisco (Tabela 3); EGSYS e escore canadense validados com menos pacientes (p. 237–238)' },
  { tema: 'Risco intermediário pelos critérios da ESC 2018', diretriz: 'Quem não preenche os critérios de baixo nem de alto risco da ESC 2018 é de risco intermediário: mais investigação e monitorização, sem alta direta do pronto-socorro', grau: GRAU_EUSEM, fonte: 'EUSEM 2024', livro: 'o manual não usa a categoria de risco intermediário: sem diagnóstico definido, mas sem condição preocupante (Tabela 5), pode ter alta e ir ao especialista (p. 240–241)' },
  { tema: 'Destino', diretriz: 'Baixo risco: alta conforme a prática local (médico de família ou ambulatório). Risco intermediário ou alto: cuidado hospitalar em leito monitorizado, dentro ou fora do pronto-socorro. Síncope como sintoma de outra doença (embolia pulmonar, dissecção, estenose aórtica, BAV total) segue o fluxo dessa doença', grau: GRAU_EUSEM, fonte: 'EUSEM 2024', livro: 'causa de risco: internar (Tabela 5); neuromediada sem condição preocupante: alta; monitorização por até 6 horas quando a causa é incerta (p. 239–241)' },
]

const fator = (id: string, rotulo: string): Item => ({ tipo: 'marca', id, rotulo, pontos: 1 })

export const sincopeSanFrancisco: Escore = {
  ficha: {
    ...FICHA_SF_LIVRO,
    versao: '2026-11-14.1',
    fontes: [...FICHA_SF_LIVRO.fontes, EUSEM_SINCOPE_2024],
    revisadoEm: '14/11/2026 (consenso da EUSEM 2024 ao lado do manual, no texto integral; lote 6 da revisão do HCFMUSP; aguarda aprovação do RT); 30/09/2026 (conferido no texto do livro)',
  },
  descricao: 'Cinco fatores da Tabela 3 do manual do HC. Há risco se pelo menos um estiver presente.',
  itens: [
    fator('ic', 'História de insuficiência cardíaca'),
    fator('ecg', 'ECG anormal: ritmo não sinusal, atraso de condução ou mudança nova (até BAV de 1º grau ou qualquer alteração de QRS ou ST não comprovada em traçado anterior)'),
    fator('ht', 'Hematócrito < 30%'),
    fator('dispneia', 'Dispneia'),
    fator('pas', 'PAS < 90 mmHg'),
  ],
  calcular(r) {
    const m = marcadas(sincopeSanFrancisco, r)
    return {
      rotulo: 'San Francisco',
      valor: String(m.length),
      unidade: 'de 5 fatores',
      nota: m.length ? 'Pelo menos 1 fator: paciente de risco pela regra (p. 238)' : 'Nenhum fator marcado',
      estado: m.length ? 1 : 0,
      derivados: [['Desempenho citado no livro', 'sensibilidade 98% e especificidade 56% para eventos graves em 1 ano (1.418 pacientes, p. 237–238)']],
      cuidados: [
        'O hematócrito na regra não torna o exame obrigatório (p. 238).',
        'Nenhum fator marcado não é o mesmo que fator ausente: confira se cada item foi avaliado.',
        'Sem referência pediátrica declarada.',
      ],
    }
  },
}
