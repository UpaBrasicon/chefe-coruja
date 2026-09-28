import { completo, somar, type Escore, type Item } from '../escore.ts'
import { fichaAdulto } from './fonte.ts'

// TIMI como o Manual de Medicina de Emergência do HCFMUSP (3ª ed., 2022) traz:
// só o TIMI-NSTEMI (sem supra de ST), na Tabela 4 do cap. 12 (p. 192, conferido
// na imagem da página), com o corte de baixo risco na nota da tabela (p. 194) e
// o uso na decisão de estratégia no cap. 13 (p. 205 e Tabela 2, p. 210). O livro
// não traz o TIMI do IAM com supra (cap. 14 não usa TIMI) nem risco em % por
// pontuação; nada disso entra aqui.

const fator = (id: string, rotulo: string): Item => ({
  tipo: 'escolha', id, rotulo, opcoes: [{ rotulo: 'Não', valor: 0 }, { rotulo: 'Sim — 1 ponto', valor: 1 }],
})

export const timiSemSupra: Escore = {
  ficha: fichaAdulto(
    'adulto-timi-nstemi',
    'TIMI-NSTEMI — risco na SCA sem supra de ST (adulto)',
    'cap. 12 Abordagem inicial do paciente com dor torácica, p. 192–194 (Tabela 4); cap. 13 Infarto agudo do miocárdio sem supradesnivelamento do segmento ST, p. 205 e p. 210 (Tabela 2)',
  ),
  descricao: 'Sete fatores de 1 ponto cada, da Tabela 4 do manual do HC. Baixo risco é 0 ou 1 ponto.',
  itens: [
    fator('idade', '65 anos de idade ou mais'),
    fator('fatores', 'Pelo menos 3 fatores de risco para DAC'),
    fator('estenose', 'Estenose coronariana de pelo menos 50% conhecida'),
    fator('dor', 'Recorrência da dor nas últimas 24 horas'),
    fator('aas', 'Uso de aspirina nos últimos 7 dias'),
    fator('st', 'Desvio de segmento ST na apresentação'),
    fator('marcadores', 'Elevação de marcadores cardíacos'),
  ],
  calcular(r) {
    if (!completo(timiSemSupra, r)) return null
    const total = somar(timiSemSupra, r)
    const baixo = total <= 1
    return {
      rotulo: 'TIMI-NSTEMI',
      valor: String(total),
      unidade: 'de 7',
      nota: baixo ? 'Baixo risco pelo livro (0 ou 1 ponto)' : '2 pontos ou mais: fora da faixa de baixo risco do livro',
      estado: baixo ? 0 : 1,
      derivados: [
        ['Baixo risco (nota da Tabela 4, p. 194)', '0 ou 1 ponto'],
        ['Tabela 2 do cap. 13 (p. 210)', baixo ? 'TIMI 0-1 está entre os critérios de estratégia conservadora' : 'TIMI ≥ 2 está entre os critérios de estratégia invasiva (72 h)'],
        ...(baixo ? [['Cap. 13, p. 205', 'Descartar SCA é razoável com escore clínico de baixo risco (TIMI 0 ou 1) e baixo risco na curva de troponina, quando SCA é a única suspeita'] as [string, string]] : []),
      ],
      cuidados: [
        'O livro não traz risco de eventos em % por pontuação; nenhum percentual é mostrado.',
        'O livro traz só o TIMI da SCA sem supra de ST. Não há TIMI para IAM com supra no manual.',
        'Redação do livro: "Recorrência da dor nas últimas 24 horas" e "Desvio de segmento ST na apresentação". No artigo original (Antman 2000) são 2 ou mais episódios de angina em 24 h e desvio de ST ≥ 0,5 mm.',
        'Na Tabela 2 (p. 210) o TIMI é um dos critérios; Grace, marcadores, alterações dinâmicas de ST, diabetes, função renal e FE também entram na decisão.',
        'Sem referência pediátrica declarada.',
      ],
    }
  },
}
