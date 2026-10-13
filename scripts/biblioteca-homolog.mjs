// Publica a API da biblioteca da branch atual como HOMOLOGAÇÃO no VPS
// (container biblioteca-api-homolog, porta 8711, rota /homolog/ no Caddy),
// sem tocar na API de produção (biblioteca-api). Decisão do RT em 13/10/2026.
// Também copia fontes.yaml (campo `publico`) e ferramentas.json (campo
// `publico`) e reindexa as ferramentas: os campos novos são ignorados pela
// API de produção.
// Uso: npm run biblioteca:homolog
import { execFileSync } from 'node:child_process'
import { join } from 'node:path'

const raiz = join(import.meta.dirname, '..')
const VPS = process.env.BIBLIOTECA_VPS ?? 'root@179.199.128.141'
const run = (cmd, args) => execFileSync(cmd, args, { cwd: raiz, stdio: 'inherit' })

run('node', ['--experimental-strip-types', 'scripts/ferramentas-json.mjs'])
run('ssh', [VPS, 'mkdir -p /srv/biblioteca/app-homolog'])
run('scp', ['-q', 'biblioteca/ferramentas.json', 'biblioteca/fontes.yaml', 'biblioteca/docker-compose.homolog.yml', `${VPS}:/srv/biblioteca/`])
run('scp', ['-q', 'biblioteca/app/main.py', 'biblioteca/app/pii.py', 'biblioteca/app/publico.py', 'biblioteca/app/siglas.py',
  'biblioteca/app/ingest.py', 'biblioteca/app/index_tools.py', 'biblioteca/app/Dockerfile', 'biblioteca/app/requirements.txt',
  `${VPS}:/srv/biblioteca/app-homolog/`])
run('ssh', [VPS, 'chown -R hermes:hermes /srv/biblioteca && cd /srv/biblioteca'
  + ' && docker compose -f docker-compose.yml -f docker-compose.homolog.yml up -d --build api-homolog'
  + ' && docker compose run --rm -T api python index_tools.py'
  + ' && sleep 5 && curl -s -o /dev/null -w "homolog health: %{http_code}\n" http://127.0.0.1:8711/health'])
console.log('biblioteca de homologação publicada')
