// Recarga sem conexão, parte 2 (A em N1 a N5 pelo RT em 05/11/2026;
// docs/porta/RECARGA-SEM-CONEXAO-DIAGNOSTICO.md).
//
// O que a casca precisa para abrir sem rede (perfil reduzido, vínculos e se é
// administrador geral) fica cifrado com a chave da sessão (cofre do item 13) e
// no armazenamento da ABA (N2): fechar a aba ou o navegador apaga; sair apaga.
// Quem decide se pode usar é a regra do modo sem conexão (N3: 2 h e 20 min).
import { chaveDaAba, cifrar, decifrar } from '../cofreLocal.ts'

export const CHAVE_SESSAO_LOCAL = 'cc-sessao-sem-conexao'

/** Só o que a casca e os carimbos usam; documento pessoal não sai do servidor. */
const CAMPOS = ['id', 'nome_completo', 'email', 'crm', 'uf_crm', 'conselho', 'registro_numero', 'registro_uf', 'cbo', 'foto_url', 'tema', 'ativo', 'created_at', 'updated_at'] as const

type Perfil = { id: string } & Record<string, unknown>
type SessaoLocal<P extends Perfil, V> = { perfil: P; vinculos: V[]; isSuper: boolean; guardadoEm: number }

export function perfilReduzido<P extends Perfil>(p: P): P {
  const r: Record<string, unknown> = {
    cpf: null, cns: null, telefone: null, dados_pessoais: {}, data_nascimento: null, tipo_sanguineo: null,
  }
  for (const c of CAMPOS) r[c] = p[c] ?? null
  return r as P
}

function aba(): Storage | null {
  try { return typeof sessionStorage === 'undefined' ? null : sessionStorage } catch { return null }
}

/** `perfilId`: só vale para a mesma pessoa do token guardado. */
export function lerSessaoLocal<P extends Perfil = Perfil, V = unknown>(perfilId?: string): SessaoLocal<P, V> | null {
  const a = aba()
  const bruto = a?.getItem(CHAVE_SESSAO_LOCAL)
  if (!bruto || !chaveDaAba()) return null
  const texto = decifrar(bruto)
  if (!texto) return null
  try {
    const s = JSON.parse(texto) as SessaoLocal<P, V>
    if (!s.perfil?.id || (perfilId && s.perfil.id !== perfilId)) return null
    return { ...s, vinculos: s.vinculos ?? [], isSuper: !!s.isSuper }
  } catch {
    return null
  }
}

/** Grava em partes (perfil agora, vínculos depois). Sem chave da sessão, não grava. */
export function guardarSessaoLocal<P extends Perfil, V>(parte: Partial<Pick<SessaoLocal<P, V>, 'perfil' | 'vinculos' | 'isSuper'>>) {
  const a = aba()
  if (!a) return
  const atual = lerSessaoLocal<P, V>()
  if (!parte.perfil && !atual) return // vínculo sem perfil não serve para nada
  const novo = {
    perfil: parte.perfil ? perfilReduzido(parte.perfil) : atual!.perfil,
    vinculos: parte.vinculos ?? atual?.vinculos ?? [],
    isSuper: parte.isSuper ?? atual?.isSuper ?? false,
    guardadoEm: Date.now(),
  }
  if (atual && parte.perfil && atual.perfil.id !== parte.perfil.id) { novo.vinculos = parte.vinculos ?? []; novo.isSuper = parte.isSuper ?? false }
  const cifrado = cifrar(JSON.stringify(novo))
  if (cifrado) a.setItem(CHAVE_SESSAO_LOCAL, cifrado)
}

export function apagarSessaoLocal() {
  try { aba()?.removeItem(CHAVE_SESSAO_LOCAL) } catch { /* sem armazenamento */ }
}

/** Perfil para abrir sem rede: o guardado nesta aba, da mesma pessoa, se a regra deixar. */
export function perfilSemConexao<P extends Perfil>(perfilId: string | null, pode: boolean): P | null {
  if (!pode) return null
  const s = lerSessaoLocal<P>(perfilId ?? undefined)
  return s?.perfil ?? null
}
