// Item 21 do kit de desempenho: guarda o que for enviado antes de uma
// biblioteca carregar (o Sentry desce depois da primeira pintura) e envia na
// ordem quando ela fica pronta. A fila tem teto; um envio que falha não
// impede os outros.
export function criarFilaAteCarregar<M, E>(opcoes: { maximo: number }, enviarUm: (modulo: M, item: E) => void) {
  let modulo: M | null = null
  const fila: E[] = []
  const tentar = (m: M, e: E) => {
    try {
      enviarUm(m, e)
    } catch {
      /* um envio que falha não derruba os outros */
    }
  }
  return {
    enviar(item: E) {
      if (modulo !== null) tentar(modulo, item)
      else if (fila.length < opcoes.maximo) fila.push(item)
    },
    pronto(m: M) {
      modulo = m
      for (const item of fila.splice(0)) tentar(m, item)
    },
  }
}
