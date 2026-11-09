// Item 03 do kit de desempenho (docs/desempenho/AUDITORIA.md, seção 1.3).
// A casca fazia a mesma leitura por vários caminhos a cada recarga:
// meu_plantao_agora por cinco, turno_atual e setores_na_escala_agora por dois,
// contexto_sem_conexao duas vezes seguidas. Uma leitura compartilhada junta as
// chamadas que chegam ao mesmo tempo e devolve o último resultado bom por
// alguns segundos. Erro nunca fica guardado.

type ComErro = { error?: unknown }

type Compartilhada<T> = {
  ler: () => Promise<T>
  limpar: () => void
}

const todas = new Set<Compartilhada<unknown>>()

export function criarCompartilhada<T extends ComErro>(
  buscar: () => PromiseLike<T>,
  opcoes: { validadeMs: number; relogio?: () => number },
): Compartilhada<T> {
  const relogio = opcoes.relogio ?? (() => Date.now())
  let geracao = 0
  let emCurso: Promise<T> | null = null
  let guardado: { valor: T; em: number } | null = null

  const ler = (): Promise<T> => {
    if (guardado && relogio() - guardado.em < opcoes.validadeMs) return Promise.resolve(guardado.valor)
    if (emCurso) return emCurso
    const minha = geracao
    const promessa = Promise.resolve(buscar()).then(
      (valor) => {
        // só guarda o que foi pedido depois da última limpeza (troca de pessoa)
        if (minha === geracao) {
          guardado = valor.error ? null : { valor, em: relogio() }
          emCurso = null
        }
        return valor
      },
      (erro: unknown) => {
        if (minha === geracao) emCurso = null
        throw erro
      },
    )
    emCurso = promessa
    return promessa
  }

  const limpar = () => {
    geracao++
    emCurso = null
    guardado = null
  }

  const c: Compartilhada<T> = { ler, limpar }
  todas.add(c as Compartilhada<unknown>)
  return c
}

/** Esquece tudo o que foi guardado (sair, entrar com outra pessoa). */
export function limparCompartilhadas(): void {
  for (const c of todas) c.limpar()
}

type CargaPerfil = { carregado: string | null; emCarga: string | null }

/**
 * Na recarga, getSession e os eventos INITIAL_SESSION, SIGNED_IN e
 * TOKEN_REFRESHED chegam quase juntos e cada um lia o perfil. Lê só quando a
 * pessoa muda, na primeira vez, ou quando o próprio usuário foi alterado.
 */
export function precisaCarregarPerfil(evento: string, userId: string, carga: CargaPerfil): boolean {
  if (evento === 'USER_UPDATED') return true
  return carga.carregado !== userId && carga.emCarga !== userId
}
