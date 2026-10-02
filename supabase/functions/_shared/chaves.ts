// Chaves do Supabase nas edge functions.
//
// Troca das chaves legadas (30/09/2026, onda 11): o segredo JWT legado vazou e
// foi revogado, e com ele param as chaves `anon` e `service_role` antigas.
//
// 02/10/2026: o segredo manual CC_SECRET_KEY ficou com uma chave que não está
// mais registrada no projeto ("Unregistered API key"), e o 2FA por e-mail e a
// busca com IA quebraram. A plataforma injeta as chaves novas em vigor em
// SUPABASE_SECRET_KEYS / SUPABASE_PUBLISHABLE_KEYS (objeto JSON nome → chave).
// A SECRETA da plataforma vem primeiro, porque acompanha qualquer troca feita no
// painel; o segredo manual e a legada ficam de reserva.

/** Primeira chave de um segredo da plataforma: JSON {"default": "..."} ou texto puro. */
function daPlataforma(nome: string): string | undefined {
  const bruto = Deno.env.get(nome)
  if (!bruto) return undefined
  try {
    const j = JSON.parse(bruto)
    if (typeof j === 'string') return j
    if (j && typeof j === 'object') {
      const v = (j as Record<string, unknown>).default ?? Object.values(j as Record<string, unknown>)[0]
      return typeof v === 'string' && v ? v : undefined
    }
  } catch {
    return bruto
  }
  return undefined
}

/** Chave pública (o que o navegador também usa): acesso com o token de quem chamou. */
// (a pública manual está válida; a da plataforma fica de reserva)
export const chavePublica = () =>
  Deno.env.get('CC_PUBLISHABLE_KEY') || daPlataforma('SUPABASE_PUBLISHABLE_KEYS') || Deno.env.get('SUPABASE_ANON_KEY')!

/** Chave secreta (ignora a RLS): só para conferências internas da function. */
export const chaveSecreta = () =>
  daPlataforma('SUPABASE_SECRET_KEYS') || Deno.env.get('CC_SECRET_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
