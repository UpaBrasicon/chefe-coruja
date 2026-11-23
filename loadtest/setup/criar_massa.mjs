// Cria a massa LOADTEST na HOMOLOGAÇÃO, com a service_role do .env.
// Idempotente: rodar de novo não duplica (ids fixos e upsert). Grava dados.json.
// Rode de novo antes de cada teste: ele semeia o check-in dos plantões que já
// começaram, e sem check-in o plantão some 30 min depois do início.
// Uso: node setup/criar_massa.mjs
//
// Esquema conferido em 23/11/2026 nas migrations (DESCOBERTA.md). Regras que
// mandam no desenho:
// - auth.users só aceita conta criada pelo admin com app_metadata.origem='admin'
//   (20261003000009); o perfil nasce por gatilho (handle_new_user);
// - a escala exige o vínculo antes (categoria) e recusa sobreposição da mesma
//   pessoa: cada pessoa fica num setor fixo entre as rodadas;
// - leituras do plantonista e da enfermagem só valem para pacientes e setores
//   da própria escala: o dados.json leva o setor de cada usuário e os
//   pacientes por setor;
// - internação em 'em_observacao' para não abrir conta de faturamento.
import { createHash, randomBytes } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import { carregarEnv, ORG_LOADTEST, gravarDados } from './_lib.mjs'

const env = carregarEnv()
const admin = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const PLANO = { plantonista: 40, enfermeiro: 15, gestor: 3, recepcao: 6 }

const UID = (n) => `10ad7e57-0000-4000-8000-${String(n).padStart(12, '0')}`
const UNIDADE = UID(101)
const LAT = -23.5505, LNG = -46.6333, RAIO = 500 // ponto fictício
// plant/enf/rec = quantas pessoas de cada papel ficam escaladas no setor; intern = internações abertas
const SETORES = [
  { chave: 'porta', id: UID(201), nome: 'CARGA Porta / PS', tipo: 'emergencia', publico: 'todos', prefixo: 'PS', tipoLeito: 'clinico', leitos: 10, plant: 12, enf: 4, rec: 6, intern: 5 },
  { chave: 'vermelha', id: UID(202), nome: 'CARGA Sala Vermelha', tipo: 'emergencia', publico: 'todos', prefixo: 'SV', tipoLeito: 'estabilizacao', leitos: 6, plant: 8, enf: 4, rec: 0, intern: 5 },
  { chave: 'obsAdulto', id: UID(203), nome: 'CARGA Observação Adulto', tipo: 'observacao', publico: 'adulto', prefixo: 'OA', tipoLeito: 'observacao', leitos: 14, plant: 12, enf: 4, rec: 0, intern: 12 },
  { chave: 'obsPed', id: UID(204), nome: 'CARGA Observação Pediátrica', tipo: 'observacao', publico: 'pediatrico', prefixo: 'OP', tipoLeito: 'observacao', leitos: 10, plant: 8, enf: 3, rec: 0, intern: 8 },
]
const CONVERSAS = [UID(301), UID(302), UID(303)]
const PAC = (n) => UID(1000 + n)
const INT = (n) => UID(2000 + n)
const TOTAL_PACIENTES = 80

const ok = ({ data, error }, etapa) => {
  if (error) throw new Error(`${etapa}: ${error.message}`)
  return data
}
const diaSP = (d = 0) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date(Date.now() + d * 864e5))

async function conferirBanco() {
  // Mesma trava S10 dos scripts de e2e: só banco com a marca ambiente_teste.
  const linhas = ok(await admin.from('configuracao_plataforma').select('chave,valor').in('chave', ['ambiente_teste', 'exigir_segundo_fator']), 'configuracao_plataforma')
  const conf = Object.fromEntries(linhas.map((c) => [c.chave, c.valor]))
  if (conf.ambiente_teste !== true) throw new Error('A marca ambiente_teste não está ligada: este banco não é a homologação. Abortado.')
  if (conf.exigir_segundo_fator) {
    console.log('exigir_segundo_fator ligado: o pre_login.mjs confirma cada sessão pelo dispositivo confiável da massa.')
  }
}

async function criarUsuarios() {
  const usuarios = []
  for (const [papel, n] of Object.entries(PLANO)) {
    for (let i = 1; i <= n; i++) {
      const num = String(i).padStart(2, '0')
      const email = `carga-${papel}-${num}@loadtest.invalid`
      const { error } = await admin.auth.admin.createUser({
        email,
        password: env.LOADTEST_SENHA,
        email_confirm: true, // nenhum e-mail sai
        user_metadata: { loadtest: true, papel, nome_completo: `CARGA ${papel} ${num}` },
        app_metadata: { origem: 'admin' }, // sem isto o gatilho recusa a conta (cadastro só por convite)
      })
      if (error && !/already been registered|already exists/i.test(error.message)) {
        throw new Error(`createUser ${email}: ${error.message}`)
      }
      usuarios.push({ email, papel })
    }
  }
  return usuarios
}

async function criarDominio(usuarios) {
  // 1. perfis criados pelo gatilho
  const emails = usuarios.map((u) => u.email)
  const idPorEmail = Object.fromEntries(ok(await admin.from('perfis').select('id,email').in('email', emails), 'perfis').map((p) => [p.email, p.id]))
  const faltam = emails.filter((e) => !idPorEmail[e])
  if (faltam.length) throw new Error(`Sem perfil para: ${faltam.join(', ')}`)

  // 1b. dispositivo confiável de cada usuário. Com exigir_segundo_fator ligado,
  //     o pre_login.mjs marca a sessão por verificar_dispositivo_2fa, o mesmo
  //     caminho da tela, sem e-mail. No banco fica só o hash; o token vai para
  //     o dados.json, que não entra no git. Refeito a cada rodada.
  const ROTULO_DISPOSITIVO = 'LOADTEST k6'
  ok(await admin.from('dispositivos_confiaveis').delete().in('user_id', Object.values(idPorEmail)).eq('rotulo', ROTULO_DISPOSITIVO), 'dispositivos (limpar)')
  const tokenPorEmail = Object.fromEntries(emails.map((e) => [e, randomBytes(32).toString('hex')]))
  const expira = new Date(Date.now() + 7 * 864e5).toISOString()
  ok(await admin.from('dispositivos_confiaveis').insert(emails.map((e) => ({
    user_id: idPorEmail[e], token_hash: createHash('sha256').update(tokenPorEmail[e]).digest('hex'),
    rotulo: ROTULO_DISPOSITIVO, expira_em: expira,
  }))), 'dispositivos')

  // 2. organização e unidade
  ok(await admin.from('organizacoes').upsert({ id: ORG_LOADTEST, nome: 'LOADTEST k6 — NÃO USAR', ativo: true }), 'organizacao')
  ok(await admin.from('unidades').upsert({
    id: UNIDADE, organizacao_id: ORG_LOADTEST, nome: 'UPA CARGA k6 (LOADTEST)', tipo: 'upa',
    municipio: 'Cidade Teste', uf: 'SP', latitude: LAT, longitude: LNG, raio_metros: RAIO, ativo: true,
  }), 'unidade')

  // 3. setores e leitos
  ok(await admin.from('setores').upsert(SETORES.map((s, i) => ({
    id: s.id, unidade_id: UNIDADE, nome: s.nome, tipo: s.tipo, ordem: i + 1, publico: s.publico, ativo: true,
  }))), 'setores')
  ok(await admin.from('leitos').upsert(SETORES.flatMap((s) => Array.from({ length: s.leitos }, (_, k) => ({
    setor_id: s.id, identificador: `${s.prefixo}-${String(k + 1).padStart(2, '0')}`, tipo: s.tipoLeito,
  }))), { onConflict: 'setor_id,identificador', ignoreDuplicates: true }), 'leitos')
  const leitos = ok(await admin.from('leitos').select('id,setor_id,identificador,status').in('setor_id', SETORES.map((s) => s.id)).order('identificador'), 'leitos (leitura)')

  // 4. setor fixo de cada pessoa e vínculos (antes da escala)
  const cota = { plantonista: 'plant', enfermeiro: 'enf', recepcao: 'rec' }
  const contador = {}
  const us = usuarios.map((u) => {
    let setor = null
    if (cota[u.papel]) {
      const i = (contador[u.papel] = (contador[u.papel] ?? -1) + 1)
      let acumulado = 0
      setor = (SETORES.find((s) => (acumulado += s[cota[u.papel]]) > i) ?? SETORES[0]).id
    }
    return { ...u, id: idPorEmail[u.email], setor }
  })
  ok(await admin.from('vinculos').upsert(us.map((u) => ({ perfil_id: u.id, unidade_id: UNIDADE, papel: u.papel, ativo: true })),
    { onConflict: 'perfil_id,unidade_id,papel' }), 'vinculos')

  // 5. escala de ontem a amanhã (manhã, tarde e noite; o gatilho preenche início e duração)
  //    e check-in semeado só nos plantões que já começaram
  const dias = [diaSP(-1), diaSP(0), diaSP(1)]
  ok(await admin.from('escala_plantao').upsert(us.filter((u) => u.setor).flatMap((u) => dias.flatMap((data) =>
    ['manha', 'tarde', 'noite'].map((turno) => ({ unidade_id: UNIDADE, setor_id: u.setor, perfil_id: u.id, data, turno, papel: u.papel })))),
  { onConflict: 'setor_id,data,turno,perfil_id', ignoreDuplicates: true }), 'escala')
  const plantoes = ok(await admin.from('escala_plantao').select('id,perfil_id,data,turno,inicio')
    .eq('unidade_id', UNIDADE).eq('ativo', true).in('data', dias), 'escala (leitura)')
  const comecados = plantoes.filter((e) => new Date(e.inicio).getTime() <= Date.now())
  ok(await admin.from('presenca_plantonista').upsert(comecados.map((e) => ({
    unidade_id: UNIDADE, escala_plantao_id: e.id, perfil_id: e.perfil_id, data: e.data, turno: e.turno,
    checkin_em: e.inicio, checkin_lat: LAT, checkin_lng: LNG, checkin_dentro: true, observacao: 'LOADTEST: check-in semeado',
  })), { onConflict: 'perfil_id,unidade_id,data,turno', ignoreDuplicates: true }), 'presencas')

  // 6. pacientes (os primeiros ficam internados; pediatria com menos de 14 anos)
  const internados = []
  let n = 0
  for (const s of SETORES) {
    const doSetor = leitos.filter((l) => l.setor_id === s.id)
    for (let k = 0; k < s.intern; k++) internados.push({ n: ++n, setor: s, leito: doSetor[k] })
  }
  const hoje = new Date()
  ok(await admin.from('pacientes').upsert(Array.from({ length: TOTAL_PACIENTES }, (_, i) => {
    const num = i + 1
    const x = internados.find((y) => y.n === num)
    const ped = x?.setor.chave === 'obsPed'
    const nasc = new Date(hoje)
    nasc.setFullYear(hoje.getFullYear() - (ped ? 2 + (num % 11) : 20 + (num % 60)))
    nasc.setDate(nasc.getDate() - 40)
    return {
      id: PAC(num), unidade_id: UNIDADE, nome: `PACIENTE CARGA ${String(num).padStart(3, '0')}`,
      data_nascimento: nasc.toISOString().slice(0, 10), sexo: num % 2 ? 'M' : 'F', setor_id: x ? x.setor.id : SETORES[0].id,
      prontuario: `CARGA.${String(num).padStart(6, '0')}`, categoria: 'sus', sem_documento: true,
    }
  }), { onConflict: 'id', ignoreDuplicates: true }), 'pacientes')

  // 7. internações abertas e leitos ocupados
  ok(await admin.from('internacoes').upsert(internados.map((x) => {
    const t = new Date(Date.now() - ((x.n % 5) + 1) * 3600e3).toISOString()
    return {
      id: INT(x.n), organizacao_id: ORG_LOADTEST, unidade_id: UNIDADE, paciente_id: PAC(x.n), tipo_internacao: 'observacao',
      origem_admissao: 'emergencia', status: 'em_observacao', setor_atual_id: x.setor.id, leito_atual_id: x.leito.id,
      data_admissao: t, data_entrada_setor: t,
    }
  }), { onConflict: 'id', ignoreDuplicates: true }), 'internacoes')
  ok(await admin.from('leitos').update({ status: 'ocupado' }).in('id', internados.map((x) => x.leito.id)).eq('status', 'livre'), 'ocupar leitos')

  // 8. três conversas com plantonistas e gestores (unidade obrigatória para o aviso da mensagem)
  ok(await admin.from('conversas').upsert(CONVERSAS.map((id) => ({ id, unidade_id: UNIDADE, tipo: 'gestao' }))), 'conversas')
  const membros = us.filter((u) => ['plantonista', 'gestor'].includes(u.papel))
  ok(await admin.from('conversa_participantes').upsert(CONVERSAS.flatMap((c) => membros.map((u) => ({ conversa_id: c, perfil_id: u.id }))),
    { onConflict: 'conversa_id,perfil_id', ignoreDuplicates: true }), 'participantes')

  const pacientesPorSetor = Object.fromEntries(SETORES.map((s) => [s.id, internados.filter((x) => x.setor.id === s.id).map((x) => PAC(x.n))]))
  return {
    unidade: UNIDADE, lat: LAT, lng: LNG,
    setores: SETORES.map((s) => s.id), setorPorta: SETORES[0].id,
    leitos: leitos.map((l) => l.id),
    pacientes: internados.map((x) => PAC(x.n)), pacientesPorSetor,
    conversas: CONVERSAS,
    usuarios: us.map(({ email, papel, setor }) => ({ email, papel, setor, dispositivo: tokenPorEmail[email] })),
    checkins: comecados.length,
  }
}

await conferirBanco()
const usuarios = await criarUsuarios()
console.log(`usuários: ${usuarios.length} garantidos`)
const dominio = await criarDominio(usuarios)
gravarDados({ org: ORG_LOADTEST, ...dominio })
console.log(`dados.json gravado: ${dominio.setores.length} setores, ${dominio.leitos.length} leitos, ${dominio.pacientes.length} internados, ${dominio.checkins} check-ins semeados.`)
