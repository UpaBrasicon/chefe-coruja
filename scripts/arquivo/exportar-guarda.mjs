// Arquivamento de longo prazo (fase 8; Lei 13.787/2018, art. 6º; ADR 0004).
//
// O backup da Supabase guarda de 7 a 30 dias e não inclui o Storage. Este
// script gera uma cópia completa e verificável, para guardar FORA da Supabase
// (disco externo criptografado, cofre de nuvem no Brasil etc.):
//
//   <destino>/guarda-AAAA-MM-DD-HHMM/
//     papeis.sql          papéis do cluster
//     esquema.sql         estrutura (tabelas, funções, policies)
//     dados.sql           todos os dados (COPY)
//     storage/<bucket>/…  anexos, se houver credencial de serviço
//     MANIFESTO.json      data, origem, tamanho e sha256 de cada arquivo
//
// Uso:
//   node scripts/arquivo/exportar-guarda.mjs --local  --destino <pasta>   (teste)
//   node scripts/arquivo/exportar-guarda.mjs --linked --destino <pasta>   (produção)
// Para os anexos, defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no ambiente
// antes de rodar (o script não lê .env e não imprime chaves).
//
// A cópia contém dados de saúde: o destino precisa ser criptografado, com
// acesso restrito e registro de quem acessa. Conferir depois com
//   node scripts/arquivo/conferir-guarda.mjs <pasta-da-guarda>
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { join, relative } from 'node:path'

const args = process.argv.slice(2)
const origem = args.includes('--linked') ? '--linked' : args.includes('--local') ? '--local' : null
const iDest = args.indexOf('--destino')
const destinoBase = iDest >= 0 ? args[iDest + 1] : null
if (!origem || !destinoBase) {
  console.error('uso: node scripts/arquivo/exportar-guarda.mjs (--local|--linked) --destino <pasta>')
  process.exit(1)
}

const agora = new Date()
const carimbo = agora.toLocaleString('sv-SE', { timeZone: 'America/Sao_Paulo' }).replace(/[: ]/g, '').replace(/^(\d{4}-\d{2}-\d{2})(\d{4}).*/, '$1-$2')
const pasta = join(destinoBase, `guarda-${carimbo}`)
mkdirSync(pasta, { recursive: true })

const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx'
function dump(arquivo, extras) {
  console.log(`→ ${arquivo}`)
  // no Windows o npx roda via shell: caminho com espaço precisa de aspas
  const q = (x) => (process.platform === 'win32' && /\s/.test(x) ? `"${x}"` : x)
  execFileSync(npx, ['supabase', 'db', 'dump', origem, '-f', q(join(pasta, arquivo)), ...extras], {
    stdio: ['ignore', 'inherit', 'inherit'], shell: process.platform === 'win32',
  })
}
dump('papeis.sql', ['--role-only'])
dump('esquema.sql', [])
dump('dados.sql', ['--data-only', '--use-copy'])

// Storage (anexos): só com credencial de serviço no ambiente.
const url = process.env.SUPABASE_URL
const chave = process.env.SUPABASE_SERVICE_ROLE_KEY
let storage = 'não exportado: defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY para incluir os anexos'
if (url && chave) {
  const h = { Authorization: `Bearer ${chave}`, apikey: chave }
  const buckets = await (await fetch(`${url}/storage/v1/bucket`, { headers: h })).json()
  let total = 0
  for (const b of buckets) {
    const fila = ['']
    while (fila.length) {
      const prefixo = fila.shift()
      const itens = await (await fetch(`${url}/storage/v1/object/list/${b.id}`, {
        method: 'POST', headers: { ...h, 'Content-Type': 'application/json' },
        body: JSON.stringify({ prefix: prefixo, limit: 1000, offset: 0 }),
      })).json()
      for (const it of itens) {
        const caminho = prefixo ? `${prefixo}/${it.name}` : it.name
        if (!it.id) { fila.push(caminho); continue }  // pasta
        const r = await fetch(`${url}/storage/v1/object/${b.id}/${caminho}`, { headers: h })
        const alvo = join(pasta, 'storage', b.id, ...caminho.split('/'))
        mkdirSync(join(alvo, '..'), { recursive: true })
        writeFileSync(alvo, Buffer.from(await r.arrayBuffer()))
        total++
      }
    }
  }
  storage = `${total} arquivo(s) de ${buckets.length} bucket(s)`
}

// Manifesto com sha256 de cada arquivo.
const arquivos = []
const varrer = (d) => {
  for (const a of readdirSync(d)) {
    const c = join(d, a)
    if (statSync(c).isDirectory()) varrer(c)
    else if (a !== 'MANIFESTO.json') {
      arquivos.push({ arquivo: relative(pasta, c).replace(/\\/g, '/'), bytes: statSync(c).size, sha256: createHash('sha256').update(readFileSync(c)).digest('hex') })
    }
  }
}
varrer(pasta)
const manifesto = {
  gerado_em: agora.toISOString(),
  origem: origem === '--linked' ? 'projeto Supabase ligado (produção)' : 'banco local',
  base_legal: 'Lei 13.787/2018, art. 6º: guarda mínima de 20 anos a partir do último registro',
  storage,
  arquivos,
}
writeFileSync(join(pasta, 'MANIFESTO.json'), JSON.stringify(manifesto, null, 2))
console.log(`guarda gerada em ${pasta} · ${arquivos.length} arquivo(s) · storage: ${storage}`)
