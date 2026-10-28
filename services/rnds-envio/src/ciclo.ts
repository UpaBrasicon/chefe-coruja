// ─────────────────────────────────────────────────────────────────────────────
// Um ciclo do serviço de envio (5C-5.3b): pega o lote, carrega, monta, envia e
// registra. Tudo o que vem de fora (a fila no banco, os certificados, a RNDS)
// entra por parâmetro, para o teste rodar contra o simulador.
//
// Ordem por item:
//   1. carga (public.rnds_dados_documento); "retido: …" da carga fica retido;
//   2. o que o envio exige: produção liberada, identificador do solicitante,
//      CNS de quem assina, certificado da unidade; faltando, fica retido;
//   3. o documento (src/interop/fhir); "retido: …" do mapper fica retido;
//   4. o envio e o resultado (cliente-rnds.ts).
// Nenhum log leva dado do paciente: só o id do item, o tipo e o resultado.
// ─────────────────────────────────────────────────────────────────────────────
import type { Bundle } from '@medplum/fhirtypes'
import {
  montarBundleRAC,
  montarBundleRegulacao,
  montarBundleSumarioAlta,
  type DadosMira,
  type EntidadeAtendimentoRAC,
  type EntidadeSumarioAlta,
  type EnvioRnds,
} from '../../../src/interop/fhir/index.ts'
import { enderecos, type Ambiente, type Certificado, type ClienteRnds, type Enderecos, type Resultado } from './cliente-rnds.ts'

export type ItemLote = { id: string; tipo_documento: 'rac' | 'sumario_alta' | 'regulacao'; unidade_id: string; tentativas: number }

/** O que public.rnds_dados_documento devolve. */
export type DocumentoCarregado = {
  item_id: string
  tipo: ItemLote['tipo_documento']
  dados: unknown
  envio: {
    ambiente: Ambiente | null
    uf: string | null
    identificador_solicitante: string | null
    id_rnds_anterior: string | null
    profissional_id: string | null
    profissional_cns: string | null
  }
}

export type Registro = {
  resultado: 'enviado' | 'retido' | 'reenviar' | 'erro' | 'credencial'
  idRnds?: string
  bundle?: unknown
  resposta?: unknown
  erro?: string
}

/** A fila no banco (as três funções da 5.3a). */
export interface Fila {
  pegarLote(limite: number): Promise<ItemLote[]>
  dados(item: string): Promise<DocumentoCarregado>
  registrar(item: string, r: Registro): Promise<void>
}

/** De onde vem o certificado A1 da unidade (o cofre é a 5.4). */
export interface Certificados {
  obter(unidade: string): Promise<Certificado | null>
}

export type Dependencias = {
  fila: Fila
  certificados: Certificados
  rnds: Pick<ClienteRnds, 'enviar'>
  /** aponta para o simulador; sem ele, os endereços oficiais */
  sobrepor?: Partial<Enderecos>
  /** nesta etapa o envio à produção fica desligado (decisão do RT, 5.3) */
  permitirProducao?: boolean
  agora?: () => Date
  log?: (linha: Record<string, unknown>) => void
}

export type Resumo = Record<Registro['resultado'], number>

const RETIDO = /^retido: /

export async function processarLote(d: Dependencias, limite = 20): Promise<Resumo> {
  const resumo: Resumo = { enviado: 0, retido: 0, reenviar: 0, erro: 0, credencial: 0 }
  const log = d.log ?? (() => {})
  for (const item of await d.fila.pegarLote(limite)) {
    const r = await processarItem(d, item)
    await d.fila.registrar(item.id, r)
    resumo[r.resultado]++
    // a mensagem da RNDS pode citar CPF ou CNS: no log, só sem os números
    log({ item: item.id, tipo: item.tipo_documento, resultado: r.resultado, ...(r.erro ? { motivo: r.erro.replace(/\d{11,15}/g, '***') } : {}) })
  }
  return resumo
}

async function processarItem(d: Dependencias, item: ItemLote): Promise<Registro> {
  let doc: DocumentoCarregado
  try {
    doc = await d.fila.dados(item.id)
  } catch (e) {
    const msg = (e as Error).message
    return RETIDO.test(msg) ? { resultado: 'retido', erro: msg } : { resultado: 'erro', erro: `carga: ${msg}` }
  }

  const { envio } = doc
  const ambiente: Ambiente = envio.ambiente ?? 'homologacao'
  if (ambiente === 'producao' && !d.permitirProducao) {
    return { resultado: 'retido', erro: 'retido: envio à produção desligado neste serviço' }
  }
  if (!envio.identificador_solicitante) return { resultado: 'retido', erro: 'retido: unidade sem o identificador do solicitante da RNDS' }
  if (!envio.profissional_cns) return { resultado: 'retido', erro: 'retido: profissional sem CNS (é quem assina o envio)' }
  const end = enderecos(ambiente, envio.uf, d.sobrepor)
  if (!end.ehr) return { resultado: 'retido', erro: 'retido: unidade sem UF (endereço da RNDS na produção)' }

  let bundle: Bundle
  try {
    bundle = montar(doc, {
      agora: (d.agora?.() ?? new Date()).toISOString(),
      identificadorSolicitante: envio.identificador_solicitante,
      idRndsAnterior: envio.id_rnds_anterior,
    })
  } catch (e) {
    const msg = (e as Error).message
    return RETIDO.test(msg) ? { resultado: 'retido', erro: msg } : { resultado: 'erro', erro: `documento: ${msg}` }
  }

  const certificado = await d.certificados.obter(item.unidade_id)
  if (!certificado) return { resultado: 'retido', erro: 'retido: unidade sem certificado da RNDS' }

  const r: Resultado = await d.rnds.enviar({
    chaveToken: `${item.unidade_id}:${ambiente}`,
    enderecos: end,
    certificado,
    cns: envio.profissional_cns,
    bundle,
  })
  return r.resultado === 'enviado'
    ? { resultado: 'enviado', idRnds: r.idRnds, bundle, resposta: r.resposta }
    : { resultado: r.resultado, erro: r.erro, bundle, resposta: r.resposta }
}

function montar(doc: DocumentoCarregado, envio: EnvioRnds): Bundle {
  if (doc.tipo === 'rac') return montarBundleRAC(doc.dados as EntidadeAtendimentoRAC, envio)
  if (doc.tipo === 'sumario_alta') return montarBundleSumarioAlta(doc.dados as EntidadeSumarioAlta, envio)
  return montarBundleRegulacao(doc.dados as DadosMira, envio)
}
