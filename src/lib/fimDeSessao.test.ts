import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  AVISO_ANTES_MS, CHAVE_DISPOSITIVO, MANTER_MAX_MS, fimPeloServidor, lerTokenDispositivo, marcarFimDeSessao, prazoDaSessao,
  salvarTokenDispositivo, textoDoFim, tirarFimDeSessao, tokenDispositivoAoSair,
} from './fimDeSessao.ts'

function area() {
  const m = new Map<string, string>()
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => { m.set(k, v) },
    removeItem: (k: string) => { m.delete(k) },
  }
}

test('C2: prazo de 12 h com a aba aberta, aviso 15 min antes', () => {
  const desde = Date.parse('2026-11-15T07:00:00Z')
  assert.deepEqual(prazoDaSessao(false, desde, desde + MANTER_MAX_MS * 2), { tipo: 'sem-prazo' })
  assert.deepEqual(prazoDaSessao(true, desde, desde + 60_000), { tipo: 'ok', fim: desde + MANTER_MAX_MS })
  assert.deepEqual(prazoDaSessao(true, desde, desde + MANTER_MAX_MS - AVISO_ANTES_MS - 1), { tipo: 'ok', fim: desde + MANTER_MAX_MS })
  assert.deepEqual(prazoDaSessao(true, desde, desde + MANTER_MAX_MS - AVISO_ANTES_MS), { tipo: 'aviso', fim: desde + MANTER_MAX_MS })
  assert.deepEqual(prazoDaSessao(true, desde, desde + MANTER_MAX_MS - 1), { tipo: 'aviso', fim: desde + MANTER_MAX_MS })
  assert.deepEqual(prazoDaSessao(true, desde, desde + MANTER_MAX_MS), { tipo: 'vencido' })
  assert.deepEqual(prazoDaSessao(true, null, desde), { tipo: 'vencido' })
})

test('C1: só o SIGNED_OUT que não veio do "Sair" é fim pelo servidor', () => {
  assert.equal(fimPeloServidor('SIGNED_OUT', false), true)
  assert.equal(fimPeloServidor('SIGNED_OUT', true), false)
  assert.equal(fimPeloServidor('TOKEN_REFRESHED', false), false)
  assert.equal(fimPeloServidor('INITIAL_SESSION', false), false)
})

test('C1 e C2: o motivo aparece uma vez na tela de entrada', () => {
  const a = area()
  assert.equal(tirarFimDeSessao(a), null)
  marcarFimDeSessao(a, 'servidor')
  assert.equal(tirarFimDeSessao(a), 'servidor')
  assert.equal(tirarFimDeSessao(a), null)
  marcarFimDeSessao(a, 'prazo')
  assert.match(textoDoFim(tirarFimDeSessao(a)!), /12 horas/)
  assert.equal(textoDoFim('servidor'), 'Sua sessão foi encerrada. Entre de novo.')
  assert.equal(tirarFimDeSessao(undefined), null)
})

test('C3: token de dispositivo só com "Manter conectado"; sem ele, o "Sair" apaga', () => {
  const a = area()
  assert.equal(salvarTokenDispositivo(a, 't'.repeat(40), false), false)
  assert.equal(lerTokenDispositivo(a), null)
  assert.equal(salvarTokenDispositivo(a, 't'.repeat(40), true), true)
  assert.equal(lerTokenDispositivo(a), 't'.repeat(40))
  tokenDispositivoAoSair(a, true)
  assert.equal(lerTokenDispositivo(a), 't'.repeat(40))
  tokenDispositivoAoSair(a, false)
  assert.equal(a.getItem(CHAVE_DISPOSITIVO), null)
})
