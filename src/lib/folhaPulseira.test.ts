// node --experimental-strip-types --test src/lib/folhaPulseira.test.ts
import assert from 'node:assert/strict'
import { test } from 'node:test'

import { montarPulseira, type DadosPulseira } from '../domain/pulseira.ts'
import { folhaPulseira } from './folhaPulseira.ts'

const dados: DadosPulseira = {
  nome: 'Ana <b>Teste</b> & Filha', nome_social: null, data_nascimento: '1980-05-04', idade_estimada_meses: null,
  prontuario: '2026.000123', nome_mae: "Joana d'Arc", sexo: 'F', raca_cor: null, identidade_desconhecida: false,
  sinais_identificacao: null, rn: false, rn_ordem: null,
}
const registro = { protocolo: 'IMP-0123456789', emitido: '10/11/2026, 14:00:00' }

test('a folha escapa o texto e traz o protocolo', () => {
  const html = folhaPulseira(montarPulseira(dados), registro)
  assert.ok(html.startsWith('<!doctype html>'))
  assert.ok(html.includes('Ana &lt;b&gt;Teste&lt;/b&gt; &amp; Filha'))
  assert.ok(html.includes('Mãe: Joana d&#39;Arc'))
  assert.ok(!html.includes('<b>Teste'))
  assert.ok(html.includes('Impressão IMP-0123456789 registrada no Chefe Coruja em 10/11/2026, 14:00:00'))
})

test('etiqueta do tamanho da pulseira, letra de 12 pt ou mais, sem itálico e sem leito', () => {
  const html = folhaPulseira(montarPulseira(dados), registro)
  assert.match(html, /\.etiqueta \{[^}]*width: 100mm; min-height: 25mm;/)
  assert.match(html, /\.linha \{[^}]*font-size: 12pt;[^}]*font-style: normal;/)
  assert.ok(!/italic|<i[ >]/.test(html))
  assert.ok(!/leito/i.test(html))
  assert.ok(html.includes('class="etiqueta"'))
  assert.ok(html.includes('no punho'))
})

test('RN em etiqueta menor, com a orientação do tornozelo', () => {
  const html = folhaPulseira(montarPulseira({ ...dados, rn: true, rn_ordem: 1, nome: 'RN 1 de Joana' }), registro)
  assert.ok(html.includes('class="etiqueta rn"'))
  assert.match(html, /\.etiqueta\.rn \{ width: 80mm; min-height: 20mm; \}/)
  assert.ok(html.includes('tornozelo'))
})
