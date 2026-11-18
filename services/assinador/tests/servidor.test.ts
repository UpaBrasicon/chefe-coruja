// Servidor HTTP do assinador com dublês: rotas, CORS, conferência no formato
// do VALIDAR, limite de pedidos e erros sem vazar detalhe.
import { test, after, before } from 'node:test'
import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import type { Server } from 'node:http'

import { ErroAssinador, type Dependencias } from '../src/fluxo.ts'
import { comRodape, htmlDoRodape, respostaValidar } from '../src/rodape.ts'
import { criarServidor } from '../src/servidor.ts'
import { Cofre, Pendentes, Sessoes } from '../src/sessoes.ts'

const CODIGO = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
let srv: Server
let base = ''

before(async () => {
  const d: Dependencias = {
    provedores: [], sessoes: new Sessoes(new Cofre(randomBytes(32).toString('hex'))), pendentes: new Pendentes(),
    quemE: async (jwt) => { if (jwt !== 'ok') throw new ErroAssinador(401, 'Sessão inválida'); return { perfilId: 'p1', nome: 'M', cpf: '12345678909', crmNumero: '1', crmUf: 'SP' } },
    fimDoPlantao: async () => null, documento: async () => null,
    folhaPdf: async () => new Uint8Array(), urlConferencia: 'https://a/v',
    banco: { abrirSessao: async () => 's', encerrarSessao: async () => {}, registrarComPdf: async () => 'a' },
  }
  srv = criarServidor(d, {
    conferir: async (c) => (c === CODIGO ? { encontrada: true, numero: 'A-1', assinado_por: 'Médica <script>', registro: 'CRM 1/SP', assinado_em: '2026-11-18T12:00:00Z' } : { encontrada: false }),
    pdfAssinado: async (c) => (c === CODIGO ? Buffer.from('%PDF-1.7 teste') : null),
  }, { origens: ['https://app.exemplo'], base: 'https://assina.exemplo', limitePorMinuto: 30 })
  await new Promise<void>((r) => srv.listen(0, '127.0.0.1', () => r()))
  base = `http://127.0.0.1:${(srv.address() as { port: number }).port}`
})
after(() => srv.close())

test('VALIDAR: com o código certo devolve o JSON com o endereço do PDF; errado, 401', async () => {
  const ok = await fetch(`${base}/v?_format=application/validador-iti+json&_secretCode=${CODIGO.toLowerCase()}`)
  assert.equal(ok.status, 200)
  assert.deepEqual(await ok.json(), respostaValidar(`https://assina.exemplo/pdf?c=${CODIGO}`))
  const errado = await fetch(`${base}/v?_format=application/validador-iti+json&_secretCode=XYZ`)
  assert.equal(errado.status, 401)
})

test('PDF pelo código; página de conferência escapa o HTML', async () => {
  const pdf = await fetch(`${base}/pdf?c=${CODIGO}`)
  assert.equal(pdf.headers.get('content-type'), 'application/pdf')
  assert.match(Buffer.from(await pdf.arrayBuffer()).toString(), /%PDF/)
  assert.equal((await fetch(`${base}/pdf?c=ERRADO`)).status, 404)
  const pagina = await (await fetch(`${base}/v?c=${CODIGO}`)).text()
  assert.match(pagina, /Médica &lt;script&gt;/)
  assert.doesNotMatch(pagina, /<script>/)
})

test('rotas do médico pedem JWT; CORS só para a origem do app', async () => {
  const sem = await fetch(`${base}/assinar`, { method: 'POST', body: '{}' })
  assert.equal(sem.status, 401)
  const opt = await fetch(`${base}/assinar`, { method: 'OPTIONS', headers: { Origin: 'https://app.exemplo' } })
  assert.equal(opt.headers.get('access-control-allow-origin'), 'https://app.exemplo')
  const estranho = await fetch(`${base}/assinar`, { method: 'OPTIONS', headers: { Origin: 'https://mal.exemplo' } })
  assert.equal(estranho.headers.get('access-control-allow-origin'), null)
  const iniciar = await fetch(`${base}/sessao/iniciar`, { method: 'POST', headers: { Authorization: 'Bearer ok' }, body: JSON.stringify({ provedor: 'vidaas' }) })
  assert.equal(iniciar.status, 400)
  assert.deepEqual(await iniciar.json(), { erro: 'Provedor de certificado não configurado' })
})

test('retorno com erro do provedor mostra página, sem detalhe técnico', async () => {
  const r = await fetch(`${base}/retorno?error=access_denied`)
  assert.equal(r.status, 400)
  assert.match(await r.text(), /não autorizou a sessão/)
  const r2 = await fetch(`${base}/retorno?state=inexistente&code=x`)
  assert.match(await r2.text(), /vencido ou desconhecido/)
})

test('limite de pedidos por minuto', async () => {
  let ultimo = 0
  for (let i = 0; i < 35; i++) ultimo = (await fetch(`${base}/pdf?c=X`)).status
  assert.equal(ultimo, 429)
})

test('rodapé: QR code em SVG, código em blocos de 4 e o texto da conferência', async () => {
  const h = await htmlDoRodape('https://assina.exemplo/v', CODIGO)
  assert.match(h, /<svg/)
  assert.match(h, /ABCD EFGH JKLM/)
  assert.match(h, /validar\.iti\.gov\.br/)
  assert.equal(comRodape('<html><body><p>x</p></body></html>', '<i>r</i>'), '<html><body><p>x</p><i>r</i></body></html>')
})
