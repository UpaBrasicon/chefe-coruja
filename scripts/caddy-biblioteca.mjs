// Publica hermes/deploy/Caddyfile no VPS e recarrega o Caddy do Hermes, com
// as travas que a troca de proxy pede (R2-13, 13/10/2026):
//   1. o Caddyfile do servidor tem de ser igual ao retrato registrado em
//      hermes/deploy/Caddyfile.servidor (senão alguém mexeu lá e a troca
//      apagaria a mudança: o script para e mostra);
//   2. cópia de segurança antes;
//   3. grava no MESMO arquivo (o contêiner monta o arquivo, não a pasta);
//   4. `caddy validate`; se falhar, volta a cópia e não recarrega;
//   5. `caddy reload` e conferência dos dois endereços.
// Uso: npm run caddy:biblioteca
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const raiz = join(import.meta.dirname, '..')
const VPS = process.env.BIBLIOTECA_VPS ?? 'root@179.199.128.141'
const ARQ = '/home/hermes/deploy/deploy/Caddyfile'
const CONTEINER = 'hermes-caddy'
const lf = (s) => s.replace(/\r\n/g, '\n')
const sh = (cmd, input) =>
  execFileSync('ssh', [VPS, cmd], { cwd: raiz, input, encoding: 'utf8', stdio: [input === undefined ? 'inherit' : 'pipe', 'pipe', 'inherit'] })

const novo = lf(readFileSync(join(raiz, 'hermes/deploy/Caddyfile'), 'utf8'))
const base = lf(readFileSync(join(raiz, 'hermes/deploy/Caddyfile.servidor'), 'utf8'))
const servidor = lf(sh(`cat ${ARQ}`))

if (servidor === novo) {
  console.log('O Caddyfile do servidor já é o desta branch. Nada a fazer.')
  process.exit(0)
}
if (servidor !== base) {
  console.error(`PARADO: o Caddyfile do servidor (${ARQ}) é diferente de hermes/deploy/Caddyfile.servidor.`)
  console.error('Alguém mudou o arquivo direto no VPS. Compare antes de trocar:')
  console.error(`  ssh ${VPS} "cat ${ARQ}"`)
  process.exit(1)
}

const copia = `${ARQ}.antes-r2-13`
sh(`cp -p ${ARQ} ${copia}`)
sh(`cat > ${ARQ}`, novo)
try {
  sh(`docker exec ${CONTEINER} caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile`)
} catch {
  sh(`cat ${copia} > ${ARQ}`)
  console.error('PARADO: o Caddy recusou o arquivo novo. A cópia anterior foi devolvida e o Caddy não foi recarregado.')
  process.exit(1)
}
sh(`docker exec ${CONTEINER} caddy reload --config /etc/caddy/Caddyfile --adapter caddyfile`)
console.log(sh('sleep 2; curl -s -o /dev/null -w "produção /health: %{http_code}\\n" https://biblioteca.chefecoruja.com.br/health;'
  + ' curl -s -o /dev/null -w "homologação /homolog/health: %{http_code}\\n" https://biblioteca.chefecoruja.com.br/homolog/health'))
console.log(`Caddy recarregado. Cópia anterior em ${copia}.`)
