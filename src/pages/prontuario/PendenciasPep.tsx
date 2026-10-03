// Pendências do PEP (protótipo index.html 2523–2601; pepAbertos/pepFaltas
// ~29933). Três quadros do plantonista:
//   1. Para emitir — meus rascunhos ainda sem número. No protótipo é "Para
//      assinar", com assinatura em lote; aqui é a EMISSÃO numerada que já
//      existe, um a um, depois de confirmar (a assinatura ICP-Brasil é a
//      etapa 4.8, ainda sem provedor). Cada rascunho mostra o que falta
//      (o servidor confere: private.faltas_documento); quem tem falta não
//      entra no lote — abre-se o formulário e completa-se lá.
//   2. Impedem a alta — o que private.impeditivos_alta devolve para cada
//      leito que eu cuido (agravo sem notificação, parecer sem resposta,
//      exame sem resultado, pendência impeditiva, passagem, rascunho de outro).
//   3. Combinadas nos leitos — pendências abertas dos meus leitos, com
//      concluir (a mesma RPC do caderno do leito).
import { useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, ArrowRight, Check, ClipboardList, Send, ShieldCheck } from 'lucide-react'
import * as React from 'react'
import { Link } from 'react-router-dom'

import { hora, invalidarDocumentos, rotuloDocumento, emitirRascunho, diaHora } from '@/components/documento/documentos'
import { rotaDoRascunho, usePendenciasPep, type RascunhoPep } from '@/components/documento/pendenciasPep'
import { TituloPagina, Trilha } from '@/components/monitor/Pagina'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Spinner } from '@/components/ui/spinner'
import { useUnidade } from '@/contexts/UnidadeContext'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'

const TIPO_PENDENCIA: Record<string, string> = {
  reavaliacao: 'Reavaliação', exame: 'Exame', parecer: 'Parecer', regulacao: 'Regulação', outro: 'Outro', observacao: 'Observação',
}
const ROTA_LEITOS = '/plantao/internacao/pacientes'

function Quadro({ icone, titulo, resumo, children }: { icone: React.ReactNode; titulo: string; resumo?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="overflow-hidden rounded-cartao border border-fio bg-superficie shadow-repouso">
      <div className="flex flex-wrap items-center gap-2.5 border-b border-trilha px-5 py-3.5">
        <h2 className="flex items-center gap-2 text-corpo font-semibold text-tinta">{icone}{titulo}</h2>
        {resumo && <span className="text-apoio text-tinta-sussurro">{resumo}</span>}
      </div>
      {children}
    </section>
  )
}

const Linha = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <div className={cn('flex flex-wrap items-center gap-3.5 border-b border-trilha px-5 py-3 last:border-0', className)}>{children}</div>
)
const Vazio = ({ children }: { children: React.ReactNode }) => <div className="px-5 py-4.5 text-apoio text-tinta-sussurro">{children}</div>

type Resultado = { id: string; ok: boolean; texto: string }

export default function PendenciasPep() {
  const { unidadeAtiva } = useUnidade()
  const unidadeId = unidadeAtiva?.unidade_id
  const qc = useQueryClient()
  const q = usePendenciasPep(unidadeId)
  // escolha explícita do usuário; sem ela, vem marcado quem não tem falta
  const [escolha, setEscolha] = React.useState<Record<string, boolean>>({})
  const [confirmando, setConfirmando] = React.useState(false)
  const [emitindo, setEmitindo] = React.useState(false)
  const [resultados, setResultados] = React.useState<Resultado[] | null>(null)
  const [erro, setErro] = React.useState<string | null>(null)
  const [agora] = React.useState(() => Date.now())

  const rascunhos = q.data?.rascunhos ?? []
  const impeditivos = q.data?.impeditivos ?? []
  const combinadas = q.data?.combinadas ?? []
  const faltasDe = (r: RascunhoPep) => r.faltas ?? []
  const marcado = (r: RascunhoPep) => faltasDe(r).length === 0 && (escolha[r.id] ?? true)
  const marcados = rascunhos.filter(marcado)
  const comFalta = rascunhos.filter((r) => faltasDe(r).length > 0).length

  const alternar = (r: RascunhoPep) => setEscolha((s) => ({ ...s, [r.id]: !marcado(r) }))

  async function emitirLote(lista: RascunhoPep[]) {
    setEmitindo(true)
    const saida: Resultado[] = []
    for (const r of lista) {
      try {
        const e = await emitirRascunho(r.id)
        saida.push({ id: r.id, ok: true, texto: `${rotuloDocumento(r.tipo)} · ${r.paciente}: emitido nº ${e.numero}` })
      } catch (e) {
        saida.push({ id: r.id, ok: false, texto: `${rotuloDocumento(r.tipo)} · ${r.paciente}: ${(e as Error).message}` })
      }
    }
    setResultados(saida)
    setEmitindo(false)
    setConfirmando(false)
    setEscolha({})
    invalidarDocumentos(qc)
  }

  async function concluir(id: string) {
    setErro(null)
    const { error } = await supabase.rpc('concluir_pendencia', { p_pendencia: id })
    if (error) setErro(error.message)
    for (const k of ['pendencias-pep', 'pendencias', 'pendencias-lista', 'impeditivos']) void qc.invalidateQueries({ queryKey: [k] })
  }

  return (
    <div className="flex w-full max-w-4xl flex-col gap-4">
      <Trilha niveis={[{ rotulo: 'Plantão', to: '/plantao' }, { rotulo: 'Internação', to: '/plantao/internacao' }, { rotulo: 'Pendências do PEP' }]} />
      <TituloPagina icone={ClipboardList} titulo="Pendências do PEP"
        descricao="Seus documentos ainda sem emissão, o que impede a alta nos seus leitos e o que ficou combinado." />

      {q.isLoading && <div className="flex h-32 items-center justify-center"><Spinner /></div>}
      {q.error && <p role="alert" className="rounded-controle bg-alerta-critico p-3 text-apoio text-critico">{(q.error as Error).message}</p>}
      {erro && <p role="alert" className="rounded-controle bg-alerta-critico p-3 text-apoio text-critico">{erro}</p>}

      {q.data && (
        <>
          <Quadro icone={<ShieldCheck className="size-4 text-acao" aria-hidden />} titulo="Para emitir"
            resumo={rascunhos.length ? `${rascunhos.length} ${rascunhos.length === 1 ? 'rascunho seu aberto' : 'rascunhos seus abertos'}` : undefined}>
            {rascunhos.map((r) => (
              <Linha key={r.id}>
                <label className={cn('flex min-w-0 flex-[1_1_260px] items-center gap-3', faltasDe(r).length ? 'cursor-not-allowed' : 'cursor-pointer')}>
                  <input type="checkbox" checked={marcado(r)} disabled={faltasDe(r).length > 0} onChange={() => alternar(r)}
                    aria-describedby={faltasDe(r).length ? `faltas-${r.id}` : undefined}
                    className="size-[18px] shrink-0 cursor-pointer accent-acao disabled:cursor-not-allowed" />
                  <span className="flex min-w-0 flex-col gap-px">
                    <span className="text-corpo font-medium text-tinta">{rotuloDocumento(r.tipo)} · {r.paciente}</span>
                    <span className="text-apoio text-tinta-sussurro">
                      {r.leito ? `Leito ${r.leito} · ` : ''}aberto às {hora(r.criado_em)} · salvo às {hora(r.atualizado_em)}
                      {r.copia_de ? ' · cópia de documento anterior' : ''}
                    </span>
                    {faltasDe(r).length > 0 && (
                      <span id={`faltas-${r.id}`} className="text-apoio text-pretty text-critico">
                        Falta para emitir: {faltasDe(r).join('; ')}. Abra e complete.
                      </span>
                    )}
                  </span>
                </label>
                <Button size="sm" variant="outline" render={<Link to={rotaDoRascunho(r.tipo)} />}>
                  <ArrowRight /> Abrir
                </Button>
              </Linha>
            ))}
            {rascunhos.length === 0 && <Vazio>Nenhum documento seu aberto. Tudo emitido ou descartado.</Vazio>}
            {rascunhos.length > 0 && (
              <div className="flex flex-wrap items-center justify-between gap-3 bg-campo px-5 py-3">
                <span className="flex-[1_1_260px] text-apoio text-pretty text-tinta-sussurro">
                  A emissão em lote vale para os marcados: cada um recebe número definitivo, como está. Confira antes; emitido não se edita.
                  {comFalta > 0 && ` ${comFalta === 1 ? 'Um rascunho tem' : `${comFalta} rascunhos têm`} campo obrigatório em branco e fica fora do lote.`}
                </span>
                <Button disabled={marcados.length === 0 || emitindo} onClick={() => setConfirmando(true)}>
                  <Send /> Emitir {marcados.length} {marcados.length === 1 ? 'documento' : 'documentos'}
                </Button>
              </div>
            )}
            {resultados && (
              <ul className="flex flex-col gap-1 border-t border-trilha px-5 py-3">
                {resultados.map((r) => (
                  <li key={r.id} className={cn('text-apoio', r.ok ? 'text-conforme' : 'text-critico')}>{r.ok ? '✓' : '✗'} {r.texto}</li>
                ))}
              </ul>
            )}
          </Quadro>

          <Quadro icone={<AlertTriangle className="size-4 text-critico" aria-hidden />} titulo="Impedem a alta"
            resumo="Agravo sem notificação, parecer sem resposta, exame sem resultado e o que mais travar a alta">
            {impeditivos.map((l) => (
              <Linha key={l.internacao_id}>
                <span className="rounded-capsula bg-marca/10 px-2.5 py-1 text-apoio font-semibold text-acao">{l.leito ? `Leito ${l.leito}` : 'Sem leito'}</span>
                <div className="flex min-w-0 flex-[1_1_240px] flex-col gap-px">
                  <span className="text-corpo font-medium text-tinta">{l.paciente}</span>
                  {l.itens.map((i) => <span key={i.tipo + i.id} className="text-apoio text-pretty text-critico">{i.descricao}</span>)}
                </div>
                <Button size="sm" variant="outline" render={<Link to={ROTA_LEITOS} />}><ArrowRight /> Abrir leito</Button>
              </Linha>
            ))}
            {impeditivos.length === 0 && <Vazio>Nenhum leito seu com pendência que impeça a alta.</Vazio>}
          </Quadro>

          <Quadro icone={<ClipboardList className="size-4 text-marca" aria-hidden />} titulo="Combinadas nos leitos"
            resumo={combinadas.length ? `${combinadas.length} em aberto` : undefined}>
            {combinadas.map((p) => {
              const vencida = !!p.prazo && Date.parse(p.prazo) < agora
              return (
                <Linha key={p.id}>
                  <span className={cn('rounded-capsula px-2 py-[3px] text-rotulo font-semibold tracking-[0.04em] uppercase',
                    vencida ? 'bg-alerta-critico text-critico' : 'bg-trilha text-tinta-apoio')}>{TIPO_PENDENCIA[p.tipo] ?? p.tipo}</span>
                  <div className="flex min-w-0 flex-[1_1_240px] flex-col gap-px">
                    <span className="text-corpo leading-[1.45] text-pretty text-tinta">{p.descricao}</span>
                    <span className="text-rotulo text-tinta-sussurro">
                      {p.leito ? `Leito ${p.leito}` : 'Sem leito'} · {p.paciente} · {p.origem === 'sistema' ? 'aberta pelo sistema' : `pedida por ${p.meu ? 'você' : p.autor ?? '—'}`}
                      {p.impeditiva ? ' · impede a alta' : ''}
                    </span>
                  </div>
                  <span className={cn('text-apoio whitespace-nowrap tabular-nums', vencida ? 'font-semibold text-critico' : 'text-tinta-sussurro')}>
                    {p.prazo ? `${vencida ? 'vencida desde' : 'até'} ${diaHora(p.prazo)}` : 'sem prazo'}
                  </span>
                  <Button size="sm" variant="outline" className="hover:border-conforme hover:text-conforme" onClick={() => void concluir(p.id)}>
                    <Check /> Concluir
                  </Button>
                  <Button size="sm" variant="outline" render={<Link to={ROTA_LEITOS} />}><ArrowRight /> Abrir leito</Button>
                </Linha>
              )
            })}
            {combinadas.length === 0 && <Vazio>Nada combinado em aberto nos seus leitos.</Vazio>}
          </Quadro>
        </>
      )}

      <Dialog open={confirmando} onOpenChange={(v) => !emitindo && setConfirmando(v)}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>Emitir {marcados.length} {marcados.length === 1 ? 'documento' : 'documentos'}?</DialogTitle>
            <DialogDescription>
              Cada um recebe número definitivo da unidade com o conteúdo que está no rascunho. Depois de emitido, corrigir é cancelar com
              justificativa e copiar como novo. Nada é impresso agora.
            </DialogDescription>
          </DialogHeader>
          <ul className="flex max-h-60 flex-col gap-1 overflow-y-auto text-apoio text-tinta">
            {marcados.map((r) => <li key={r.id}>• {rotuloDocumento(r.tipo)} · {r.paciente}{r.leito ? ` · leito ${r.leito}` : ''}</li>)}
          </ul>
          <DialogFooter>
            <Button variant="outline" disabled={emitindo} onClick={() => setConfirmando(false)}>Voltar</Button>
            <Button disabled={emitindo || marcados.length === 0} onClick={() => void emitirLote(marcados)}>
              {emitindo ? <Spinner /> : <Send />} Emitir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
