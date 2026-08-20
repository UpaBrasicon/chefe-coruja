// Popula dados de demonstração de evolução clínica (FASE 2)
// para validar o critério de aceite (gráfico de creatinina+ureia, 5 dias).
// Uso: node scripts/observacao/demo-evolucao.ts <pacienteId> [unidadeId]
import { createClient } from '@supabase/supabase-js'

const url = process.env.SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) throw new Error('SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY obrigatórias')

const client = createClient(url, key)

const pacienteId = process.argv[2]
if (!pacienteId) {
  console.error('uso: node scripts/observacao/demo-evolucao.ts <pacienteId> [unidadeId]')
  process.exit(1)
}
const unidadeId = process.argv[3]

// internação ativa do paciente
const { data: internacao, error: e0 } = await client
  .from('internacoes')
  .select('*')
  .eq('paciente_id', pacienteId)
  .in('status', ['admitido', 'em_observacao', 'internado'])
  .order('data_admissao', { ascending: false })
  .limit(1)
  .maybeSingle()
if (e0) throw e0
if (!internacao) {
  console.error('paciente sem internação ativa — abra uma internação antes')
  process.exit(1)
}
console.log(`internação: ${internacao.id} | admissão ${internacao.data_admissao}`)

const uniId = unidadeId ?? internacao.unidade_id

// conceitos por nome
const { data: conceitosRaw } = await client.from('conceito').select('id, nome, ref_min, ref_max').is('unidade_id', null)
if (!conceitosRaw) throw new Error('sem conceitos')
const conceitos = conceitosRaw

function conceito(nome: string) {
  const c = conceitos.find((x) => x.nome === nome)
  if (!c) throw new Error(`conceito ${nome} não encontrado`)
  return c
}

// séries de 5 dias (aferições 2x/dia) para creatinina/ureia + FC/PAS/Temp
const serie = (dias: number, fn: (dia: number, turno: number) => number) => {
  const linhas: { aferido_em: string; valor_num: number }[] = []
  const inicio = new Date(internacao.data_admissao)
  for (let d = 0; d < dias; d++) {
    for (let t = 0; t < 2; t++) {
      const aferido = new Date(inicio.getTime() + d * 86_400_000 + (t === 0 ? 9 : 21) * 3_600_000)
      linhas.push({ aferido_em: aferido.toISOString(), valor_num: fn(d, t) })
    }
  }
  return linhas
}

const creat = conceito('creatinina')
const ureia = conceito('ureia')
const fc = conceito('frequencia-cardiaca')
const pas = conceito('pressao-arterial-sistolica')
const temp = conceito('temperatura')

// monta o array de inserção
const insercoes = [
  ...serie(5, (d, t) => +(1.1 + d * 0.18 + (t === 1 ? 0.1 : 0)).toFixed(2)).map((l) => ({ conceito_id: creat.id, ...l })),
  ...serie(5, (d, t) => +(35 + d * 7 + (t === 1 ? 8 : 0)).toFixed(1)).map((l) => ({ conceito_id: ureia.id, ...l })),
  ...serie(5, (d, t) => +(92 + Math.sin(d) * 8 + (t === 1 ? 6 : 0)).toFixed(0)).map((l) => ({ conceito_id: fc.id, ...l })),
  ...serie(5, (d, t) => +(125 + d * 3 + (t === 1 ? 8 : 0)).toFixed(0)).map((l) => ({ conceito_id: pas.id, ...l })),
  ...serie(5, (d, t) => +(36.6 + (t === 1 ? 0.3 : 0) + (d === 3 ? 0.6 : 0)).toFixed(1)).map((l) => ({ conceito_id: temp.id, ...l })),
].map((l) => ({
  unidade_id: uniId,
  internacao_id: internacao.id,
  paciente_id: pacienteId,
  conceito_id: l.conceito_id,
  valor_num: l.valor_num,
  aferido_em: l.aferido_em,
  origem: 'calculado',
}))

// insere em lotes
for (let i = 0; i < insercoes.length; i += 100) {
  const lote = insercoes.slice(i, i + 100)
  const { error } = await client.from('observacao').insert(lote)
  if (error) {
    console.error(`erro no lote ${i}:`, error.message)
    process.exit(1)
  }
}
console.log(`demo: ${insercoes.length} observações inseridas (5 conceitos × 5 dias × 2 turnos)`)
console.log('creatinina final ~', serie(5, (d, t) => +(1.1 + d * 0.18 + (t === 1 ? 0.1 : 0)).toFixed(2)).at(-1)?.valor_num, '(ref 0.6–1.3 → deve cruzar para H/CRIT)')
