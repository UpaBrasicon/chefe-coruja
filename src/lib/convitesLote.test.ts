// Fase 1, item 16b: convites em lote (CA2 = A do RT em 23/11/2026).
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import assert from 'node:assert/strict'

const PAPEIS = [
  { papel: 'plantonista', rotulo: 'Médico' },
  { papel: 'tecnico_enfermagem', rotulo: 'Técnico de enfermagem' },
  { papel: 'recepcao', rotulo: 'Recepção' },
]

test('16b: lê "Nome" e "Nome; papel", com papel padrão, sem acento nem maiúscula', async () => {
  const { lerLista } = await import('../domain/convitesLote.ts')
  const l = lerLista('Dra. Helena Barros; médico\n\n  João   Lima ;TECNICO DE ENFERMAGEM\nAna Souza\nBia\tplantonista', 'recepcao', PAPEIS)
  assert.deepEqual(l.map((x) => [x.paraQuem, x.papel, x.erro]), [
    ['Dra. Helena Barros', 'plantonista', null],
    ['João Lima', 'tecnico_enfermagem', null],
    ['Ana Souza', 'recepcao', null],
    ['Bia', 'plantonista', null],
  ])
})

test('16b: recusa papel desconhecido, linha sem papel e nome curto', async () => {
  const { lerLista } = await import('../domain/convitesLote.ts')
  const l = lerLista('Carlos; gestor\nMaria\nAl; recepção', null, PAPEIS)
  assert.match(l[0].erro!, /Papel não reconhecido: gestor/)
  assert.match(l[1].erro!, /Sem papel/)
  assert.match(l[2].erro!, /Nome de 3 a 120 letras/)
})

test('16b: CSV com nome, papel, código e validade, protegido contra fórmula', async () => {
  const { csvConvitesLote, LIMITE_LOTE } = await import('../domain/convitesLote.ts')
  assert.equal(LIMITE_LOTE, 60)
  const csv = csvConvitesLote([{ paraQuem: '=HYPERLINK("x")', papelRotulo: 'Médico', codigo: 'AB12CD34', expiraEm: '2026-11-30T12:00:00Z' }],
    'UBS Teste', '23/11/2026, 20:00', () => '30/11, 09:00')
  assert.match(csv, /Para quem;Papel;Código;Vale até/)
  assert.match(csv, /"'=HYPERLINK\(""x""\)";Médico;AB12CD34;30\/11, 09:00/)
})

test('16b: a tela usa a mesma gerar_convite, um por pessoa, e não cria conta', () => {
  const comp = readFileSync('src/components/gestor/ConvitesEmLote.tsx', 'utf8')
  assert.match(comp, /useGerarConvite\(unidadeId\)/)
  assert.match(comp, /for \(const l of linhas\)/)
  assert.doesNotMatch(comp, /auth\.admin|signUp|createUser/)
  const tela = readFileSync('src/pages/gestor/Convites.tsx', 'utf8')
  assert.match(tela, /<ConvitesEmLote unidadeId=\{unidadeId\}/)
})
