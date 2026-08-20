// ─────────────────────────────────────────────────────────────────────────────
// fhir:validar — valida os Bundles FHIR gerados contra o validador local da
// RNDS (aplicação Java em tools/rnds/validador-rnds.jar).
//
// Se o JAR não existir, lista os Bundles e avisa como obter (docs/rnds/VALIDADOR.md).
// ─────────────────────────────────────────────────────────────────────────────
import { execSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const JAR = resolve('tools/rnds/validador-rnds.jar')
const SNAP_DIR = resolve('scripts/interop/__snapshots__')

function bundlesGerados(): string[] {
  if (!existsSync(SNAP_DIR)) return []
  return readdirSync(SNAP_DIR)
    .filter((f) => f.endsWith('.json'))
    .map((f) => resolve(SNAP_DIR, f))
    .sort()
}

function main() {
  const bundles = bundlesGerados()
  console.log(`fhir:validar — ${bundles.length} Bundle(s) gerados`)
  for (const b of bundles) {
    const nome = b.split(/[\\/]/).pop()
    const tamanho = (readFileSync(b, 'utf8').length / 1024).toFixed(1)
    console.log(`  • ${nome} (${tamanho} KB)`)
  }

  if (!existsSync(JAR)) {
    console.log('')
    console.log('⚠️  Validador local NÃO encontrado em tools/rnds/validador-rnds.jar')
    console.log('   Veja docs/rnds/VALIDADOR.md para obter a aplicação Java')
    console.log('   (Portal de Serviços do DATASUS → RNDS → validador de perfis FHIR).')
    console.log('   Nenhum envio é feito — validação é 100% local.')
    process.exit(2)
  }

  // valida cada bundle com o JAR (entrada via stdin ou --arquivo conforme o JAR)
  let falhas = 0
  for (const b of bundles) {
    const nome = b.split(/[\\/]/).pop()
    try {
      const saida = execSync(`java -jar "${JAR}" "${b}"`, { encoding: 'utf8', timeout: 120_000 })
      console.log(`  ✓ ${nome}: ${saida.trim().slice(0, 200)}`)
    } catch (err) {
      falhas++
      const saida = (err as { stdout?: string; stderr?: string }).stderr ?? (err as Error).message
      console.log(`  ✗ ${nome}: ${saida.slice(0, 300)}`)
    }
  }
  if (falhas > 0) {
    console.log(`\n${falhas} Bundle(s) com falha de validação`)
    process.exit(1)
  }
  console.log('\n✓ Todos os Bundles válidos segundo o validador local.')
}

main()
