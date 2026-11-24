import { useQuery, useQueryClient } from '@tanstack/react-query'
import { BedDouble, Moon } from 'lucide-react'
import * as React from 'react'

import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { diaMesHora, hora } from '@/lib/formato'
import {
  blocosDescanso, conferirDivisao, descansandoAgora, janelaDasHoras, lerDivisao, minutosDeDescanso,
  type BlocoDescanso, type MedicoDescanso,
} from '@/domain/descanso'
import { Button } from '@/components/ui/button'
import { CaixaMarcar } from '@/components/ui/caixa-marcar'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Spinner } from '@/components/ui/spinner'
import { TituloCartao } from '@/components/monitor/Pagina'

// Divisão do descanso dos médicos (pedido 8; PS4 e PS5 do RT em 23/11/2026):
// o médico de plantão divide igual (quais médicos, início, fim e o mínimo
// acordado); médicos, enfermagem e gestor veem quem está descansando agora.

const CHAVE = 'descanso-do-plantao'

function useDivisao(unidadeId: string | undefined) {
  return useQuery({
    queryKey: [CHAVE, unidadeId],
    enabled: !!unidadeId,
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('descanso_do_plantao', { p_unidade: unidadeId! })
      if (error) throw error
      return lerDivisao(data)
    },
  })
}

const duracao = (min: number) => `${Math.floor(min / 60)}h${min % 60 ? String(min % 60).padStart(2, '0') : ''}`

/** A grade: uma linha por médico, a janela na horizontal e a marca de "agora". */
function Grade({ inicio, fim, medicos, blocos, agora }: {
  inicio: number; fim: number; medicos: MedicoDescanso[]; blocos: BlocoDescanso[]; agora: number
}) {
  const total = fim - inicio
  const pct = (t: number) => `${Math.min(100, Math.max(0, ((t - inicio) / total) * 100))}%`
  const marcaAgora = agora > inicio && agora < fim
  return (
    <div className="flex flex-col gap-1.5" role="table" aria-label="Divisão do descanso">
      <div className="flex justify-between pl-[112px] text-rotulo tabular-nums text-tinta-sussurro" aria-hidden>
        <span>{hora(inicio)}</span><span>{hora(inicio + total / 2)}</span><span>{hora(fim)}</span>
      </div>
      {medicos.map((m) => {
        const meus = blocos.filter((b) => b.perfil_id === m.perfil_id)
        return (
          <div key={m.perfil_id} role="row" className="flex items-center gap-3">
            <span role="rowheader" className="w-[100px] shrink-0 truncate text-apoio text-tinta">{m.nome}</span>
            <div role="cell" className="relative h-6 flex-1 overflow-hidden rounded-controle bg-trilha"
              aria-label={meus.length ? `descansa ${meus.map((b) => `${hora(b.inicio)} às ${hora(b.fim)}`).join(' e ')}` : 'acordado a janela toda'}>
              {meus.map((b) => (
                <span key={b.inicio} className="absolute inset-y-0 rounded-controle bg-acao/70"
                  style={{ left: pct(b.inicio), width: `calc(${pct(b.fim)} - ${pct(b.inicio)})` }} />
              ))}
              {marcaAgora && <span className="absolute inset-y-0 w-0.5 bg-critico" style={{ left: pct(agora) }} aria-hidden />}
            </div>
          </div>
        )
      })}
      <p className="pl-[112px] text-rotulo text-tinta-sussurro">
        <span className="mr-1 inline-block size-2.5 rounded-controle bg-acao/70 align-middle" aria-hidden /> descansa
        {marcaAgora && <><span className="ml-3 mr-1 inline-block h-2.5 w-0.5 bg-critico align-middle" aria-hidden /> agora</>}
      </p>
    </div>
  )
}

function Formulario({ unidadeId, aoFechar }: { unidadeId: string; aoFechar: () => void }) {
  const qc = useQueryClient()
  const medicos = useQuery({
    queryKey: ['medicos-para-descanso', unidadeId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('medicos_para_descanso', { p_unidade: unidadeId })
      if (error) throw error
      return (data ?? []) as { perfil_id: string; nome: string; na_escala: boolean }[]
    },
  })
  const [marcados, setMarcados] = React.useState<string[] | null>(null)
  const escolhidos = marcados ?? (medicos.data ?? []).filter((m) => m.na_escala).map((m) => m.perfil_id)
  const [horaInicio, setHoraInicio] = React.useState('00:00')
  const [horaFim, setHoraFim] = React.useState('06:00')
  const [minimo, setMinimo] = React.useState('1')
  const [erro, setErro] = React.useState<string | null>(null)
  const [salvando, setSalvando] = React.useState(false)
  const [agora] = React.useState(() => Date.now())

  const lista: MedicoDescanso[] = (medicos.data ?? []).filter((m) => escolhidos.includes(m.perfil_id)).map((m) => ({ perfil_id: m.perfil_id, nome: m.nome }))
  const janela = janelaDasHoras(horaInicio, horaFim, agora)
  const nMin = Number(minimo)
  const problema = janela ? conferirDivisao(lista.length, nMin, janela.inicio, janela.fim) : 'Digite a hora de início e a de fim.'
  const blocos = janela && !problema ? blocosDescanso(janela.inicio, janela.fim, nMin, lista) : []

  async function salvar() {
    if (!janela || problema) return
    setSalvando(true)
    const { error } = await supabase.rpc('dividir_descanso', {
      p_unidade: unidadeId, p_inicio: new Date(janela.inicio).toISOString(), p_fim: new Date(janela.fim).toISOString(),
      p_minimo: nMin, p_medicos: lista.map((m) => m.perfil_id),
    })
    setSalvando(false)
    if (error) { setErro(error.message); return }
    void qc.invalidateQueries({ queryKey: [CHAVE] })
    aoFechar()
  }

  return (
    <div className="flex flex-col gap-4 border-t border-fio pt-4">
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-apoio font-medium text-tinta">Quantos plantonistas: quem entra na divisão</legend>
        {medicos.isLoading && <Spinner />}
        <div className="flex flex-wrap gap-2">
          {(medicos.data ?? []).map((m) => (
            <CaixaMarcar key={m.perfil_id} marcado={escolhidos.includes(m.perfil_id)}
              onChange={(v) => setMarcados(v ? [...escolhidos, m.perfil_id] : escolhidos.filter((x) => x !== m.perfil_id))}>
              {m.nome}{m.na_escala ? '' : ' (fora da escala)'}
            </CaixaMarcar>
          ))}
        </div>
      </fieldset>
      <div className="flex flex-wrap items-end gap-4">
        <div className="flex flex-col gap-1">
          <Label htmlFor="descanso-inicio">Começa às</Label>
          <Input id="descanso-inicio" type="time" value={horaInicio} onChange={(e) => setHoraInicio(e.target.value)} className="w-[120px]" />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="descanso-fim">Termina às</Label>
          <Input id="descanso-fim" type="time" value={horaFim} onChange={(e) => setHoraFim(e.target.value)} className="w-[120px]" />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="descanso-minimo">Pelo menos acordados</Label>
          <Input id="descanso-minimo" type="number" min={1} max={Math.max(1, lista.length - 1)} value={minimo}
            onChange={(e) => setMinimo(e.target.value)} className="w-[100px]" />
        </div>
      </div>
      {janela && !problema && (
        <div className="flex flex-col gap-2">
          <p className="text-apoio text-tinta-apoio">
            {diaMesHora(janela.inicio)} às {hora(janela.fim)} · {lista.length} médicos, pelo menos {nMin} acordado{nMin > 1 ? 's' : ''}:
            {' '}cada um descansa <b className="text-tinta">{duracao(minutosDeDescanso(janela.inicio, janela.fim, nMin, lista.length))}</b>, igual para todos.
          </p>
          <Grade inicio={janela.inicio} fim={janela.fim} medicos={lista} blocos={blocos} agora={agora} />
        </div>
      )}
      {problema && <p className="text-apoio text-atencao">{problema}</p>}
      {erro && <p role="alert" className="text-apoio text-critico">{erro}</p>}
      <div className="flex gap-2">
        <Button size="sm" onClick={() => void salvar()} disabled={!!problema || salvando}>
          {salvando ? <Spinner className="size-4" /> : <Moon className="size-4" aria-hidden />} Salvar divisão
        </Button>
        <Button size="sm" variant="ghost" onClick={aoFechar}>Cancelar</Button>
      </div>
    </div>
  )
}

/**
 * Cartão do descanso. `podeDividir`: o médico de plantão divide e refaz; os
 * outros (enfermagem e gestor) só veem.
 */
export function DescansoDoPlantao({ unidadeId, podeDividir, className }: { unidadeId: string | undefined; podeDividir: boolean; className?: string }) {
  const divisao = useDivisao(unidadeId)
  const [aberto, setAberto] = React.useState(false)
  const [agora, setAgora] = React.useState(() => Date.now())
  React.useEffect(() => {
    const t = setInterval(() => setAgora(Date.now()), 60_000)
    return () => clearInterval(t)
  }, [])
  const d = divisao.data
  if (!unidadeId || divisao.error) return null
  if (!d && !podeDividir) return null

  const descansando = d ? descansandoAgora(d.blocos, agora) : new Set<string>()
  const nomes = (dorme: boolean) => (d?.medicos ?? []).filter((m) => descansando.has(m.perfil_id) === dorme).map((m) => m.nome)

  return (
    <section aria-label="Descanso dos médicos" className={cn('flex flex-col gap-3 rounded-cartao border border-fio bg-superficie p-4 shadow-repouso', className)}>
      <div className="flex flex-wrap items-center gap-2">
        <BedDouble className="size-4 text-acao" aria-hidden />
        <TituloCartao className="mb-0">Descanso dos médicos</TituloCartao>
        {d && <span className="text-apoio text-tinta-sussurro">{hora(d.inicio)} às {hora(d.fim)} · pelo menos {d.minimo_acordados} acordado{d.minimo_acordados > 1 ? 's' : ''}</span>}
        {podeDividir && !aberto && (
          <Button size="sm" variant="outline" className="ml-auto" onClick={() => setAberto(true)}>
            <Moon className="size-4" aria-hidden /> {d ? 'Refazer divisão' : 'Dividir descanso'}
          </Button>
        )}
      </div>
      {divisao.isLoading && <Spinner />}
      {d && agora >= d.inicio && agora < d.fim && (
        <p className="text-apoio text-tinta">
          <b>Descansando agora:</b> {nomes(true).join(', ') || 'ninguém'} · <b>Acordado:</b> {nomes(false).join(', ') || 'ninguém'}
        </p>
      )}
      {d && agora < d.inicio && <p className="text-apoio text-tinta-apoio">A divisão começa às {hora(d.inicio)}.</p>}
      {d && <Grade inicio={d.inicio} fim={d.fim} medicos={d.medicos} blocos={d.blocos} agora={agora} />}
      {d && <p className="text-rotulo text-tinta-sussurro">Dividido por {d.criada_por} em {diaMesHora(d.criada_em)}.</p>}
      {!d && podeDividir && !aberto && (
        <p className="text-apoio text-tinta-apoio">Ainda sem divisão para este plantão. O app divide igual entre os médicos que você marcar, respeitando o mínimo acordado.</p>
      )}
      {podeDividir && aberto && unidadeId && <Formulario unidadeId={unidadeId} aoFechar={() => setAberto(false)} />}
    </section>
  )
}
