// Pedido 8: divisão do descanso dos médicos (PS4 e PS5 do RT, 23/11/2026).
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import assert from 'node:assert/strict'

const H = 3_600_000
const M = (n: number) => Array.from({ length: n }, (_, i) => ({ perfil_id: `m${i + 1}`, nome: `Médico ${i + 1}` }))

function maxJuntos(blocos: { inicio: number; fim: number }[], ini: number, fim: number) {
  let max = 0
  for (let t = ini; t < fim; t += 60_000) max = Math.max(max, blocos.filter((b) => b.inicio <= t && t < b.fim).length)
  return max
}

test('exemplo do RT: 3 médicos, 00h às 06h, pelo menos 1 acordado, 4 h para cada um', async () => {
  const { blocosDescanso, minutosDeDescanso, descansandoAgora } = await import('../domain/descanso.ts')
  const ini = Date.UTC(2026, 10, 24, 3) // 00h em Brasília
  const fim = ini + 6 * H
  const b = blocosDescanso(ini, fim, 1, M(3))
  assert.equal(minutosDeDescanso(ini, fim, 1, 3), 240)
  for (const id of ['m1', 'm2', 'm3']) {
    assert.equal(b.filter((x) => x.perfil_id === id).reduce((n, x) => n + (x.fim - x.inicio), 0), 4 * H, `${id} descansa 4 h`)
  }
  assert.equal(maxJuntos(b, ini, fim), 2, 'nunca mais de 2 descansando')
  assert.deepEqual([...descansandoAgora(b, ini + H)].sort(), ['m1', 'm2'])
  assert.deepEqual([...descansandoAgora(b, ini + 5 * H)].sort(), ['m2', 'm3'])
})

test('divisão igual em outros tamanhos respeita o mínimo acordado', async () => {
  const { blocosDescanso, minutosDeDescanso } = await import('../domain/descanso.ts')
  const ini = Date.UTC(2026, 10, 24, 1)
  for (const [n, minimo, horas] of [[2, 1, 6], [4, 2, 8], [5, 1, 7], [4, 3, 12]] as const) {
    const fim = ini + horas * H
    const b = blocosDescanso(ini, fim, minimo, M(n))
    assert.ok(maxJuntos(b, ini, fim) <= n - minimo, `${n} médicos, ${minimo} acordados`)
    const cada = minutosDeDescanso(ini, fim, minimo, n) * 60_000
    for (const m of M(n)) assert.equal(b.filter((x) => x.perfil_id === m.perfil_id).reduce((s, x) => s + x.fim - x.inicio, 0), cada)
    assert.ok(b.every((x) => x.inicio >= ini && x.fim <= fim && x.fim > x.inicio), 'blocos dentro da janela')
  }
})

test('regras: pelo menos 2 médicos, mínimo de 1 até N-1, janela de até 14 h', async () => {
  const { conferirDivisao } = await import('../domain/descanso.ts')
  assert.match(conferirDivisao(1, 1, 0, H) ?? '', /pelo menos dois/)
  assert.match(conferirDivisao(3, 3, 0, H) ?? '', /mínimo acordado/)
  assert.match(conferirDivisao(3, 0, 0, H) ?? '', /mínimo acordado/)
  assert.match(conferirDivisao(3, 1, 0, 15 * H) ?? '', /14 horas/)
  assert.equal(conferirDivisao(3, 1, 0, 6 * H), null)
})

test('janela pelas horas digitadas: a de hoje, a de amanhã ou a que passa da meia-noite', async () => {
  const { janelaDasHoras } = await import('../domain/descanso.ts')
  const local = (d: number, h: number, m = 0) => new Date(2026, 10, d, h, m).getTime()
  const j1 = janelaDasHoras('00:00', '06:00', local(23, 22))
  assert.deepEqual(j1, { inicio: local(24, 0), fim: local(24, 6) }, 'às 22h, a madrugada que vem')
  const j2 = janelaDasHoras('00:00', '06:00', local(24, 2))
  assert.deepEqual(j2, { inicio: local(24, 0), fim: local(24, 6) }, 'às 2h, a madrugada em curso')
  const j3 = janelaDasHoras('23:00', '05:00', local(23, 20))
  assert.deepEqual(j3, { inicio: local(23, 23), fim: local(24, 5) }, 'passa da meia-noite')
  assert.equal(janelaDasHoras('25:00', '06:00', local(23, 20)), null)
})

test('a conta da tela é a mesma do banco, e cada papel vê o que o RT decidiu', () => {
  const sql = readFileSync('supabase/migrations/20270419000002_descanso_plantao.sql', 'utf8')
  assert.match(sql, /l := \(t \* r\) \/ n;/)
  assert.match(sql, /off := pos % t;/)
  assert.match(readFileSync('src/pages/gestor/PainelGestor.tsx', 'utf8'), /<DescansoDoPlantao unidadeId=\{unidadeId\} podeDividir=\{false\} \/>/)
  assert.match(readFileSync('src/pages/enfermagem/ProntoSocorroEnfermagem.tsx', 'utf8'), /podeDividir=\{false\}/)
  assert.match(readFileSync('src/pages/MeuPlantao.tsx', 'utf8'), /podeDividir=\{papelAtivo === 'plantonista'\}/)
})
