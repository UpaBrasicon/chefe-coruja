// ─────────────────────────────────────────────────────────────────────────────
// FASE 4A — Processador da outbox (SEM ENVIO)
//
// Lê itens 'pendente' da interop_outbox, carrega as entidades do banco
// (camada de carga — separada dos mappers puros), monta o Bundle FHIR via
// src/interop/fhir e atualiza o payload. Se o mapper falhar, marca 'erro'.
// NADA sai do status 'pendente'→'enviado': envio é a Fase 4B.
//
// Uso (local/CI, service_role):
//   node scripts/interop/processar-outbox.ts            # processa pendentes
//   node scripts/interop/processar-outbox.ts --id <id>  # um item específico
// ─────────────────────────────────────────────────────────────────────────────
import { createClient } from '@supabase/supabase-js'
import {
  montarBundleSumarioAlta,
  type EntidadeCondicao,
  type EntidadeEncontro,
  type EntidadeEstabelecimento,
  type EntidadeMedicacao,
  type EntidadeObservacao,
  type EntidadePaciente,
  type EntidadeProfissional,
} from '../../src/interop/fhir/index.ts'

const url = process.env.SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) throw new Error('SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY obrigatórias')

const client = createClient(url, key)
const APLICAR = process.argv.includes('--aplicar')

type ItemOutbox = {
  id: string
  unidade_id: string
  tipo_documento: string
  referencia_id: string
  payload: Record<string, unknown> | null
}

async function buscarPendentes(): Promise<ItemOutbox[]> {
  const idArg = process.argv.find((a, i) => a === '--id' && process.argv[i + 1])
  const q = client.from('interop_outbox').select('id, unidade_id, tipo_documento, referencia_id, payload')
  if (idArg) q.eq('id', process.argv[process.argv.indexOf('--id') + 1])
  else q.eq('status', 'pendente')
  const { data, error } = await q.order('created_at', { ascending: true }).limit(50)
  if (error) throw new Error(`SELECT outbox: ${error.message}`)
  return (data ?? []) as ItemOutbox[]
}

async function carregarEntidades(item: ItemOutbox) {
  const internacaoId = item.referencia_id

  const { data: encontro } = await client
    .from('internacoes')
    .select('*')
    .eq('id', internacaoId)
    .single()
  if (!encontro) throw new Error(`internacao ${internacaoId} não encontrada`)
  const e = encontro as EntidadeEncontro

  const { data: pacienteRaw } = await client.from('pacientes').select('*').eq('id', e.paciente_id).single()
  const paciente = pacienteRaw as EntidadePaciente

  const { data: unidade } = await client.from('unidades').select('*').eq('id', e.unidade_id).single()
  const estabelecimento: EntidadeEstabelecimento = unidade as EntidadeEstabelecimento

  // profissional: autor do último documento clínico, ou primeiro vínculo gestor/plantonista
  const { data: profRaw } = await client
    .from('vinculos')
    .select('perfil_id, perfis(id, nome_completo, cpf, crm, uf_crm)')
    .eq('unidade_id', e.unidade_id)
    .eq('ativo', true)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()
  const perfil = (profRaw?.perfis ?? null) as { id: string; nome_completo: string; cpf: string | null; crm: string | null; uf_crm: string | null } | null
  const profissional: EntidadeProfissional = {
    id: String(profRaw?.perfil_id ?? ''),
    nome_completo: String(perfil?.nome_completo ?? ''),
    cpf: (perfil?.cpf as string) ?? null,
    crm: (perfil?.crm as string) ?? null,
    uf_crm: (perfil?.uf_crm as string) ?? null,
    cbo_codigo: null, // TODO: mapear CBO do profissional quando existir
  }

  // condição principal (CID-10 da internação)
  const condicoes: EntidadeCondicao[] = []
  if (e.cid_principal) {
    condicoes.push({
      id: `cond-${internacaoId}-principal`,
      paciente_id: e.paciente_id,
      encontro_id: internacaoId,
      codigo_cid: e.cid_principal,
      descricao: null, // TODO: buscar descrição em terminologia.cid10
      categoria: 'principal',
      verificado: true,
      data: e.data_admissao,
    })
  }

  // observações da internação (Fase 2 — modelo conceito+observacao)
  const { data: obsRaw } = await client
    .from('observacao')
    .select('*, conceito(id, nome, tipo, loinc_codigo, unidade_padrao)')
    .eq('internacao_id', internacaoId)
    .order('aferido_em', { ascending: true })
  const observacoes: EntidadeObservacao[] = (obsRaw ?? []).map((o) => ({
    id: o.id,
    conceito_id: o.conceito_id,
    conceito_nome: String(o.conceito?.nome ?? o.conceito_id),
    conceito_tipo: String(o.conceito?.tipo ?? 'numerico'),
    loinc_codigo: (o.conceito?.loinc_codigo as string | null) ?? null,
    unidade_padrao: (o.conceito?.unidade_padrao as string | null) ?? null,
    valor_num: o.valor_num,
    valor_texto: o.valor_texto,
    unidade: o.unidade,
    ref_min: o.ref_min,
    ref_max: o.ref_max,
    flag: o.flag,
    aferido_em: o.aferido_em,
    origem: o.origem,
    registrado_por: o.registrado_por,
  }))

  // medicações (prescrições + itens)
  const { data: presc } = await client
    .from('prescricoes')
    .select('id, paciente_id, medico_id, status, created_at')
    .eq('unidade_id', e.unidade_id)
    .eq('paciente_id', e.paciente_id)
  const { data: itens } = await client
    .from('prescricao_itens')
    .select('id, prescricao_id, descricao, dose, posologia')
    .in('prescricao_id', (presc ?? []).map((p) => p.id).filter(Boolean))
  const medicacoes: EntidadeMedicacao[] = (itens ?? []).map((i) => {
    const p = (presc ?? []).find((x) => x.id === i.prescricao_id)
    return {
      id: i.id,
      prescricao_id: i.prescricao_id,
      paciente_id: e.paciente_id,
      medico_id: p?.medico_id ?? '',
      descricao: i.descricao,
      dose: i.dose,
      posologia: i.posologia,
      status_prescricao: p?.status ?? 'rascunho',
      prescrito_em: p?.created_at ?? '',
    }
  })

  return { paciente, estabelecimento, encontro: e, profissional, condicoes, observacoes, medicacoes }
}

async function main() {
  const itens = await buscarPendentes()
  console.log(`outbox: ${itens.length} item(ns) pendente(s)${APLICAR ? ' — APLICANDO' : ' — dry-run (use --aplicar)'}`)

  for (const item of itens) {
    const rotulo = `${item.tipo_documento} ${item.referencia_id.slice(0, 8)}`
    try {
      const entidades = await carregarEntidades(item)
      const bundle = montarBundleSumarioAlta({
        ...entidades,
        motivo_alta: entidades.encontro.motivo_alta,
        orientacoes: null, // TODO: ler sumario_alta de documentos_clinicos
      })
      const nRecursos = (bundle.entry ?? []).length
      console.log(`  ${rotulo}: Bundle montado (${nRecursos} recursos)`)
      if (APLICAR) {
        const { error } = await client
          .from('interop_outbox')
          .update({ payload: bundle as unknown as Record<string, unknown> })
          .eq('id', item.id)
        if (error) throw new Error(`update outbox: ${error.message}`)
        console.log(`    → payload atualizado (permanece 'pendente'; envio é a Fase 4B)`)
      } else {
        console.log(`    → (dry-run — payload não alterado)`)
      }
    } catch (err) {
      console.error(`  ${rotulo}: ERRO ao montar → marcaria status='erro'`)
      console.error(`    ${(err as Error).message}`)
      if (APLICAR) {
        const { error } = await client
          .from('interop_outbox')
          .update({ status: 'erro', ultimo_erro: (err as Error).message })
          .eq('id', item.id)
        if (error) console.error(`    falha ao marcar erro: ${error.message}`)
      }
    }
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
