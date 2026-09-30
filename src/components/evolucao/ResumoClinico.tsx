// ─────────────────────────────────────────────────────────────────────────────
// Resumo evoluções (protótipo: aba Evolução do leito, "Resumo evoluções";
// dados do EVOL): resumo do caso e previsão de alta, antibióticos com
// movimento, dia de uso e motivo, medicações em curso, eletrólitos e
// reposição, condutas. Tudo lido do banco (resumo_clinico): antibióticos e
// medicações da prescrição da internação, eletrólitos das observações,
// condutas do "P" das evoluções. O texto livre do médico (resumo, previsão de
// alta, movimento/motivo do antibiótico) é gravado em resumos_clinicos — só
// inserção; o vigente é o mais recente.
// ─────────────────────────────────────────────────────────────────────────────
import { Activity, ArrowRight, ArrowUpRight, Pencil, Repeat, TrendingDown } from 'lucide-react'
import * as React from 'react'

import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { dataCurta, diaHora, mensagemErro, useRecarregarEvolucao, useResumoClinico, type Movimento, type ResumoClinicoDados } from './dados'
import { CampoTexto, ChipEscolha, Mensagem, RotuloSecao, type Aviso } from './pecas'

const MOV: Record<Movimento, { rotulo: string; classe: string; Icone: typeof Repeat }> = {
  escalonado: { rotulo: 'Escalonado', classe: 'bg-critico/10 text-critico', Icone: ArrowUpRight },
  descalonado: { rotulo: 'Descalonado', classe: 'bg-conforme/10 text-conforme', Icone: TrendingDown },
  mantido: { rotulo: 'Mantido', classe: 'bg-trilha text-tinta-apoio', Icone: Repeat },
}
const NOME_ELETROLITO: Record<string, string> = {
  sodio: 'Sódio', potassio: 'Potássio', magnesio: 'Magnésio', 'calcio-total': 'Cálcio total', cloro: 'Cloro', fosforo: 'Fósforo', bicarbonato: 'Bicarbonato',
}
const SEXO: Record<string, string> = { M: 'Masculino', F: 'Feminino', I: 'Sexo ignorado' }

export function ResumoClinico({ pacienteId, internacaoId }: { pacienteId: string; internacaoId: string }) {
  const q = useResumoClinico(internacaoId)
  const [editando, setEditando] = React.useState(false)
  if (q.isLoading) return <Casca><span className="flex items-center gap-2 px-4 py-3.5 text-apoio text-tinta-sussurro"><Spinner /> Carregando o resumo…</span></Casca>
  if (q.error || !q.data) return <Casca><div className="p-4"><Mensagem aviso={{ erro: true, texto: 'Não foi possível abrir o resumo: ' + mensagemErro(q.error) }} /></div></Casca>
  const r = q.data
  const sexo = r.sexo ? SEXO[r.sexo] ?? r.sexo : null
  const internado = r.dih <= 1 ? 'admissão hoje' : `${r.dih - 1} ${r.dih - 1 === 1 ? 'dia' : 'dias'} de internação`

  return (
    <Casca contexto={[sexo, internado].filter(Boolean).join(' · ')}>
      <div className="flex flex-col gap-2 border-b border-fio px-4 py-3.5">
        {editando
          ? <EditarResumo r={r} internacaoId={internacaoId} pacienteId={pacienteId} aoFechar={() => setEditando(false)} />
          : (
            <>
              <div className="flex items-start gap-2">
                <span className="min-w-0 flex-1 text-corpo leading-[1.55] text-pretty text-tinta">
                  {r.resumo?.texto ?? <span className="text-tinta-sussurro">Sem resumo do caso ainda.</span>}
                </span>
                {r.pode_registrar && (
                  <Button variant="ghost" size="sm" onClick={() => setEditando(true)}><Pencil /> {r.resumo ? 'Atualizar' : 'Escrever'}</Button>
                )}
              </div>
              {r.resumo?.previsao_alta && (
                <span className="flex items-center gap-[7px] text-apoio text-acao"><ArrowRight className="size-3.5" aria-hidden />Alta: {r.resumo.previsao_alta}</span>
              )}
              {r.resumo && <span className="text-rotulo text-tinta-sussurro">{r.resumo.autor ?? '—'} · {diaHora(r.resumo.criado_em)}</span>}
            </>
          )}
      </div>

      <div className="flex flex-col gap-2.5 border-b border-fio px-4 py-3.5">
        <RotuloSecao>Antibióticos</RotuloSecao>
        {r.antibioticos.map((ab) => {
          const m = ab.movimento ? MOV[ab.movimento] : null
          return (
            <div key={ab.item_id} className={cn('flex flex-col gap-1 rounded-bloco border border-fio bg-superficie px-[13px] py-[11px]', !ab.em_curso && 'opacity-70')}>
              <div className="flex flex-wrap items-center gap-[9px]">
                <span className="text-controle font-medium text-tinta">{ab.nome}</span>
                {m && <span className={cn('inline-flex items-center gap-[5px] rounded-capsula px-[9px] py-[3px] text-rotulo font-semibold whitespace-nowrap', m.classe)}><m.Icone className="size-3" aria-hidden />{m.rotulo}</span>}
                {!ab.em_curso && <span className="rounded-capsula bg-trilha px-[9px] py-[3px] text-rotulo font-semibold text-tinta-apoio">Suspenso {dataCurta(ab.suspenso_em)}</span>}
                <span className="tabular text-rotulo text-tinta-sussurro">D{ab.dia} · início {diaHora(ab.inicio)}</span>
              </div>
              {(ab.motivo || ab.motivo_suspensao) && <span className="text-apoio leading-[1.5] text-pretty text-tinta-apoio">{ab.motivo ?? ab.motivo_suspensao}</span>}
            </div>
          )
        })}
        {r.antibioticos.length === 0 && <span className="text-apoio text-tinta-sussurro">Sem antibiótico nesta internação.</span>}
      </div>

      <div className="grid grid-cols-1 border-b border-fio sm:grid-cols-2">
        <div className="flex flex-col gap-[9px] border-fio px-4 py-3.5 max-sm:border-b sm:border-r">
          <RotuloSecao>Medicações em curso</RotuloSecao>
          {r.medicacoes.map((md) => (
            <div key={md.item_id} className="flex flex-col gap-px">
              <span className="text-controle text-tinta">{md.nome}</span>
              <span className="text-rotulo text-tinta-sussurro">{[md.via, `desde ${dataCurta(md.desde)}`].filter(Boolean).join(' · ')}</span>
            </div>
          ))}
          {r.medicacoes.length === 0 && <span className="text-apoio text-tinta-sussurro">{r.ativa ? 'Nenhum item na prescrição vigente.' : 'Internação encerrada.'}</span>}
        </div>
        <div className="flex flex-col gap-[9px] px-4 py-3.5">
          <RotuloSecao>Eletrólitos e reposição</RotuloSecao>
          {r.eletrolitos.map((el) => (
            <div key={`${el.nome}-${el.aferido_em}`} className="flex items-baseline gap-[9px]">
              <span className={cn('tabular text-corpo font-semibold tracking-[-0.01em]', el.flag === 'CRIT' ? 'text-critico' : el.flag === 'N' ? 'text-tinta' : 'text-observacao')}>
                {el.valor}{el.unidade ? ` ${el.unidade}` : ''}
              </span>
              <div className="flex min-w-0 flex-col gap-px">
                <span className="text-apoio font-medium text-tinta">{NOME_ELETROLITO[el.nome] ?? el.nome}</span>
                <span className="text-rotulo text-tinta-sussurro">{diaHora(el.aferido_em)}</span>
              </div>
            </div>
          ))}
          {r.eletrolitos.length === 0 && <span className="text-apoio text-tinta-sussurro">Sem eletrólito dosado nesta internação.</span>}
          {r.reposicoes.map((rp) => (
            <div key={rp.item_id} className="flex flex-col gap-px border-l-2 border-observacao/40 pl-2.5">
              <span className="text-apoio text-tinta">Reposição: {rp.nome}</span>
              <span className="text-rotulo text-tinta-sussurro">{[rp.via, `desde ${dataCurta(rp.desde)}`, rp.suspenso_em ? `suspensa ${dataCurta(rp.suspenso_em)}` : null].filter(Boolean).join(' · ')}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-[11px] px-4 py-3.5">
        <RotuloSecao>Condutas</RotuloSecao>
        {r.condutas.map((c, k) => (
          <div key={`${c.quando}-${k}`} className="grid grid-cols-[8px_minmax(0,1fr)] gap-[11px]">
            <span className={cn('mt-1.5 size-2 rounded-full', k === 0 ? 'bg-marca' : 'bg-fio-forte')} />
            <div className="flex min-w-0 flex-col gap-0.5">
              <span className={cn('text-controle leading-[1.5] text-pretty whitespace-pre-wrap', k === 0 ? 'text-tinta' : 'text-tinta-apoio')}>{c.texto}</span>
              <span className="tabular text-rotulo text-tinta-sussurro">{diaHora(c.quando)} · {c.quem ?? '—'}</span>
            </div>
          </div>
        ))}
        {r.condutas.length === 0 && <span className="text-apoio text-tinta-sussurro">As condutas aparecem aqui a partir do plano (P) das evoluções médicas.</span>}
      </div>
    </Casca>
  )
}

function Casca({ children, contexto }: { children: React.ReactNode; contexto?: string }) {
  return (
    <section aria-label="Resumo evoluções" className="overflow-hidden rounded-menu border border-fio bg-campo">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-fio px-4 py-3">
        <span className="flex items-center gap-2 text-apoio font-semibold tracking-[0.05em] text-tinta-sussurro uppercase">
          <Activity className="size-[15px] text-marca" aria-hidden /> Resumo evoluções
        </span>
        {contexto && <span className="text-apoio text-tinta-apoio">{contexto}</span>}
      </div>
      {children}
    </section>
  )
}

function EditarResumo({ r, internacaoId, pacienteId, aoFechar }: { r: ResumoClinicoDados; internacaoId: string; pacienteId: string; aoFechar: () => void }) {
  const recarregar = useRecarregarEvolucao(internacaoId, pacienteId)
  const emCurso = r.antibioticos.filter((a) => a.em_curso)
  const [texto, setTexto] = React.useState(r.resumo?.texto ?? '')
  const [alta, setAlta] = React.useState(r.resumo?.previsao_alta ?? '')
  const [atb, setAtb] = React.useState<Record<string, { movimento: Movimento | ''; motivo: string }>>(() =>
    Object.fromEntries(emCurso.map((a) => [a.item_id, { movimento: a.movimento ?? '', motivo: a.motivo ?? '' }])))
  const [salvando, setSalvando] = React.useState(false)
  const [aviso, setAviso] = React.useState<Aviso>(null)

  async function salvar() {
    setSalvando(true)
    const lista = Object.entries(atb).filter(([, v]) => v.movimento).map(([item_id, v]) => ({ item_id, movimento: v.movimento, motivo: v.motivo }))
    const { error } = await supabase.rpc('registrar_resumo_clinico', {
      p_internacao: internacaoId, p_resumo: texto, p_previsao_alta: alta, p_antibioticos: lista,
    })
    setSalvando(false)
    if (error) return setAviso({ erro: true, texto: error.message })
    recarregar()
    aoFechar()
  }

  return (
    <fieldset className="flex flex-col gap-3" disabled={salvando}>
      <CampoTexto id="resumo-texto" rotulo="Resumo do caso" linhas={3} valor={texto} onValor={setTexto}
        placeholder="Diagnóstico, gravidade na entrada, evolução até aqui" />
      <label className="flex flex-col gap-[5px]">
        <span className="text-apoio font-medium text-grafite">Previsão de alta</span>
        <Input value={alta} onChange={(e) => setAlta(e.target.value)} placeholder="Provável em 48 h se mantiver sem oxigênio e aceitar via oral." />
      </label>
      {emCurso.map((a) => {
        const v = atb[a.item_id] ?? { movimento: '', motivo: '' }
        const setV = (p: Partial<typeof v>) => setAtb((x) => ({ ...x, [a.item_id]: { ...v, ...p } }))
        return (
          <div key={a.item_id} className="flex flex-col gap-1.5 rounded-bloco border border-fio bg-superficie p-3">
            <span className="text-controle font-medium text-tinta">{a.nome} <span className="font-normal text-tinta-sussurro">· D{a.dia}</span></span>
            <div className="flex flex-wrap gap-1.5">
              {(Object.keys(MOV) as Movimento[]).map((m) => (
                <ChipEscolha key={m} ativo={v.movimento === m} onClick={() => setV({ movimento: v.movimento === m ? '' : m })}>{MOV[m].rotulo}</ChipEscolha>
              ))}
            </div>
            {v.movimento && (
              <Input value={v.motivo} onChange={(e) => setV({ motivo: e.target.value })}
                placeholder={v.movimento === 'mantido' ? 'Motivo (opcional)' : 'Por quê? (obrigatório para escalonar ou descalonar)'} />
            )}
          </div>
        )
      })}
      <Mensagem aviso={aviso} />
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={aoFechar}>Cancelar</Button>
        <Button onClick={() => void salvar()} disabled={texto.trim().length < 10}>{salvando && <Spinner />} Salvar resumo</Button>
      </div>
    </fieldset>
  )
}
