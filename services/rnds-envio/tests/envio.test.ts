// ─────────────────────────────────────────────────────────────────────────────
// Serviço de envio contra o simulador da RNDS (5C-5.3b), com TLS mútuo de
// verdade (CA de teste gerada pelo openssl numa pasta temporária).
//
// A fila é de mentira (em memória), no formato das funções da 5.3a; a carga
// usa as fixtures dos documentos (src/interop/fhir/__fixtures__.ts).
//
// Uso: node --test services/rnds-envio/tests/envio.test.ts
// ─────────────────────────────────────────────────────────────────────────────
import { after, before, describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { fixtureAltaParaCasa, fixtureSumarioAltaParaCasa } from '../../../src/interop/fhir/__fixtures__.ts'
import { processarLote, type DocumentoCarregado, type Fila, type ItemLote, type Registro } from '../src/ciclo.ts'
import { ClienteRnds, classificar, enderecos } from '../src/cliente-rnds.ts'
import { gerarCertificadosDeTeste, SimuladorRnds, type CertificadosDeTeste } from '../simulador/simulador.ts'

const UNIDADE = '00000000-0000-4000-8000-0000000f5302'
const CNS = '898001000000011'

let pasta: string
let certs: CertificadosDeTeste
let sim: SimuladorRnds
let base: string

before(async () => {
  pasta = mkdtempSync(join(tmpdir(), 'rnds-sim-'))
  certs = gerarCertificadosDeTeste(pasta)
  sim = new SimuladorRnds(certs)
  base = await sim.ouvir()
})
after(async () => {
  await sim.fechar()
  rmSync(pasta, { recursive: true, force: true })
})

const mira = {
  solicitacao_id: '00000000-0000-4000-8000-0000000f5341', numero: 7, status: 'pending', status_origem: 'enviada',
  evento_em: '2026-08-10T13:00:00Z', cnes_evento: '9999995', paciente_cpf: '52998224725', paciente_cns: null,
  modalidade: '04', carater: 'urgent', procedimento: '0303060190', cbo: null, cid: 'E86', cnes_solicitante: '9999995',
  cnes_executante: null, cnes_regulador: '9999993', criada_em: '2026-08-10T12:00:00Z', autorizada_em: null,
  data_prevista: null, realizada_em: null,
}

function documento(tipo: ItemLote['tipo_documento'], extra: Partial<DocumentoCarregado['envio']> = {}, dados?: unknown): DocumentoCarregado {
  return {
    item_id: 'x',
    tipo,
    dados: dados ?? (tipo === 'rac' ? fixtureAltaParaCasa() : tipo === 'sumario_alta' ? fixtureSumarioAltaParaCasa() : mira),
    envio: {
      ambiente: 'homologacao', uf: 'GO', identificador_solicitante: '99999', id_rnds_anterior: null,
      profissional_id: null, profissional_cns: CNS, ...extra,
    },
  }
}

/** Fila em memória: itens, a carga de cada um e o que foi registrado. */
function filaDeTeste(docs: Record<string, DocumentoCarregado | Error>) {
  const registros = new Map<string, Registro>()
  const fila: Fila = {
    async pegarLote() {
      return Object.entries(docs).map(([id, d]) => ({
        id, unidade_id: UNIDADE, tentativas: 0, tipo_documento: d instanceof Error ? 'rac' : d.tipo,
      }))
    },
    async dados(id) {
      const d = docs[id]
      if (d instanceof Error) throw d
      return d
    },
    async registrar(id, r) {
      registros.set(id, r)
    },
  }
  return { fila, registros }
}

function deps(fila: Fila, o: { rnds?: ClienteRnds; pfx?: Buffer; semCertificado?: boolean } = {}) {
  return {
    fila,
    certificados: { obter: async () => (o.semCertificado ? null : { pfx: o.pfx ?? certs.unidadePfx, senha: certs.unidadeSenha }) },
    rnds: o.rnds ?? new ClienteRnds({ caExtra: certs.ca, timeoutMs: 5_000 }),
    sobrepor: { auth: base, ehr: base },
  }
}

describe('envio ao simulador', () => {
  it('RAC, SA e MIRA saem com 201, o id da RNDS e um só token', async () => {
    const emitidosAntes = sim.tokensEmitidos
    const { fila, registros } = filaDeTeste({ rac: documento('rac'), sa: documento('sumario_alta'), mira: documento('regulacao') })
    const resumo = await processarLote(deps(fila))
    assert.deepEqual(resumo, { enviado: 3, retido: 0, reenviar: 0, erro: 0, credencial: 0 })
    for (const id of ['rac', 'sa', 'mira']) {
      const r = registros.get(id)!
      assert.equal(r.resultado, 'enviado')
      assert.match(r.idRnds!, /^[0-9a-f-]{36}$/)
      assert.ok(r.bundle, 'o Bundle enviado fica gravado')
    }
    assert.equal(sim.tokensEmitidos - emitidosAntes, 1, 'o token é reaproveitado no lote')
  })

  it('headers do manual: X-Authorization-Server com o token e Authorization com o CNS', async () => {
    const { fila } = filaDeTeste({ rac: documento('rac') })
    await processarLote(deps(fila))
    const h = sim.recebidos.at(-1)!.headers
    assert.match(String(h['x-authorization-server']), /^Bearer sim-/)
    assert.equal(h.authorization, CNS)
    assert.equal(h['content-type'], 'application/json')
    const b = sim.recebidos.at(-1)!.bundle as { identifier: { system: string }; timestamp: string }
    assert.equal(b.identifier.system, 'http://www.saude.gov.br/fhir/r4/NamingSystem/BRRNDS-99999')
    assert.ok(Math.abs(Date.parse(b.timestamp) - Date.now()) < 60_000, 'timestamp é a hora do envio')
  })

  it('substituição: o documento seguinte aponta o id do anterior', async () => {
    const um = filaDeTeste({ rac: documento('rac') })
    await processarLote(deps(um.fila))
    const anterior = um.registros.get('rac')!.idRnds!
    const dois = filaDeTeste({ rac2: documento('rac', { id_rnds_anterior: anterior }) })
    await processarLote(deps(dois.fila))
    assert.equal(dois.registros.get('rac2')!.resultado, 'enviado')
    const c = (sim.recebidos.at(-1)!.bundle as { entry: { resource: { relatesTo: unknown } }[] }).entry[0].resource
    assert.deepEqual(c.relatesTo, [{ code: 'replaces', targetReference: { reference: `Composition/${anterior}` } }])
  })

  it('token vencido do lado da RNDS: pede outro e envia', async () => {
    const rnds = new ClienteRnds({ caExtra: certs.ca, timeoutMs: 5_000 })
    await processarLote(deps(filaDeTeste({ a: documento('rac') }).fila, { rnds }))
    sim.expirarTokens()
    const antes = sim.tokensEmitidos
    const { fila, registros } = filaDeTeste({ b: documento('rac') })
    await processarLote(deps(fila, { rnds }))
    assert.equal(registros.get('b')!.resultado, 'enviado')
    assert.equal(sim.tokensEmitidos - antes, 1)
  })
})

describe('respostas da RNDS', () => {
  it('422 ERR906 (profissional sem CBO) é erro definitivo, com a mensagem', async () => {
    sim.cnsSemCbo.add('898001000000029')
    const { fila, registros } = filaDeTeste({ x: documento('rac', { profissional_cns: '898001000000029' }) })
    await processarLote(deps(fila))
    const r = registros.get('x')!
    assert.equal(r.resultado, 'erro')
    assert.match(r.erro!, /EHR-ERR906/)
    assert.equal((r.resposta as { status: number }).status, 422)
  })

  it('500 e 429 voltam à fila', async () => {
    sim.proximas.push({ status: 500 }, { status: 429 })
    const { fila, registros } = filaDeTeste({ a: documento('rac'), b: documento('rac') })
    await processarLote(deps(fila))
    assert.equal(registros.get('a')!.resultado, 'reenviar')
    assert.equal(registros.get('b')!.resultado, 'reenviar')
  })

  it('certificado de outra cadeia: o EHR Auth recusa e é a credencial', async () => {
    const { fila, registros } = filaDeTeste({ x: documento('rac') })
    await processarLote(deps(fila, { pfx: certs.estranhoPfx, rnds: new ClienteRnds({ caExtra: certs.ca, timeoutMs: 5_000 }) }))
    const r = registros.get('x')!
    assert.equal(r.resultado, 'credencial')
    assert.match(r.erro!, /ERR882|TLS/)
  })

  it('401 mesmo com token novo: é a credencial', async () => {
    sim.proximas.push({ status: 401 }, { status: 401 })
    const { fila, registros } = filaDeTeste({ x: documento('rac') })
    await processarLote(deps(fila))
    assert.equal(registros.get('x')!.resultado, 'credencial')
  })

  it('RNDS fora do ar: volta à fila', async () => {
    const { fila, registros } = filaDeTeste({ x: documento('rac') })
    const d = { ...deps(fila), sobrepor: { auth: 'https://127.0.0.1:1', ehr: 'https://127.0.0.1:1' } }
    await processarLote(d)
    assert.equal(registros.get('x')!.resultado, 'reenviar')
  })

  it('201 sem Location não é reenviado (duplicaria)', () => {
    const r = classificar({ status: 201, headers: {}, corpo: '' })
    assert.equal(r.resultado, 'erro')
  })
})

describe('retenção antes do envio: o que falta não sai', () => {
  const casos: [string, DocumentoCarregado | Error, RegExp][] = [
    ['carga retida', new Error('retido: unidade sem financiamento configurado para a RNDS'), /financiamento/],
    ['profissional sem CNS', documento('rac', { profissional_cns: null }), /sem CNS/],
    ['unidade sem identificador do solicitante', documento('rac', { identificador_solicitante: null }), /identificador do solicitante/],
    ['produção desligada nesta etapa', documento('rac', { ambiente: 'producao' }), /produção desligado/],
    ['mapper retém (sem procedimento)', documento('rac', {}, { ...fixtureAltaParaCasa(), procedimentos: [] }), /sem procedimento SIGTAP/],
  ]
  for (const [nome, doc, motivo] of casos) {
    it(nome, async () => {
      const antes = sim.recebidos.length
      const { fila, registros } = filaDeTeste({ x: doc })
      await processarLote(deps(fila))
      const r = registros.get('x')!
      assert.equal(r.resultado, 'retido')
      assert.match(r.erro!, /^retido: /)
      assert.match(r.erro!, motivo)
      assert.equal(sim.recebidos.length, antes, 'nada chegou à RNDS')
    })
  }

  it('unidade sem certificado', async () => {
    const { fila, registros } = filaDeTeste({ x: documento('rac') })
    await processarLote(deps(fila, { semCertificado: true }))
    assert.match(registros.get('x')!.erro!, /sem certificado/)
  })

  it('carga quebrada (não é retenção) é erro', async () => {
    const { fila, registros } = filaDeTeste({ x: new Error('episódio 123 não encontrado') })
    await processarLote(deps(fila))
    assert.equal(registros.get('x')!.resultado, 'erro')
  })
})

describe('endereços', () => {
  it('homologação, produção pela UF e simulador', () => {
    assert.deepEqual(enderecos('homologacao', 'GO'), { auth: 'https://ehr-auth-hmg.saude.gov.br', ehr: 'https://ehr-services-hmg.saude.gov.br' })
    assert.deepEqual(enderecos('producao', 'GO'), { auth: 'https://ehr-auth.saude.gov.br', ehr: 'https://go-ehr-services.saude.gov.br' })
    assert.equal(enderecos('producao', 'GO', { ehr: 'https://127.0.0.1:8443' }).ehr, 'https://127.0.0.1:8443')
  })
})
