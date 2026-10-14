// Publica a API da biblioteca da branch atual como HOMOLOGAÇÃO no VPS
// (container biblioteca-api-homolog, porta 8711, rota /homolog/ no Caddy),
// sem tocar na API de produção (biblioteca-api). Decisão do RT em 13/10/2026.
// Também copia fontes.yaml (campo `publico`) e ferramentas.json (campo
// `publico`) e reindexa as ferramentas: os campos novos são ignorados pela
// API de produção.
//
// Portão 2, tarefa 1b: a homologação tem coleção de trechos própria
// (biblioteca_homolog, copiada da coleção da produção na primeira vez) e
// corpus próprio (/srv/biblioteca/corpus-homolog). A produção não muda.
//
// Uso: npm run biblioteca:homolog                  (código + corpus no VPS)
//      npm run biblioteca:homolog -- --ingerir     (e reingere o corpus na coleção da homologação)
//      npm run biblioteca:homolog -- --avaliar     (e roda as evals contra a homologação)
import { execFileSync } from 'node:child_process'
import { join } from 'node:path'

const raiz = join(import.meta.dirname, '..')
const VPS = process.env.BIBLIOTECA_VPS ?? 'root@179.199.128.141'
const run = (cmd, args) => execFileSync(cmd, args, { cwd: raiz, stdio: 'inherit' })
const ingerir = process.argv.includes('--ingerir')
const avaliar = process.argv.includes('--avaliar')
const COMPOSE = 'docker compose -f docker-compose.yml -f docker-compose.homolog.yml'
const QD = 'http://127.0.0.1:6333/collections'

run('node', ['--experimental-strip-types', 'scripts/ferramentas-json.mjs'])
run('node', ['--experimental-strip-types', 'scripts/corpus-central.mjs'])
run('ssh', [VPS, 'mkdir -p /srv/biblioteca/app-homolog /srv/biblioteca/evals && rm -rf /srv/biblioteca/corpus-homolog'])
run('scp', ['-q', 'biblioteca/ferramentas.json', 'biblioteca/fontes.yaml', 'biblioteca/docker-compose.homolog.yml', `${VPS}:/srv/biblioteca/`])
run('scp', ['-q', 'biblioteca/app/main.py', 'biblioteca/app/pii.py', 'biblioteca/app/publico.py', 'biblioteca/app/siglas.py',
  'biblioteca/app/armadilhas.py', 'biblioteca/app/ingest.py', 'biblioteca/app/index_tools.py', 'biblioteca/app/Dockerfile',
  'biblioteca/app/requirements.txt', `${VPS}:/srv/biblioteca/app-homolog/`])
run('scp', ['-q', '-r', 'biblioteca/corpus', `${VPS}:/srv/biblioteca/corpus-homolog`])
run('scp', ['-q', 'biblioteca/evals/run.py', 'biblioteca/evals/perguntas.yaml', 'biblioteca/evals/perguntas-falhas.yaml',
  'biblioteca/evals/perguntas-r2.yaml', `${VPS}:/srv/biblioteca/evals/`])

// cópia da coleção da produção, só se a da homologação ainda não existe
// (snapshot é leitura na coleção da produção; o arquivo é apagado em seguida)
const copiarColecao = `if ! curl -sf ${QD}/biblioteca_homolog > /dev/null; then`
  + ` N=$(curl -sf -X POST '${QD}/biblioteca/snapshots?wait=true' | grep -o '"name":"[^"]*"' | head -1 | cut -d'"' -f4)`
  + ` && curl -sf -X PUT '${QD}/biblioteca_homolog/snapshots/recover?wait=true' -H 'Content-Type: application/json'`
  + ` -d "{\\"location\\":\\"file:///qdrant/snapshots/biblioteca/$N\\"}" > /dev/null`
  + ` && curl -sf -X DELETE "${QD}/biblioteca/snapshots/$N" > /dev/null`
  + ' && echo "coleção biblioteca_homolog copiada da produção ($N)";'
  + ' fi'

run('ssh', [VPS, 'chown -R hermes:hermes /srv/biblioteca && cd /srv/biblioteca'
  + ` && ${copiarColecao}`
  + ` && ${COMPOSE} up -d --build api-homolog`
  + ' && docker compose run --rm -T api python index_tools.py'
  // docker exec no container já de pé: o `docker compose run` da ingestão
  // terminou mas não devolveu o terminal (14/10/2026)
  + (ingerir ? ' && docker exec biblioteca-api-homolog python -u ingest.py corpus' : '')
  + ' && sleep 5 && curl -s -w "\\nhomolog health: %{http_code}\\n" http://127.0.0.1:8711/health'])

if (avaliar) {
  for (const arq of ['perguntas-r2.yaml', 'perguntas.yaml', 'perguntas-falhas.yaml']) {
    try {
      run('ssh', [VPS, 'docker exec -e BIBLIOTECA_URL=http://127.0.0.1:8710'
        + ` -e EVALS_ARQUIVO=/srv/biblioteca/evals/${arq} biblioteca-api-homolog python -u /srv/biblioteca/evals/run.py`])
    } catch {
      console.log(`evals ${arq}: REPROVADO (ver a lista de falhas acima)`)
    }
  }
}
console.log('biblioteca de homologação publicada')
