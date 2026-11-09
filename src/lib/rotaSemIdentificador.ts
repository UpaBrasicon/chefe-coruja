// Item 30 do kit de desempenho (decisão do RT em 09/11/2026): a rota vai como
// marcador das métricas de usuários reais, sem nenhum identificador. Lista
// branca: só fica o trecho que é nome de tela (minúsculas, hífen e sublinhado,
// sem dígito). O resto vira ":id"; depois de um prefixo de link público, tudo
// vira ":token". Consulta (?) e âncora (#) saem inteiras.

const PUBLICOS = new Set(['r', 'painel', 'alta'])
const TRECHO_DE_TELA = /^[a-z][a-z_-]{0,40}$/
const PROFUNDIDADE = 6

export function normalizarRota(caminho: string): string {
  const semConsulta = caminho.split(/[?#]/)[0] ?? ''
  const trechos = semConsulta.split('/').filter(Boolean)
  if (trechos.length === 0) return '/'
  const saida: string[] = []
  const publico = PUBLICOS.has(trechos[0])
  for (let i = 0; i < trechos.length; i++) {
    if (i >= PROFUNDIDADE) {
      saida.push('…')
      break
    }
    const t = trechos[i]
    if (publico && i > 0) saida.push(':token')
    else saida.push(TRECHO_DE_TELA.test(t) ? t : ':id')
  }
  return '/' + saida.join('/')
}
