// Regras da senha pessoal (primeiro acesso e recuperação), marcadas ao vivo
// na tela — a fonte única delas. Mínimo de 10 caracteres com letra e número
// (o servidor exige o mesmo: supabase/config.toml, minimum_password_length e
// password_requirements = letters_digits), diferente do e-mail, e as duas
// digitações conferindo.

export type RegraSenha = { chave: 'tamanho' | 'letra' | 'numero' | 'email'; texto: string; ok: boolean }

export const TAMANHO_MINIMO_SENHA = 10

export function conferirSenha(senha: string, confirmacao: string, email: string) {
  const mail = email.trim().toLowerCase()
  const usuario = mail.split('@')[0] ?? ''
  const s = senha.toLowerCase()
  const regras: RegraSenha[] = [
    { chave: 'tamanho', texto: 'Dez caracteres ou mais', ok: senha.length >= TAMANHO_MINIMO_SENHA },
    { chave: 'letra', texto: 'Ao menos uma letra', ok: /\p{L}/u.test(senha) },
    { chave: 'numero', texto: 'Ao menos um número', ok: /\d/.test(senha) },
    {
      chave: 'email',
      texto: 'Diferente do seu e-mail',
      // Sem e-mail conhecido, só não pode estar vazia.
      ok: senha.length > 0 && (!mail || (s !== mail && (usuario.length < 3 || !s.includes(usuario)))),
    },
  ]
  const conferem = confirmacao.length > 0 && confirmacao === senha
  return { regras, conferem, valida: regras.every((r) => r.ok) && conferem }
}
