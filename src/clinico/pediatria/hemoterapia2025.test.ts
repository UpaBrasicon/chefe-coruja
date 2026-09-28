import { test } from 'node:test'
import assert from 'node:assert/strict'

import { temReferenciaPediatrica } from '../ficha.ts'
import { DIRETRIZES_HEMO_PED, fichaHemoterapiaPed } from './hemoterapiaPed.ts'

test('hemocomponentes ped: versão .1 de 28/09 com AABB 2023 (rec. 3–4) e AABB/ICTMG 2025 declaradas pediátricas', () => {
  assert.equal(fichaHemoterapiaPed.versao, '2026-09-28.1')
  assert.equal(temReferenciaPediatrica(fichaHemoterapiaPed), true)
  assert.ok(fichaHemoterapiaPed.fontes.some((f) => /Recomendações 3 e 4/.test(f.citacao) && f.pediatrica))
  assert.ok(DIRETRIZES_HEMO_PED.some((r) => /dengue/.test(r.rotulo) && /NÃO transfundir/.test(r.texto)))
  assert.ok(DIRETRIZES_HEMO_PED.some((r) => /neonato/.test(r.rotulo) && /25\.000/.test(r.texto)))
  assert.ok(DIRETRIZES_HEMO_PED.some((r) => /cardiopatia congênita/.test(r.rotulo) && /9 g\/dL/.test(r.texto)))
})
