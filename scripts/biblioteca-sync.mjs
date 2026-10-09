// Regenera ferramentas.json e o corpus da Central e copia a biblioteca para o
// VPS do Hermes (/srv/biblioteca), depois reindexa lá. Precisa da chave SSH
// do usuário (~/.ssh/id_ed25519) autorizada em root@VPS.
// Uso: npm run biblioteca:sync            (só copia e reindexa ferramentas)
//      npm run biblioteca:sync -- --ingerir (também reingere o corpus)
import { execFileSync } from 'node:child_process'
import { join } from 'node:path'

const raiz = join(import.meta.dirname, '..')
const VPS = process.env.BIBLIOTECA_VPS ?? 'root@179.199.128.141'
const run = (cmd, args) => execFileSync(cmd, args, { cwd: raiz, stdio: 'inherit' })

run('node', ['--experimental-strip-types', 'scripts/ferramentas-json.mjs'])
run('node', ['--experimental-strip-types', 'scripts/corpus-central.mjs'])
run('scp', ['-q', 'biblioteca/ferramentas.json', 'biblioteca/fontes.yaml', `${VPS}:/srv/biblioteca/`])
run('scp', ['-q', '-r', 'biblioteca/corpus', 'biblioteca/referencias', `${VPS}:/srv/biblioteca/`])
run('scp', ['-q', 'biblioteca/app/main.py', 'biblioteca/app/pii.py', 'biblioteca/app/ingest.py', 'biblioteca/app/index_tools.py',
  'biblioteca/app/Dockerfile', 'biblioteca/app/requirements.txt', `${VPS}:/srv/biblioteca/app/`])
run('scp', ['-q', 'biblioteca/evals/perguntas.yaml', 'biblioteca/evals/run.py', `${VPS}:/srv/biblioteca/evals/`])
// referencias/: fichas-resumo de obras com direitos reservados (só citação e resumo da equipe);
// entra na ingestão depois que o RT registrar a pasta em fontes.yaml
const ingerir = process.argv.includes('--ingerir') ? ' && docker compose run --rm -T api python ingest.py corpus' : ''
// os .py entram na imagem (Dockerfile COPY): rebuild antes de rodar
run('ssh', [VPS, `chown -R hermes:hermes /srv/biblioteca && cd /srv/biblioteca && docker compose build -q api && docker compose run --rm -T api python index_tools.py${ingerir}`])
console.log('biblioteca sincronizada')
