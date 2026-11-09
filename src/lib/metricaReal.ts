import { normalizarRota } from './rotaSemIdentificador.ts'

// Item 30 do kit de desempenho (decisão do RT em 09/11/2026): uma medição de
// usuário real vira cinco campos, e só eles: nome da métrica, valor, nota, rota
// sem identificador e papel ativo. Nada de unidade, nome, CPF, CNS ou texto.

const METRICAS = new Set(['LCP', 'INP', 'CLS', 'FCP', 'TTFB'])
const PAPEIS = new Set([
  'admin', 'gestor', 'plantonista', 'enfermeiro', 'tecnico_enfermagem', 'recepcao', 'farmaceutico',
  'telemedicina', 'regulador', 'faturamento', 'secretaria', 'regulacao_regional', 'faturamento_rede', 'nir',
])

export type MetricaEnviada = { metrica: string; valor: string; nota: string; rota: string; papel: string }

export function montarMetrica(
  m: { name: string; value: number; rating: string },
  caminho: string,
  papel: string | null | undefined,
): MetricaEnviada {
  if (!METRICAS.has(m.name)) throw new Error(`Métrica fora da lista: ${m.name}`)
  // CLS é uma fração (0,1 = ruim); em milésimos fica inteiro como as outras
  const valor = Math.round(m.name === 'CLS' ? m.value * 1000 : m.value)
  return {
    metrica: m.name,
    valor: String(valor),
    nota: ['good', 'needs-improvement', 'poor'].includes(m.rating) ? m.rating : 'outra',
    rota: normalizarRota(caminho),
    papel: !papel ? '—' : PAPEIS.has(papel) ? papel : 'outro',
  }
}
