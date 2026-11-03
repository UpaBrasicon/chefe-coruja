// ─────────────────────────────────────────────────────────────────────────────
// O cofre do certificado (5C-5.4b): cifra do navegador, abertura no serviço,
// leitura do .pfx com o openssl e o envio ao simulador com o certificado aberto.
//
// O banco é de mentira (em memória), no formato das funções da 5.4; a RNDS é o
// simulador, com TLS mútuo de verdade.
//
// Uso: node --test services/rnds-envio/tests/cofre.test.ts
// ─────────────────────────────────────────────────────────────────────────────
import { after, before, describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { generateKeyPairSync } from 'node:crypto'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { fixtureAltaParaCasa } from '../../../src/interop/fhir/__fixtures__.ts'
import { abrirCertificado, cifrarCertificado, idDaChave, type Cifrado } from '../../../src/interop/rnds/cofre.ts'
import { processarLote, type DocumentoCarregado, type Fila, type Registro } from '../src/ciclo.ts'
import { ClienteRnds } from '../src/cliente-rnds.ts'
import { carregarChave, CofreDeCertificados, lerPfx, type BancoDoCofre, type ChaveDoServico, type Leitura } from '../src/cofre.ts'
import { gerarCertificadosDeTeste, SimuladorRnds, type CertificadosDeTeste } from '../simulador/simulador.ts'

const UNIDADE = '00000000-0000-4000-8000-0000000f5602'
const CREDENCIAL = '00000000-0000-4000-8000-0000000f5611'
const OUTRA = '00000000-0000-4000-8000-0000000f5612'
const SENHA_ICP = 'senha-icp-teste'

let pasta: string
let certs: CertificadosDeTeste
let sim: SimuladorRnds
let base: string
let chave: ChaveDoServico
let icpPfx: Buffer
let legadoPfx: Buffer | null = null

function pemDeChave(): string {
  return generateKeyPairSync('rsa', { modulusLength: 2048 }).privateKey.export({ type: 'pkcs8', format: 'pem' }).toString()
}

before(async () => {
  pasta = mkdtempSync(join(tmpdir(), 'rnds-cofre-'))
  certs = gerarCertificadosDeTeste(pasta)
  sim = new SimuladorRnds(certs)
  base = await sim.ouvir()
  chave = await carregarChave(pemDeChave())

  // um A1 no padrão da ICP-Brasil (CN "NOME:CNPJ"), da CA do simulador
  const p = (n: string) => join(pasta, n)
  const ossl = (...a: string[]) => execFileSync('openssl', a, { stdio: 'pipe' })
  ossl('req', '-newkey', 'rsa:2048', '-nodes', '-keyout', p('icp.key'), '-out', p('icp.csr'), '-subj', '/CN=UPA TESTE COFRE LTDA:12345678000199')
  ossl('x509', '-req', '-in', p('icp.csr'), '-CA', p('ca.crt'), '-CAkey', p('ca.key'), '-CAcreateserial', '-out', p('icp.crt'),
    '-days', '30', '-extfile', p('cliente.ext'))
  ossl('pkcs12', '-export', '-inkey', p('icp.key'), '-in', p('icp.crt'), '-certfile', p('ca.crt'), '-out', p('icp.pfx'),
    '-passout', `pass:${SENHA_ICP}`)
  icpPfx = readFileSync(p('icp.pfx'))
  // o mesmo com as cifras antigas (RC2-40), como muitos A1 emitidos há anos
  try {
    ossl('pkcs12', '-export', '-legacy', '-inkey', p('icp.key'), '-in', p('icp.crt'), '-out', p('legado.pfx'), '-passout', `pass:${SENHA_ICP}`)
    legadoPfx = readFileSync(p('legado.pfx'))
  } catch {
    legadoPfx = null // openssl sem o provedor legacy: o teste avisa e pula
  }
})
after(async () => {
  await sim.fechar()
  rmSync(pasta, { recursive: true, force: true })
})

/** O banco do cofre em memória, como as funções da 5.4. */
function bancoDeTeste() {
  const credenciais = new Map<string, { cifrado: Cifrado | null; situacao: string; impressao: string | null }>()
  const unidades = new Map<string, string>()
  const leituras: (Leitura & { credencial: string })[] = []
  const chaves: string[] = []
  const banco: BancoDoCofre = {
    async registrarChave(id) {
      chaves.push(id)
    },
    async certificadoDaUnidade(u) {
      const id = unidades.get(u)
      const k = id ? credenciais.get(id) : undefined
      return k?.cifrado ? { credencial_id: id!, certificado_cifrado: k.cifrado, situacao: k.situacao, impressao: k.impressao } : null
    },
    async aguardando() {
      return [...credenciais].filter(([, k]) => k.situacao === 'aguardando' && k.cifrado)
        .map(([id, k]) => ({ credencial_id: id, certificado_cifrado: k.cifrado! }))
    },
    async registrarCertificado(credencial, l) {
      leituras.push({ credencial, ...l })
      const k = credenciais.get(credencial)!
      k.situacao = l.situacao
      k.impressao = l.impressao ?? null
    },
  }
  const enviar = async (credencial: string, unidade: string, cifrado: Cifrado) => {
    credenciais.set(credencial, { cifrado, situacao: 'aguardando', impressao: null })
    unidades.set(unidade, credencial)
  }
  return { banco, enviar, leituras, chaves, credenciais }
}

async function cifrado(pfx: Uint8Array, senha: string, credencial = CREDENCIAL, c: ChaveDoServico = chave): Promise<Cifrado> {
  return cifrarCertificado({ id: c.id, jwk: c.jwk }, credencial, { pfx, senha })
}

function filaUmRac() {
  const registros = new Map<string, Registro>()
  const doc: DocumentoCarregado = {
    item_id: 'x', tipo: 'rac', dados: fixtureAltaParaCasa(),
    envio: {
      credencial_id: CREDENCIAL, ambiente: 'homologacao', uf: 'GO', identificador_solicitante: '99999',
      id_rnds_anterior: null, profissional_id: null, profissional_cns: '898001000000011',
    },
  }
  const fila: Fila = {
    async pegarLote() { return [{ id: 'x', unidade_id: UNIDADE, tentativas: 0, tipo_documento: 'rac' }] },
    async dados() { return doc },
    async registrar(id, r) { registros.set(id, r) },
  }
  return { fila, registros }
}

describe('a cifra do cofre (navegador e serviço)', () => {
  it('o que o navegador cifra, só a chave do serviço abre, e só para a mesma credencial', async () => {
    const c = await cifrado(certs.unidadePfx, 'teste-simulador')
    assert.equal(c.versao, 1)
    assert.equal(c.chave_id, chave.id)
    const aberto = await abrirCertificado(chave.privada, CREDENCIAL, c)
    assert.deepEqual(Buffer.from(aberto.pfx), certs.unidadePfx)
    assert.equal(aberto.senha, 'teste-simulador')
    await assert.rejects(abrirCertificado(chave.privada, OUTRA, c), 'o cifrado copiado para outra credencial não abre')
    const outraChave = await carregarChave(pemDeChave())
    await assert.rejects(abrirCertificado(outraChave.privada, CREDENCIAL, c), 'outra chave não abre')
  })

  it('a chave publicada não leva a parte privada e o id é a impressão RFC 7638', async () => {
    assert.equal('d' in chave.jwk, false)
    assert.equal(chave.jwk.kty, 'RSA')
    assert.match(chave.id, /^[0-9A-Za-z_-]{43}$/)
    assert.equal(await idDaChave(chave.jwk), chave.id)
    await assert.rejects(cifrarCertificado({ id: 'outro-id-qualquer', jwk: chave.jwk }, CREDENCIAL, { pfx: new Uint8Array(1), senha: '' }))
  })

  it('chave fraca não sobe', async () => {
    const fraca = generateKeyPairSync('rsa', { modulusLength: 1024 }).privateKey.export({ type: 'pkcs8', format: 'pem' }).toString()
    await assert.rejects(carregarChave(fraca), /2048/)
  })
})

describe('leitura do .pfx', () => {
  it('A1 no padrão ICP-Brasil: titular, CNPJ, validade, impressão e a cadeia', async () => {
    const l = await lerPfx(icpPfx, SENHA_ICP, new Date())
    assert.equal(l.situacao, 'valido')
    assert.equal(l.titular, 'UPA TESTE COFRE LTDA')
    assert.equal(l.documento, '12345678000199')
    assert.ok(l.validoAte! > new Date())
    assert.match(l.impressao!, /^([0-9A-F]{2}:){31}[0-9A-F]{2}$/)
    assert.ok(l.certificado && 'cadeia' in l.certificado)
    assert.equal((l.certificado.cadeia.match(/BEGIN CERTIFICATE/g) ?? []).length, 2, 'a folha e a CA')
  })

  it('A1 com as cifras antigas (RC2) abre com -legacy', async (t) => {
    if (!legadoPfx) return t.skip('openssl sem o provedor legacy')
    const l = await lerPfx(legadoPfx, SENHA_ICP, new Date())
    assert.equal(l.situacao, 'valido')
    assert.equal(l.documento, '12345678000199')
  })

  it('senha errada, arquivo que não é .pfx e certificado vencido', async () => {
    assert.equal((await lerPfx(icpPfx, 'errada', new Date())).situacao, 'senha_incorreta')
    assert.equal((await lerPfx(new TextEncoder().encode('nao sou um pfx'), 'x', new Date())).situacao, 'invalido')
    const vencido = await lerPfx(icpPfx, SENHA_ICP, new Date(Date.now() + 60 * 86_400_000))
    assert.equal(vencido.situacao, 'vencido')
    assert.equal(vencido.certificado, undefined, 'vencido não vai ao TLS')
  })

  it('certificado sem o padrão ICP-Brasil: titular é o CN, sem documento', async () => {
    const l = await lerPfx(certs.unidadePfx, certs.unidadeSenha, new Date())
    assert.equal(l.situacao, 'valido')
    assert.equal(l.titular, 'UPA de teste (simulador RNDS)')
    assert.equal(l.documento, null)
  })
})

describe('o serviço com o cofre', () => {
  it('certificado que acabou de chegar: lido no ciclo, sem documento na fila', async () => {
    const b = bancoDeTeste()
    await b.enviar(CREDENCIAL, UNIDADE, await cifrado(icpPfx, SENHA_ICP))
    const cofre = new CofreDeCertificados({ banco: b.banco, chave })
    await cofre.publicarChave()
    await cofre.publicarChave()
    assert.deepEqual(b.chaves, [chave.id], 'a chave é publicada uma vez')
    assert.equal(await cofre.lerAguardando(), 1)
    assert.equal(b.leituras.length, 1)
    assert.equal(b.leituras[0].situacao, 'valido')
    assert.equal(b.leituras[0].documento, '12345678000199')
    assert.equal(await cofre.lerAguardando(), 0, 'lido, sai da lista')
  })

  it('o certificado do cofre envia ao simulador com TLS mútuo, sem reler a cada item', async () => {
    const b = bancoDeTeste()
    await b.enviar(CREDENCIAL, UNIDADE, await cifrado(icpPfx, SENHA_ICP))
    const cofre = new CofreDeCertificados({ banco: b.banco, chave })
    const rnds = new ClienteRnds({ caExtra: certs.ca, timeoutMs: 5_000 })
    for (let i = 0; i < 2; i++) {
      const { fila, registros } = filaUmRac()
      await processarLote({ fila, certificados: cofre, rnds, sobrepor: { auth: base, ehr: base } })
      assert.equal(registros.get('x')!.resultado, 'enviado')
    }
    assert.equal(b.leituras.length, 1, 'o certificado aberto fica na memória')
  })

  it('senha errada: grava, avisa (banco) e o documento fica retido com o motivo', async () => {
    const b = bancoDeTeste()
    await b.enviar(CREDENCIAL, UNIDADE, await cifrado(icpPfx, 'errada'))
    const cofre = new CofreDeCertificados({ banco: b.banco, chave })
    const { fila, registros } = filaUmRac()
    const antes = sim.recebidos.length
    await processarLote({ fila, certificados: cofre, rnds: new ClienteRnds({ caExtra: certs.ca }), sobrepor: { auth: base, ehr: base } })
    assert.equal(b.leituras[0].situacao, 'senha_incorreta')
    assert.equal(registros.get('x')!.resultado, 'retido')
    assert.match(registros.get('x')!.erro!, /senha/)
    assert.equal(sim.recebidos.length, antes)
    assert.deepEqual(await cofre.obter(UNIDADE), { retido: registros.get('x')!.erro }, 'não tenta abrir de novo')
    assert.equal(b.leituras.length, 1)
  })

  it('cifrado com a chave antiga do serviço: chave trocada', async () => {
    const b = bancoDeTeste()
    const antiga = await carregarChave(pemDeChave())
    await b.enviar(CREDENCIAL, UNIDADE, await cifrado(icpPfx, SENHA_ICP, CREDENCIAL, antiga))
    const cofre = new CofreDeCertificados({ banco: b.banco, chave })
    assert.match(String((await cofre.obter(UNIDADE) as { retido: string }).retido), /chave do serviço mudou/)
    assert.equal(b.leituras[0].situacao, 'chave_trocada')
  })

  it('cifrado de outra credencial colado nesta: não abre', async () => {
    const b = bancoDeTeste()
    await b.enviar(CREDENCIAL, UNIDADE, await cifrado(icpPfx, SENHA_ICP, OUTRA))
    const cofre = new CofreDeCertificados({ banco: b.banco, chave })
    assert.ok('retido' in ((await cofre.obter(UNIDADE)) as object))
    assert.equal(b.leituras[0].situacao, 'invalido')
  })

  it('vence com o serviço rodando: grava vencido e para de enviar', async () => {
    const b = bancoDeTeste()
    await b.enviar(CREDENCIAL, UNIDADE, await cifrado(icpPfx, SENHA_ICP))
    let agora = new Date()
    const cofre = new CofreDeCertificados({ banco: b.banco, chave, agora: () => agora })
    const obtido = await cofre.obter(UNIDADE)
    assert.ok(obtido && 'cadeia' in obtido)
    agora = new Date(Date.now() + 60 * 86_400_000)
    assert.match(String((await cofre.obter(UNIDADE) as { retido: string }).retido), /venceu/)
    assert.equal(b.leituras.at(-1)!.situacao, 'vencido')
  })

  it('certificado novo enviado depois: o serviço abre o novo', async () => {
    const b = bancoDeTeste()
    await b.enviar(CREDENCIAL, UNIDADE, await cifrado(icpPfx, 'errada'))
    const cofre = new CofreDeCertificados({ banco: b.banco, chave })
    assert.ok('retido' in ((await cofre.obter(UNIDADE)) as object))
    await b.enviar(CREDENCIAL, UNIDADE, await cifrado(icpPfx, SENHA_ICP))
    const obtido = await cofre.obter(UNIDADE)
    assert.ok(obtido && 'cadeia' in obtido)
    assert.equal(b.leituras.at(-1)!.situacao, 'valido')
  })

  it('unidade sem certificado no cofre usa a pasta', async () => {
    const b = bancoDeTeste()
    const reserva = { obter: async () => ({ pfx: certs.unidadePfx, senha: certs.unidadeSenha }) }
    const cofre = new CofreDeCertificados({ banco: b.banco, chave, reserva })
    const obtido = await cofre.obter(UNIDADE)
    assert.ok(obtido && 'pfx' in obtido)
    assert.equal(await new CofreDeCertificados({ banco: b.banco, chave }).obter(UNIDADE), null)
  })
})
