// Limpeza da massa LOADTEST (homologação). Roda com a service_role do .env.
// Dry-run por padrão (só conta). Para aplicar: node setup/limpar_massa.mjs --apply
//
// 🛑 Antes de --apply: mostrar o plano ao RT e esperar o ok.
// Nunca desligar gatilhos de imutabilidade para limpar. O que é só inserção fica:
// pacientes, episódios, internações, prescrições, classificações, observação,
// log_auditoria e log_acesso_prontuario (guarda de 20 anos, migration
// 20261001000004 e seguintes). Unidade, setores, leitos e organização não podem
// ser apagados porque essas tabelas apontam para eles sem ON DELETE: ficam com
// ativo=false. Os usuários carga-* também não podem ser apagados (log_auditoria,
// prescricoes e episodios apontam para eles): ficam banidos e com perfil inativo.
import { createClient } from '@supabase/supabase-js'
import { carregarEnv, ORG_LOADTEST } from './_lib.mjs'

const env = carregarEnv()
const APLICAR = process.argv.includes('--apply')
const admin = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const ids = (r, tabela) => {
  if (r.error) throw new Error(`${tabela}: ${r.error.message}`)
  return (r.data ?? []).map((x) => x.id)
}
const U = ids(await admin.from('unidades').select('id').eq('organizacao_id', ORG_LOADTEST), 'unidades')
if (!U.length) {
  console.log('Nenhuma unidade da organização de carga. Nada a limpar.')
  process.exit(0)
}
const S = ids(await admin.from('setores').select('id').in('unidade_id', U), 'setores')
const C = ids(await admin.from('conversas').select('id').in('unidade_id', U), 'conversas')

// Apagáveis, das filhas para os pais. A escala grava em historico_escala num
// gatilho AFTER DELETE, por isso o histórico vem depois dela.
const APAGAVEIS = [
  ['chat_mensagens', (q) => q.in('conversa_id', C)],
  ['conversa_participantes', (q) => q.in('conversa_id', C)],
  ['conversas', (q) => q.in('unidade_id', U)],
  ['notificacoes_plantonista', (q) => q.in('unidade_id', U)],
  ['presenca_plantonista', (q) => q.in('unidade_id', U)],
  ['escala_plantao', (q) => q.in('unidade_id', U)],
  ['historico_escala', (q) => q.in('unidade_id', U)],
  ['vinculos', (q) => q.in('unidade_id', U)],
  ['dispositivos_confiaveis', (q) => q.eq('rotulo', 'LOADTEST k6')],
]
// Ficam, com ativo=false.
const DESATIVAR = [
  ['leitos', (q) => q.in('setor_id', S)],
  ['setores', (q) => q.in('unidade_id', U)],
  ['unidades', (q) => q.eq('organizacao_id', ORG_LOADTEST)],
  ['organizacoes', (q) => q.eq('id', ORG_LOADTEST)],
]

const { data: lista, error: erroLista } = await admin.auth.admin.listUsers({ perPage: 1000 })
if (erroLista) throw new Error(`listUsers: ${erroLista.message}`)
const usuarios = (lista?.users ?? []).filter((u) => u.user_metadata?.loadtest === true && /@loadtest\.invalid$/.test(u.email ?? ''))

console.log(`Organização ${ORG_LOADTEST}: ${U.length} unidade(s), ${S.length} setor(es), ${C.length} conversa(s), ${usuarios.length} usuário(s) carga-*`)
for (const [t, filtro] of APAGAVEIS) {
  const { count, error } = await filtro(admin.from(t).select('*', { count: 'exact', head: true }))
  console.log(`apagar   ${t}: ${error ? 'erro ' + error.message : count}`)
}
for (const [t, filtro] of DESATIVAR) {
  const { count, error } = await filtro(admin.from(t).select('*', { count: 'exact', head: true }))
  console.log(`desativar ${t}: ${error ? 'erro ' + error.message : count}`)
}
console.log('Ficam como estão (só inserção): pacientes, episódios, internações, prescrições e registros de auditoria.')

if (!APLICAR) {
  console.log('\nDry-run. Mostre este plano ao RT e rode com --apply só depois do ok.')
  process.exit(0)
}

for (const [t, filtro] of APAGAVEIS) {
  const { error } = await filtro(admin.from(t).delete())
  console.log(`${t}: ${error ? 'ERRO ' + error.message : 'apagado'}`)
}
for (const [t, filtro] of DESATIVAR) {
  const { error } = await filtro(admin.from(t).update({ ativo: false }))
  console.log(`${t}: ${error ? 'ERRO ' + error.message : 'ativo=false'}`)
}
for (const u of usuarios) {
  const p = await admin.from('perfis').update({ ativo: false }).eq('id', u.id)
  const b = await admin.auth.admin.updateUserById(u.id, { ban_duration: '876000h' })
  if (p.error || b.error) console.log(`${u.email}: ERRO ${p.error?.message ?? ''} ${b.error?.message ?? ''}`)
}
console.log(`Limpeza aplicada: ${usuarios.length} usuário(s) banido(s); o que é só inserção ficou.`)
