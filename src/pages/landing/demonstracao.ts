// Regras do formulário "Agendar demonstração" do lado da tela (pedido 8, J3).
// As mesmas regras valem na função pedir-demonstracao (supabase/functions/
// pedir-demonstracao/regras.ts); aqui elas só adiantam o aviso.

export type CamposDemonstracao = { nome: string; email: string; telefone: string; unidade: string; mensagem: string }
export type ErrosDemonstracao = Partial<Record<'nome' | 'email' | 'telefone', string>>

export const CAMPOS_VAZIOS: CamposDemonstracao = { nome: '', email: '', telefone: '', unidade: '', mensagem: '' }

const AVISO: Required<ErrosDemonstracao> = {
  nome: 'Escreva o seu nome.',
  email: 'Confira o e-mail.',
  telefone: 'Escreva o telefone com DDD.',
}

export function validarDemonstracao(c: CamposDemonstracao): ErrosDemonstracao {
  const erros: ErrosDemonstracao = {}
  if (c.nome.trim().length < 2) erros.nome = AVISO.nome
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c.email.trim())) erros.email = AVISO.email
  if (c.telefone.replace(/\D/g, '').length < 10) erros.telefone = AVISO.telefone
  return erros
}

export type ResultadoEnvio = { tipo: 'ok' } | { tipo: 'campo'; erros: ErrosDemonstracao } | { tipo: 'erro'; mensagem: string }

const ESCREVA = 'Se preferir, escreva para contato@chefecoruja.com.br.'

/** Traduz a resposta da função em mensagem para a tela. */
export function lerResposta(status: number, corpo: { campo?: string; erro?: string } | null): ResultadoEnvio {
  if (status === 200) return { tipo: 'ok' }
  if (status === 400 && corpo?.campo && corpo.campo in AVISO) {
    const campo = corpo.campo as keyof ErrosDemonstracao
    return { tipo: 'campo', erros: { [campo]: AVISO[campo] } }
  }
  if (status === 403) return { tipo: 'erro', mensagem: 'Não conseguimos confirmar que você não é um robô. Tente enviar de novo.' }
  if (status === 429) return { tipo: 'erro', mensagem: `Já recebemos pedidos deste endereço na última hora. ${ESCREVA}` }
  return { tipo: 'erro', mensagem: `Não foi possível enviar agora. Tente de novo em instantes. ${ESCREVA}` }
}
