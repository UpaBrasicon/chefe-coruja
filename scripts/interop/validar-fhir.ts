// ─────────────────────────────────────────────────────────────────────────────
// fhir:validar — valida os Bundles FHIR gerados com o validador local oficial
// da RNDS, num contêiner SEM REDE (decisão do RT, 5C-5.2).
//
// O aplicativo do DATASUS só tem tela; tools/rnds/validador/ValidarRnds.java
// chama o motor dele direto. O aplicativo e as definições não entram no
// repositório: ficam na pesquisa (produto/docs/pesquisa/rnds-oficial/, com
// SHA-256) e são extraídos para tools/rnds/.cache/.
//
// Uso:
//   npm run fhir:validar                               # os snapshots
//   npm run fhir:validar -- --arquivo a.json --arquivo b.json
//
// Precisa de Docker e de um JDK no PATH (javac, para compilar a classe).
// Caminhos: RNDS_VALIDADOR_ZIP e RNDS_DEFINICOES_ZIP, ou a pasta da pesquisa
// procurada a partir do diretório atual. Ver docs/rnds/VALIDADOR.md.
// ─────────────────────────────────────────────────────────────────────────────
import { execFileSync, spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync } from 'node:fs'
import { basename, dirname, resolve } from 'node:path'

// eclipse-temurin:17-jre, fixada por digest (baixada em 28/10/2026)
const IMAGEM = 'eclipse-temurin@sha256:4faa9eaf440514dd4f7ef71fecb92526e13679aea039bed5d2fc98e885c60dee'
const CACHE = resolve('tools/rnds/.cache')
const FONTE = resolve('tools/rnds/validador/ValidarRnds.java')
const SNAP_DIR = resolve('scripts/interop/__snapshots__')

function pastaPesquisa(): string | null {
  let dir = process.cwd()
  for (;;) {
    const p = resolve(dir, 'produto/docs/pesquisa/rnds-oficial')
    if (existsSync(p)) return p
    const acima = dirname(dir)
    if (acima === dir) return null
    dir = acima
  }
}

function zip(variavel: string, relativo: string): string {
  const doAmbiente = process.env[variavel]
  if (doAmbiente) return resolve(doAmbiente)
  const pesquisa = pastaPesquisa()
  if (!pesquisa) throw new Error(`${variavel} não definida e produto/docs/pesquisa/rnds-oficial não encontrada`)
  return resolve(pesquisa, relativo)
}

// SHA-256 registrados em produto/docs/pesquisa/rnds-oficial/SHA256SUMS.txt (10/10/2026)
const SHA256: Record<string, string> = {
  'SOA-RNDS_ValidadorLocal_Aplicativo.zip': 'c39777b051ca459df6ea356db600219fe752dd6e90b88fa89a6a6737c99aa3a4',
  'definicoes-validador-sa.zip': 'f5116c43f11013ad195d24c7ea06a8a9cd245184bc72abbfc1a0065df63057f2',
}

function extrair(arquivo: string, destino: string) {
  if (existsSync(destino)) return
  if (!existsSync(arquivo)) throw new Error(`não encontrado: ${arquivo}`)
  // o aplicativo não tem assinatura conferível: só roda o arquivo baixado em 10/10/2026
  const hash = createHash('sha256').update(readFileSync(arquivo)).digest('hex')
  if (hash !== SHA256[basename(arquivo)]) throw new Error(`SHA-256 diferente do registrado: ${arquivo}`)
  mkdirSync(destino, { recursive: true })
  execFileSync('unzip', ['-q', '-o', arquivo, '-x', '__MACOSX/*', '-d', destino], { stdio: 'inherit' })
}

function bundles(): string[] {
  const args = process.argv.slice(2)
  const escolhidos = args.flatMap((a, i) => (a === '--arquivo' && args[i + 1] ? [resolve(args[i + 1])] : []))
  if (escolhidos.length) return escolhidos
  return readdirSync(SNAP_DIR).filter((f) => f.endsWith('.json')).sort().map((f) => resolve(SNAP_DIR, f))
}

function main() {
  const app = resolve(CACHE, 'aplicativo')
  const defs = resolve(CACHE, 'definicoes')
  extrair(zip('RNDS_VALIDADOR_ZIP', 'validador/SOA-RNDS_ValidadorLocal_Aplicativo.zip'), app)
  extrair(zip('RNDS_DEFINICOES_ZIP', 'sa/definicoes-validador-sa.zip'), defs)
  const libs = resolve(app, 'rnds-fhir-validador/libs')

  const classes = resolve(CACHE, 'classes')
  mkdirSync(classes, { recursive: true })
  execFileSync('javac', ['--release', '8', '-nowarn', '-cp', `${libs}/*`, '-d', classes, FONTE], { stdio: 'inherit' })

  // só os Bundles escolhidos entram no contêiner
  const entrada = resolve(CACHE, 'entrada')
  rmSync(entrada, { recursive: true, force: true })
  mkdirSync(entrada)
  const arquivos = bundles()
  for (const b of arquivos) copyFileSync(b, resolve(entrada, basename(b)))
  console.log(`fhir:validar — ${arquivos.length} Bundle(s), contêiner sem rede`)

  const r = spawnSync('docker', [
    'run', '--rm', '--network', 'none', '--read-only', '--tmpfs', '/tmp',
    '-v', `${libs}:/v/libs:ro`,
    '-v', `${resolve(defs, 'arquivos_definicoes')}:/v/definicoes:ro`,
    '-v', `${classes}:/v/classes:ro`,
    '-v', `${entrada}:/v/entrada:ro`,
    IMAGEM,
    'java', '-cp', '/v/classes:/v/libs/*', 'ValidarRnds', '/v/definicoes',
    ...arquivos.map((b) => `/v/entrada/${basename(b)}`),
  ], { stdio: 'inherit' })
  process.exit(r.status ?? 1)
}

main()
