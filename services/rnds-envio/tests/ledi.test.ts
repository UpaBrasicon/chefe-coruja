// U15, PR 4: envio das fichas do LEDI a um PEC falso, que segue o exemplo oficial
// (laboratoriobridge/esusaps-integracao, ExemploEnvioApi.java): login e ficha em
// multipart/form-data, cookie JSESSIONID, 201 na ficha aceita.
import { after, before, describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { ClientePec, processarLoteLedi, type FichaCarregada, type FilaLedi, type ItemLedi, type RegistroLedi } from '../src/ledi.ts'
import { desserializar } from '../../../src/interop/ledi/thrift.ts'

const UNIDADE = '00000000-0000-4000-8000-00000000e601'
const UUID = '9912345-6f1c2b9e-3a3e-4b7b-9a51-0c1f2d3e4f50'
const INST = { contraChave: 'Chefe Coruja - teste', uuidInstalacao: 'teste', cpfOuCnpj: '00000000000191', nomeOuRazaoSocial: 'Chefe Coruja' }

type Recebido = { rota: string; tipo: string; cookie?: string; corpo: Buffer }

class PecFalso {
  servidor!: Server
  recebidos: Recebido[] = []
  /** respostas da ficha, em ordem; depois da lista, 201 */
  respostasFicha: number[] = []
  senhaCerta = 'segredo'
  url = ''
  async subir() {
    this.servidor = createServer((req, res) => {
      const partes: Buffer[] = []
      req.on('data', (p) => partes.push(p))
      req.on('end', () => {
        const corpo = Buffer.concat(partes)
        this.recebidos.push({ rota: req.url ?? '', tipo: req.headers['content-type'] ?? '', cookie: req.headers.cookie, corpo })
        if (req.url === '/api/recebimento/login') {
          const ok = corpo.includes('name="usuario"') && corpo.includes(`\r\n\r\n${this.senhaCerta}\r\n`)
          if (!ok) { res.writeHead(400); res.end('Usuário ou senha inválidos'); return }
          res.writeHead(200, { 'set-cookie': 'JSESSIONID=sessao-1; Path=/; HttpOnly' }); res.end(); return
        }
        if (req.url === '/api/v1/recebimento/ficha') {
          if (req.headers.cookie !== 'JSESSIONID=sessao-1') { res.writeHead(401); res.end('sem sessão'); return }
          const st = this.respostasFicha.shift() ?? 201
          res.writeHead(st); res.end(st === 400 ? 'Erro de validação: cnsCidadao' : ''); return
        }
        res.writeHead(404); res.end()
      })
    })
    await new Promise<void>((r) => this.servidor.listen(0, '127.0.0.1', r))
    this.url = `http://127.0.0.1:${(this.servidor.address() as AddressInfo).port}`
  }
}

function carga(): FichaCarregada['carga'] {
  return {
    unidade: { cnes: '9912345', codigo_ibge: '3550308', ine: null },
    profissional: { id: 'm', nome: 'Médica', cns: '700000000000005', cbo: '225142', cpf: null },
    cidadao: { id: 'p', cns: '898000000000002', cpf: null, data_nascimento: '1956-03-10', sexo: 'M', justificativa_sem_cpf: 8 },
    procedimento: { id: 'r', codigo_sigtap: '0214010015', quantidade: 1, realizado_em: '2026-11-10T13:00:00Z', episodio_id: null },
  }
}

function filaDeTeste(itens: ItemLedi[], dados: (id: string) => FichaCarregada) {
  const registros = new Map<string, RegistroLedi>()
  const fila: FilaLedi = {
    async pegarLote() { return itens.splice(0) },
    async dados(id) { return dados(id) },
    async registrar(id, r) { registros.set(id, r) },
  }
  return { fila, registros }
}

describe('U15, PR 4: envio ao PEC', () => {
  const pec = new PecFalso()
  before(() => pec.subir())
  after(() => pec.servidor.close())

  it('faz login, envia o .esus em multipart com o cookie e registra 201 como enviado', async () => {
    pec.recebidos = []
    const { fila, registros } = filaDeTeste([{ id: 'i1', tipo: 'fp', unidade_id: UNIDADE, uuid_ficha: UUID, tentativas: 0 }],
      () => ({ item_id: 'i1', tipo: 'fp', uuid_ficha: UUID, unidade_id: UNIDADE, carga: carga(), envio: { pec_url: pec.url } }))
    const resumo = await processarLoteLedi({
      fila, credenciais: { obter: async () => ({ usuario: 'chefe', senha: 'segredo' }) }, pec: new ClientePec(), instalacao: INST,
    })
    assert.deepEqual(resumo, { enviado: 1, retido: 0, reenviar: 0, erro: 0 })
    assert.equal(registros.get('i1')?.resultado, 'enviado')
    const [login, ficha] = pec.recebidos
    assert.equal(login.rota, '/api/recebimento/login')
    assert.match(login.tipo, /^multipart\/form-data; boundary=/)
    assert.equal(ficha.rota, '/api/v1/recebimento/ficha')
    assert.equal(ficha.cookie, 'JSESSIONID=sessao-1')
    assert.match(ficha.tipo, /^multipart\/form-data/)
    assert.ok(ficha.corpo.includes(`name="ficha"; filename="${UUID}.esus"`))
    // o arquivo dentro do multipart é o DadoTransporte do Thrift, tipo 7
    const ini = ficha.corpo.indexOf('\r\n\r\n') + 4
    const fim = ficha.corpo.lastIndexOf('\r\n--')
    const t = desserializar(new Uint8Array(ficha.corpo.subarray(ini, fim))) as Record<number, unknown>
    assert.equal(t[2], 7n)
  })

  it('sessão vencida (401): entra de novo uma vez e envia', async () => {
    pec.recebidos = []
    const cliente = new ClientePec()
    const credencial = { usuario: 'chefe', senha: 'segredo' }
    assert.equal((await cliente.enviar({ url: pec.url, credencial, nome: `${UUID}.esus`, bytes: new Uint8Array([0]) })).resultado, 'enviado')
    pec.respostasFicha = [401]
    const r = await cliente.enviar({ url: pec.url, credencial, nome: `${UUID}.esus`, bytes: new Uint8Array([0]) })
    assert.equal(r.resultado, 'enviado')
    assert.deepEqual(pec.recebidos.map((x) => x.rota), [
      '/api/recebimento/login', '/api/v1/recebimento/ficha', '/api/v1/recebimento/ficha', '/api/recebimento/login', '/api/v1/recebimento/ficha',
    ])
  })

  it('400 é erro (não volta), 503 é reenviar, senha errada fica retida', async () => {
    const credencial = { usuario: 'chefe', senha: 'segredo' }
    const cliente = new ClientePec()
    pec.respostasFicha = [400]
    const e = await cliente.enviar({ url: pec.url, credencial, nome: 'x.esus', bytes: new Uint8Array([0]) })
    assert.equal(e.resultado, 'erro')
    assert.match(e.erro ?? '', /Erro de validação/)
    pec.respostasFicha = [503]
    assert.equal((await cliente.enviar({ url: pec.url, credencial, nome: 'x.esus', bytes: new Uint8Array([0]) })).resultado, 'reenviar')
    const s = await new ClientePec().enviar({ url: pec.url, credencial: { usuario: 'chefe', senha: 'errada' }, nome: 'x.esus', bytes: new Uint8Array([0]) })
    assert.equal(s.resultado, 'retido')
    assert.match(s.erro ?? '', /^retido: o PEC recusou a credencial/)
    const fora = await new ClientePec().enviar({ url: 'http://127.0.0.1:1', credencial, nome: 'x.esus', bytes: new Uint8Array([0]) })
    assert.equal(fora.resultado, 'reenviar')
  })

  it('retém sem credencial da unidade e quando a carga ou a ficha dizem "retido:"', async () => {
    const semCredencial = filaDeTeste([{ id: 'a', tipo: 'fp', unidade_id: UNIDADE, uuid_ficha: UUID, tentativas: 0 }],
      () => ({ item_id: 'a', tipo: 'fp', uuid_ficha: UUID, unidade_id: UNIDADE, carga: carga(), envio: { pec_url: pec.url } }))
    await processarLoteLedi({ fila: semCredencial.fila, credenciais: { obter: async () => null }, pec: new ClientePec(), instalacao: INST })
    assert.match(semCredencial.registros.get('a')?.erro ?? '', /^retido: unidade sem a credencial/)

    const cargaRetida = filaDeTeste([{ id: 'b', tipo: 'fai', unidade_id: UNIDADE, uuid_ficha: UUID, tentativas: 0 }], () => {
      throw new Error('retido: paciente sem CNS e sem CPF')
    })
    await processarLoteLedi({ fila: cargaRetida.fila, credenciais: { obter: async () => ({ usuario: 'u', senha: 's' }) }, pec: new ClientePec(), instalacao: INST })
    assert.equal(cargaRetida.registros.get('b')?.resultado, 'retido')

    const semIbge = filaDeTeste([{ id: 'c', tipo: 'fp', unidade_id: UNIDADE, uuid_ficha: UUID, tentativas: 0 }], () => {
      const c = carga()
      return { item_id: 'c', tipo: 'fp', uuid_ficha: UUID, unidade_id: UNIDADE, carga: { ...c, unidade: { ...c.unidade, codigo_ibge: '' } }, envio: { pec_url: pec.url } }
    })
    await processarLoteLedi({ fila: semIbge.fila, credenciais: { obter: async () => ({ usuario: 'u', senha: 's' }) }, pec: new ClientePec(), instalacao: INST })
    assert.match(semIbge.registros.get('c')?.erro ?? '', /^retido: unidade sem código IBGE/)
  })
})
