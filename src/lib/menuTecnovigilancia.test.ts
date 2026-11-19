import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { itensDeNavegacao } from '../components/casca/navegacao.ts'

// LG12 numa aba própria (pedido do RT em 19/11/2026)
const rotas = (...a: Parameters<typeof itensDeNavegacao>) => itensDeNavegacao(...a).map((i) => i.to)

test('Tecnovigilância: aba própria para o RT e para o gestor, logo depois da Revisão clínica', () => {
  for (const [papel, rt] of [['plantonista', true], ['gestor', false], ['gestor', true]] as const) {
    const r = rotas(papel, rt)
    const i = r.indexOf('/revisao-clinica')
    assert.ok(i >= 0, `${papel}: sem Revisão clínica`)
    assert.equal(r[i + 1], '/tecnovigilancia', `${papel}: Tecnovigilância fora do lugar`)
    assert.equal(r.filter((x) => x === '/tecnovigilancia').length, 1, `${papel}: item repetido`)
  }
  assert.ok(!rotas('plantonista', false).includes('/tecnovigilancia'), 'médico sem nomeação não tem a aba')
})

test('Tecnovigilância: a fila saiu da Revisão clínica e o e-mail aponta para a aba nova', () => {
  const revisao = readFileSync(new URL('../pages/RevisaoClinica.tsx', import.meta.url), 'utf8')
  assert.ok(!revisao.includes('FilaTecnovigilancia'))
  const pagina = readFileSync(new URL('../pages/Tecnovigilancia.tsx', import.meta.url), 'utf8')
  assert.ok(pagina.includes('<FilaTecnovigilancia />') && pagina.includes('<RelatosDaUnidade'))
  const app = readFileSync(new URL('../App.tsx', import.meta.url), 'utf8')
  assert.ok(app.includes('path="/tecnovigilancia"'))
  const aviso = readFileSync(new URL('../../supabase/functions/avisar-tecnovigilancia/regras.ts', import.meta.url), 'utf8')
  assert.ok(aviso.includes('/tecnovigilancia`') && !aviso.includes('/revisao-clinica'))
})
