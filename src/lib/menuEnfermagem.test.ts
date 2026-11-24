// Revisão do perfil Enfermeiro (EN1–EN3) e do Técnico (TE1), RT 24/11/2026.
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import assert from 'node:assert/strict'

test('EN1: o menu do enfermeiro na UPA vem em grupos pelo momento do cuidado', async () => {
  const { itensDeNavegacao, agruparNavegacao } = await import('../components/casca/navegacao.ts')
  const blocos = agruparNavegacao(itensDeNavegacao('enfermeiro', false, false, 'upa'))
  assert.deepEqual(blocos.map((b) => [b.grupo, b.itens.map((i) => i.rotulo)]), [
    ['Porta', ['Triagem', 'Pronto-Socorro']],
    ['Leitos', ['Internação']],
    ['Medicação', ['Checagem', 'Alta vigilância', 'Retirada sem farmacêutico']],
    ['Registros', ['Notificação compulsória', 'Prontuários']],
    ['Equipe', ['Escala', 'Avisos', 'Contingência']],
  ])
})

test('TE1: o técnico tem os mesmos grupos, só com o que existe para ele', async () => {
  const { itensDeNavegacao, agruparNavegacao, inicioDoPapel } = await import('../components/casca/navegacao.ts')
  const blocos = agruparNavegacao(itensDeNavegacao('tecnico_enfermagem', false, false, 'upa'))
  assert.deepEqual(blocos.map((b) => [b.grupo, b.itens.map((i) => i.rotulo)]), [
    ['Porta', ['Pronto-Socorro']],
    ['Leitos', ['Internação']],
    ['Medicação', ['Checagem', 'Retirada sem farmacêutico']],
    ['Registros', ['Prontuários']],
    ['Equipe', ['Escala', 'Avisos']],
  ])
  assert.equal(inicioDoPapel('tecnico_enfermagem', 'upa'), '/enfermagem/pronto-socorro')
})

test('EN1/TE1: na UBS o menu da enfermagem segue em lista, sem grupos', async () => {
  const { itensDeNavegacao } = await import('../components/casca/navegacao.ts')
  for (const papel of ['enfermeiro', 'tecnico_enfermagem'] as const) {
    assert.ok(itensDeNavegacao(papel, false, false, 'ubs').every((i) => !i.grupo), papel)
  }
})

test('EN2: o número da Triagem e a lista saem da mesma leitura e da mesma chave', () => {
  const notas = readFileSync('src/components/casca/useNotasNav.ts', 'utf8')
  const tela = readFileSync('src/pages/enfermagem/Triagem.tsx', 'utf8')
  for (const f of [notas, tela]) {
    assert.match(f, /queryKey: chaveFilaTriagem\(/)
    assert.match(f, /queryFn: (\(\) => )?lerFilaTriagem/)
  }
})

test('EN3: o cartão guarda que já foi visto e a leitura tolera o campo novo', async () => {
  const { lerProgresso } = await import('../domain/primeirosPassos.ts')
  assert.deepEqual(lerProgresso('{"feitos":[],"escondido":false,"visto":true}'), { feitos: [], escondido: false, visto: true })
  assert.deepEqual(lerProgresso('{"feitos":[],"escondido":false}'), { feitos: [], escondido: false })
  const cartao = readFileSync('src/components/casca/PrimeirosPassos.tsx', 'utf8')
  assert.match(cartao, /marcarVisto\(\)/)
})
