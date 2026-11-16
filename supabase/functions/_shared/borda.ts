// Regras de borda das Edge Functions (trilha de segurança, S6;
// docs/seguranca/S6-BORDA-DIAGNOSTICO.md). Puras, testadas em borda.test.ts.
//
// B1. O gateway do Supabase mantém o X-Forwarded-For que o cliente manda e
//     acrescenta o IP real no fim (conferido na homologação em 15/11/2026). O
//     cf-connecting-ip vem da borda e o cliente não consegue trocá-lo.
// B2. Comparação de segredo em tempo constante.
// B3. Corpo lido em partes, parando ao passar do limite (mesmo sem
//     Content-Length).
// B5. Endereço privado, de loopback, link-local, de documentação ou reservado.

/** IP de quem chamou: cf-connecting-ip ou, na falta dele, o ÚLTIMO item do x-forwarded-for. */
export function ipConfiavel(cab: (nome: string) => string | null): string | null {
  const cf = cab('cf-connecting-ip')?.trim()
  if (cf) return cf
  const itens = (cab('x-forwarded-for') ?? '').split(',').map((t) => t.trim()).filter(Boolean)
  return itens.length ? itens[itens.length - 1] : null
}

/** Mesmo texto? O tempo não depende de onde os dois diferem. */
export function iguaisTempoConstante(a: string, b: string): boolean {
  const x = new TextEncoder().encode(a)
  const y = new TextEncoder().encode(b)
  const n = Math.max(x.length, y.length)
  let dif = x.length ^ y.length
  for (let i = 0; i < n; i++) dif |= (x[i] ?? 0) ^ (y[i] ?? 0)
  return dif === 0
}

/** Lê o corpo até `max` bytes; passou, para e avisa. Sem corpo, devolve texto vazio. */
export async function lerCorpoLimitado(req: Request, max: number): Promise<{ texto: string } | { excedeu: true }> {
  const declarado = Number(req.headers.get('content-length') ?? '0')
  if (declarado > max) return { excedeu: true }
  if (!req.body) return { texto: '' }
  const leitor = req.body.getReader()
  const partes: Uint8Array[] = []
  let total = 0
  for (;;) {
    const { done, value } = await leitor.read()
    if (done) break
    total += value.byteLength
    if (total > max) {
      await leitor.cancel().catch(() => {})
      return { excedeu: true }
    }
    partes.push(value)
  }
  const tudo = new Uint8Array(total)
  let pos = 0
  for (const p of partes) { tudo.set(p, pos); pos += p.byteLength }
  return { texto: new TextDecoder().decode(tudo) }
}

function ipv4(texto: string): number[] | null {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(texto)
  if (!m) return null
  const o = m.slice(1).map(Number)
  return o.every((n) => n <= 255) ? o : null
}

function ipv4Privado([a, b, c]: number[]): boolean {
  return a === 0 || a === 10 || a === 127 || a >= 224 // 0/8, 10/8, loopback, multicast e reservados
    || (a === 100 && b >= 64 && b <= 127) // 100.64/10 (CGNAT)
    || (a === 169 && b === 254) // link-local e metadados de nuvem
    || (a === 172 && b >= 16 && b <= 31)
    || (a === 192 && b === 168)
    || (a === 192 && b === 0 && (c === 0 || c === 2)) // 192.0.0/24 e documentação
    || (a === 198 && (b === 18 || b === 19)) // testes de rede
    || (a === 198 && b === 51 && c === 100) || (a === 203 && b === 0 && c === 113) // documentação
}

/** Endereço que um webhook não pode alcançar (privado, loopback, link-local, documentação, reservado). */
export function enderecoPrivado(ip: string): boolean {
  const texto = ip.trim().toLowerCase().replace(/^\[|\]$/g, '')
  const v4 = ipv4(texto)
  if (v4) return ipv4Privado(v4)
  if (!texto.includes(':')) return true // não é IP: não arrisca
  if (texto === '::' || texto === '::1') return true
  const mapeado = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(texto)
  if (mapeado) { const m = ipv4(mapeado[1]); return m ? ipv4Privado(m) : true }
  const primeiro = parseInt(texto.split(':')[0] || '0', 16)
  return (primeiro & 0xfe00) === 0xfc00 // fc00::/7 (local único)
    || (primeiro & 0xffc0) === 0xfe80 // fe80::/10 (link-local)
    || (primeiro & 0xff00) === 0xff00 // multicast
    || texto.startsWith('2001:db8:') || texto.startsWith('2001:db8::') // documentação
    || texto.startsWith('64:ff9b:') // NAT64, pode embutir endereço privado
    || primeiro === 0 // ::/16 restante (mapeados e reservados)
}

export type ResolverDns = (nome: string, tipo: 'A' | 'AAAA') => Promise<string[]>

/**
 * O nome só aponta para endereço público? Resolve A e AAAA; sem nenhum endereço,
 * ou com algum privado, recusa. Erro de um tipo (ex.: sem AAAA) não recusa sozinho.
 */
export async function nomePublico(nome: string, resolver: ResolverDns): Promise<{ ok: true } | { ok: false; motivo: string }> {
  const enderecos: string[] = []
  for (const tipo of ['A', 'AAAA'] as const) {
    try { enderecos.push(...await resolver(nome, tipo)) } catch { /* sem registro desse tipo */ }
  }
  if (enderecos.length === 0) return { ok: false, motivo: 'o nome não resolveu' }
  const privado = enderecos.find(enderecoPrivado)
  if (privado) return { ok: false, motivo: 'o nome aponta para endereço privado ou reservado' }
  return { ok: true }
}
