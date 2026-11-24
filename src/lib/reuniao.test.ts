// Agenda do administrador (pedido do RT, 24/11/2026): reuniões com o link colado.
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import assert from 'node:assert/strict'

test('reconhece a plataforma pelo endereço', async () => {
  const { plataformaDoLink } = await import('../domain/reuniao.ts')
  assert.equal(plataformaDoLink('https://meet.google.com/abc-defg-hij'), 'Google Meet')
  assert.equal(plataformaDoLink(' https://us02web.zoom.us/j/123456789?pwd=abc '), 'Zoom')
  assert.equal(plataformaDoLink('https://teams.microsoft.com/l/meetup-join/19%3ameeting'), 'Microsoft Teams')
  assert.equal(plataformaDoLink('https://teams.live.com/meet/9381'), 'Microsoft Teams')
  assert.equal(plataformaDoLink('https://whereby.com/sala-da-rede'), 'Outra plataforma')
  assert.equal(plataformaDoLink('https://meet.google.com.golpe.com/x'), 'Outra plataforma', 'endereço que só começa igual não é o Meet')
  assert.equal(plataformaDoLink(''), null)
  assert.equal(plataformaDoLink(null), null)
})

test('o link só aceita https com endereço de verdade', async () => {
  const { linkValido } = await import('../domain/reuniao.ts')
  assert.ok(linkValido('https://meet.google.com/abc-defg-hij'))
  assert.ok(!linkValido('http://meet.google.com/abc'), 'sem https')
  assert.ok(!linkValido('javascript:alert(1)'))
  assert.ok(!linkValido('https://meet.google.com@golpe.com/x'), 'usuário@endereço')
  assert.ok(!linkValido('https://meet google.com/x'), 'espaço')
  assert.ok(!linkValido('https://localhost/x'), 'sem domínio')
  assert.ok(!linkValido('https://' + 'a'.repeat(500) + '.com'), 'longo demais')
})

test('confere o formulário antes de salvar', async () => {
  const { problemaDaReuniao } = await import('../domain/reuniao.ts')
  const ok = { titulo: 'Reunião da rede', data: '2026-11-25', inicio: '10:00', fim: '11:00', link: '', pauta: '', convidados: [] }
  assert.equal(problemaDaReuniao(ok), null)
  assert.match(problemaDaReuniao({ ...ok, titulo: 'ab' }) ?? '', /título/)
  assert.match(problemaDaReuniao({ ...ok, fim: '09:00' }) ?? '', /depois do início/)
  assert.match(problemaDaReuniao({ ...ok, inicio: '06:00', fim: '19:00' }) ?? '', /12 horas/)
  assert.match(problemaDaReuniao({ ...ok, link: 'meet.google.com/abc' }) ?? '', /https/)
  assert.match(problemaDaReuniao({ ...ok, convidados: Array.from({ length: 51 }, (_, i) => String(i)) }) ?? '', /50 pessoas/)
})

test('semana de segunda a domingo', async () => {
  const { diasDaSemana, inicioDaSemana, somarDias } = await import('../domain/reuniao.ts')
  assert.equal(inicioDaSemana('2026-11-24'), '2026-11-23', 'terça → segunda')
  assert.equal(inicioDaSemana('2026-11-29'), '2026-11-23', 'domingo → segunda anterior')
  assert.equal(inicioDaSemana('2026-11-23'), '2026-11-23')
  assert.deepEqual(diasDaSemana('2026-12-31'), ['2026-12-28', '2026-12-29', '2026-12-30', '2026-12-31', '2027-01-01', '2027-01-02', '2027-01-03'])
  assert.equal(somarDias('2026-02-28', 1), '2026-03-01')
})

test('o banco aceita e reconhece o link do mesmo jeito', () => {
  const sql = readFileSync(new URL('../../supabase/migrations/20270421000030_agenda_reunioes.sql', import.meta.url), 'utf8')
  assert.match(sql, /\^https:\/\/\[a-z0-9\]/, 'o banco também exige https')
  for (const p of ['Google Meet', 'Zoom', 'Microsoft Teams', 'Outra plataforma']) assert.ok(sql.includes(`'${p}'`), `o banco não conhece ${p}`)
  assert.match(sql, /ENABLE ROW LEVEL SECURITY/)
})

test('no menu do administrador a Escala vira Agenda; o gestor e o médico não mudam', async () => {
  const { itensDeNavegacao } = await import('../components/casca/navegacao.ts')
  const admin = itensDeNavegacao('admin')
  assert.ok(admin.some((i) => i.to === '/agenda-admin' && i.rotulo === 'Agenda'))
  assert.ok(!admin.some((i) => i.to === '/escala'), 'o administrador não tem mais a Escala no menu')
  assert.ok(itensDeNavegacao('gestor').some((i) => i.to === '/escala' && i.rotulo === 'Escala'))
  // o médico: Minha agenda é aba do Plantão fora da UBS (RT, 24/11/2026) e item do menu na UBS
  assert.ok(itensDeNavegacao('plantonista').some((i) => i.to === '/plantao' && i.rotulo === 'Plantão'))
  assert.ok(itensDeNavegacao('plantonista', false, false, 'ubs').some((i) => i.to === '/agenda' && i.rotulo === 'Minha agenda'))
})

test('e-mail aos convidados: aviso discreto só quando falha ou falta e-mail', async () => {
  const { avisoDoEmail } = await import('../domain/reuniao.ts')
  assert.equal(avisoDoEmail({ enviados: 3, sem_email: 0, falhas: 0 }, false), null)
  assert.equal(avisoDoEmail({ enviados: 0, sem_email: 0, falhas: 0 }, false), null, 'fila vazia (nada mudou para os convidados)')
  assert.match(avisoDoEmail({ enviados: 1, sem_email: 1 }, false) ?? '', /^Um convidado está sem e-mail/)
  assert.match(avisoDoEmail({ sem_email: 2 }, false) ?? '', /^2 convidados/)
  assert.equal(avisoDoEmail(null, true), 'E-mail não enviado. Os convidados têm o aviso no app.')
  assert.equal(avisoDoEmail({ erro: 'e-mail não enviado: o envio demorou' }, true),
    'E-mail não enviado (o envio demorou). Os convidados têm o aviso no app.')
})

test('a tela chama o e-mail depois de gravar e o banco põe o e-mail na fila', () => {
  const tela = readFileSync(new URL('../pages/admin/AgendaAdmin.tsx', import.meta.url), 'utf8')
  assert.match(tela, /functions\.invoke\('avisar-reuniao'/)
  const sql = readFileSync(new URL('../../supabase/migrations/20270421000031_agenda_email.sql', import.meta.url), 'utf8')
  assert.match(sql, /INSERT INTO private\.reuniao_emails/)
  assert.match(sql, /GRANT EXECUTE ON FUNCTION public\.reuniao_emails_reservar\(uuid, uuid, text\), public\.reuniao_emails_concluir\(bigint\[\], text\)\s+TO service_role;/)
  assert.doesNotMatch(sql, /TO authenticated/, 'o e-mail dos convidados não sai para o navegador')
})
