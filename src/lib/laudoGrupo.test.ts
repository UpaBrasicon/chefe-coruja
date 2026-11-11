// node --experimental-strip-types --test src/lib/laudoGrupo.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { gruposParaLaudo, laudoAceitaFoto, type ExameAguardandoLaudo } from './laudoGrupo.ts'

const ex = (id: string, grupo: ExameAguardandoLaudo['grupo'], tipo: string | null = 'laboratorio'): ExameAguardandoLaudo =>
  ({ id, exame: id, grupo, situacao: 'pedido', pedido_em: '2026-11-11T10:00:00Z', urgencia: 'rotina', tipo })

test('laudo por grupo: só grupos com dois ou mais exames, na ordem laboratório, ECG, imagem', () => {
  const g = gruposParaLaudo([ex('rx', 'imagem', 'imagem'), ex('hemo', 'laboratorio'), ex('crea', 'laboratorio'), ex('ecg', 'grafico', 'imagem'), ex('tc', 'imagem', 'imagem')])
  assert.deepEqual(g.map((x) => [x.grupo, x.exames.map((e) => e.id)]), [['laboratorio', ['hemo', 'crea']], ['imagem', ['rx', 'tc']]])
})
test('laudo por grupo: um exame só não oferece o laudo do grupo', () => {
  assert.deepEqual(gruposParaLaudo([ex('hemo', 'laboratorio'), ex('rx', 'imagem', 'imagem')]), [])
})
test('laudo por grupo: foto só quando todos os marcados são de imagem', () => {
  assert.equal(laudoAceitaFoto([ex('rx', 'imagem', 'imagem'), ex('tc', 'imagem', 'imagem')]), true)
  assert.equal(laudoAceitaFoto([ex('ecg', 'grafico', 'imagem'), ex('livre', 'grafico', 'laboratorio')]), false)
  assert.equal(laudoAceitaFoto([]), false)
})
