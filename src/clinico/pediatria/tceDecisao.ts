import { completo, escolha, somar, type Escore, type Resultado } from '../escore.ts'
import { fichaP2, type DosePeso } from './fonteP2.ts'

// TCE na criança — livro do ICr, cap. 16 (p. 171–181). As duas figuras de
// indicação de TC no TCE leve (Figuras 2 e 3, p. 176, baseadas em Kuppermann
// et al., PECARN), a Escala de Coma de Glasgow com a versão modificada para
// menores de 5 anos (Tabela 1, p. 172) e as doses da terapia hiperosmolar
// (p. 179). O resultado mostra o ramo da figura e o texto do quadro de destino,
// como referência citada; a decisão é do médico (ADR 0007).

const NAO_SIM = [{ rotulo: 'Não', valor: 0 }, { rotulo: 'Sim', valor: 1 }]

const CUIDADOS_PECARN = [
  'As figuras do livro são para TCE leve (Glasgow de 13 a 15, p. 172).',
  'O texto do quadro de destino é o do livro; a decisão é do médico.',
]

type Ramo = { itens1: string[]; itens2: string[]; fatores: string[]; figura: string }

function resultadoPecarn(esc: Escore, r: Parameters<Escore['calcular']>[0], ramo: Ramo): Resultado | null {
  if (!completo(esc, r)) return null
  const sim = (id: string) => escolha(esc, r, id)?.valor === 1
  const q1 = ramo.itens1.filter(sim)
  const q2 = ramo.itens2.filter(sim)
  const rotulos = (ids: string[]) => ids.map((id) => esc.itens.find((i) => i.id === id)!.rotulo).join('; ')
  if (q1.length) {
    return {
      rotulo: 'PECARN (livro do ICr)', valor: '1º quadro — sim', nota: rotulos(q1), estado: 2,
      derivados: [['Quadro de destino no livro', `"TC recomendada" (${ramo.figura})`]],
      cuidados: CUIDADOS_PECARN,
    }
  }
  if (q2.length) {
    return {
      rotulo: 'PECARN (livro do ICr)', valor: '2º quadro — sim', nota: rotulos(q2), estado: 1,
      derivados: [
        ['Quadro de destino no livro', `"TC ou observação" (${ramo.figura})`],
        ['Fatores que o quadro lista', ramo.fatores.join('; ')],
      ],
      cuidados: CUIDADOS_PECARN,
    }
  }
  return {
    rotulo: 'PECARN (livro do ICr)', valor: 'Nenhum critério', nota: 'Todos os itens das duas perguntas responderam "Não".', estado: 0,
    derivados: [['Quadro de destino no livro', `"TC não recomendada" (${ramo.figura})`]],
    cuidados: CUIDADOS_PECARN,
  }
}

const R1 = { tipo: 'escolha' as const, opcoes: NAO_SIM }

export const pecarnMenor2: Escore = {
  ficha: fichaP2('ped-pecarn-menor2-icr', 'TCE leve — menores de 2 anos (PECARN, livro do ICr)', 'cap. 16, p. 172–176 (Figura 2)'),
  descricao: 'Figura 2 do cap. 16: indicação de TC de crânio no TCE leve abaixo de 2 anos.',
  itens: [
    { ...R1, id: 'glasgow', rotulo: '1º quadro — Glasgow abaixo de 14' },
    { ...R1, id: 'mental', rotulo: '1º quadro — sinais de alteração do estado mental' },
    { ...R1, id: 'base', rotulo: '1º quadro — sinais de fratura de base de crânio' },
    { ...R1, id: 'hematoma', rotulo: '2º quadro — hematoma occipital, parietal ou temporal' },
    { ...R1, id: 'naoNormal', rotulo: '2º quadro — não está agindo normalmente segundo os pais' },
    { ...R1, id: 'mecanismo', rotulo: '2º quadro — mecanismo de trauma grave', ajuda: 'Na figura: atropelamento; queda de altura > 0,9 m; morte de outro passageiro; atingido por objeto de alto impacto.' },
  ],
  calcular: (r) => resultadoPecarn(pecarnMenor2, r, {
    itens1: ['glasgow', 'mental', 'base'],
    itens2: ['hematoma', 'naoNormal', 'mecanismo'],
    fatores: ['experiência clínica', 'achados múltiplos', 'piora clínica', 'preferência dos pais', 'idade < 3 meses'],
    figura: 'Figura 2, p. 176',
  }),
}

export const pecarnMaior2: Escore = {
  ficha: fichaP2('ped-pecarn-maior2-icr', 'TCE leve — 2 anos ou mais (PECARN, livro do ICr)', 'cap. 16, p. 172–176 (Figura 3)'),
  descricao: 'Figura 3 do cap. 16: indicação de TC de crânio no TCE leve a partir de 2 anos.',
  itens: [
    { ...R1, id: 'glasgow', rotulo: '1º quadro — Glasgow abaixo de 14' },
    { ...R1, id: 'mental', rotulo: '1º quadro — sinais de alteração do estado mental' },
    { ...R1, id: 'base', rotulo: '1º quadro — sinais de fratura de base de crânio' },
    { ...R1, id: 'perda', rotulo: '2º quadro — história de perda de consciência' },
    { ...R1, id: 'vomitos', rotulo: '2º quadro — história de vômitos' },
    { ...R1, id: 'mecanismo', rotulo: '2º quadro — mecanismo de trauma grave', ajuda: 'Na figura: atropelamento; queda de altura > 1,5 m; morte de outro passageiro; atingido por objeto de alto impacto.' },
    { ...R1, id: 'cefaleia', rotulo: '2º quadro — cefaleia intensa' },
  ],
  calcular: (r) => resultadoPecarn(pecarnMaior2, r, {
    itens1: ['glasgow', 'mental', 'base'],
    itens2: ['perda', 'vomitos', 'mecanismo', 'cefaleia'],
    fatores: ['experiência clínica', 'achados múltiplos', 'piora clínica', 'preferência dos pais'],
    figura: 'Figura 3, p. 176',
  }),
}

// ── Glasgow com a versão modificada (James, 1985) para menores de 5 anos (Tabela 1, p. 172) ──

const op = (pares: [number, string, string][]) => pares.map(([valor, adulto, crianca]) => ({
  rotulo: adulto === crianca ? `${valor} — ${adulto}` : `${valor} — ${adulto} · menor de 5 anos: ${crianca}`,
  valor,
}))

export const glasgowPediatrico: Escore = {
  ficha: fichaP2('ped-glasgow-icr', 'Escala de Coma de Glasgow — criança', 'cap. 16, p. 172 (Tabela 1)'),
  descricao: 'Glasgow com a escala modificada (James, 1985) para menores de 5 anos, e a gravidade do TCE pelo total.',
  itens: [
    { tipo: 'escolha', id: 'ocular', rotulo: 'Abertura ocular', opcoes: op([[4, 'Espontânea', 'Espontânea'], [3, 'Ao chamado', 'Ao chamado'], [2, 'À dor', 'À dor'], [1, 'Ausente', 'Ausente']]) },
    { tipo: 'escolha', id: 'verbal', rotulo: 'Resposta verbal', opcoes: op([[5, 'Orientado', 'Balbucio'], [4, 'Confuso', 'Choro irritado'], [3, 'Palavras inapropriadas', 'Choro à dor'], [2, 'Palavras incompreensíveis', 'Gemido à dor'], [1, 'Nenhuma', 'Nenhuma']]) },
    { tipo: 'escolha', id: 'motora', rotulo: 'Resposta motora', opcoes: op([[6, 'Obedece a comandos', 'Movimentos'], [5, 'Localiza a dor', 'Retirada ao toque'], [4, 'Retirada inespecífica à dor', 'Retirada à dor'], [3, 'Flexão à dor (decorticação)', 'Flexão anormal'], [2, 'Extensão à dor (descerebração)', 'Extensão anormal'], [1, 'Nenhuma', 'Nenhuma']]) },
  ],
  calcular(r) {
    if (!completo(glasgowPediatrico, r)) return null
    const total = somar(glasgowPediatrico, r)
    const faixa = total >= 13 ? 'leve (13 a 15)' : total >= 9 ? 'moderado (9 a 12)' : 'grave (3 a 8)'
    return {
      rotulo: 'Glasgow', valor: String(total), unidade: 'de 15',
      nota: `TCE ${faixa} pela classificação do livro (p. 172).`,
      estado: total >= 13 ? 0 : total >= 9 ? 1 : 2,
      derivados: [
        ['Ocular', String(escolha(glasgowPediatrico, r, 'ocular')!.valor)],
        ['Verbal', String(escolha(glasgowPediatrico, r, 'verbal')!.valor)],
        ['Motora', String(escolha(glasgowPediatrico, r, 'motora')!.valor)],
      ],
      cuidados: ['Abaixo de 5 anos o livro sugere a escala modificada (James, 1985).'],
    }
  },
}

// ── Terapia hiperosmolar e metas (p. 177–179) ──

export const fichaTcePediatrico = fichaP2('ped-tce-icr', 'TCE grave — hiperosmolar e metas (criança)', 'cap. 16, p. 177–179')

export const DOSES_TCE: DosePeso[] = [
  { id: 'nacl3-bolus', nome: 'NaCl 3% — infusão rápida', unidade: 'mL', porKg: [2, 5], via: 'IV em 10 a 20 min', pagina: 'p. 179' },
  { id: 'nacl3-continuo', nome: 'NaCl 3% — infusão contínua', unidade: 'mL/h', porKg: [0.1, 1], via: 'IV contínua', pagina: 'p. 179' },
  { id: 'manitol', nome: 'Manitol 20%', unidade: 'g', porKg: [0.25, 1], porMl: 0.2, solucao: 'manitol a 20% (0,2 g/mL)', via: 'IV em bolus; corrigir a volemia depois', pagina: 'p. 179',
    errata: 'O livro contraindica com osmolaridade "maior que 320 mOsm/mL" (p. 179); a unidade impressa é mOsm/mL.' },
]

export const METAS_TCE: { texto: string; pagina: string }[] = [
  { texto: 'Intubação: sinais de hipertensão intracraniana, Glasgow ≤ 8, queda do Glasgow > 3 pontos, anisocoria > 1 mm, lesão medular cervical com comprometimento respiratório, hipoxemia refratária ou insuficiência respiratória.', pagina: 'p. 177' },
  { texto: 'PaCO₂ inicial de 35 a 40 mmHg; hiperventilação profilática não recomendada.', pagina: 'p. 177' },
  { texto: 'Cabeça em posição neutra, elevada a 30°; evitar temperatura > 38,0 °C; aporte hídrico de 100% das necessidades, sem soluções hipotônicas.', pagina: 'p. 177–178' },
  { texto: 'PIC: limiar de tratamento 20 mmHg (10 a 15 mmHg em menores de 3 anos ou lactentes); monitorar com Glasgow < 8.', pagina: 'p. 178' },
  { texto: 'Pressão de perfusão cerebral (PAM − PIC) entre 40 e 65 mmHg; abaixo de 40 associa-se a pior prognóstico.', pagina: 'p. 177, 179' },
  { texto: 'Com NaCl 3%: osmolaridade sérica < 360 mOsm/L e sódio tolerado até 160 mmol/L; PIC < 20 mmHg com a menor dose.', pagina: 'p. 179' },
]
