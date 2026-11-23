// ─────────────────────────────────────────────────────────────────────────────
// Fichas do LEDI APS 8.7.0 (percurso da UBS, U15, PR 3) — PURAS, sem banco.
//
// Recebem a carga do banco (private.ledi_carga_fai e private.ledi_carga_fp,
// migration 20270415000022; private.ledi_carga_fv, U15 vacina, migration
// 20270415000030) e devolvem o arquivo `<uuidFicha>.esus` que vai à
// API do PEC e-SUS APS do município (POST api/v1/recebimento/ficha): o
// DadoTransporte serializado no Thrift binário, com a ficha dentro.
//
// Fonte: Layout e-SUS APS de Dados e Interface, versão 8.7.0
// (https://integracao.esusaps.bridge.ufsc.tech/ledi/documentacao/), dicionários
// "Camada de transporte", "Cabeçalhos de lotação", "Atendimento Individual" e
// "Procedimentos", e as tabelas de referência (Dicionário de dados). O número
// de cada campo é o do IDL oficial do Thrift (laboratoriobridge/esusaps-integracao,
// commit 9316f280f526: dado_transporte.thrift, common.thrift,
// ficha_atendimento_individual.thrift, ficha_atendimento_procedimento.thrift e
// ficha_vacinacao.thrift).
// Nos registros filhos e no VariasLotacoesHeader, ele não é o "#N" do
// dicionário (correção do U15, PR 3).
//
// Falta de dado vira erro com o prefixo "retido:", como na RNDS: o serviço de
// envio (PR 4) grava a ficha como retida, com o motivo, e tenta de novo depois.
// ─────────────────────────────────────────────────────────────────────────────
import { TIPO, bool, double, i32, i64, lista, serializar, str, struct, type Struct, type Valor } from './thrift.ts'

// ── carga do banco ───────────────────────────────────────────────────────────
export type UnidadeLedi = { cnes: string; codigo_ibge: string; ine: string | null }
export type ProfissionalLedi = { id: string; nome: string | null; cns: string; cbo: string; cpf: string | null }
export type CidadaoLedi = {
  id: string; cns: string | null; cpf: string | null; data_nascimento: string; sexo: string | null
  /** U15, VC7: motivo de não ter CPF (lista do LEDI); só vem sem CPF. */
  justificativa_sem_cpf?: number | null
}
export type MedicaoLedi = { conceito: string; loinc: string | null; valor: number; unidade: string | null; aferido_em: string }

export type CargaFai = {
  unidade: UnidadeLedi
  profissional: ProfissionalLedi
  cidadao: CidadaoLedi
  atendimento: {
    id: string
    tipo_atendimento: string | null
    inicio: string | null
    fim: string
    problemas: string[]
    ciap: string[]
    cid: string[]
    condutas: string[]
    exames_solicitados: string[]
  }
  medicoes: MedicaoLedi[]
}

export type CargaFp = {
  unidade: UnidadeLedi
  profissional: ProfissionalLedi
  cidadao: CidadaoLedi
  procedimento: { id: string; codigo_sigtap: string; quantidade: number; realizado_em: string; episodio_id: string | null }
}

export type CargaFv = {
  unidade: UnidadeLedi
  profissional: ProfissionalLedi
  cidadao: CidadaoLedi
  vacina: {
    id: string; registro_anterior: boolean; data_aplicacao: string; registrado_em: string
    imunobiologico: number; estrategia: number | null; dose: number; lote: string | null; fabricante: string | null
    grupo_atendimento: number | null; via: number; local: number; aplicado_exterior: boolean | null
    condicao_maternal: number | null; viajante: boolean; comunicante_hanseniase: boolean | null
    prescritor_cbo: string | null; cid10_motivo: string | null; pesquisa_clinica: boolean
  }
}

/** Quem gera e envia o dado (DadoInstalacao). Vem da configuração do serviço de envio. */
export type Instalacao = {
  contraChave: string
  uuidInstalacao: string
  cpfOuCnpj: string
  nomeOuRazaoSocial: string
  fone?: string
  email?: string
}

// ── tabelas de referência do LEDI 8.7.0 ─────────────────────────────────────
export const VERSAO_LEDI = { major: 8, minor: 7, revision: 0 } as const
/** TipoDadoSerializado */
export const TIPO_DADO = { fai: 4, fp: 7, fv: 14 } as const
/** tpCdsOrigem: sistemas terceiros */
const ORIGEM_TERCEIROS = 3
/** LocalDeAtendimento: 1 = UBS */
const LOCAL_UBS = 1
/** TipoDeAtendimento (só 1, 2, 4, 5 e 6 na FAI); as chaves são os tipos do app (src/domain/aps.ts) */
export const TIPO_ATENDIMENTO: Record<string, number> = {
  consulta_programada: 1, consulta_agendada: 2, escuta_inicial: 4, consulta_no_dia: 5, atendimento_urgencia: 6,
}
/** CondutaEncaminhamento; as chaves são as condutas do app (CONDUTAS_APS) */
export const CONDUTA: Record<string, number> = {
  retorno_consulta_agendada: 1, retorno_cuidado_continuado: 2, agendamento_grupos: 12, agendamento_nasf: 14,
  alta_episodio: 9, encaminhamento_interno: 11, encaminhamento_especializado: 4, encaminhamento_caps: 5,
  encaminhamento_internacao: 6, encaminhamento_urgencia: 7, encaminhamento_atencao_domiciliar: 8, encaminhamento_intersetorial: 10,
}
/** ListaCiapCondicaoAvaliada: os únicos códigos AB do LEDI 8.7.0; o resto do problema vai pela CID ou pela CIAP2 */
export const CODIGO_AB: Record<string, string> = {
  saude_sexual_reprodutiva: 'ABP003', saude_mental: 'ABP014', reabilitacao: 'ABP015',
  rastreamento_cancer_colo_utero: 'ABP022', rastreamento_cancer_mama: 'ABP023',
}
/** Sexo: 0 masculino, 1 feminino, 4 ignorado */
export function sexoLedi(s: string | null): number {
  const x = (s ?? '').trim().toUpperCase()
  return x === 'M' ? 0 : x === 'F' ? 1 : 4
}
/** Turno pela hora de Brasília: 1 manhã (antes das 12), 2 tarde (12 às 18), 3 noite */
export function turnoLedi(instante: string): number {
  const h = Number(
    // padrao-ok: hora de Brasília para o código do turno da ficha, não é texto de tela
    new Intl.DateTimeFormat('en-GB', { timeZone: 'America/Sao_Paulo', hour: '2-digit', hourCycle: 'h23' }).format(new Date(instante)))
  return h < 12 ? 1 : h < 18 ? 2 : 3
}
/** Data pura (AAAA-MM-DD) em Epoch milissegundos, à meia-noite de Brasília (UTC-3, sem horário de verão desde 2019). */
export function epochData(iso: string): number {
  const t = Date.parse(`${iso.slice(0, 10)}T00:00:00-03:00`)
  if (Number.isNaN(t)) throw new Error(`retido: data inválida "${iso}"`)
  return t
}
export const epoch = (instante: string) => {
  const t = Date.parse(instante)
  if (Number.isNaN(t)) throw new Error(`retido: data e hora inválidas "${instante}"`)
  return t
}
/** CID-10 no LEDI: maiúscula, sem ponto (I10, E119). */
export const cidLedi = (c: string) => c.replace(/[^0-9A-Za-z]/g, '').toUpperCase()

// ── partes comuns ────────────────────────────────────────────────────────────
/** Identificação do cidadão: CPF; sem CPF, o CNS e o motivo da lista do LEDI (U15, VC7). Nunca os dois. */
function identificacao(c: CidadaoLedi): { cpf?: string; cns?: string; justificativa?: number } {
  if (c.cpf) return { cpf: c.cpf }
  if (!c.justificativa_sem_cpf) throw new Error('retido: paciente sem CPF e sem justificativa')
  if (!c.cns) throw new Error('retido: paciente sem CPF e sem CNS')
  return { cns: c.cns, justificativa: c.justificativa_sem_cpf }
}

/** MedicoesThrift (1 a 13), pelos conceitos do app. */
export function medicoes(lista_: MedicaoLedi[]): Struct | undefined {
  const v = (nome: string) => lista_.find((m) => m.conceito === nome)?.valor
  const umaCasa = (n: number) => Math.round(n * 10) / 10
  const s: Struct = {}
  // RF3 (23/11/2026): circunferenciaAbdominal, em cm, uma casa, de 0.0 a 99999 (dicionário da FAI)
  const ca = v('circunferencia-abdominal'); if (ca !== undefined && ca >= 0 && ca <= 99999) s[1] = double(umaCasa(ca))
  const pas = v('pressao-arterial-sistolica'), pad = v('pressao-arterial-diastolica')
  if (pas !== undefined && pad !== undefined) { s[3] = i32(Math.round(pas)); s[4] = i32(Math.round(pad)) }
  const fr = v('frequencia-respiratoria'); if (fr !== undefined) s[5] = i32(Math.round(fr))
  const fc = v('frequencia-cardiaca'); if (fc !== undefined) s[6] = i32(Math.round(fc))
  const temp = v('temperatura'); if (temp !== undefined && temp >= 20 && temp <= 45) s[7] = double(umaCasa(temp))
  const sat = v('saturacao-o2'); if (sat !== undefined && sat >= 0 && sat <= 100) s[8] = i32(Math.round(sat))
  // o app não guarda o momento da glicemia: tipoGlicemiaCapilar 3 = não especificado
  const gli = v('glicemia-capilar'); if (gli !== undefined && gli >= 0 && gli <= 800) { s[9] = i32(Math.round(gli)); s[10] = i64(3) }
  const peso = v('peso'); if (peso !== undefined && peso >= 0.5 && peso <= 500) s[11] = double(Math.round(peso * 1000) / 1000)
  const alt = v('estatura'); if (alt !== undefined && alt >= 20 && alt <= 250) s[12] = double(umaCasa(alt))
  const pc = v('perimetro-cefalico'); if (pc !== undefined && pc >= 10 && pc <= 200) s[13] = double(umaCasa(pc))
  return Object.keys(s).length ? s : undefined
}

function instalacao(i: Instalacao): Valor {
  return struct({ 1: str(i.contraChave), 2: str(i.uuidInstalacao), 3: str(i.cpfOuCnpj), 4: str(i.nomeOuRazaoSocial),
    5: i.fone ? str(i.fone) : undefined, 6: i.email ? str(i.email) : undefined })
}

/** DadoTransporte: a ficha serializada dentro, com o CNES, o IBGE, quem envia e a versão. */
function transporte(tipo: keyof typeof TIPO_DADO, uuid: string, u: UnidadeLedi, ficha: Uint8Array, inst: Instalacao): Uint8Array {
  return serializar({
    1: str(uuid), 2: i64(TIPO_DADO[tipo]), 3: str(u.cnes), 4: str(u.codigo_ibge), 5: u.ine ? str(u.ine) : undefined,
    7: str(ficha), 8: instalacao(inst), 9: instalacao(inst),
    10: struct({ 1: i32(VERSAO_LEDI.major), 2: i32(VERSAO_LEDI.minor), 3: i32(VERSAO_LEDI.revision) }),
  })
}

function conferirUnidade(u: UnidadeLedi) {
  if (!/^\d{7}$/.test(u.cnes)) throw new Error('retido: unidade sem CNES')
  if (!/^\d{7}$/.test(u.codigo_ibge)) throw new Error('retido: unidade sem código IBGE do município')
}

export type Arquivo = { nome: string; bytes: Uint8Array; avisos: string[] }

// ── Ficha de Atendimento Individual ─────────────────────────────────────────
export function fichaFai(uuidFicha: string, c: CargaFai, inst: Instalacao): Arquivo {
  conferirUnidade(c.unidade)
  const a = c.atendimento
  const avisos: string[] = []
  const tipo = a.tipo_atendimento ? TIPO_ATENDIMENTO[a.tipo_atendimento] : undefined
  if (tipo === undefined) throw new Error(`retido: tipo de atendimento "${a.tipo_atendimento ?? 'vazio'}" sem correspondência no LEDI`)

  const condutas = [...new Set(a.condutas.map((x) => CONDUTA[x]).filter((x): x is number => x !== undefined))]
  if (condutas.length === 0) throw new Error('retido: atendimento sem conduta')

  // problemas: CID e CIAP registrados, e os códigos AB que o LEDI ainda tem
  const problemas: Struct[] = []
  const vistos = new Set<string>()
  for (const cid of a.cid.map(cidLedi)) if (cid && !vistos.has(cid)) { vistos.add(cid); problemas.push({ 5: str(cid), 9: bool(true) }) }
  for (const ciap of a.ciap.map((x) => x.trim().toUpperCase())) if (ciap && !vistos.has(ciap)) { vistos.add(ciap); problemas.push({ 4: str(ciap), 9: bool(true) }) }
  for (const p of a.problemas) {
    const ab = CODIGO_AB[p]
    if (ab && !vistos.has(ab)) { vistos.add(ab); problemas.push({ 4: str(ab), 9: bool(true) }) }
    else if (!ab) avisos.push(`problema "${p}" sem código AB no LEDI 8.7.0: vai só pela CID ou CIAP do atendimento`)
  }
  if (problemas.length === 0) throw new Error('retido: atendimento sem CID nem CIAP')

  const id = identificacao(c.cidadao)
  const fim = epoch(a.fim)
  const inicio = Math.min(a.inicio ? epoch(a.inicio) : fim, fim)
  const med = medicoes(c.medicoes)
  const exames = [...new Set(a.exames_solicitados)].slice(0, 100)
    .map((cod) => struct({ 1: str(cod), 2: lista(TIPO.STRING, [str('S')]) }))

  // FichaAtendimentoIndividualChildThrift
  const filho: Struct = {
    2: id.cns ? str(id.cns) : undefined,
    3: i64(epochData(c.cidadao.data_nascimento)),
    4: i64(LOCAL_UBS),
    5: i64(sexoLedi(c.cidadao.sexo)),
    6: i64(turnoLedi(a.fim)),
    7: i64(tipo),
    17: exames.length ? lista(TIPO.STRUCT, exames) : undefined,
    22: lista(TIPO.I64, condutas.map((x) => i64(x))),
    28: i64(inicio),
    29: i64(fim),
    30: id.cpf ? str(id.cpf) : undefined,
    39: med ? struct(med) : undefined,
    40: lista(TIPO.STRUCT, problemas.map((p) => struct(p))),
    47: bool(!id.cpf),
    48: id.justificativa ? i64(id.justificativa) : undefined,
  }
  const lotacao: Struct = { 1: str(c.profissional.cns), 2: str(c.profissional.cbo), 3: str(c.unidade.cnes),
    4: c.unidade.ine ? str(c.unidade.ine) : undefined }
  // FichaAtendimentoIndividualMasterThrift, com o VariasLotacoesHeaderThrift (6 principal, 8 data, 9 IBGE)
  const ficha = serializar({
    1: struct({ 6: struct(lotacao), 8: i64(fim), 9: str(c.unidade.codigo_ibge) }),
    2: lista(TIPO.STRUCT, [struct(filho)]),
    3: str(uuidFicha),
    4: i32(ORIGEM_TERCEIROS),
  })
  return { nome: `${uuidFicha}.esus`, bytes: transporte('fai', uuidFicha, c.unidade, ficha, inst), avisos }
}

// ── Ficha de Procedimentos ──────────────────────────────────────────────────
export function fichaFp(uuidFicha: string, c: CargaFp, inst: Instalacao): Arquivo {
  conferirUnidade(c.unidade)
  const p = c.procedimento
  if (!/^\d{10}$/.test(p.codigo_sigtap)) throw new Error(`retido: procedimento "${p.codigo_sigtap}" fora do SIGTAP`)
  const id = identificacao(c.cidadao)
  const em = epoch(p.realizado_em)
  const avisos = p.quantidade > 1 ? [`quantidade ${p.quantidade}: a ficha leva o procedimento uma vez (o LEDI não repete código)`] : []
  // FichaProcedimentoChildThrift
  const filho: Struct = {
    2: id.cns ? str(id.cns) : undefined,
    3: i64(epochData(c.cidadao.data_nascimento)),
    4: i64(sexoLedi(c.cidadao.sexo)),
    5: i64(LOCAL_UBS),
    6: i64(turnoLedi(p.realizado_em)),
    8: lista(TIPO.STRING, [str(p.codigo_sigtap)]),
    10: i64(em),
    11: i64(em),
    12: id.cpf ? str(id.cpf) : undefined,
    20: bool(!id.cpf),
    21: id.justificativa ? i64(id.justificativa) : undefined,
  }
  const ficha = serializar({
    1: str(uuidFicha),
    2: i32(ORIGEM_TERCEIROS),
    3: struct({ 1: str(c.profissional.cns), 2: str(c.profissional.cbo), 3: str(c.unidade.cnes),
      4: c.unidade.ine ? str(c.unidade.ine) : undefined, 5: i64(em), 6: str(c.unidade.codigo_ibge) }),
    4: lista(TIPO.STRUCT, [struct(filho)]),
  })
  return { nome: `${uuidFicha}.esus`, bytes: transporte('fp', uuidFicha, c.unidade, ficha, inst), avisos }
}

// ── Ficha de Vacinação (U15, vacina, PR 6) ──────────────────────────────────
/** BCG: o único imunobiológico com "comunicante de hanseníase". */
const BCG = 15

export function fichaFv(uuidFicha: string, c: CargaFv, inst: Instalacao): Arquivo {
  conferirUnidade(c.unidade)
  const v = c.vacina
  const id = identificacao(c.cidadao)
  const em = epoch(v.registrado_em)
  const sexo = sexoLedi(c.cidadao.sexo)
  // condição maternal: obrigatória fora do sexo masculino, proibida nele
  if (sexo !== 0 && !v.condicao_maternal) throw new Error('retido: vacina sem a condição maternal')
  if (v.imunobiologico === BCG && v.comunicante_hanseniase == null) throw new Error('retido: BCG sem comunicante de hanseníase')
  if (!v.registro_anterior && (!v.lote || !v.fabricante || !v.estrategia || !v.grupo_atendimento)) {
    throw new Error('retido: vacina aplicada sem lote, fabricante, estratégia ou grupo')
  }
  // VacinaRowThrift (IDL: 1 imunobiológico, 2 estratégia, 3 dose, 4 lote, 6 grupo, 7 registro anterior,
  // 8 data do registro anterior, 9 aplicada no exterior, 11 CBO do prescritor, 12 CID-10, 13 pesquisa clínica,
  // 17 via, 18 local, 19 fabricante RNDS)
  const linha: Struct = {
    1: i64(v.imunobiologico),
    2: v.estrategia ? i64(v.estrategia) : undefined,
    3: i64(v.dose),
    4: v.lote ? str(v.lote) : undefined,
    6: !v.registro_anterior && v.grupo_atendimento ? i64(v.grupo_atendimento) : undefined,
    7: bool(v.registro_anterior),
    8: v.registro_anterior ? i64(epochData(v.data_aplicacao)) : undefined,
    9: v.registro_anterior && v.aplicado_exterior != null ? bool(v.aplicado_exterior) : undefined,
    11: v.prescritor_cbo ? str(v.prescritor_cbo) : undefined,
    12: v.cid10_motivo ? str(cidLedi(v.cid10_motivo)) : undefined,
    13: bool(v.pesquisa_clinica),
    17: i64(v.via),
    18: i64(v.local),
    19: v.fabricante ? str(v.fabricante) : undefined,
  }
  // FichaVacinacaoChildThrift (IDL: 1 turno, 3 CNS, 4 nascimento, 5 sexo, 6 local, 7 viajante,
  // 8 comunicante de hanseníase, 11 vacinas, 12 e 13 início e fim, 14 CPF, 15 condição maternal,
  // 16 não possui CPF, 17 justificativa)
  const filho: Struct = {
    1: i64(turnoLedi(v.registrado_em)),
    3: id.cns ? str(id.cns) : undefined,
    4: i64(epochData(c.cidadao.data_nascimento)),
    5: i64(sexo),
    6: i64(LOCAL_UBS),
    7: bool(v.viajante),
    8: v.imunobiologico === BCG ? bool(!!v.comunicante_hanseniase) : undefined,
    11: lista(TIPO.STRUCT, [struct(linha)]),
    12: i64(em),
    13: i64(em),
    14: id.cpf ? str(id.cpf) : undefined,
    15: sexo !== 0 ? i64(v.condicao_maternal!) : undefined,
    16: bool(!id.cpf),
    17: id.justificativa ? i64(id.justificativa) : undefined,
  }
  // FichaVacinacaoMasterThrift (1 uuid, 2 origem, 3 UnicaLotacaoHeader, 4 vacinações)
  const ficha = serializar({
    1: str(uuidFicha),
    2: i32(ORIGEM_TERCEIROS),
    3: struct({ 1: str(c.profissional.cns), 2: str(c.profissional.cbo), 3: str(c.unidade.cnes),
      4: c.unidade.ine ? str(c.unidade.ine) : undefined, 5: i64(em), 6: str(c.unidade.codigo_ibge) }),
    4: lista(TIPO.STRUCT, [struct(filho)]),
  })
  return { nome: `${uuidFicha}.esus`, bytes: transporte('fv', uuidFicha, c.unidade, ficha, inst), avisos: [] }
}

/** Ponto de entrada do serviço de envio: o tipo da fila e a carga do banco. */
export function montarFicha(tipo: 'fai' | 'fp' | 'fv', uuidFicha: string, carga: CargaFai | CargaFp | CargaFv, inst: Instalacao): Arquivo {
  if (uuidFicha.length < 36 || uuidFicha.length > 44) throw new Error('uuid da ficha fora de 36 a 44 caracteres')
  if (tipo === 'fv') return fichaFv(uuidFicha, carga as CargaFv, inst)
  return tipo === 'fai' ? fichaFai(uuidFicha, carga as CargaFai, inst) : fichaFp(uuidFicha, carga as CargaFp, inst)
}
