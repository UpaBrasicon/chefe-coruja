// ─────────────────────────────────────────────────────────────────────────────
// Testes de snapshot dos Bundles FHIR (FASE 4A)
//
// Gera os Bundles a partir das fixtures e compara com snapshots versionados
// (scripts/interop/__snapshots__/). Use --atualizar para regenerar.
//
// Uso:
//   node --test scripts/interop/tests/bundles.test.ts
//   node scripts/interop/tests/bundles.test.ts --atualizar
// ─────────────────────────────────────────────────────────────────────────────
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

import {
  montarBundleRAC,
  montarBundleSumarioAlta,
} from '../../../src/interop/fhir/mappers.ts'
import {
  fixtureAltaParaCasa,
  fixtureComEvasao,
  fixtureComInternacao,
  fixtureSumarioAltaParaCasa,
} from '../../../src/interop/fhir/__fixtures__.ts'

const ATUALIZAR = process.argv.includes('--atualizar')
const SNAP_DIR = resolve('scripts/interop/__snapshots__')

type SnapshotCase = {
  nome: string
  gerar: () => unknown
}

const CASOS: SnapshotCase[] = [
  { nome: 'rac-alta-para-casa.json', gerar: () => montarBundleRAC(fixtureAltaParaCasa()) },
  { nome: 'rac-com-internacao.json', gerar: () => montarBundleRAC(fixtureComInternacao()) },
  { nome: 'rac-com-evasao.json', gerar: () => montarBundleRAC(fixtureComEvasao()) },
  { nome: 'sumario-alta-para-casa.json', gerar: () => montarBundleSumarioAlta(fixtureSumarioAltaParaCasa()) },
]

function serializar(bundle: unknown): string {
  return JSON.stringify(bundle, null, 2) + '\n'
}

describe('snapshots de Bundle FHIR', () => {
  for (const caso of CASOS) {
    it(`snapshot ${caso.nome}`, () => {
      mkdirSync(SNAP_DIR, { recursive: true })
      const caminho = resolve(SNAP_DIR, caso.nome)
      const gerado = serializar(caso.gerar())

      if (ATUALIZAR || !existsSync(caminho)) {
        writeFileSync(caminho, gerado)
        assert.ok(true, `snapshot ${caso.nome} gerado (${gerado.length} bytes)`)
        return
      }

      const anterior = readFileSync(caminho, 'utf8')
      if (anterior !== gerado) {
        // permite regenerar com --atualizar
        writeFileSync(caminho, gerado)
        assert.fail(
          `snapshot ${caso.nome} DIVERGE — atualizado (rode sem --atualizar p/ confirmar). Diff:\n` +
            primeiroDiff(anterior, gerado)
        )
      }
      assert.equal(anterior, gerado)
    })
  }
})

function primeiroDiff(a: string, b: string): string {
  const la = a.split('\n')
  const lb = b.split('\n')
  for (let i = 0; i < Math.max(la.length, lb.length); i++) {
    if (la[i] !== lb[i]) {
      return `linha ${i + 1}:\n  antes: ${(la[i] ?? '').slice(0, 120)}\n  agora: ${(lb[i] ?? '').slice(0, 120)}`
    }
  }
  return '(sem diff textual)'
}
