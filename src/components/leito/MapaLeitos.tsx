// ─────────────────────────────────────────────────────────────────────────────
// Setores com mapa de leitos (protótipo, aba Setores da Unidade, P/index.html
// 7446–7520; D11). Em ordem fixa de prioridade: o censo com o mapa de leitos
// por setor (limite da unidade, padrão 85%), pacientes por plantonista escalado
// agora, e o que venceu e os escores em banda de alerta. O gestor lê por leito:
// nome de paciente não entra no mapa. Dados de mapa_leitos_gestor (migration
// 20261007000001).
//
// Revisão do gestor (RT, 24/11/2026): o mapa é a visão principal da
// Internação do gestor (saiu da Unidade, que ficou só configuração). Setores
// fora de internação e observação que têm leitos cadastrados (a Sala
// Vermelha, por exemplo) entram no mapa pelo status do leito; a RPC do mapa
// não os traz, e o leito deles não abre paciente.
//
// Segunda revisão (RT, 24/11/2026): o censo e a ocupação por setor eram a
// mesma informação do mapa, em lista. Ficou um bloco só: o total da unidade no
// topo e, em cada setor, os números do censo junto dos leitos. Clicar no leito
// não sai da página: quem usa o mapa abre o resumo numa gaveta (onAbrir).
// ─────────────────────────────────────────────────────────────────────────────
import { ShieldCheck } from 'lucide-react'

import { hora } from '@/lib/formato'
import { cn } from '@/lib/utils'
import { Spinner } from '@/components/ui/spinner'

import { type LeitoDoMapa, ROTULO_STATUS_LEITO, type SetorDoMapa, useMapaLeitos } from './mapaDados'

export type SecaoMapa = 'leitos' | 'medicos' | 'alertas'

const SELO = 'shrink-0 whitespace-nowrap rounded-capsula px-2 py-[3px] text-rotulo font-semibold'

function Cabeca({ titulo, resumo, tom = 'neutro' }: { titulo: string; resumo: string; tom?: 'neutro' | 'atencao' | 'critico' | 'ok' }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-3 px-1 pb-2">
      <span className="text-apoio font-semibold text-grafite">{titulo}</span>
      <span className={cn('text-apoio', tom === 'atencao' ? 'text-atencao' : tom === 'critico' ? 'text-critico' : tom === 'ok' ? 'text-conforme' : 'text-tinta-sussurro')}>{resumo}</span>
    </div>
  )
}

/** Contagem do censo: os leitos por situação e os pacientes ainda sem leito. */
function contar(leitos: LeitoDoMapa[], semLeito: number) {
  const fora = (st: string) => leitos.filter((l) => !l.ocupado && l.status === st).length
  return {
    total: leitos.length,
    ocupados: leitos.filter((l) => l.ocupado).length,
    livres: fora('livre'),
    higienizacao: fora('higienizacao'),
    bloqueados: fora('bloqueado'),
    reservados: fora('reservado'),
    semLeito,
  }
}
type Contagem = ReturnType<typeof contar>
const pct = (n: Contagem) => (n.total ? n.ocupados / n.total : 0)

export function MapaLeitos({ unidadeId, secoes = ['leitos', 'medicos', 'alertas'], onAbrir }: {
  unidadeId: string | undefined
  secoes?: SecaoMapa[]
  /** Abre o resumo do leito sem sair da página: o paciente do leito ou, sem paciente, o próprio leito. */
  onAbrir: (chave: string) => void
}) {
  const { carregando, erro, dados: m } = useMapaLeitos(unidadeId)
  if (carregando) return <div className="flex justify-center py-6"><Spinner /></div>
  if (erro) return <p className="text-apoio text-critico">{erro.message}</p>
  if (!m) return null
  const teto = Math.max(1, ...m.plantonistas.map((p) => p.pacientes))
  const nVenc = m.alertas.filter((a) => a.ordem === 0).length
  const nEsc = m.alertas.length - nVenc
  const mostrar = (s: SecaoMapa) => secoes.includes(s)

  return (
    <div className="mb-8 flex flex-col gap-6">
      {mostrar('leitos') && <CensoEMapa setores={m.setores} limite={m.limite} onAbrir={onAbrir} />}

      {mostrar('medicos') && (
        <div>
          <Cabeca titulo="Pacientes por médico" resumo="Escalados agora nos setores de internação e observação" />
          <div className="overflow-hidden rounded-cartao border border-fio bg-superficie shadow-repouso">
            {m.plantonistas.length === 0 && <p className="px-5 py-4 text-apoio text-tinta-sussurro">Nenhum médico escalado agora nesses setores.</p>}
            {m.plantonistas.map((p) => (
              <div key={`${p.perfil_id}-${p.setor}`} className="flex flex-wrap items-center gap-4 border-b border-trilha px-5 py-3 last:border-0">
                <div className="flex min-w-0 flex-[1_1_200px] flex-col gap-0.5">
                  <span className="text-corpo font-medium text-tinta">{p.nome}</span>
                  <span className="text-apoio text-tinta-sussurro">{p.setor} · até {hora(p.ate)}</span>
                </div>
                <div className="flex w-[180px] shrink-0 flex-col items-end gap-1">
                  <span className="text-secao font-semibold tabular-nums text-tinta">{p.pacientes}</span>
                  <div className="relative h-[5px] w-full rounded-capsula bg-trilha" aria-hidden>
                    <div className="absolute inset-y-0 left-0 rounded-capsula bg-grafite" style={{ width: `${Math.round((p.pacientes / teto) * 100)}%` }} />
                  </div>
                  <span className="text-rotulo text-tinta-sussurro">{p.pacientes === 1 ? 'paciente' : 'pacientes'} no setor</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {mostrar('alertas') && (
        <div>
          <Cabeca titulo="Vencidas e alertas ativos" tom={nVenc ? 'critico' : nEsc ? 'atencao' : 'ok'}
            resumo={m.alertas.length ? `${nVenc} ${nVenc === 1 ? 'pendência vencida' : 'pendências vencidas'} · ${nEsc} ${nEsc === 1 ? 'escore em alerta' : 'escores em alerta'}` : 'Nada vencido agora'} />
          <div className="cc-lista overflow-hidden rounded-cartao border border-fio bg-superficie shadow-repouso">
            {m.alertas.length === 0 && (
              <div className="flex items-center gap-2 px-5 py-4 text-apoio text-conforme">
                <ShieldCheck className="size-4" aria-hidden /> Nenhuma pendência vencida e nenhum escore em banda de alerta.
              </div>
            )}
            {m.alertas.map((a, i) => (
              <div key={i} className="flex flex-wrap items-center gap-3.5 border-b border-trilha px-5 py-3 last:border-0">
                <span className="w-16 shrink-0 text-apoio font-semibold text-acao">{a.leito}</span>
                <div className="flex min-w-0 flex-[1_1_220px] flex-col gap-0.5">
                  <span className="text-corpo text-tinta">{a.texto}</span>
                  <span className="text-apoio text-tinta-sussurro">{[a.setor, a.nota, a.prazo && `prazo ${hora(a.prazo)}`].filter(Boolean).join(' · ')}</span>
                </div>
                <span className={cn(SELO, a.ordem === 2 ? 'bg-alerta-atencao text-atencao' : 'bg-alerta-critico text-critico')}>{a.selo}</span>
                <button type="button" onClick={() => onAbrir(a.paciente_id)}
                  className="rounded-controle border border-fio px-3 py-1.5 text-apoio whitespace-nowrap text-tinta-apoio hover:border-acao hover:text-acao">
                  Ver leito
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

/** Censo e mapa num bloco só: o total da unidade e, em cada setor, os números com os leitos. */
function CensoEMapa({ setores, limite, onAbrir }: { setores: SetorDoMapa[]; limite: number; onAbrir: (chave: string) => void }) {
  const n = contar(setores.flatMap((s) => s.leitos), setores.reduce((a, s) => a + s.sem_leito, 0))
  const lim = Math.round(limite * 100)
  const acima = setores.filter((s) => s.leitos.length && pct(contar(s.leitos, 0)) >= limite)
  const resumo = n.total
    ? `${Math.round(pct(n) * 100)}% dos leitos ocupados · ${acima.length ? `${acima.map((s) => s.nome).join(' e ')} acima do limite de ${lim}%` : `nenhum setor acima do limite de ${lim}%`}`
    : 'Nenhum leito cadastrado'
  return (
    <section aria-label="Censo e mapa de leitos">
      <Cabeca titulo="Censo agora" resumo={resumo} tom={acima.length ? 'atencao' : 'neutro'} />
      <div className="overflow-hidden rounded-cartao border border-fio bg-superficie shadow-repouso">
        <div className="grid grid-cols-2 border-b border-trilha sm:grid-cols-4 lg:grid-cols-7">
          {[
            { rotulo: 'Leitos da unidade', valor: n.total },
            { rotulo: 'Ocupados', valor: n.ocupados },
            { rotulo: 'Livres', valor: n.livres, tom: n.livres === 0 && n.total > 0 ? 'text-critico' : 'text-conforme' },
            { rotulo: 'Em higienização', valor: n.higienizacao },
            { rotulo: 'Bloqueados', valor: n.bloqueados },
            { rotulo: 'Reservados', valor: n.reservados },
            { rotulo: 'Sem leito', valor: n.semLeito, tom: n.semLeito > 0 ? 'text-atencao' : undefined },
          ].map((i) => (
            <div key={i.rotulo} className="flex flex-col gap-0.5 border-trilha px-4 py-3 [&:not(:first-child)]:border-l">
              <span className="text-rotulo text-tinta-sussurro">{i.rotulo}</span>
              <span className={cn('text-secao font-semibold tabular-nums', i.tom ?? 'text-tinta')}>{i.valor}</span>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-3 border-b border-trilha bg-campo px-5 py-2.5 text-rotulo text-tinta-sussurro">
          <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-controle bg-conforme/30" />Livre</span>
          <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-controle bg-critico/30" />Ocupado</span>
          <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-controle bg-atencao/30" />Reservado</span>
          <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-controle bg-trilha" />Bloqueado ou em higienização</span>
          <span className="flex items-center gap-1.5"><span className="size-1.5 rounded-capsula bg-atencao" />Com alerta</span>
          <span className="ml-auto">Clique no leito para ver o resumo sem sair desta página</span>
        </div>

        {setores.length === 0 && <p className="px-5 py-4 text-apoio text-tinta-sussurro">Nenhum setor com leitos cadastrados.</p>}
        {setores.map((s) => <SetorNoMapa key={s.id} s={s} limite={limite} onAbrir={onAbrir} />)}
      </div>
    </section>
  )
}

function SetorNoMapa({ s, limite, onAbrir }: { s: SetorDoMapa; limite: number; onAbrir: (chave: string) => void }) {
  const n = contar(s.leitos, s.sem_leito)
  const t = pct(n)
  const cor = t >= 0.95 ? ['text-critico', 'bg-critico'] : t >= limite ? ['text-atencao', 'bg-atencao'] : ['text-conforme', 'bg-conforme']
  const numeros: { rotulo: string; valor: number; tom?: string }[] = [
    { rotulo: n.livres === 1 ? 'livre' : 'livres', valor: n.livres, tom: n.livres === 0 && n.total > 0 ? 'text-critico' : 'text-conforme' },
    { rotulo: 'em higienização', valor: n.higienizacao },
    { rotulo: n.bloqueados === 1 ? 'bloqueado' : 'bloqueados', valor: n.bloqueados },
    { rotulo: n.reservados === 1 ? 'reservado' : 'reservados', valor: n.reservados },
    { rotulo: 'sem leito', valor: n.semLeito, tom: n.semLeito > 0 ? 'text-atencao' : undefined },
  ]
  return (
    <div className="border-b border-trilha px-5 py-4 last:border-0">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-x-6 gap-y-2">
        <div className="flex min-w-0 flex-[1_1_260px] flex-col gap-1">
          <span className="text-corpo font-medium text-tinta">
            {s.nome}
            {s.pelo_status && <span className="ml-2 text-rotulo font-normal text-tinta-sussurro">pelo status do leito</span>}
          </span>
          {n.total ? (
            <p className="flex flex-wrap gap-x-3.5 gap-y-0.5 text-apoio">
              <span className="flex gap-1"><span className="font-semibold tabular-nums text-tinta">{n.ocupados} de {n.total}</span><span className="text-tinta-sussurro">ocupados</span></span>
              {numeros.map((x) => (
                <span key={x.rotulo} className={cn('flex gap-1', x.valor === 0 && 'opacity-60')}>
                  <span className={cn('font-semibold tabular-nums', x.valor ? x.tom ?? 'text-tinta' : 'text-tinta-sussurro')}>{x.valor}</span>
                  <span className="text-tinta-sussurro">{x.rotulo}</span>
                </span>
              ))}
            </p>
          ) : (
            <span className="text-apoio text-tinta-sussurro">
              Sem leitos cadastrados{s.sem_leito ? ` · ${s.sem_leito} ${s.sem_leito === 1 ? 'paciente sem leito' : 'pacientes sem leito'}` : ''}
            </span>
          )}
        </div>
        {n.total > 0 && (
          <div className="flex w-[160px] shrink-0 flex-col items-end gap-1">
            <span className={cn('text-secao font-semibold tabular-nums tracking-[-0.02em]', cor[0])}>{Math.round(t * 100)}%</span>
            <div className="relative h-[5px] w-full rounded-capsula bg-trilha" aria-hidden>
              <div className={cn('absolute inset-y-0 left-0 rounded-capsula', cor[1])} style={{ width: `${Math.min(100, Math.round(t * 100))}%` }} />
              <span className="absolute -top-0.5 -bottom-0.5 w-0.5 rounded-controle bg-tinta/35" style={{ left: `${limite * 100}%` }} />
            </div>
            <span className="text-rotulo text-tinta-sussurro">limite {Math.round(limite * 100)}%</span>
          </div>
        )}
      </div>
      {s.leitos.length > 0 && (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(64px,1fr))] gap-2">
          {s.leitos.map((l) => {
            const comAlerta = l.vencidas > 0 || (l.banda ?? 0) >= 1
            const titulo = [l.aguardando_corpo ? 'aguardando liberação do corpo' : ROTULO_STATUS_LEITO[l.status] ?? l.status, l.vencidas ? `${l.vencidas} vencida(s)` : '', (l.banda ?? 0) >= 1 ? 'escore em alerta' : ''].filter(Boolean).join(' · ')
            return (
              <button key={l.id} type="button" title={titulo} onClick={() => onAbrir(l.paciente_id ?? l.id)}
                aria-label={`Leito ${l.identificador}, ${titulo}`}
                className={cn('relative grid h-11 place-items-center rounded-controle border text-apoio font-medium tabular-nums outline-none hover:ring-2 focus-visible:ring-2 focus-visible:ring-acao/50',
                  l.ocupado ? 'border-critico/20 bg-alerta-critico text-critico hover:ring-critico/30'
                    : l.status === 'livre' ? 'border-conforme/20 bg-alerta-conforme text-conforme hover:ring-conforme/30'
                    : l.status === 'reservado' ? 'border-atencao/30 bg-alerta-atencao text-atencao hover:ring-atencao/30'
                    : 'border-fio bg-trilha text-tinta-sussurro hover:ring-fio')}>
                {l.identificador}
                {comAlerta && <span className="absolute top-1 right-1 size-1.5 rounded-capsula bg-atencao" aria-hidden />}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
