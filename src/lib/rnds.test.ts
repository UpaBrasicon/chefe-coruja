// node --experimental-strip-types --test src/lib/rnds.test.ts
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { acaoDoItem, alertas, conferirArquivo, diasAte, formatarDocumento, motivoDoItem, type ItemRnds, type PainelRnds } from './rnds.ts'

const AGORA = Date.parse('2026-10-29T12:00:00Z')
const painel = (o: Partial<PainelRnds> = {}, cert: Partial<NonNullable<PainelRnds['credencial']>['certificado']> = {}): PainelRnds => ({
  pode_producao: false,
  config: { financiamento: '07', envio_ligado: true, pausado_em: null, pausa_motivo: null, atualizado_em: null },
  credencial: {
    id: 'k', nome: 'UPA Central', ambiente: 'homologacao', identificador_solicitante: '99999', unidade_principal_id: 'u',
    unidades: [{ id: 'u', nome: 'UPA', cnes: '9999991' }],
    certificado: { situacao: 'valido', titular: 'UPA', documento: '12345678000199', valido_ate: '2027-10-28T00:00:00Z',
      enviado_em: null, lido_em: null, erro: null, ...cert },
  },
  contagem: {}, bloqueios: [], ...o,
})
const item = (o: Partial<ItemRnds>): ItemRnds => ({
  id: 'i', tipo: 'rac', referencia_id: 'r', status: 'pendente', tentativas: 0, ultimo_erro: null,
  criado_em: '2026-10-29T10:00:00Z', enviado_em: null, proxima_tentativa_em: null, id_rnds: null, ...o,
})

test('tudo certo: nenhum alerta', () => {
  assert.deepEqual(alertas(painel(), AGORA), [])
})

test('sem credencial: só o convite para montar', () => {
  const a = alertas(painel({ credencial: null }), AGORA)
  assert.equal(a.length, 1)
  assert.equal(a[0].acao, 'credencial')
})

test('pausado vem primeiro, crítico, com retomar', () => {
  const a = alertas(painel({ config: { financiamento: '07', envio_ligado: true, pausado_em: '2026-10-29T08:00:00Z', pausa_motivo: 'certificado vencido em 28/10/2026', atualizado_em: null } }, { situacao: 'vencido' }), AGORA)
  assert.equal(a[0].acao, 'retomar')
  assert.equal(a[0].tom, 'critico')
  assert.match(a[0].texto, /vencido/)
  assert.equal(a[1].acao, 'certificado')
})

test('vencimento: aviso a partir de 30 dias, com o número de dias', () => {
  assert.deepEqual(alertas(painel({}, { valido_ate: '2026-12-15T12:00:00Z' }), AGORA), [])
  const a = alertas(painel({}, { valido_ate: '2026-11-05T12:00:00Z' }), AGORA)
  assert.equal(a[0].titulo, 'Certificado vence em 7 dias')
  assert.equal(alertas(painel({}, { valido_ate: '2026-10-30T12:00:00Z' }), AGORA)[0].titulo, 'Certificado vence em 1 dia')
})

test('senha errada e chave trocada pedem o certificado de novo', () => {
  assert.equal(alertas(painel({}, { situacao: 'senha_incorreta' }), AGORA)[0].tom, 'critico')
  const t = alertas(painel({}, { situacao: 'chave_trocada' }), AGORA)[0]
  assert.equal(t.tom, 'atencao')
  assert.equal(t.acao, 'certificado')
})

test('bloqueios e envio desligado', () => {
  const a = alertas(painel({
    bloqueios: [{ id: 'b', profissional: 'Fulano', codigo: 'ERR906', mensagem: null, bloqueado_em: '2026-10-29T09:00:00Z' }],
    config: { financiamento: null, envio_ligado: false, pausado_em: null, pausa_motivo: null, atualizado_em: null },
  }), AGORA)
  assert.deepEqual(a.map((x) => x.titulo), ['1 profissional bloqueado pela RNDS', 'Envio desligado'])
})

test('documento com máscara', () => {
  assert.equal(formatarDocumento('12345678000199'), '12.345.678/0001-99')
  assert.equal(formatarDocumento('11144477735'), '111.444.777-35')
  assert.equal(formatarDocumento(null), '—')
})

test('item: motivo sem o prefixo e a ação certa', () => {
  assert.equal(motivoDoItem(item({ ultimo_erro: 'retido: unidade sem certificado da RNDS' })), 'Unidade sem certificado da RNDS')
  assert.equal(acaoDoItem(item({ status: 'erro' }))?.rotulo, 'Reenviar')
  assert.equal(acaoDoItem(item({ status: 'retido' }))?.rotulo, 'Tentar agora')
  assert.equal(acaoDoItem(item({ status: 'enviado' })), null)
})

test('arquivo do certificado', () => {
  assert.equal(conferirArquivo({ name: 'upa.pfx', size: 4000 }), null)
  assert.equal(conferirArquivo({ name: 'UPA.P12', size: 4000 }), null)
  assert.match(conferirArquivo({ name: 'upa.pem', size: 4000 })!, /\.pfx/)
  assert.match(conferirArquivo({ name: 'upa.pfx', size: 500_000 })!, /grande/)
})

test('dias até a data', () => {
  assert.equal(diasAte('2026-10-30T12:00:00Z', AGORA), 1)
  assert.equal(diasAte('2026-10-28T12:00:00Z', AGORA), -1)
})
