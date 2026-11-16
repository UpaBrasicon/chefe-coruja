// Regenera ferramentas.json e o corpus da Central e copia a biblioteca para o
// VPS do Hermes (/srv/biblioteca), depois reindexa lá. Precisa da chave SSH
// do usuário (~/.ssh/id_ed25519) autorizada em root@VPS.
// Uso: npm run biblioteca:sync -- --confirmo-producao            (só copia e reindexa ferramentas)
//      npm run biblioteca:sync -- --confirmo-producao --ingerir (também reingere o corpus)
//
// É a PRODUÇÃO da biblioteca (S10, H4): só roda do master limpo, igual ao
// origin/master, e com --confirmo-producao. Mudança nova passa antes pela
// homologação (npm run biblioteca:homolog).
import { execFileSync } from 'node:child_process'
import { join } from 'node:path'

const raiz = join(import.meta.dirname, '..')
const VPS = process.env.BIBLIOTECA_VPS ?? 'root@179.199.128.141'
const run = (cmd, args) => execFileSync(cmd, args, { cwd: raiz, stdio: 'inherit' })

/** Decide se a publicação pode seguir. Puro, para teste. */
export function conferirSync({ porcelana, branch, head, origem, argv }) {
  if (!argv.includes('--confirmo-producao')) {
    return { ok: false, motivo: 'a biblioteca:sync publica na PRODUÇÃO; rode com --confirmo-producao (depois da homologação e do ok do RT)' }
  }
  if (branch !== 'master') return { ok: false, motivo: `o branch atual é ${branch || '(nenhum)'}; a produção só sai do master` }
  if (porcelana.trim() !== '') return { ok: false, motivo: 'há mudança não commitada (git status --porcelain); a produção só sai de código commitado' }
  if (!head || head !== origem) return { ok: false, motivo: 'o master local não é igual ao origin/master; rode git pull antes' }
  return { ok: true }
}

function estadoGit() {
  const git = (...args) => execFileSync('git', args, { cwd: raiz, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim()
  git('fetch', '-q', 'origin', 'master')
  return {
    porcelana: git('status', '--porcelain'),
    branch: git('rev-parse', '--abbrev-ref', 'HEAD'),
    head: git('rev-parse', 'HEAD'),
    origem: git('rev-parse', 'origin/master'),
  }
}

function principal() {
  // a flag primeiro: sem ela, nem consulta o git
  const argv = process.argv
  const git = argv.includes('--confirmo-producao') ? estadoGit() : { porcelana: '', branch: '', head: '', origem: '' }
  const r = conferirSync({ ...git, argv })
  if (!r.ok) {
    console.error(`RECUSADO: ${r.motivo}`)
    return 1
  }
  run('node', ['--experimental-strip-types', 'scripts/ferramentas-json.mjs'])
  run('node', ['--experimental-strip-types', 'scripts/corpus-central.mjs'])
  run('scp', ['-q', 'biblioteca/ferramentas.json', 'biblioteca/fontes.yaml', 'biblioteca/vocabulario-clinico.txt', `${VPS}:/srv/biblioteca/`])
  run('scp', ['-q', '-r', 'biblioteca/corpus', 'biblioteca/referencias', 'biblioteca/abertas-cc-by', 'biblioteca/abertas-cc-by-nc', `${VPS}:/srv/biblioteca/`])
  run('scp', ['-q', 'biblioteca/app/main.py', 'biblioteca/app/pii.py', 'biblioteca/app/publico.py', 'biblioteca/app/siglas.py', 'biblioteca/app/armadilhas.py', 'biblioteca/app/orfaos.py', 'biblioteca/app/pubmed.py',
    'biblioteca/app/ingest.py', 'biblioteca/app/index_tools.py',
    'biblioteca/app/Dockerfile', 'biblioteca/app/requirements.txt', `${VPS}:/srv/biblioteca/app/`])
  run('scp', ['-q', 'biblioteca/evals/perguntas.yaml', 'biblioteca/evals/run.py', `${VPS}:/srv/biblioteca/evals/`])
  // referencias/: fichas-resumo de obras com direitos reservados (só citação e resumo da equipe);
  // abertas-cc-by/ e abertas-cc-by-nc/: texto integral de artigos abertos (Europe PMC);
  // entram na ingestão depois que o RT registrar as pastas em fontes.yaml
  const ingerir = process.argv.includes('--ingerir') ? ' && docker compose run --rm -T api python ingest.py corpus' : ''
  // os .py entram na imagem (Dockerfile COPY): rebuild antes de rodar
  run('ssh', [VPS, `chown -R hermes:hermes /srv/biblioteca && cd /srv/biblioteca && docker compose build -q api && docker compose run --rm -T api python index_tools.py${ingerir}`])
  console.log('biblioteca sincronizada')
  return 0
}

// só roda quando chamado direto (o teste importa sem executar)
if (process.argv[1]?.replace(/\\/g, '/').endsWith('/biblioteca-sync.mjs')) {
  process.exit(principal())
}
