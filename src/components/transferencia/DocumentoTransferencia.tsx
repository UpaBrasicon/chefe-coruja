// ─────────────────────────────────────────────────────────────────────────────
// Documento de transferência (lacuna 7; decisão do RT em 10/11/2026, A em T1 a
// T9; migration 20270329000001). Aparece no desfecho da porta, da observação e
// da internação quando a saída é a transferência externa.
//
// O servidor monta a fotografia do momento (dados_transferencia): só leitura.
// O médico escreve o resumo clínico, as condutas e o motivo e emite; o
// enfermeiro marca os itens de enfermagem do checklist. A transferência só sai
// com o documento emitido (o servidor recusa sem ele); o checklist registra e
// não trava. Portaria GM/MS 2.048/2002, Anexo, Cap. VI, item 3.1 (a, b, d, f,
// g, h, l) e 3.3 (e); Res. CFM 1.672/2003, Art. 1º.
// ─────────────────────────────────────────────────────────────────────────────
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, CircleAlert, FileText, Printer } from 'lucide-react'
import * as React from 'react'

import { Chip } from '@/components/monitor/Pagina'
import { Button } from '@/components/ui/button'
import { CampoSelecao } from '@/components/ui/campo-selecao'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { dataHora } from '@/lib/formato'
import { imprimirDocumento } from '@/lib/prontuario'
import { supabase } from '@/lib/supabase'
import {
  ITENS_TRANSFERENCIA, ROTULO_ATENDIMENTO, ROTULO_TRANSPORTE, documentoEmitido, faltaNoItem, faltasDosTextos, opcoesDoItem,
  pendentesDoChecklist, rotuloDetalhe, rotuloSinal, textoItemTransferencia, textosIniciais,
  type DadosTransferencia, type DocumentoTransferencia, type FotografiaTransferencia, type ItemChecklist, type SituacaoItem,
  type TextosTransferencia,
} from '@/lib/transferencia'
import type { Json } from '@/types/database'

const FONTE = 'Portaria GM/MS nº 2.048/2002, Anexo, Cap. VI, item 3.1 (f): o documento acompanha o paciente e fica no prontuário de quem recebe.'
const erroDe = (e: unknown) => (e instanceof Error ? e.message : (e as { message?: string } | null)?.message ?? 'Erro.')

/** Linha "rótulo: valor" de leitura. */
function Linha({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-rotulo text-tinta-sussurro">{rotulo}</dt>
      <dd className="text-apoio text-tinta [overflow-wrap:anywhere]">{children}</dd>
    </div>
  )
}

/** A fotografia do servidor, só leitura (sinais vitais crus, como gravados). */
export function FotografiaLeitura({ dados }: { dados: FotografiaTransferencia }) {
  const r = dados.regulacao
  const al = dados.alergias
  const alergias = al?.estado === 'tem'
    ? al.itens.map((a) => [a.substancia, a.gravidade ? `(${a.gravidade})` : '', a.reacao ? `: ${a.reacao}` : ''].join(' ').trim()).join('; ')
    : al?.estado === 'nega' ? 'Nega alergias' : al?.estado === 'desconhece' ? 'Não soube informar' : 'Não registrado'
  const lista = (xs: string[], vazio: string) => (xs.length ? xs.join('; ') : vazio)
  return (
    <dl className="grid gap-x-4 gap-y-2.5 sm:grid-cols-2">
      <Linha rotulo="Origem">
        {[ROTULO_ATENDIMENTO[dados.origem?.atendimento ?? ''] ?? dados.origem?.atendimento, dados.origem?.setor, dados.origem?.leito ? `leito ${dados.origem.leito}` : '']
          .filter(Boolean).join(' · ') || '—'}
      </Linha>
      <Linha rotulo="Diagnóstico de entrada">
        {[dados.diagnostico_entrada?.hipotese, dados.diagnostico_entrada?.cid, dados.cid_internacao ? `CID da internação ${dados.cid_internacao}` : '']
          .filter(Boolean).join(' · ') || '—'}
      </Linha>
      <Linha rotulo="Alergias">{alergias}</Linha>
      <Linha rotulo="Regulação">
        {r ? [r.numero != null ? `nº ${r.numero}` : '', r.protocolo_externo ? `${r.sistema_externo ?? ''} ${r.protocolo_externo}`.trim() : '', r.destino,
              r.aceite ? `aceite de ${[r.aceite.por, r.aceite.registro].filter(Boolean).join(', ')}` : 'sem aceite registrado',
              r.transporte ? ROTULO_TRANSPORTE[r.transporte] ?? r.transporte : ''].filter(Boolean).join(' · ')
          : 'Sem regulação neste atendimento'}
      </Linha>
      <div className="sm:col-span-2">
        <Linha rotulo="Últimos sinais vitais (como registrados)">
          {lista((dados.sinais_vitais ?? []).map((s) => `${rotuloSinal(s.conceito)} ${s.valor ?? '—'}${s.unidade ? ` ${s.unidade}` : ''}`), 'Nenhum registrado')}
        </Linha>
      </div>
      <div className="sm:col-span-2">
        <Linha rotulo="Prescrição em uso">
          {(dados.prescricao ?? []).length === 0 ? 'Sem prescrição ativa' : (
            <ul className="flex flex-col gap-0.5">
              {(dados.prescricao ?? []).map((i, k) => (
                <li key={k} className={i.vencido ? 'text-atencao' : undefined}>
                  {[i.descricao, i.dose, i.via, i.posologia].filter(Boolean).join(' · ')}
                  {i.controlado ? ` (controlado, lista ${i.controlado})` : ''}
                  {' · '}{i.valida_ate ? `${i.vencido ? 'vencido em' : 'válido até'} ${dataHora(i.valida_ate)}` : 'dose única'}
                </li>
              ))}
            </ul>
          )}
        </Linha>
      </div>
      <div className="sm:col-span-2">
        <Linha rotulo="Exames">
          {lista((dados.exames ?? []).map((e) => [e.exame, e.resultado ?? e.situacao,
            ...(e.itens ?? []).map((it) => [it.analito, it.valor, it.unidade].filter(Boolean).join(' '))].filter(Boolean).join(': ')), 'Nenhum pedido')}
        </Linha>
      </div>
      <Linha rotulo="Dispositivos">{lista((dados.dispositivos ?? []).map((d) => [d.tipo, d.local, d.calibre].filter(Boolean).join(' · ')), 'Nenhum')}</Linha>
      <Linha rotulo="Isolamento">{lista((dados.isolamento ?? []).map((s) => s.tipo), 'Nenhum')}</Linha>
      <Linha rotulo="Contenção mecânica">{lista((dados.contencao ?? []).map((k) => `desde ${dataHora(k.desde)}`), 'Nenhuma')}</Linha>
      <Linha rotulo="Controlados em uso">{lista((dados.controlados ?? []).map((c) => `${c.descricao} (lista ${c.lista})`), 'Nenhum')}</Linha>
    </dl>
  )
}

/** Um item do checklist: a situação e, para quem marca, as opções. */
function ItemDoChecklist({ c, pacienteId, podeMarcar, neonato, aoSalvar }: {
  c: ItemChecklist; pacienteId: string; podeMarcar: boolean; neonato: boolean; aoSalvar: () => void
}) {
  const def = ITENS_TRANSFERENCIA.find((i) => i.item === c.item)
  const [situacao, setSituacao] = React.useState<SituacaoItem | null>(c.automatico ? null : c.situacao)
  const [detalhe, setDetalhe] = React.useState(c.detalhe ?? '')
  const [motivo, setMotivo] = React.useState(c.automatico ? '' : c.motivo ?? '')
  const salvar = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('marcar_item_transferencia', {
        p_paciente: pacienteId, p_item: c.item, p_situacao: situacao!,
        p_detalhe: situacao === 'feito' && detalhe.trim() ? detalhe.trim() : undefined,
        p_motivo: situacao === 'nao_se_aplica' ? motivo.trim() : undefined,
      })
      if (error) throw error
    },
    onSuccess: aoSalvar,
  })
  const falta = faltaNoItem(c.item, situacao, detalhe, motivo, neonato)
  const opcoes = opcoesDoItem(c.item)
  const rotDet = rotuloDetalhe(c.item)
  const editavel = podeMarcar && !c.automatico
  const id = `tr-${c.item}`
  return (
    <li className="flex flex-col gap-1.5 py-2">
      <div className="flex flex-wrap items-baseline gap-x-2">
        <span className="text-apoio font-medium text-tinta">{def?.rotulo ?? c.item}</span>
        <span className="text-rotulo text-tinta-sussurro">{c.quem === 'medico' ? 'médico' : 'enfermagem'} · {def?.fonte}</span>
      </div>
      <span className={c.situacao == null ? 'text-apoio text-atencao' : 'text-apoio text-tinta-apoio'}>
        {textoItemTransferencia(c)}{c.por ? ` · ${c.por}` : ''}{c.em ? ` · ${dataHora(c.em)}` : ''}
      </span>
      {editavel && (
        <div className="flex flex-col gap-1.5">
          <div className="flex flex-wrap gap-2">
            <Chip ativo={situacao === 'feito'} onClick={() => setSituacao('feito')} variante="opcao">Feito</Chip>
            <Chip ativo={situacao === 'nao_se_aplica'} onClick={() => setSituacao('nao_se_aplica')} variante="opcao">Não se aplica</Chip>
          </div>
          {situacao === 'feito' && rotDet && (
            <div className="flex max-w-md flex-col gap-1">
              <Label htmlFor={id}>{rotDet}</Label>
              {opcoes ? (
                <CampoSelecao id={id} className="text-controle" value={detalhe} onChange={(e) => setDetalhe(e.target.value)}>
                  <option value="">Escolha…</option>
                  {opcoes.map((o) => <option key={o.valor} value={o.valor}>{o.rotulo}</option>)}
                </CampoSelecao>
              ) : <Input id={id} value={detalhe} maxLength={120} onChange={(e) => setDetalhe(e.target.value)} />}
            </div>
          )}
          {situacao === 'nao_se_aplica' && (
            <div className="flex max-w-md flex-col gap-1">
              <Label htmlFor={`${id}-mot`}>Por que não se aplica</Label>
              <Input id={`${id}-mot`} value={motivo} maxLength={500} onChange={(e) => setMotivo(e.target.value)} />
            </div>
          )}
          {situacao && (
            <div className="flex flex-wrap items-center gap-2">
              <Button size="xs" variant="outline" disabled={!!falta || salvar.isPending} onClick={() => salvar.mutate()}>Salvar item</Button>
              {falta && <span className="text-rotulo text-tinta-sussurro">{falta}</span>}
            </div>
          )}
          {salvar.error && <p role="alert" className="text-rotulo text-critico">{erroDe(salvar.error)}</p>}
        </div>
      )}
    </li>
  )
}

/** Cabeçalho do documento emitido, com a impressão em duas vias. */
function DocumentoEmitido({ doc }: { doc: DocumentoTransferencia }) {
  const [aviso, setAviso] = React.useState<string | null>(null)
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-container border border-conforme/40 bg-superficie px-3 py-2">
      <Check className="size-4 text-conforme" aria-hidden />
      <span className="text-apoio text-tinta">
        Documento nº {doc.numero}{doc.versao > 1 ? ` (versão ${doc.versao})` : ''} emitido por {doc.autor ?? '—'}
        {doc.autor_registro ? ` · ${doc.autor_registro}` : ''} em {dataHora(doc.emitido_em)}
      </span>
      <Button size="xs" variant="outline" className="ml-auto"
        onClick={() => void imprimirDocumento(doc.id, 'documento de transferencia').then((ok) => setAviso(ok ? null : 'O navegador bloqueou a janela de impressão.'))}>
        <Printer /> Imprimir (2 vias)
      </Button>
      {aviso && <span className="w-full text-rotulo text-atencao">{aviso}</span>}
    </div>
  )
}

/**
 * O painel do desfecho. `aoMudar` diz à tela se já há documento emitido (o
 * botão de transferir só se habilita com ele; o servidor confere de novo).
 */
export function PainelTransferencia({ pacienteId, aoMudar }: { pacienteId: string; aoMudar: (emitido: boolean) => void }) {
  const qc = useQueryClient()
  const chave = ['dados-transferencia', pacienteId]
  const q = useQuery({
    queryKey: chave,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('dados_transferencia', { p_paciente: pacienteId })
      if (error) throw error
      return data as unknown as DadosTransferencia
    },
  })
  const d = q.data
  const emitido = documentoEmitido(d)
  React.useEffect(() => { aoMudar(emitido) }, [emitido, aoMudar])
  const [textos, setTextos] = React.useState<TextosTransferencia | null>(null)
  const [novaVersao, setNovaVersao] = React.useState(false)
  const [motivoVersao, setMotivoVersao] = React.useState('')
  const atual = textos ?? textosIniciais(novaVersao ? d : null)
  const recarregar = () => void qc.invalidateQueries({ queryKey: chave })
  const emitir = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('emitir_documento_transferencia', {
        p_paciente: pacienteId, p_textos: { ...atual } as unknown as Json,
        p_retifica: novaVersao ? d?.documento?.id : undefined, p_motivo: novaVersao ? motivoVersao.trim() : undefined,
      })
      if (error) throw error
    },
    onSuccess: () => { setTextos(null); setNovaVersao(false); setMotivoVersao(''); recarregar() },
  })

  if (q.isLoading) return <p className="text-apoio text-tinta-sussurro">Carregando o documento de transferência…</p>
  if (q.error) return <p role="alert" className="text-apoio text-critico">{erroDe(q.error)}</p>
  if (!d?.contexto || !d.dados) return <p className="text-apoio text-tinta-sussurro">O paciente não está em atendimento, observação ou internação.</p>

  const faltas = faltasDosTextos(atual)
  const escrevendo = !!d.pode?.emitir && (!emitido || novaVersao)
  const pendentes = pendentesDoChecklist(d.checklist)
  const campo = (k: keyof TextosTransferencia, rotulo: string, linhas: number) => (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={`tr-${k}`}>{rotulo}</Label>
      <Textarea id={`tr-${k}`} rows={linhas} value={atual[k]} onChange={(e) => setTextos({ ...atual, [k]: e.target.value })} />
    </div>
  )
  return (
    <section aria-label="Documento de transferência" className="flex flex-col gap-3 rounded-cartao border border-fio bg-campo px-4 py-3.5">
      <div className="flex flex-col gap-0.5">
        <span className="flex items-center gap-2 text-controle font-semibold text-tinta"><FileText className="size-4 text-acao" aria-hidden /> Documento de transferência</span>
        <span className="text-rotulo text-tinta-sussurro">{FONTE} Sem ele, a transferência não é registrada.</span>
      </div>
      {d.documento && emitido && <DocumentoEmitido doc={d.documento} />}

      <div className="flex flex-col gap-1.5">
        <span className="rotulo text-tinta-sussurro">Preenchido pelo sistema (só leitura)</span>
        <FotografiaLeitura dados={d.dados} />
      </div>

      {emitido && !escrevendo && d.documento?.conteudo.textos && (
        <dl className="grid gap-2.5">
          <Linha rotulo="Motivo da transferência">{d.documento.conteudo.textos.motivo}</Linha>
          <Linha rotulo="Resumo clínico"><span className="whitespace-pre-wrap">{d.documento.conteudo.textos.resumo_clinico}</span></Linha>
          <Linha rotulo="Condutas adotadas"><span className="whitespace-pre-wrap">{d.documento.conteudo.textos.condutas}</span></Linha>
        </dl>
      )}
      {escrevendo && (
        <div className="flex flex-col gap-3">
          {campo('motivo', 'Motivo da transferência', 2)}
          {campo('resumo_clinico', 'Resumo clínico', 4)}
          {campo('condutas', 'Condutas adotadas na origem', 3)}
          {novaVersao && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="tr-motivo-versao">Por que emitir uma nova versão</Label>
              <Input id="tr-motivo-versao" value={motivoVersao} onChange={(e) => setMotivoVersao(e.target.value)} />
            </div>
          )}
          {!d.eu?.registro && (
            <span className="text-rotulo text-atencao">Seu CRM não está no cadastro: a folha sai com o campo em branco para escrever à mão.</span>
          )}
        </div>
      )}

      <div className="flex flex-col">
        <span className="rotulo text-tinta-sussurro">Checklist (registra, não trava a transferência)</span>
        <ul className="flex flex-col divide-y divide-fio">
          {(d.checklist ?? []).map((c) => (
            <ItemDoChecklist key={`${c.item}-${c.situacao}-${c.em ?? ''}`} c={c} pacienteId={pacienteId} neonato={!!d.neonato} aoSalvar={recarregar}
              podeMarcar={c.quem === 'medico' ? !!d.pode?.emitir : !!d.pode?.enfermagem} />
          ))}
        </ul>
        {pendentes.length > 0 && <span className="text-rotulo text-tinta-sussurro">Pendentes: {pendentes.join('; ')}.</span>}
      </div>

      {escrevendo && (
        <div className="flex flex-col gap-1.5">
          {faltas.map((f) => (
            <span key={f} className="flex items-start gap-2 text-apoio text-atencao"><CircleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />{f}</span>
          ))}
          {emitir.error && <p role="alert" className="rounded-container border border-critico/30 bg-alerta-critico px-3.5 py-2.5 text-apoio text-critico">{erroDe(emitir.error)}</p>}
          <div className="flex flex-wrap justify-end gap-2">
            {novaVersao && <Button variant="ghost" size="sm" onClick={() => { setNovaVersao(false); setTextos(null) }}>Desistir</Button>}
            <Button size="sm" disabled={faltas.length > 0 || (novaVersao && motivoVersao.trim().length < 10) || emitir.isPending} onClick={() => emitir.mutate()}>
              <FileText /> {novaVersao ? 'Emitir nova versão' : 'Emitir documento de transferência'}
            </Button>
          </div>
          <span className="text-rotulo text-tinta-sussurro">Autor: {d.eu?.nome ?? '—'}{d.eu?.registro ? ` · ${d.eu.registro}` : ''} (quem emite assina a folha).</span>
        </div>
      )}
      {emitido && !escrevendo && d.pode?.emitir && (
        <Button size="xs" variant="outline" className="self-start" onClick={() => { setNovaVersao(true); setTextos(null) }}>Emitir nova versão</Button>
      )}
      {!d.pode?.emitir && !emitido && <span className="text-apoio text-tinta-sussurro">O documento é emitido pelo médico que transfere.</span>}
    </section>
  )
}

/**
 * O documento visto pela Regulação, pelo NIR e pelo destino na rede (T9). Só
 * leitura; quem não pode ver recebe a recusa do servidor.
 */
export function LeituraTransferencia({ solicitacaoId }: { solicitacaoId: string }) {
  const [aberto, setAberto] = React.useState(false)
  const q = useQuery({
    queryKey: ['transferencia-da-regulacao', solicitacaoId],
    enabled: aberto,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('transferencia_da_regulacao', { p_solicitacao: solicitacaoId })
      if (error) throw error
      return data as unknown as { documento: DocumentoTransferencia | null; checklist?: ItemChecklist[] }
    },
  })
  const doc = q.data?.documento
  const textos = doc?.conteudo.textos
  return (
    <div className="flex flex-col gap-2">
      <Button size="xs" variant="outline" className="self-start" aria-expanded={aberto} onClick={() => setAberto((v) => !v)}>
        <FileText /> Documento de transferência
      </Button>
      {aberto && (q.isLoading ? <p className="text-apoio text-tinta-sussurro">Carregando…</p>
        : q.error ? <p role="alert" className="text-apoio text-critico">{erroDe(q.error)}</p>
        : !doc ? <p className="text-apoio text-tinta-sussurro">A origem ainda não emitiu o documento de transferência.</p> : (
          <div className="flex flex-col gap-3 rounded-cartao border border-fio bg-campo px-4 py-3.5">
            <span className="text-apoio text-tinta">
              Documento nº {doc.numero}{doc.versao > 1 ? ` (versão ${doc.versao})` : ''} · {doc.autor ?? '—'}{doc.autor_registro ? ` · ${doc.autor_registro}` : ''} · {dataHora(doc.emitido_em)}
            </span>
            {textos && (
              <dl className="grid gap-2.5">
                <Linha rotulo="Motivo da transferência">{textos.motivo}</Linha>
                <Linha rotulo="Resumo clínico"><span className="whitespace-pre-wrap">{textos.resumo_clinico}</span></Linha>
                <Linha rotulo="Condutas adotadas"><span className="whitespace-pre-wrap">{textos.condutas}</span></Linha>
              </dl>
            )}
            {doc.conteudo.dados && <FotografiaLeitura dados={doc.conteudo.dados} />}
            {(q.data?.checklist ?? []).length > 0 && (
              <Linha rotulo="Checklist">
                <ul className="flex flex-col gap-0.5">
                  {(q.data?.checklist ?? []).map((c) => (
                    <li key={c.item}>{ITENS_TRANSFERENCIA.find((i) => i.item === c.item)?.rotulo ?? c.item}: {textoItemTransferencia(c)}</li>
                  ))}
                </ul>
              </Linha>
            )}
          </div>
        ))}
    </div>
  )
}
