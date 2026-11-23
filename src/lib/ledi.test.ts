// Percurso da UBS, U15 (PR 3): fichas do LEDI APS 8.7.0 no Thrift binário.
import { test } from 'node:test'
import assert from 'node:assert/strict'

const UNIDADE = { cnes: '9912345', codigo_ibge: '3550308', ine: null }
const MEDICO = { id: 'm', nome: 'Médica', cns: '700000000000005', cbo: '225142', cpf: null }
const TECNICO = { id: 't', nome: 'Técnico', cns: '700000000000013', cbo: '322205', cpf: null }
const PACIENTE: { id: string; cns: string | null; cpf: string | null; data_nascimento: string; sexo: string | null; justificativa_sem_cpf: number | null } =
  { id: 'p', cns: '898000000000002', cpf: null, data_nascimento: '1956-03-10', sexo: 'M', justificativa_sem_cpf: 8 }
const INST = { contraChave: 'Chefe Coruja - 2026.11', uuidInstalacao: '0b6a0c4e-1f7e-4e43-9d5d-2a6f8a1c0001', cpfOuCnpj: '00000000000191', nomeOuRazaoSocial: 'Chefe Coruja' }
const UUID = '9912345-6f1c2b9e-3a3e-4b7b-9a51-0c1f2d3e4f50'

function cargaFai(extra: Record<string, unknown> = {}) {
  return {
    unidade: UNIDADE, profissional: MEDICO, cidadao: PACIENTE,
    atendimento: {
      id: 'e', tipo_atendimento: 'consulta_programada', inicio: '2026-11-10T13:05:00Z', fim: '2026-11-10T13:25:00Z',
      problemas: ['hipertensao_arterial', 'rastreamento_cancer_colo_utero'], ciap: ['k86'], cid: ['I10', 'E11.9'],
      condutas: ['retorno_cuidado_continuado', 'retorno_cuidado_continuado'], exames_solicitados: ['0202010503'],
      ...extra,
    },
    medicoes: [
      { conceito: 'peso', loinc: '29463-7', valor: 70.25, unidade: 'kg', aferido_em: '2026-11-10T12:50:00Z' },
      { conceito: 'estatura', loinc: '8302-2', valor: 170, unidade: 'cm', aferido_em: '2026-11-10T12:50:00Z' },
      { conceito: 'pressao-arterial-sistolica', loinc: '8480-6', valor: 142, unidade: 'mmHg', aferido_em: '2026-11-10T12:50:00Z' },
    ],
  }
}

test('Thrift binário: struct, i64, string, lista e STOP no formato do protocolo', async () => {
  const { serializar, desserializar, i64, str, lista, struct, TIPO, texto } = await import('../interop/ledi/thrift.ts')
  const b = serializar({ 1: str('ab'), 2: i64(7), 3: lista(TIPO.I64, [i64(1), i64(2)]), 4: struct({ 1: i64(-1) }) })
  // campo 1: tipo 11 (string), id 0x0001, tamanho 2, "ab"
  assert.deepEqual([...b.slice(0, 9)], [11, 0, 1, 0, 0, 0, 2, 97, 98])
  assert.equal(b[b.length - 1], 0)
  const s = desserializar(b) as Record<number, unknown>
  assert.equal(texto(s[1] as Uint8Array), 'ab')
  assert.equal(s[2], 7n)
  assert.deepEqual(s[3], [1n, 2n])
  assert.deepEqual(s[4], { 1: -1n })
})

test('FAI: DadoTransporte com tipo 4, CNES, IBGE, versão 8.7.0 e a ficha dentro', async () => {
  const { fichaFai } = await import('../interop/ledi/fichas.ts')
  const { desserializar, texto } = await import('../interop/ledi/thrift.ts')
  const arq = fichaFai(UUID, cargaFai(), INST)
  assert.equal(arq.nome, `${UUID}.esus`)
  const t = desserializar(arq.bytes) as Record<number, never>
  assert.equal(texto(t[1]), UUID)
  assert.equal(t[2], 4n)
  assert.equal(texto(t[3]), '9912345')
  assert.equal(texto(t[4]), '3550308')
  assert.deepEqual(t[10], { 1: 8, 2: 7, 3: 0 })
  assert.equal(texto((t[8] as Record<number, never>)[1]), 'Chefe Coruja - 2026.11')

  const f = desserializar(t[7]) as Record<number, never>
  assert.equal(texto(f[3]), UUID)
  assert.equal(f[4], 3) // tpCdsOrigem = sistemas terceiros
  // VariasLotacoesHeaderThrift: 6 principal, 8 data, 9 IBGE
  const lot = (f[1] as Record<number, never>)
  assert.equal(texto((lot[6] as Record<number, never>)[1]), '700000000000005')
  assert.equal(texto((lot[6] as Record<number, never>)[2]), '225142')
  assert.equal(lot[8], BigInt(Date.parse('2026-11-10T13:25:00Z')))
  assert.equal(texto(lot[9]), '3550308')

  const c = (f[2] as never[])[0] as Record<number, never>
  assert.equal(texto(c[2]), '898000000000002') // CNS, sem CPF
  assert.equal(c[30], undefined)
  assert.equal(c[3], BigInt(Date.parse('1956-03-10T00:00:00-03:00')))
  assert.equal(c[4], 1n) // UBS
  assert.equal(c[5], 0n) // masculino
  assert.equal(c[6], 1n) // 10h de Brasília: manhã
  assert.equal(c[7], 1n) // consulta programada
  assert.deepEqual(c[22], [2n]) // conduta sem repetição
  assert.equal(c[28], BigInt(Date.parse('2026-11-10T13:05:00Z')))
  assert.equal(c[29], BigInt(Date.parse('2026-11-10T13:25:00Z')))
  assert.equal(c[47], true) // sem CPF: CNS e o motivo (U15, VC7)
  assert.equal(c[48], 8n)
  const probs = (c[40] as Record<number, never>[]).map((p) => texto(p[5]) ?? texto(p[4]))
  assert.deepEqual(probs, ['I10', 'E119', 'K86', 'ABP022'])
  const ex = (c[17] as Record<number, never>[])[0]
  assert.equal(texto(ex[1]), '0202010503')
  // medições: peso e altura; a pressão só vai com a sistólica e a diastólica juntas
  assert.deepEqual(c[39], { 11: 70.25, 12: 170 })
  assert.ok(arq.avisos.some((a) => a.includes('hipertensao_arterial')))
})

test('FAI: retém sem tipo do LEDI, sem conduta, sem CID/CIAP, sem CNS e CPF ou sem IBGE', async () => {
  const { fichaFai } = await import('../interop/ledi/fichas.ts')
  assert.throws(() => fichaFai(UUID, cargaFai({ tipo_atendimento: 'pre_natal_parceiro' }), INST), /^Error: retido: tipo de atendimento/)
  assert.throws(() => fichaFai(UUID, cargaFai({ condutas: [] }), INST), /retido: atendimento sem conduta/)
  assert.throws(() => fichaFai(UUID, cargaFai({ cid: [], ciap: [], problemas: ['asma'] }), INST), /retido: atendimento sem CID nem CIAP/)
  assert.throws(() => fichaFai(UUID, { ...cargaFai(), cidadao: { ...PACIENTE, cns: null } }, INST), /retido: paciente sem CPF e sem CNS/)
  assert.throws(() => fichaFai(UUID, { ...cargaFai(), cidadao: { ...PACIENTE, justificativa_sem_cpf: null } }, INST), /retido: paciente sem CPF e sem justificativa/)
  assert.throws(() => fichaFai(UUID, { ...cargaFai(), unidade: { ...UNIDADE, codigo_ibge: '' } }, INST), /retido: unidade sem código IBGE/)
})

test('FAI: CPF no lugar do CNS, nunca os dois; pressão vai com as duas medidas', async () => {
  const { fichaFai } = await import('../interop/ledi/fichas.ts')
  const { desserializar, texto } = await import('../interop/ledi/thrift.ts')
  const carga = cargaFai()
  carga.cidadao = { ...PACIENTE, cpf: '52998224725' }
  carga.medicoes = [...carga.medicoes, { conceito: 'pressao-arterial-diastolica', loinc: '8462-4', valor: 91, unidade: 'mmHg', aferido_em: '2026-11-10T12:50:00Z' }]
  const t = desserializar(fichaFai(UUID, carga, { ...INST }).bytes) as Record<number, never>
  const c = ((desserializar(t[7]) as Record<number, never>)[2] as never[])[0] as Record<number, never>
  assert.equal(texto(c[30]), '52998224725')
  assert.equal(c[2], undefined)
  assert.equal(c[47], false)
  assert.equal(c[48], undefined)
  assert.deepEqual(c[39], { 3: 142, 4: 91, 11: 70.25, 12: 170 })
})

test('FP: DadoTransporte com tipo 7 e o procedimento com quem fez, turno e cidadão', async () => {
  const { fichaFp, turnoLedi } = await import('../interop/ledi/fichas.ts')
  const { desserializar, texto } = await import('../interop/ledi/thrift.ts')
  const arq = fichaFp(UUID, {
    unidade: { ...UNIDADE, ine: '0001234567' }, profissional: TECNICO, cidadao: { ...PACIENTE, sexo: 'F' },
    procedimento: { id: 'r', codigo_sigtap: '0214010015', quantidade: 2, realizado_em: '2026-11-10T20:30:00Z', episodio_id: null },
  }, INST)
  const t = desserializar(arq.bytes) as Record<number, never>
  assert.equal(t[2], 7n)
  assert.equal(texto(t[5]), '0001234567')
  const f = desserializar(t[7]) as Record<number, never>
  assert.equal(texto(f[1]), UUID)
  const h = f[3] as Record<number, never>
  assert.equal(texto(h[2]), '322205')
  assert.equal(texto(h[4]), '0001234567')
  assert.equal(texto(h[6]), '3550308')
  const c = (f[4] as never[])[0] as Record<number, never>
  assert.deepEqual((c[8] as Uint8Array[]).map((x) => texto(x)), ['0214010015'])
  assert.equal(c[4], 1n) // feminino
  assert.equal(c[5], 1n) // UBS
  assert.equal(c[6], 2n) // 17h30 de Brasília: tarde
  assert.equal(texto(c[2]), '898000000000002')
  assert.equal(c[20], true) // sem CPF
  assert.equal(c[21], 8n)
  assert.equal(turnoLedi('2026-11-10T20:30:00Z'), 2) // 17h30 de Brasília: tarde
  assert.equal(turnoLedi('2026-11-10T21:00:00Z'), 3) // 18h: noite
  assert.ok(arq.avisos[0].includes('quantidade 2'))
})

// ── U15, vacina, PR 6: Ficha de Vacinação ───────────────────────────────────
function cargaFv(extra: Record<string, unknown> = {}, cidadao: Record<string, unknown> = {}) {
  return {
    unidade: UNIDADE, profissional: { ...TECNICO, cbo: '322205' }, cidadao: { ...PACIENTE, ...cidadao },
    vacina: {
      id: 'v', registro_anterior: false, data_aplicacao: '2026-11-10', registrado_em: '2026-11-10T13:30:00Z',
      imunobiologico: 42, estrategia: 1, dose: 1, lote: 'PENTA01', fabricante: '152', grupo_atendimento: 121,
      via: 3, local: 18, aplicado_exterior: null, condicao_maternal: null, viajante: false, comunicante_hanseniase: null,
      prescritor_cbo: null, cid10_motivo: null, pesquisa_clinica: false, ...extra,
    },
  }
}

test('FV: DadoTransporte tipo 14 e a vacina aplicada nos campos do IDL oficial', async () => {
  const { fichaFv, montarFicha } = await import('../interop/ledi/fichas.ts')
  const { desserializar, texto } = await import('../interop/ledi/thrift.ts')
  const arq = fichaFv(UUID, cargaFv(), INST)
  const t = desserializar(arq.bytes) as Record<number, never>
  assert.equal(t[2], 14n)
  const f = desserializar(t[7]) as Record<number, never>
  assert.equal(texto(f[1]), UUID)
  assert.equal(f[2], 3) // tpCdsOrigem
  const h = f[3] as Record<number, never>
  assert.equal(texto(h[1]), '700000000000013')
  assert.equal(texto(h[2]), '322205')
  assert.equal(texto(h[6]), '3550308')
  const c = (f[4] as never[])[0] as Record<number, never>
  assert.equal(c[1], 1n) // 10h30 de Brasília: manhã
  assert.equal(texto(c[3]), '898000000000002')
  assert.equal(c[5], 0n)
  assert.equal(c[6], 1n)
  assert.equal(c[7], false)
  assert.equal(c[8], undefined) // não é BCG
  assert.equal(c[15], undefined) // masculino: sem condição maternal
  assert.equal(c[16], true) // sem CPF
  assert.equal(c[17], 8n)
  const v = (c[11] as never[])[0] as Record<number, never>
  assert.equal(v[1], 42n)
  assert.equal(v[2], 1n)
  assert.equal(v[3], 1n)
  assert.equal(texto(v[4]), 'PENTA01')
  assert.equal(v[6], 121n)
  assert.equal(v[7], false)
  assert.equal(v[8], undefined)
  assert.equal(v[13], false)
  assert.equal(v[17], 3n)
  assert.equal(v[18], 18n)
  assert.equal(texto(v[19]), '152')
  assert.equal(v[5], undefined) // o fabricante vai no 19 (coRndsFabricante), não no 5
  assert.deepEqual(montarFicha('fv', UUID, cargaFv(), INST).bytes, arq.bytes)
})

test('FV: registro anterior, condição maternal, BCG e o que retém', async () => {
  const { fichaFv } = await import('../interop/ledi/fichas.ts')
  const { desserializar } = await import('../interop/ledi/thrift.ts')
  const linha = (b: Uint8Array) => {
    const f = desserializar((desserializar(b) as Record<number, never>)[7]) as Record<number, never>
    const c = (f[4] as never[])[0] as Record<number, never>
    return { c, v: (c[11] as never[])[0] as Record<number, never> }
  }
  const ant = linha(fichaFv(UUID, cargaFv({ registro_anterior: true, estrategia: null, lote: null, fabricante: null, grupo_atendimento: null,
    imunobiologico: 85, data_aplicacao: '2021-08-01', aplicado_exterior: true }), INST).bytes)
  assert.equal(ant.v[7], true)
  assert.equal(ant.v[8], BigInt(Date.parse('2021-08-01T00:00:00-03:00')))
  assert.equal(ant.v[9], true)
  assert.equal(ant.v[4], undefined)
  assert.equal(ant.v[6], undefined)
  const mulher = linha(fichaFv(UUID, cargaFv({ condicao_maternal: 2 }, { sexo: 'F' }), INST).bytes)
  assert.equal(mulher.c[15], 2n)
  assert.throws(() => fichaFv(UUID, cargaFv({}, { sexo: 'F' }), INST), /retido: vacina sem a condição maternal/)
  const bcg = linha(fichaFv(UUID, cargaFv({ imunobiologico: 15, comunicante_hanseniase: false }), INST).bytes)
  assert.equal(bcg.c[8], false)
  assert.throws(() => fichaFv(UUID, cargaFv({ imunobiologico: 15 }), INST), /retido: BCG sem comunicante/)
  assert.throws(() => fichaFv(UUID, cargaFv({ lote: null }), INST), /retido: vacina aplicada sem lote/)
  assert.throws(() => fichaFv(UUID, cargaFv({}, { justificativa_sem_cpf: null }), INST), /retido: paciente sem CPF e sem justificativa/)
  const esp = linha(fichaFv(UUID, cargaFv({ estrategia: 2, dose: 8, prescritor_cbo: '225125', cid10_motivo: 'D80.0' }), INST).bytes)
  assert.equal(esp.v[11] && new TextDecoder().decode(esp.v[11] as Uint8Array), '225125')
  assert.equal(new TextDecoder().decode(esp.v[12] as Uint8Array), 'D800')
})

// Refinamento da UBS, RF3 = A (RT, 23/11/2026): a circunferência abdominal vai
// no campo 1 de MedicoesThrift (IDL oficial), em cm, com uma casa decimal, de
// 0.0 a 99999 (dicionário da FAI, LEDI 8.7.0).
test('RF3: circunferência abdominal no campo 1 das medições da FAI', async () => {
  const { medicoes } = await import('../interop/ledi/fichas.ts')
  const { double } = await import('../interop/ledi/thrift.ts')
  const m = (valor: number) => [{ conceito: 'circunferencia-abdominal', loinc: '8280-0', valor, unidade: 'cm', aferido_em: '2026-11-23T12:50:00Z' }]
  assert.deepEqual(medicoes(m(94.56))?.[1], double(94.6))
  assert.equal(medicoes(m(-1)), undefined)
  assert.equal(medicoes(m(100000)), undefined)
  // a tela do técnico e da consulta da UBS pede o campo; a escuta inicial, não
  const { readFileSync } = await import('node:fs')
  assert.match(readFileSync('src/components/clinico/SinaisVitaisAps.tsx', 'utf8'), /extras=\{\['estatura', 'circunferencia-abdominal'\]\}/)
  assert.match(readFileSync('src/pages/enfermagem/triagem/EscutaInicial.tsx', 'utf8'), /extras=\{\['estatura'\]\}/)
})
