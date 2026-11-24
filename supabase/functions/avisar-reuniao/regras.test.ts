// Agenda do administrador: e-mail aos convidados da reunião.
import { test } from 'node:test'
import assert from 'node:assert/strict'

import {
  assunto, escolherEnvios, eventoPedido, html, jsonAscii, pautaCurta, quando, remetente, texto,
  REMETENTE_PADRAO, type DadosReuniao, type Pendente,
} from './regras.ts'

const r: DadosReuniao = {
  titulo: 'Reunião da rede', inicio: '2026-11-25T12:00:00Z', fim: '2026-11-25T13:30:00Z',
  link: 'https://meet.google.com/abc-defg-hij', plataforma: 'Google Meet', pauta: 'Escala de dezembro',
  cancelada: false, criador_nome: 'Ana Administradora',
}
const p = (id: number, perfil: string, evento: Pendente['evento'], email: string | null = `${perfil}@exemplo.com`): Pendente =>
  ({ id, perfil_id: perfil, evento, nome: 'Bruno Souza', email })

test('dia e hora em Brasília', () => {
  assert.match(quando(r), /^quarta-feira, 25\/11\/2026, das 09:00 às 10:30 \(horário de Brasília\)$/)
  assert.equal(assunto('convite', r), 'Convite para reunião: Reunião da rede, 25/11 às 09:00')
  assert.equal(assunto('alterada', r), 'Reunião alterada: Reunião da rede, agora 25/11 às 09:00')
  assert.equal(assunto('cancelada', r), 'Reunião cancelada: Reunião da rede, 25/11 às 09:00')
  assert.equal(assunto('retirado', r), 'Você não está mais na reunião: Reunião da rede')
})

test('o convite traz plataforma, Entrar, pauta e quem marcou', () => {
  const t = texto('convite', r, 'Bruno Souza', 'https://www.chefecoruja.com.br')
  assert.match(t, /^Olá, Bruno\./)
  assert.match(t, /Onde: Google Meet/)
  assert.match(t, /Entrar: https:\/\/meet\.google\.com\/abc-defg-hij/)
  assert.match(t, /Pauta: Escala de dezembro/)
  assert.match(t, /Marcada por: Ana Administradora/)
  assert.match(t, /https:\/\/www\.chefecoruja\.com\.br\/notificacoes/)
  assert.match(t, /Não traz dado de paciente/)
})

test('cancelamento e retirada não trazem o link nem a pauta', () => {
  for (const ev of ['cancelada', 'retirado'] as const) {
    const t = texto(ev, r, null, 'https://x.com.br')
    assert.doesNotMatch(t, /meet\.google/)
    assert.doesNotMatch(t, /Pauta/)
    assert.match(t, /Marcada por: Ana Administradora/)
  }
})

test('sem link: presencial ou a combinar', () => {
  const t = texto('convite', { ...r, link: null, plataforma: null, pauta: null }, 'Bruno', 'https://x.com.br')
  assert.match(t, /Onde: Presencial ou a combinar/)
  assert.doesNotMatch(t, /Entrar/)
  assert.doesNotMatch(t, /Pauta/)
})

test('pauta curta: até 300 letras, sem quebras', () => {
  assert.equal(pautaCurta('  a\n\n b  '), 'a b')
  assert.equal(pautaCurta(''), null)
  const longa = pautaCurta('x'.repeat(1000))!
  assert.equal(longa.length, 300)
  assert.ok(longa.endsWith('...'))
})

test('HTML escapa o que o administrador digitou e o botão Entrar leva ao link', () => {
  const h = html('convite', { ...r, titulo: '<script>alert(1)</script>', pauta: 'a & b "c"' }, 'Bruno', 'https://x.com.br')
  assert.doesNotMatch(h, /<script>/)
  assert.match(h, /&lt;script&gt;/)
  assert.match(h, /a &amp; b &quot;c&quot;/)
  assert.match(h, /<a href="https:\/\/meet\.google\.com\/abc-defg-hij"[^>]*>Entrar<\/a>/)
})

test('uma mensagem por pessoa, pelo estado final da fila', () => {
  const { envios, semEmail, descartados, pessoasSemEmail } = escolherEnvios([
    p(1, 'a', 'convite'), p(5, 'a', 'alterada'), // convite não entregue + mudança = convite
    p(2, 'b', 'alterada'), // só a mudança
    p(3, 'c', 'convite'), p(6, 'c', 'retirado'), // nem soube: nada
    p(4, 'd', 'convite', null), // sem e-mail
    p(7, 'e', 'retirado'), // retirado depois de receber o convite
    p(8, 'f', 'cancelada'),
  ])
  assert.deepEqual(envios.map((e) => `${e.perfil_id}:${e.evento}:${e.ids.join('+')}`), ['a:convite:1+5', 'b:alterada:2', 'e:retirado:7', 'f:cancelada:8'])
  assert.deepEqual(semEmail, [4])
  assert.equal(pessoasSemEmail, 1)
  assert.deepEqual(descartados, [3, 6])
})

test('convidado de novo depois de retirado recebe o convite', () => {
  const { envios } = escolherEnvios([p(1, 'a', 'retirado'), p(2, 'a', 'convite')])
  assert.deepEqual(envios.map((e) => e.evento), ['convite'])
})

test('evento pedido aceita os nomes do pedido e recusa o resto', () => {
  assert.equal(eventoPedido(undefined), null)
  assert.equal(eventoPedido('mudança'), 'alterada')
  assert.equal(eventoPedido('cancelamento'), 'cancelada')
  assert.equal(eventoPedido('retirada'), 'retirado')
  assert.equal(eventoPedido('convite'), 'convite')
  assert.equal(eventoPedido('apagar'), undefined)
})

test('remetente: EMAIL_FROM quando vale; senão o padrão', () => {
  assert.deepEqual(remetente(undefined), { de: REMETENTE_PADRAO, motivo: 'ausente' })
  assert.deepEqual(remetente('  '), { de: REMETENTE_PADRAO, motivo: 'ausente' })
  assert.deepEqual(remetente('Coruja <oi@chefecoruja.com.br>'), { de: 'Coruja <oi@chefecoruja.com.br>', motivo: 'configurado' })
  assert.deepEqual(remetente('re_abc123'), { de: REMETENTE_PADRAO, motivo: 'malformado' })
})

test('JSON vai só com ASCII', () => {
  assert.equal(jsonAscii([{ a: 'ã' }]), '[{"a":"\\u00e3"}]')
})
