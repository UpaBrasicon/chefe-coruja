import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

import { ROTULO_BLOCO_CID, ferramentasDosCids } from './ferramentasDoCid.ts'

// F2 das ferramentas pelo CID (pedido do RT de 17/11/2026; CF1–CF9 = A e as
// condições da sessão de obrigatórios legais): bloco no Atendimento (urgência
// e UBS) e na Conduta da UBS.
const bloco = readFileSync('src/components/clinico/FerramentasDoCid.tsx', 'utf8')
const atend = readFileSync('src/pages/plantao/porta/AbaAtendimento.tsx', 'utf8')
const conduta = readFileSync('src/pages/plantao/porta/AbaConduta.tsx', 'utf8')
const janela = readFileSync('src/pages/plantao/porta/JanelaAtendimento.tsx', 'utf8')

test('exemplos do RT: I20 traz HEART; G45 traz ABCD2; código completo herda a categoria', () => {
  const fichas = (cids: string[]) => ferramentasDosCids(cids, 'adulto').map((f) => f.ficha)
  assert.ok(fichas(['I20.0 — Angina instável']).includes('heart'))
  assert.ok(fichas(['G459']).includes('abcd2'))
  assert.ok(!fichas(['I64']).includes('abcd2'))
  assert.deepEqual(ferramentasDosCids(['', null, undefined, 'xyz'], 'adulto'), [])
})

test('vários CIDs: junta sem repetir a ferramenta, e cada uma tem rota da Central', () => {
  const l = ferramentasDosCids(['I20', 'I21', 'R07'], 'adulto')
  assert.equal(new Set(l.map((f) => f.ficha)).size, l.length)
  for (const f of l) assert.match(f.rota, /^\/plantonista\/[a-z0-9-]+\/[a-z0-9-]+$/)
})

test('CF6: criança não vê ferramenta de adulto; adulto não vê pediátrica', () => {
  const crianca = ferramentasDosCids(['J18', 'A41', 'R50', 'E10'], 'pediatrico')
  const adulto = ferramentasDosCids(['J18', 'A41', 'R50', 'E10'], 'adulto')
  assert.ok(crianca.length > 0 && adulto.length > 0)
  assert.ok(crianca.every((f) => !f.ficha.startsWith('adulto-')))
  assert.ok(adulto.every((f) => !f.ficha.startsWith('ped-')))
})

test('condição do LG: rótulo fixo e o bloco nunca mostra cor, dose ou conduta', () => {
  assert.equal(ROTULO_BLOCO_CID, 'Atalho para ferramentas de referência. A decisão é do médico.')
  assert.match(bloco, /\{ROTULO_BLOCO_CID\}/)
  // só lista e abre: sem servidor, sem gravar, sem escore, cor ou trecho clínico na tela
  for (const proibido of [/supabase/, /registrar_/, /useMutation/, /CORES_RISCO/, /\bcalcular\w*\(/, /f\.motivo/]) {
    assert.doesNotMatch(bloco, proibido)
  }
  // nada do paciente na URL: o link leva só a rota da ferramenta
  assert.match(bloco, /to=\{f\.rota\}/)
  assert.doesNotMatch(bloco, /[?#]\$\{|search=|hash=/)
})

test('o bloco está no Atendimento (urgência e UBS) e na Conduta da UBS, com a faixa pela idade', () => {
  assert.match(atend, /<FerramentasDoCid className="md:col-span-2" cids=\{\[soap\.cid\.trim\(\)/)
  assert.match(atend, /faixa=\{faixa\} \/>/)
  assert.match(conduta, /<FerramentasDoCid faixa=\{faixa\} cids=/)
  assert.match(janela, /<AbaConduta [^\n]*faixa=\{faixa\}/)
})
