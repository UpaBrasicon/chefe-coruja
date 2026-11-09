// Item 08 do kit de desempenho (docs/desempenho/AUDITORIA.md, seção 3.1).
// Junta os pedidos feitos no mesmo instante (por exemplo, um cartão por
// paciente pedindo as alergias dele) numa chamada só ao servidor. Cada pedido
// recebe a sua resposta; o erro de um item (sem acesso) rejeita só aquele, e a
// falha da chamada inteira (rede, segundo fator) rejeita todos com o mesmo
// erro, para a tela tratar como antes.

export type RespostaLote<V> = Record<string, { dados?: V; erro?: string }>

type Pendente<V> = { resolver: (v: V) => void; rejeitar: (e: unknown) => void }

export function criarLoteador<V>(
  buscar: (chaves: string[]) => Promise<RespostaLote<V>>,
  opcoes: { maximo: number; esperaMs?: number },
) {
  let fila = new Map<string, Pendente<V>[]>()
  let agendado = false

  async function enviar(chaves: string[], pedidos: Map<string, Pendente<V>[]>) {
    try {
      const resposta = await buscar(chaves)
      for (const chave of chaves) {
        const item = resposta[chave]
        for (const p of pedidos.get(chave) ?? []) {
          if (item && 'dados' in item) p.resolver(item.dados as V)
          else p.rejeitar(new Error(item?.erro ?? `Leitura em lote sem resposta para ${chave}.`))
        }
      }
    } catch (erro) {
      for (const chave of chaves) for (const p of pedidos.get(chave) ?? []) p.rejeitar(erro)
    }
  }

  function esvaziar() {
    agendado = false
    const pedidos = fila
    fila = new Map()
    const chaves = [...pedidos.keys()]
    for (let i = 0; i < chaves.length; i += opcoes.maximo) void enviar(chaves.slice(i, i + opcoes.maximo), pedidos)
  }

  return {
    carregar(chave: string): Promise<V> {
      return new Promise<V>((resolver, rejeitar) => {
        const lista = fila.get(chave) ?? []
        lista.push({ resolver, rejeitar })
        fila.set(chave, lista)
        if (!agendado) {
          agendado = true
          setTimeout(esvaziar, opcoes.esperaMs ?? 10)
        }
      })
    },
  }
}
