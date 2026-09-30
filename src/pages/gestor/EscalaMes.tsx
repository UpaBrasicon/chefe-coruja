// ─────────────────────────────────────────────────────────────────────────────
// Escala do mês para o gestor (protótipo, aba Mensal, P/index.html 7133–7230):
// calendário com uma barra por setor em cada dia (coberto, vaga aberta, sem
// plantão), o marcador de vagas do dia, o detalhe do dia por setor e faixa, e
// "Publicar escala". O modelo da escala continua o de sempre (ADR 0003): quem
// é escalado, fracionar, passar plantão, 15/15 e candidaturas seguem na grade
// da semana logo abaixo. Dados de escala_mes_gestor; marcar/retirar vaga e
// publicar pelas RPCs da migration 20261007000003.
// ─────────────────────────────────────────────────────────────────────────────
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, ChevronLeft, ChevronRight, ShieldCheck } from 'lucide-react'
import * as React from 'react'

import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { useUnidade } from '@/contexts/UnidadeContext'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'

type Escalado = { plantao_id: string; perfil_id: string; nome: string; turno: string; duracao_min: number; quinzenal: boolean; rotulo: string | null }
type Faixa = {
  data: string; setor_id: string; turno: 'manha' | 'tarde' | 'noite'; escalados: Escalado[]; previsto: boolean
  vaga_id: string | null; vaga_obs: string | null; situacao: 'coberto' | 'vaga' | 'sem_plantao'
}
type Publicacao = { versao: number; publicada_em: string; publicada_por: string | null; plantoes: number; vagas: number; alteracoes_depois: number }
type Mes = { setores: { id: string; nome: string; tipo: string }[]; faixas: Faixa[]; publicacao: Publicacao | null }

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']
const SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
const FAIXA: Record<Faixa['turno'], [string, string]> = { manha: ['Manhã', '07h–13h'], tarde: ['Tarde', '13h–19h'], noite: ['Noite', '19h–07h'] }
const COR = { coberto: 'bg-conforme', vaga: 'bg-atencao', sem_plantao: 'bg-trilha' } as const

const hojeSP = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })
const quando = (iso: string) => new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Sao_Paulo' })
const ORDEM_FAIXA: Faixa['turno'][] = ['manha', 'tarde', 'noite']

/** Situação do setor no dia: vaga se alguma faixa está vaga; coberto se tem alguém; senão sem plantão. */
function situacaoDoDia(fs: Faixa[]): Faixa['situacao'] {
  if (fs.some((f) => f.situacao === 'vaga')) return 'vaga'
  if (fs.some((f) => f.situacao === 'coberto')) return 'coberto'
  return 'sem_plantao'
}

export function EscalaMes() {
  const { unidadeAtiva, papelAtivo } = useUnidade()
  const unidadeId = unidadeAtiva?.unidade_id
  const qc = useQueryClient()
  const hoje = hojeSP()
  const [mes, setMes] = React.useState(() => hoje.slice(0, 7))
  const [dia, setDia] = React.useState<string | null>(null)
  const [publicando, setPublicando] = React.useState(false)
  const [obs, setObs] = React.useState('')
  const [erro, setErro] = React.useState<string | null>(null)
  const [aviso, setAviso] = React.useState<string | null>(null)
  const [ano, mesNum] = mes.split('-').map(Number)

  const dados = useQuery({
    // prefixo 'escala-plantao-mes': a grade da semana (Escala.tsx) já invalida
    // essa chave ao escalar ou remover alguém, e o calendário acompanha
    queryKey: ['escala-plantao-mes', 'gestor', unidadeId, mes],
    enabled: !!unidadeId && papelAtivo === 'gestor',
    queryFn: async () => {
      const { data, error } = await supabase.rpc('escala_mes_gestor', { p_unidade: unidadeId!, p_ano: ano, p_mes: mesNum })
      if (error) throw error
      return data as unknown as Mes
    },
  })
  if (papelAtivo !== 'gestor') return null

  const recarregar = () => {
    void qc.invalidateQueries({ queryKey: ['escala-plantao-mes'] })
    void qc.invalidateQueries({ queryKey: ['escala-plantao'] })
  }
  const mudarMes = (n: number) => {
    const d = new Date(ano, mesNum - 1 + n, 1)
    setMes(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
    setDia(null); setErro(null); setAviso(null)
  }

  const m = dados.data
  const setores = m?.setores ?? []
  const porDia = new Map<string, Faixa[]>()
  for (const f of m?.faixas ?? []) porDia.set(f.data, [...(porDia.get(f.data) ?? []), f])
  const vagasMes = (m?.faixas ?? []).filter((f) => f.situacao === 'vaga').length
  const plantoesMes = new Set((m?.faixas ?? []).flatMap((f) => f.escalados.map((e) => e.plantao_id))).size
  const primeiro = new Date(ano, mesNum - 1, 1).getDay()
  const diasNoMes = new Date(ano, mesNum, 0).getDate()
  const celulas: (string | null)[] = [...Array(primeiro).fill(null),
    ...Array.from({ length: diasNoMes }, (_, i) => `${mes}-${String(i + 1).padStart(2, '0')}`)]
  while (celulas.length % 7) celulas.push(null)
  const pub = m?.publicacao
  const mesPassou = `${mes}-${String(diasNoMes).padStart(2, '0')}` < hoje

  async function publicar() {
    setErro(null)
    const { data, error } = await supabase.rpc('publicar_escala', { p_unidade: unidadeId!, p_ano: ano, p_mes: mesNum, p_observacao: obs.trim() || undefined })
    if (error) return setErro(error.message)
    setPublicando(false); setObs('')
    setAviso(`Escala de ${MESES[mesNum - 1]} publicada (versão ${data}). Quem está escalado no mês foi avisado.`)
    recarregar()
    void qc.invalidateQueries({ queryKey: ['historico-escala'] })
  }
  async function marcarVaga(f: Faixa) {
    setErro(null)
    const { error } = await supabase.rpc('marcar_vaga_escala', { p_setor: f.setor_id, p_data: f.data, p_turno: f.turno })
    if (error) return setErro(error.message)
    recarregar()
  }
  async function retirarVaga(id: string) {
    setErro(null)
    const { error } = await supabase.rpc('retirar_vaga_escala', { p_vaga: id })
    if (error) return setErro(error.message)
    recarregar()
  }

  return (
    <section className="mb-6 overflow-hidden rounded-cartao border border-fio bg-superficie shadow-repouso">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-trilha px-5 py-3.5">
        <div className="flex items-center gap-2">
          <button type="button" aria-label="Mês anterior" onClick={() => mudarMes(-1)} className="grid size-8 place-items-center rounded-controle border border-fio hover:border-marca hover:text-acao"><ChevronLeft className="size-4" /></button>
          <span className="min-w-[150px] text-center text-corpo font-semibold text-tinta">{MESES[mesNum - 1][0].toUpperCase() + MESES[mesNum - 1].slice(1)} de {ano}</span>
          <button type="button" aria-label="Próximo mês" onClick={() => mudarMes(1)} className="grid size-8 place-items-center rounded-controle border border-fio hover:border-marca hover:text-acao"><ChevronRight className="size-4" /></button>
        </div>
        <Button onClick={() => { setErro(null); setPublicando(true) }} disabled={!m || plantoesMes === 0 || mesPassou}>
          <ShieldCheck /> Publicar escala
        </Button>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-trilha bg-campo px-5 py-2.5">
        <span className={cn('text-apoio', pub?.alteracoes_depois ? 'text-atencao' : 'text-tinta-sussurro')}>
          {pub
            ? `Publicada, versão ${pub.versao}, em ${quando(pub.publicada_em)}${pub.publicada_por ? ` por ${pub.publicada_por}` : ''}`
              + (pub.alteracoes_depois ? ` · ${pub.alteracoes_depois} ${pub.alteracoes_depois === 1 ? 'alteração' : 'alterações'} depois de publicar` : '')
            : 'Ainda não publicada'}
          {m ? ` · ${plantoesMes} ${plantoesMes === 1 ? 'plantão' : 'plantões'} · ${vagasMes} ${vagasMes === 1 ? 'vaga aberta' : 'vagas abertas'}` : ''}
        </span>
        <div className="flex flex-wrap items-center gap-3 text-rotulo text-tinta-sussurro">
          <span>Uma barra por setor:</span>
          <span className="flex items-center gap-1.5"><span className="h-1.5 w-3 rounded-capsula bg-conforme" />Coberto</span>
          <span className="flex items-center gap-1.5"><span className="h-1.5 w-3 rounded-capsula bg-atencao" />Vaga aberta</span>
          <span className="flex items-center gap-1.5"><span className="h-1.5 w-3 rounded-capsula bg-trilha ring-1 ring-fio" />Sem plantão</span>
        </div>
      </div>

      {aviso && <p role="status" className="border-b border-trilha bg-alerta-conforme px-5 py-2.5 text-apoio text-conforme">{aviso}</p>}
      {erro && !publicando && <p role="alert" className="border-b border-trilha bg-alerta-critico px-5 py-2.5 text-apoio text-critico">{erro}</p>}
      {dados.isLoading && <div className="flex justify-center py-8"><Spinner /></div>}
      {dados.error && <p className="px-5 py-3 text-apoio text-critico">{(dados.error as Error).message}</p>}

      {m && !dia && (
        <div className="p-3">
          <div className="grid grid-cols-7 gap-1.5 pb-1.5">
            {SEMANA.map((s) => <span key={s} className="text-center text-rotulo font-semibold tracking-[0.05em] text-tinta-sussurro uppercase">{s}</span>)}
          </div>
          <div className="grid grid-cols-7 gap-1.5">
            {celulas.map((d, i) => {
              if (!d) return <span key={i} />
              const fs = porDia.get(d) ?? []
              const vagas = fs.filter((f) => f.situacao === 'vaga').length
              const pessoas = new Set(fs.flatMap((f) => f.escalados.map((e) => e.plantao_id))).size
              return (
                <button key={d} type="button" onClick={() => setDia(d)}
                  className={cn('flex min-h-[84px] flex-col gap-1.5 rounded-controle border p-2 text-left transition-colors hover:border-marca',
                    d === hoje ? 'border-marca bg-alerta-marca/40' : 'border-fio bg-superficie', d < hoje && 'opacity-70')}>
                  <span className="flex items-center gap-1 text-apoio font-semibold tabular-nums text-tinta">
                    {Number(d.slice(8))}{d === hoje && <span className="size-1.5 rounded-full bg-acao" aria-label="hoje" />}
                  </span>
                  <span className="flex flex-col gap-[3px]" aria-hidden>
                    {setores.map((s) => (
                      <span key={s.id} title={s.nome} className={cn('h-1.5 rounded-capsula', COR[situacaoDoDia(fs.filter((f) => f.setor_id === s.id))])} />
                    ))}
                  </span>
                  <span className="mt-auto flex flex-wrap items-center justify-between gap-1 text-rotulo">
                    <span className="tabular-nums text-tinta-sussurro">{pessoas ? `${pessoas} ${pessoas === 1 ? 'plantão' : 'plantões'}` : ''}</span>
                    {vagas > 0 && (
                      <span className="flex items-center gap-0.5 rounded-capsula bg-alerta-atencao px-1.5 font-semibold text-atencao" title={`${vagas} ${vagas === 1 ? 'vaga aberta' : 'vagas abertas'}`}>
                        <AlertTriangle className="size-3" aria-hidden />{vagas}
                      </span>
                    )}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {m && dia && (
        <div className="flex flex-col">
          <div className="flex flex-wrap items-center gap-3 border-b border-trilha px-5 py-3">
            <Button size="sm" variant="outline" onClick={() => setDia(null)}><ChevronLeft /> Voltar ao mês</Button>
            <span className="text-corpo font-semibold text-tinta">
              {new Date(`${dia}T12:00:00`).toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
            </span>
          </div>
          {setores.map((s) => {
            const fs = (porDia.get(dia) ?? []).filter((f) => f.setor_id === s.id)
              .sort((x, y) => ORDEM_FAIXA.indexOf(x.turno) - ORDEM_FAIXA.indexOf(y.turno))
            return (
              <div key={s.id} className="border-b border-trilha px-5 py-3 last:border-0">
                <span className="text-apoio font-semibold text-tinta">{s.nome}</span>
                <div className="mt-2 grid gap-2 sm:grid-cols-3">
                  {fs.map((f) => (
                    <div key={f.turno} className={cn('flex flex-col gap-1.5 rounded-controle border px-3 py-2',
                      f.situacao === 'vaga' ? 'border-atencao/30 bg-alerta-atencao/60' : 'border-fio')}>
                      <div className="flex flex-wrap items-baseline gap-x-2">
                        <span className="text-apoio font-semibold text-tinta">{FAIXA[f.turno][0]}</span>
                        <span className="text-rotulo text-tinta-sussurro">{FAIXA[f.turno][1]}</span>
                        {f.situacao === 'vaga' && <span className="ml-auto rounded-capsula bg-atencao/[0.12] px-1.5 text-rotulo font-semibold text-atencao uppercase">Vaga aberta</span>}
                      </div>
                      {f.escalados.map((e) => (
                        <span key={e.plantao_id} className="text-apoio text-tinta">
                          {e.nome}
                          <span className="text-tinta-sussurro">{e.duracao_min === 720 ? ' · 12 h' : ' · 6 h'}{e.quinzenal ? ' · 15/15' : ''}</span>
                        </span>
                      ))}
                      {f.situacao !== 'coberto' && (
                        <span className="text-rotulo text-tinta-sussurro">
                          {f.vaga_id ? `Marcada pelo gestor${f.vaga_obs ? `: ${f.vaga_obs}` : ''}` : f.previsto ? 'Prevista pela escala fixa' : 'Sem plantão'}
                        </span>
                      )}
                      {f.situacao === 'coberto' && f.vaga_id && <span className="text-rotulo text-conforme">Vaga marcada, já coberta</span>}
                      {f.vaga_id ? (
                        <button type="button" onClick={() => void retirarVaga(f.vaga_id!)} className="w-fit text-rotulo text-tinta-sussurro underline-offset-2 hover:text-critico hover:underline">Retirar vaga</button>
                      ) : f.situacao === 'sem_plantao' && dia >= hoje ? (
                        <button type="button" onClick={() => void marcarVaga(f)} className="w-fit text-rotulo text-acao underline-offset-2 hover:underline">Marcar vaga</button>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
          <p className="bg-campo px-5 py-2.5 text-rotulo text-pretty text-tinta-sussurro">
            Para escalar alguém, use a grade da semana abaixo. Marcar vaga avisa os plantonistas da unidade; a vaga coberta deixa de contar.
          </p>
        </div>
      )}

      <Dialog open={publicando} onOpenChange={setPublicando}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Publicar a escala de {MESES[mesNum - 1]}</DialogTitle>
            <DialogDescription>
              {plantoesMes} {plantoesMes === 1 ? 'plantão' : 'plantões'} e {vagasMes} {vagasMes === 1 ? 'vaga aberta' : 'vagas abertas'}.
              Quem está escalado no mês recebe o aviso. Publicar não muda acesso: a escala vale pelo que está nela, e mudança depois
              aparece como alterada até a próxima publicação.
            </DialogDescription>
          </DialogHeader>
          {vagasMes > 0 && <p className="flex items-center gap-1.5 text-apoio text-atencao"><AlertTriangle className="size-3.5" /> O mês ainda tem vagas abertas.</p>}
          <label className="flex flex-col gap-[5px]">
            <span className="text-apoio font-medium text-grafite">Observação (opcional)</span>
            <Input value={obs} onChange={(e) => setObs(e.target.value)} placeholder="Ex.: versão com as férias de outubro" />
          </label>
          {erro && <p className="text-apoio text-critico">{erro}</p>}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setPublicando(false)}>Cancelar</Button>
            <Button onClick={() => void publicar()}><ShieldCheck /> Publicar{pub ? ` versão ${pub.versao + 1}` : ''}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  )
}
