// Texto do erro na tela (guia do padrão do frontend, 2.2; decisão do RT "3a" de
// 19/10/2026). A recusa escrita para a pessoa por uma regra do banco
// (RAISE EXCEPTION, código P0001) aparece como veio. Falha de rede, de
// permissão ou erro técnico vira "Não foi possível <ação>. Tente de novo." e o
// detalhe vai para o registro de erros (MensagemErro chama reportarErro).

export interface ErroClassificado {
  /** O que a tela mostra. */
  texto: string
  /** Mensagem técnica para o registro de erros, ou null quando é frase do servidor. */
  tecnico: string | null
}

function campo(erro: unknown, nome: string): string | undefined {
  if (erro && typeof erro === 'object' && nome in erro) {
    const v = (erro as Record<string, unknown>)[nome]
    return typeof v === 'string' ? v : undefined
  }
  return undefined
}

/** Tira o prefixo de código que algumas regras usam ("CHECKIN_FORA_DO_RAIO: …"). */
function semPrefixo(m: string) {
  return m.replace(/^[A-Z][A-Z0-9_]{2,}:\s*/, '').trim()
}

export function classificarErro(erro: unknown, acao: string): ErroClassificado {
  const generico = `Não foi possível ${acao}. Tente de novo.`
  const codigo = campo(erro, 'code')
  const mensagem = campo(erro, 'message') ?? (typeof erro === 'string' ? erro : erro instanceof Error ? erro.message : '')
  if (codigo === 'P0001' && mensagem && semPrefixo(mensagem)) return { texto: semPrefixo(mensagem), tecnico: null }
  return { texto: generico, tecnico: [codigo, mensagem].filter(Boolean).join(' — ') || 'erro sem mensagem' }
}
