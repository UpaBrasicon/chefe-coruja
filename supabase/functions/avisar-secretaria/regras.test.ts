// Perfil Gestor da secretaria: e-mail de quem o administrador designa.
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { assunto, html, jsonAscii, listaUnidades, remetente, REMETENTE_PADRAO, texto, type DadosAviso } from './regras.ts'

const ORIGEM = 'https://www.chefecoruja.com.br'
const d: DadosAviso = {
  email: 'ana@exemplo.com', nome: 'Ana Souza', pendente: false, secretaria: 'Secretaria de Saúde de Goiânia',
  organizacao: 'Rede Goiânia', designado_por: 'Carlos Lima', unidades: ['Hospital Centro', 'UPA Norte'],
}

test('assunto diz a secretaria', () => {
  assert.equal(assunto(d), 'Você cuida da Secretaria de Saúde de Goiânia no Chefe Coruja')
})

test('com conta: texto chama pelo primeiro nome e manda entrar na secretaria', () => {
  const t = texto(d, ORIGEM)
  assert.match(t, /^Olá, Ana\./)
  assert.match(t, /Unidades: Hospital Centro, UPA Norte/)
  assert.match(t, /Quem escolheu: Carlos Lima/)
  assert.match(t, /Entrar: https:\/\/www\.chefecoruja\.com\.br\/secretaria/)
  assert.match(t, /Não traz dado de paciente/)
})

test('sem conta: texto pede a conta com o mesmo e-mail', () => {
  const t = texto({ ...d, nome: null, pendente: true }, ORIGEM)
  assert.match(t, /^Olá\./)
  assert.match(t, /Crie sua conta no Chefe Coruja com este e-mail \(ana@exemplo\.com\)/)
  assert.match(t, /Criar conta: https:\/\/www\.chefecoruja\.com\.br\/cadastro/)
})

test('lista de unidades: vazia e longa', () => {
  assert.equal(listaUnidades([]), 'nenhuma unidade ligada ainda')
  const muitas = Array.from({ length: 23 }, (_, i) => `U${i + 1}`)
  assert.match(listaUnidades(muitas), /U20 e mais 3$/)
})

test('HTML escapa o que vem do cadastro', () => {
  const h = html({ ...d, secretaria: 'Secretaria <b>X</b> & Cia' }, ORIGEM)
  assert.match(h, /Secretaria &lt;b&gt;X&lt;\/b&gt; &amp; Cia/)
  assert.doesNotMatch(h, /<b>X<\/b>/)
  assert.match(h, /href="https:\/\/www\.chefecoruja\.com\.br\/secretaria"/)
})

test('remetente: configurado, ausente e malformado', () => {
  assert.deepEqual(remetente('Rede <rede@exemplo.com>'), { de: 'Rede <rede@exemplo.com>', motivo: 'configurado' })
  assert.deepEqual(remetente(undefined), { de: REMETENTE_PADRAO, motivo: 'ausente' })
  assert.deepEqual(remetente('sem arroba'), { de: REMETENTE_PADRAO, motivo: 'malformado' })
})

test('JSON vai só com ASCII', () => {
  assert.equal(jsonAscii({ a: 'ó' }), '{"a":"\\u00f3"}')
})
