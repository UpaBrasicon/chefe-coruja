import { marcadas, type Escore, type Item } from '../escore.ts'
import { fichaAdulto } from './fonte.ts'

// Regra de San Francisco como o Manual de Medicina de Emergência do HCFMUSP
// (3ª ed., 2022) traz: Tabela 3 do capítulo de síncope (p. 238), com o texto
// da p. 237–238 (sensibilidade 98% e especificidade 56% para eventos graves
// em 1 ano; risco com pelo menos 1 fator presente).

const fator = (id: string, rotulo: string): Item => ({ tipo: 'marca', id, rotulo, pontos: 1 })

export const sincopeSanFrancisco: Escore = {
  ficha: {
    ...fichaAdulto('adulto-sincope-san-francisco', 'Regra de San Francisco — síncope (adulto)', 'cap. 16 Perda transitória da consciência, p. 237–238 (Tabela 3)'),
    versao: '2026-09-30.1',
    revisadoEm: '30/09/2026 (conferido no texto do livro; aguarda aprovação do RT)',
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
