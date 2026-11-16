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
import { dirname, join, relative } from 'node:path'
import { caminhoConfinado, planejarAnexos } from './caminho.mjs'

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

const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx'
// No Windows o npx.cmd só roda via shell (cmd.exe). O único argumento variável
// é o caminho do arquivo: vai sempre entre aspas, e o que o cmd ainda
// interpretaria dentro das aspas (", %, !, quebra de linha) é recusado.
if (process.platform === 'win32' && /["%!\r\n]/.test(pasta)) {
  console.error('o caminho de --destino não pode ter ", %, ! nem quebra de linha (no Windows o npx roda pelo cmd.exe)')
  process.exit(1)
}
mkdirSync(pasta, { recursive: true })
function dump(arquivo, extras) {
  console.log(`→ ${arquivo}`)
  const q = (x) => (process.platform === 'win32' ? `"${x}"` : x)
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
  // erro HTTP aborta a exportação: nunca grava a página de erro como se fosse o anexo
  const pedir = async (u, init, oque) => {
    const r = await fetch(u, { ...init, headers: { ...h, ...(init?.headers ?? {}) } })
    if (!r.ok) throw new Error(`${oque}: HTTP ${r.status}`)
    return r
  }
  const seg = (s) => s.split('/').map(encodeURIComponent).join('/')
  const buckets = await (await pedir(`${url}/storage/v1/bucket`, {}, 'lista de buckets')).json()

  // 1. lista tudo (paginado: a API devolve no máximo `limit` itens por vez)
  const LIMITE = 1000
  const lista = []
  for (const b of buckets) {
    const fila = ['']
    while (fila.length) {
      const prefixo = fila.shift()
      // até a página voltar vazia (não confia em "página menor = última")
      let anterior = null
      for (let offset = 0; ; ) {
        const itens = await (await pedir(`${url}/storage/v1/object/list/${encodeURIComponent(b.id)}`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prefix: prefixo, limit: LIMITE, offset }),
        }, `lista do bucket ${b.id}`)).json()
        if (!Array.isArray(itens)) throw new Error(`lista do bucket ${b.id}: resposta inesperada`)
        if (itens.length === 0) break
        const marca = JSON.stringify(itens[0])
        if (marca === anterior) throw new Error(`lista do bucket ${b.id}: a paginação repetiu a página`)
        anterior = marca
        offset += itens.length
        for (const it of itens) {
          const caminho = prefixo ? `${prefixo}/${it.name}` : it.name
          if (!it.id) fila.push(caminho)   // pasta
          else lista.push({ bucket: b.id, nome: caminho })
        }
      }
    }
  }

  // 2. nome inválido ou colisão arquivo×pasta: pula com aviso (sem o nome)
  const { aceitos, pulados } = planejarAnexos(lista)
  for (const p of pulados) console.warn(`! anexo pulado no bucket ${p.bucket}: ${p.motivo} (${p.resumo})`)

  // 3. baixa, cada um confinado em <guarda>/storage/
  for (const a of aceitos) {
    const r = await pedir(`${url}/storage/v1/object/${encodeURIComponent(a.bucket)}/${seg(a.nome)}`, {}, `anexo do bucket ${a.bucket}`)
    const alvo = caminhoConfinado(join(pasta, 'storage'), `${a.bucket}/${a.nome}`)
    mkdirSync(dirname(alvo), { recursive: true })
    writeFileSync(alvo, Buffer.from(await r.arrayBuffer()))
  }
  storage = `${aceitos.length} arquivo(s) de ${buckets.length} bucket(s)`
    + (pulados.length ? `; ${pulados.length} PULADO(S) por nome inválido ou colisão` : '')
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
