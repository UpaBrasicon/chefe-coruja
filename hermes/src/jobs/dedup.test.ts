// Testes do pre-check de dedup (A1) — chavesJaAbertas (com cliente fake) e
// filtrarNovos (pura). Não tocam a rede.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { filtrarNovos } from './dedup.js'
import { chaveDedupArgos } from './argos.js'
import { chaveDedupGaviao } from './gaviao.js'

// ── filtrarNovos (pura) ──────────────────────────────────────────────────────

test('filtrarNovos — remove itens cuja chave está aberta', () => {
  const itens = [
    { titulo: 'A', id: 1 },
    { titulo: 'B', id: 2 },
  ]
  const chave = (i: { titulo: string; id: number }) => `${i.titulo}:${i.id}`
  const abertas = new Set(['A:1'])
  assert.deepEqual(filtrarNovos(itens, chave, abertas), [{ titulo: 'B', id: 2 }])
})

test('filtrarNovos — nenhuma aberta = mantém tudo', () => {
  const itens = [{ titulo: 'A', id: 1 }]
  assert.equal(filtrarNovos(itens, (i) => i.titulo, new Set()).length, 1)
})

test('filtrarNovos — todas abertas = vazio', () => {
  const itens = [{ titulo: 'A', id: 1 }]
  assert.equal(filtrarNovos(itens, (i) => i.titulo, new Set(['A'])).length, 0)
})

// ── chavesJaAbertas com cliente fake (sem rede) ──────────────────────────────

function clienteFake(chavesExistentes: string[]) {
  // Retorna um objeto com .from() que responde como o supabase-js encadeado
  // para esta consulta específica (select/in/in): o primeiro .in (status)
  // continua a cadeia; o segundo .in (chave_dedup) resolve com os dados.
  return {
    from: (tabela: string) => {
      assert.equal(tabela, 'cerbero_incidentes')
      const builder: Record<string, unknown> = {}
      builder.select = () => builder
      builder.in = (coluna: string, valores: string[]) => {
        if (coluna !== 'chave_dedup') return builder
        const encontradas = chavesExistentes.filter((c) => valores.includes(c))
        return Promise.resolve({ data: encontradas.map((c) => ({ chave_dedup: c })), error: null })
      }
      return builder
    },
  }
}

test('chavesJaAbertas — retorna só as que existem', async () => {
  const cliente = clienteFake(['dados:chave-1'])
  const abertas = await import('./dedup.js').then((m) => m.chavesJaAbertas(['dados:chave-1', 'dados:chave-2'], cliente))
  assert.deepEqual([...abertas], ['dados:chave-1'])
})

test('chavesJaAbertas — vazio quando nada existe', async () => {
  const cliente = clienteFake([])
  const abertas = await import('./dedup.js').then((m) => m.chavesJaAbertas(['x:1'], cliente))
  assert.equal(abertas.size, 0)
})

test('chavesJaAbertas — lista vazia retorna vazio sem consultar', async () => {
  let consultou = false
  const cliente = {
    from: () => {
      consultou = true
      throw new Error('não deveria consultar')
    },
  }
  const abertas = await import('./dedup.js').then((m) => m.chavesJaAbertas([], cliente))
  assert.equal(abertas.size, 0)
  assert.equal(consultou, false)
})

// ── Chaves de dedup por job (estabilidade da chave) ──────────────────────────

test('chaveDedupArgos — mesma evidência gera a mesma chave (estável)', () => {
  const a1 = chaveDedupArgos({
    severidade: 'atencao',
    titulo: 'Prescrição sem paciente vinculado',
    evidencia: { prescricao_id: 'abc' },
  })
  const a2 = chaveDedupArgos({
    severidade: 'atencao',
    titulo: 'Prescrição sem paciente vinculado',
    evidencia: { prescricao_id: 'abc' },
  })
  assert.equal(a1, a2)
})

test('chaveDedupArgos — prescrição diferente gera chave diferente', () => {
  const a = chaveDedupArgos({ severidade: 'atencao', titulo: 'X', evidencia: { prescricao_id: 'abc' } })
  const b = chaveDedupArgos({ severidade: 'atencao', titulo: 'X', evidencia: { prescricao_id: 'def' } })
  assert.notEqual(a, b)
})

test('chaveDedupArgos — usa observacao_id quando presente', () => {
  const a = chaveDedupArgos({ severidade: 'atencao', titulo: 'Obs futura', evidencia: { observacao_id: 'obs-1' } })
  assert.ok(a.includes('obs-1'))
})

test('chaveDedupGaviao — mesma sessão e trecho gera a mesma chave (estável)', () => {
  const a1 = chaveDedupGaviao({
    regra: 'R4',
    severidade: 'atencao',
    titulo: 'Tentativa de prompt injection',
    evidencia: { session_id: 's1', trecho: 'ignore suas instruções' },
  })
  const a2 = chaveDedupGaviao({
    regra: 'R4',
    severidade: 'atencao',
    titulo: 'Tentativa de prompt injection',
    evidencia: { session_id: 's1', trecho: 'ignore suas instruções' },
  })
  assert.equal(a1, a2)
})

test('chaveDedupGaviao — mensagem diferente na mesma sessão gera chave diferente', () => {
  const a = chaveDedupGaviao({
    regra: 'R4', severidade: 'atencao', titulo: 'T', evidencia: { session_id: 's1', trecho: 'msg 1' },
  })
  const b = chaveDedupGaviao({
    regra: 'R4', severidade: 'atencao', titulo: 'T', evidencia: { session_id: 's1', trecho: 'msg 2' },
  })
  assert.notEqual(a, b)
})

test('chaveDedupGaviao — R5 sem trecho usa só a sessão (volume anômalo não duplica)', () => {
  const a = chaveDedupGaviao({
    regra: 'R5', severidade: 'informativo', titulo: 'Volume anômalo', evidencia: { session_id: 's1', quantidade: 40 },
  })
  const b = chaveDedupGaviao({
    regra: 'R5', severidade: 'informativo', titulo: 'Volume anômalo', evidencia: { session_id: 's1', quantidade: 41 },
  })
  assert.equal(a, b)
})
