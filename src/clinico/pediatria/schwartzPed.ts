import { completo, escolha, numero, type Escore, type OpcaoEscolha } from '../escore.ts'
import { fichaP4 } from './fonteP4.ts'
import { K_ENZIMATICO, K_JAFFE, schwartz } from './injuriaRenalPed.ts'

// TFG estimada na criança pela fórmula de Schwartz, como o livro do ICr traz
// (cap. 56, Tabela 2, p. 576): 0,413 com creatinina enzimática (é a Schwartz
// "à beira do leito" do estudo CKiD) e a constante k por idade com o método
// colorimétrico (Jaffé). A mesma conta está na ferramenta de injúria renal;
// aqui ela fica sozinha, como calculadora da Central.

const METODOS: OpcaoEscolha[] = [
  { rotulo: `Enzimática — k ${String(K_ENZIMATICO).replace('.', ',')} (CKiD)`, valor: K_ENZIMATICO },
  ...K_JAFFE.map((k) => ({ rotulo: `Jaffé — ${k.texto} (k ${String(k.k).replace('.', ',')})`, valor: k.k })),
]

export const schwartzPed: Escore = {
  ficha: {
    ...fichaP4('ped-tfg-schwartz', 'TFG estimada — Schwartz / CKiD (criança)', 'cap. 56, p. 575–576 (Tabela 2)'),
    publico: 'pediatrico',
    versao: '2026-09-30.1',
    revisadoEm: '30/09/2026 (conferido no texto do livro; aguarda aprovação do RT)',
  },
  descricao: 'Estatura × k ÷ creatinina, com a constante do método de dosagem da creatinina (Tabela 2 do livro do ICr).',
  itens: [
    { tipo: 'numero', id: 'estatura', rotulo: 'Estatura', unidade: 'cm', min: 30, max: 200, passo: 0.5 },
    { tipo: 'numero', id: 'creatinina', rotulo: 'Creatinina sérica', unidade: 'mg/dL', min: 0.05, max: 20, passo: 0.01 },
    { tipo: 'escolha', id: 'metodo', rotulo: 'Método da creatinina no laboratório', opcoes: METODOS },
  ],
  calcular(r) {
    if (!completo(schwartzPed, r)) return null
    const k = escolha(schwartzPed, r, 'metodo')!.valor
    const tfg = schwartz(numero(schwartzPed, r, 'estatura')!, numero(schwartzPed, r, 'creatinina')!, k)
    if (tfg === null) return null
    return {
      rotulo: 'eTFG (Schwartz)',
      valor: String(Math.round(tfg)),
      unidade: 'mL/min/1,73 m²',
      nota: `k = ${String(k).replace('.', ',')}`,
      estado: tfg < 35 ? 2 : 0,
      derivados: [['KDIGO pediátrico (Tabela 1, p. 576)', tfg < 35 ? 'eTFG < 35 é critério do estágio 3' : 'eTFG ≥ 35']],
      cuidados: [
        'Pergunte ao laboratório o método da creatinina: a constante muda o resultado.',
        'Sem creatinina basal conhecida, o livro usa a creatinina que dá TFG 120 pela Schwartz (p. 575) — ver Injúria renal aguda — criança.',
        'Adulto (18 anos ou mais): CKD-EPI 2021.',
      ],
    }
  },
}
