// Trava de alvo do Supabase (Fase 0, tarefa 2 — BACKLOG.md, regra 3:
// "nunca aplique nada diretamente em produção; o alvo padrão é homologação").
//
// O CLI do Supabase age no projeto LIGADO (supabase/.temp/project-ref). Este
// script confere o projeto ligado antes de qualquer comando que escreve no
// banco remoto e recusa quando o alvo não é o esperado.
//
// Uso:
//   node scripts/ambiente/supabase-alvo.mjs qual
//   node scripts/ambiente/supabase-alvo.mjs push homolog
//   node scripts/ambiente/supabase-alvo.mjs reset homolog          (APAGA o banco de homologação)
//   node scripts/ambiente/supabase-alvo.mjs functions homolog
//   node scripts/ambiente/supabase-alvo.mjs push producao --confirmo-producao
//
// Ligar um projeto (pede a senha do banco, digitada por quem opera):
//   npx supabase link --project-ref <ref>
import { readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'

export const PROJETOS = {
  producao: 'saqjrjtrkzkswsxxvdxn',
  homolog: 'puzivzsfyheiqjqyibhk',
}

const nomeDoRef = (ref) => Object.entries(PROJETOS).find(([, r]) => r === ref)?.[0] ?? 'desconhecido'

export function projetoLigado() {
  try {
    return readFileSync('supabase/.temp/project-ref', 'utf8').trim()
  } catch {
    return ''
  }
}

/** Decide se a ação pode seguir. Puro, para teste. */
export function conferirAlvo({ acao, alvo, ligado, confirmaProducao }) {
  if (!['push', 'reset', 'functions'].includes(acao)) return { ok: false, motivo: `ação desconhecida: ${acao}` }
  if (!(alvo in PROJETOS)) return { ok: false, motivo: `alvo desconhecido: ${alvo} (use homolog ou producao)` }
  if (ligado !== PROJETOS[alvo]) {
    return {
      ok: false,
      motivo: `o projeto ligado é ${nomeDoRef(ligado)} (${ligado || 'nenhum'}), não ${alvo}. Ligue antes: npx supabase link --project-ref ${PROJETOS[alvo]}`,
    }
  }
  if (alvo === 'producao' && acao === 'reset') return { ok: false, motivo: 'reset em produção é proibido' }
  if (alvo === 'producao' && !confirmaProducao) {
    return { ok: false, motivo: 'produção exige --confirmo-producao e a mudança já validada em homologação (BACKLOG.md, regra 3)' }
  }
  return { ok: true }
}

const COMANDOS = {
  push: ['supabase', 'db', 'push', '--linked'],
  // --no-seed: o seed.sql tem usuários com senha conhecida, só para o banco local
  reset: ['supabase', 'db', 'reset', '--linked', '--no-seed'],
  functions: ['supabase', 'functions', 'deploy'],
}

function principal(argv) {
  const [acao, alvo, ...resto] = argv
  const ligado = projetoLigado()
  if (acao === 'qual' || !acao) {
    console.log(`Projeto ligado: ${nomeDoRef(ligado)} (${ligado || 'nenhum'})`)
    return 0
  }
  const r = conferirAlvo({ acao, alvo, ligado, confirmaProducao: resto.includes('--confirmo-producao') })
  if (!r.ok) {
    console.error(`RECUSADO: ${r.motivo}`)
    return 1
  }
  const args = [...COMANDOS[acao]]
  if (acao === 'functions') args.push('--project-ref', PROJETOS[alvo])
  console.log(`Alvo conferido: ${alvo} (${PROJETOS[alvo]}). Rodando: npx ${args.join(' ')}`)
  const p = spawnSync('npx', args, { stdio: 'inherit', shell: process.platform === 'win32' })
  return p.status ?? 1
}

// só roda quando chamado direto (o teste importa sem executar)
if (process.argv[1]?.replace(/\\/g, '/').endsWith('/supabase-alvo.mjs')) {
  process.exit(principal(process.argv.slice(2)))
}
