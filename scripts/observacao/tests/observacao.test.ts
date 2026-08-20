// ─────────────────────────────────────────────────────────────────────────────
// Testes da camada de observação (FASE 2)
//
// 1. Flag L/N/H/CRIT contra faixa de referência (espelho TS do trigger SQL)
// 2. Série temporal com valores faltantes (mesclagem/pontos nulos)
// 3. Painel com delta entre aferições
// 4. (Integração condicional) constraint de valor no banco real
// ─────────────────────────────────────────────────────────────────────────────
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

// ── 1. Flag — espelho da lógica do trigger private.validar_observacao ────────
export function calcularFlag(
  valorNum: number | null,
  refMin: number | null,
  refMax: number | null
): 'L' | 'N' | 'H' | 'CRIT' {
  if (valorNum == null || (refMin == null && refMax == null)) return 'N'
  if (refMax != null && valorNum > refMax * 1.5) return 'CRIT'
  if (refMin != null && valorNum > 0 && valorNum < refMin * 0.5) return 'CRIT'
  if (refMax != null && valorNum > refMax) return 'H'
  if (refMin != null && valorNum < refMin) return 'L'
  return 'N'
}

describe('flag contra faixa de referência (espelho do banco)', () => {
  const refMin = 3.5
  const refMax = 5.0

  it('valor normal → N', () => {
    assert.equal(calcularFlag(4.2, refMin, refMax), 'N')
  })
  it('acima da faixa → H', () => {
    assert.equal(calcularFlag(5.6, refMin, refMax), 'H')
  })
  it('abaixo da faixa → L', () => {
    assert.equal(calcularFlag(3.0, refMin, refMax), 'L')
  })
  it('muito acima (1,5x) → CRIT', () => {
    assert.equal(calcularFlag(8.0, refMin, refMax), 'CRIT')
  })
  it('muito abaixo (0,5x) → CRIT', () => {
    assert.equal(calcularFlag(1.5, refMin, refMax), 'CRIT')
  })
  it('sem referência → N', () => {
    assert.equal(calcularFlag(100, null, null), 'N')
  })
})

// ── 2. Série temporal com valores faltantes ──────────────────────────────────
export function montarSerie(
  pontos: { rotulo: string; valor: number | null }[]
): { rotulo: string; valor: number | null }[] {
  // mantém a ordem; pontos com valor null viram lacunas (connectNulls no gráfico)
  return pontos.map((p) => ({ rotulo: p.rotulo, valor: p.valor }))
}

describe('série temporal com valores faltantes', () => {
  it('preserva lacunas (null) entre pontos válidos', () => {
    const serie = montarSerie([
      { rotulo: 'D+1', valor: 1.1 },
      { rotulo: 'D+2', valor: null }, // dia sem aferição
      { rotulo: 'D+3', valor: 1.4 },
    ])
    assert.equal(serie.length, 3)
    assert.equal(serie[1].valor, null)
    // o gráfico usa connectNulls: não inventa valores
    assert.deepEqual(
      serie.filter((p) => p.valor != null).map((p) => p.rotulo),
      ['D+1', 'D+3']
    )
  })

  it('mesclagem de múltiplos conceitos por rótulo de tempo', () => {
    const creatinina = [
      { rotulo: 'D+1', valor: 1.1 },
      { rotulo: 'D+2', valor: 1.2 },
    ]
    const ureia = [
      { rotulo: 'D+2', valor: 60 },
      { rotulo: 'D+3', valor: 55 },
    ]
    const mapa = new Map<string, Record<string, number | null>>()
    for (const p of creatinina) mapa.set(p.rotulo, { ...(mapa.get(p.rotulo) ?? {}), creatinina: p.valor })
    for (const p of ureia) mapa.set(p.rotulo, { ...(mapa.get(p.rotulo) ?? {}), ureia: p.valor })
    const dados = [...mapa.entries()].sort((a, b) => a[0].localeCompare(b[0], 'pt-BR', { numeric: true }))
    assert.equal(dados.length, 3) // D+1, D+2, D+3
    assert.deepEqual(Object.keys(dados[1][1]).sort(), ['creatinina', 'ureia'])
    // D+1 só tem creatinina (faltante vira undefined → gap no gráfico)
    assert.equal(dados[0][1].ureia, undefined)
  })
})

// ── 3. Delta entre aferições ─────────────────────────────────────────────────
export function calcularDelta(ultimo: number | null, anterior: number | null): number | null {
  if (ultimo == null || anterior == null) return null
  return Number((ultimo - anterior).toFixed(3))
}

describe('delta entre aferições', () => {
  it('calcula diferença com sinal', () => {
    assert.equal(calcularDelta(1.4, 1.1), 0.3)
    assert.equal(calcularDelta(1.0, 1.5), -0.5)
  })
  it('sem aferição anterior → null', () => {
    assert.equal(calcularDelta(1.2, null), null)
    assert.equal(calcularDelta(null, 1.0), null)
  })
})

// ── 4. Integração condicional (banco real) ───────────────────────────────────
const URL_TESTE = process.env.SUPABASE_TEST_URL
const KEY_TESTE = process.env.SUPABASE_SERVICE_ROLE_KEY
const temBanco = Boolean(URL_TESTE && KEY_TESTE)
const suiteBanco = temBanco ? describe : describe.skip

suiteBanco('constraint de valor no banco (integração)', () => {
  it('rejeita observação sem valor', async () => {
    // usa o cliente real; espera erro de constraint
    const { createClient } = await import('@supabase/supabase-js')
    const client = createClient(URL_TESTE!, KEY_TESTE!)
    const { data: conceito } = await client
      .from('conceito')
      .select('id')
      .eq('nome', 'creatinina')
      .is('unidade_id', null)
      .single()
    if (!conceito) {
      assert.ok(true, 'conceito não existe — pula')
      return
    }
    const { error } = await client.from('observacao').insert({
      conceito_id: conceito.id,
      paciente_id: '00000000-0000-0000-0000-000000000000',
      unidade_id: '00000000-0000-0000-0000-000000000000',
      // sem valor_num/valor_texto/valor_conceito_id → deve falhar
    })
    assert.ok(error, 'deveria rejeitar observação sem valor')
  })
})
