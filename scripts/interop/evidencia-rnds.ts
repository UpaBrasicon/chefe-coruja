// ─────────────────────────────────────────────────────────────────────────────
// rnds:evidencia — monta a evidência que o DATASUS pede para liberar a produção
// (manual de apoio, p. 30–33; manual RAC §4.2; docs/rnds/CHECKLIST.md, seção 6):
// um único PDF de até 10 MB com
//   1. o validador local oficial sem erro;
//   2. o header da resposta 201 da RNDS;
//   3. o Bundle enviado.
//
// Parte de um item já enviado da fila (interop_outbox): o serviço guarda o
// Bundle e a resposta, com os headers, em cada item (5.3b e 5.5a).
//
// Uso (no projeto ligado à homologação, onde os testes oficiais rodam):
//   npm run rnds:evidencia -- --item <uuid do item> [--saida <pasta>]
//
// Precisa do que o fhir:validar precisa (Docker e JDK) e do Edge ou Chrome para
// gerar o PDF (EDGE_BIN). O Bundle leva os dados do paciente do teste: use só
// pacientes fictícios (decisão do RT na 5.5, "c a").
// ─────────────────────────────────────────────────────────────────────────────
import { execSync, spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { parseArgs } from 'node:util'
import { chromium } from 'playwright-core'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
const LIMITE = 10 * 1024 * 1024
const NAVEGADOR = process.env.EDGE_BIN || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
const TIPO: Record<string, string> = { rac: 'RAC — Registro de Atendimento Clínico', sumario_alta: 'Sumário de Alta', regulacao: 'Regulação assistencial (MIRA)' }

type Item = {
  id: string; tipo_documento: string; enviado_em: string; id_rnds: string
  bundle_enviado: unknown; resposta: { status: number; headers?: Record<string, string>; location?: string }
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!)

function lerItem(id: string, pasta: string): Item {
  const sql = join(pasta, 'item.sql')
  writeFileSync(sql, `SELECT id, tipo_documento, enviado_em, id_rnds, bundle_enviado, resposta
  FROM public.interop_outbox WHERE id = '${id}' AND status = 'enviado' AND bundle_enviado IS NOT NULL;\n`)
  // o caminho vem do tmpdir; o id já passou pela regex de UUID
  const saida = execSync(`npx supabase db query --linked -o json -f "${sql}"`, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
  const json = JSON.parse(saida.slice(saida.indexOf('{'))) as { rows?: Item[] }
  const item = json.rows?.[0]
  if (!item) throw new Error(`item ${id} não encontrado como enviado, com o Bundle gravado`)
  return item
}

function validar(bundle: string): { ok: boolean; texto: string } {
  const r = spawnSync(process.execPath, ['scripts/interop/validar-fhir.ts', '--arquivo', bundle], { encoding: 'utf8' })
  // sem a carga das definições (centenas de linhas): fica o item, o resultado e o resumo
  const texto = `${r.stdout ?? ''}${r.stderr ?? ''}`.split(/\r?\n/)
    .filter((l) => l.trim() && !/^\s*->|ResouceValidator|^SLF4J/.test(l)).join('\n')
  return { ok: r.status === 0, texto }
}

function html(item: Item, validador: string): string {
  const r = item.resposta
  const headers = Object.entries(r.headers ?? (r.location ? { location: r.location } : {}))
    .map(([k, v]) => `${esc(k)}: ${esc(v)}`).join('\n')
  const bloco = (titulo: string, conteudo: string) => `<section><h2>${titulo}</h2><pre>${conteudo}</pre></section>`
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Evidência RNDS</title><style>
    body { font: 11px/1.45 system-ui, sans-serif; color: #111; margin: 24px; }
    h1 { font-size: 16px; margin: 0 0 4px; } h2 { font-size: 13px; margin: 18px 0 6px; border-bottom: 1px solid #ccc; padding-bottom: 3px; }
    p { margin: 0 0 2px; } pre { font: 9.5px/1.4 Consolas, monospace; background: #f6f6f6; border: 1px solid #ddd; padding: 8px; white-space: pre-wrap; word-break: break-all; margin: 0; }
  </style></head><body>
    <h1>Evidência de homologação — ${esc(TIPO[item.tipo_documento] ?? item.tipo_documento)}</h1>
    <p>Sistema: Chefe Coruja · documento enviado em ${esc(new Date(item.enviado_em).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }))} (Brasília) · id RNDS ${esc(item.id_rnds)}</p>
    ${bloco('1. Validador local oficial da RNDS', esc(validador))}
    ${bloco('2. Resposta da RNDS', `HTTP ${r.status}\n${headers}`)}
    ${bloco('3. Bundle enviado', esc(JSON.stringify(item.bundle_enviado, null, 2)))}
  </body></html>`
}

const { values } = parseArgs({ options: { item: { type: 'string' }, saida: { type: 'string' } } })
if (!values.item || !UUID.test(values.item)) {
  console.error('uso: npm run rnds:evidencia -- --item <uuid do item enviado> [--saida <pasta>]')
  process.exit(2)
}
const tmp = mkdtempSync(join(tmpdir(), 'rnds-evidencia-'))
try {
  const item = lerItem(values.item, tmp)
  if (item.resposta?.status !== 201) throw new Error(`a resposta gravada é ${item.resposta?.status}, não 201`)
  const bundle = join(tmp, `${item.tipo_documento}-${item.id}.json`)
  writeFileSync(bundle, JSON.stringify(item.bundle_enviado, null, 2))
  const v = validar(bundle)
  if (!v.ok) throw new Error(`o validador local apontou erro; a evidência não é gerada:\n${v.texto}`)
  const destino = resolve(values.saida ?? '.')
  mkdirSync(destino, { recursive: true })
  const pdf = join(destino, `evidencia-rnds-${item.tipo_documento}-${item.id.slice(0, 8)}.pdf`)
  const nav = await chromium.launch({ executablePath: NAVEGADOR, headless: true })
  const pagina = await nav.newPage()
  await pagina.setContent(html(item, v.texto))
  await pagina.pdf({ path: pdf, format: 'A4', margin: { top: '12mm', bottom: '12mm', left: '10mm', right: '10mm' } })
  await nav.close()
  const tamanho = statSync(pdf).size
  if (tamanho > LIMITE) throw new Error(`o PDF tem ${(tamanho / 1048576).toFixed(1)} MB; o limite do DATASUS é 10 MB`)
  console.log(`evidência: ${pdf} (${(tamanho / 1024).toFixed(0)} KB)`)
} catch (e) {
  console.error(`rnds:evidencia: ${(e as Error).message}`)
  process.exitCode = 1
} finally {
  rmSync(tmp, { recursive: true, force: true })
}
