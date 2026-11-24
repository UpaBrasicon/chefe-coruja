// PS1–PS2 e IN1–IN3 (revisão do perfil Enfermeiro, RT 24/11/2026)
import assert from 'node:assert/strict'
import { test } from 'node:test'

import { contarFaixa, pendenciaPrincipal, SEM_PENDENCIA, tem } from './pendenciasEnfermagem.ts'

test('a pendência principal é a mais urgente: vencida, atrasada, contenção, vencendo, escala', () => {
  assert.equal(pendenciaPrincipal(SEM_PENDENCIA), null)
  const p = { ...SEM_PENDENCIA, atrasados: 2, vencendo: 1, escala: 'Fugulin' as const }
  assert.deepEqual(pendenciaPrincipal(p), { chave: 'atrasada', texto: '2 doses atrasadas', critica: true, outras: 2 })
  assert.equal(pendenciaPrincipal({ ...p, vencidos: 1 })!.texto, '1 item vencido')
  assert.deepEqual(pendenciaPrincipal({ ...SEM_PENDENCIA, contencao: { texto: 'Revisão atrasada', critico: true } }),
    { chave: 'contencao', texto: 'Revisão atrasada', critica: true, outras: 0 })
  assert.equal(pendenciaPrincipal({ ...SEM_PENDENCIA, escala: 'Dini' })!.texto, 'Dini de hoje pendente')
  assert.equal(pendenciaPrincipal({ ...SEM_PENDENCIA, escala: 'Dini' })!.critica, false)
})

test('a faixa conta pacientes por pendência, só as chaves da tela, vencidas primeiro', () => {
  const lista = [
    { ...SEM_PENDENCIA, atrasados: 3 },
    { ...SEM_PENDENCIA, atrasados: 1, vencidos: 1 },
    { ...SEM_PENDENCIA, escala: 'Fugulin' as const },
  ]
  assert.deepEqual(contarFaixa(lista, ['vencida', 'atrasada', 'vencendo', 'contencao']).map((x) => [x.chave, x.n]),
    [['vencida', 1], ['atrasada', 2], ['contencao', 0], ['vencendo', 0]])
  assert.equal(contarFaixa(lista, ['escala'])[0].n, 1)
  assert.equal(tem(lista[2], 'escala'), true)
})
