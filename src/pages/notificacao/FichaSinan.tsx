// Ficha Individual de Notificação do SINAN, campos 1 a 33 do protótipo
// (index.html ~8255, `sinanVals`). Quem registra é quem está logado; o
// número do SINAN é opcional (a digitação no SINAN é feita à parte).
// Registrada, a ficha fica só leitura: corrigir é "Reabrir para correção",
// com motivo.
import { useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, Check, ChevronLeft, FolderOpen, Save } from 'lucide-react'
import * as React from 'react'
import { Link } from 'react-router-dom'

import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { Chip } from '@/components/monitor/Pagina'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'

import {
  avisosFicha, chaveLista, diaHora, type Campo, type Ficha, type FichaAberta, FONTE_LNNC, pendenciasFicha, prazo, SECOES, useFicha,
} from './dados'

const caixa = 'flex flex-col gap-3 rounded-cartao border border-fio bg-superficie p-4 shadow-repouso sm:px-5'
const rotuloCampo = 'text-rotulo font-medium text-grafite'

export function FichaSinan({ agravoId, onVoltar }: { agravoId: string; onVoltar: () => void }) {
  const q = useFicha(agravoId)
  if (q.isLoading) return <div className="flex h-32 items-center justify-center"><Spinner /></div>
  if (q.error || !q.data) {
    return (
      <div className="flex flex-col gap-3">
        <Voltar onClick={onVoltar} />
        <p className="text-apoio text-critico">{(q.error as Error | null)?.message ?? 'Notificação não encontrada.'}</p>
      </div>
    )
  }
  return <Formulario key={`${q.data.id}:${q.data.situacao}:${q.data.reaberto_em ?? ''}`} d={q.data} onVoltar={onVoltar} />
}

function Voltar({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="flex items-center gap-1.5 self-start text-apoio text-tinta-apoio hover:text-acao">
      <ChevronLeft className="size-3.5" aria-hidden /> Voltar aos casos
    </button>
  )
}

function Formulario({ d, onVoltar }: { d: FichaAberta; onVoltar: () => void }) {
  const qc = useQueryClient()
  const [f, setF] = React.useState<Ficha>(d.ficha ?? {})
  const [numero, setNumero] = React.useState(d.numero_sinan ?? '')
  const [motivo, setMotivo] = React.useState('')
  const [reabrindo, setReabrindo] = React.useState(false)
  const [aviso, setAviso] = React.useState<{ erro: boolean; texto: string } | null>(null)
  const [ocupado, setOcupado] = React.useState(false)
  const aberta = d.situacao === 'suspeito'
  const registrada = d.situacao === 'notificado'
  const pend = pendenciasFicha(f)
  const avisos = avisosFicha(f)
  const hoje = new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })

  const recarregar = () => {
    void qc.invalidateQueries({ queryKey: ['notificacao-ficha', d.id] })
    void qc.invalidateQueries({ queryKey: chaveLista })
    void qc.invalidateQueries({ queryKey: ['agravos'] })
    void qc.invalidateQueries({ queryKey: ['impeditivos'] })
  }
  async function acao(fn: () => PromiseLike<{ error: { message: string } | null }>, ok: string) {
    setOcupado(true)
    setAviso(null)
    const { error } = await fn()
    setOcupado(false)
    if (error) return setAviso({ erro: true, texto: error.message })
    setAviso({ erro: false, texto: ok })
    recarregar()
  }

  const fixos: { num: string; rotulo: string; valor: string; largura: number }[] = [
    { num: '1', rotulo: 'Tipo de notificação', valor: '2 – Individual', largura: 12 },
    { num: '2', rotulo: 'Agravo / doença', valor: d.agravo, largura: 8 },
    { num: '', rotulo: 'Código (CID-10)', valor: d.cid ?? 'sem CID próprio', largura: 4 },
    { num: '3', rotulo: 'Data da notificação', valor: registrada && d.registrado_em ? diaHora(d.registrado_em).slice(0, 10) : hoje, largura: 3 },
    { num: '4', rotulo: 'UF', valor: d.unidade.uf ?? '—', largura: 2 },
    { num: '5', rotulo: 'Município de notificação', valor: d.unidade.municipio ?? '—', largura: 4 },
    { num: '6', rotulo: 'Unidade de saúde', valor: d.unidade.nome, largura: 9 },
    { num: '', rotulo: 'CNES', valor: d.unidade.cnes ?? '—', largura: 3 },
  ]
  const notificador = [d.notificador.nome, d.notificador.registro
    ? `${d.notificador.conselho ?? 'Registro'} ${d.notificador.registro}${d.notificador.registro_uf ? `/${d.notificador.registro_uf}` : ''}`
    : 'registro profissional não cadastrado no login'].filter(Boolean).join(' · ')

  return (
    <div className="flex flex-col gap-4">
      <Voltar onClick={onVoltar} />

      <div className={cn(caixa, 'flex-row flex-wrap items-center gap-3.5')}>
        <div className="flex min-w-0 flex-[1_1_260px] flex-col gap-0.5">
          <span className="text-secao font-semibold text-tinta">{d.paciente_nome}</span>
          <span className="text-controle text-tinta-apoio">
            {d.agravo}{d.item ? ` · item ${d.item} da LNNC` : ''} · <b>{d.cid ?? 'sem CID próprio'}</b>
          </span>
          <span className="text-apoio text-tinta-sussurro">
            {prazo(d)}{d.destino ? ` · destino da imediata: ${d.destino}` : ''} · aberta {diaHora(d.suspeito_em)}
          </span>
        </div>
        <Situacao d={d} />
        {d.pode_abrir_paciente && (
          <Button variant="outline" size="sm" render={<Link to={`/prontuarios/${d.paciente_id}`} />} nativeButton={false}>
            <FolderOpen aria-hidden /> Abrir paciente
          </Button>
        )}
      </div>

      {d.imediata && aberta && (
        <div role="alert" className="flex items-start gap-2.5 rounded-controle border border-critico/30 bg-critico/[0.06] px-3.5 py-3">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-critico" aria-hidden />
          <span className="text-controle leading-[1.5] text-pretty text-critico">
            Notificação imediata: comunicar {d.destino || 'a vigilância epidemiológica'} em até 24 horas da suspeita, por telefone ou meio
            eletrônico, além desta ficha. ({FONTE_LNNC})
          </span>
        </div>
      )}
      {d.reaberto_em && aberta && (
        <p className="rounded-controle border border-nota bg-alerta-atencao px-3.5 py-2.5 text-apoio text-atencao">
          Reaberta para correção {diaHora(d.reaberto_em)}{d.reaberto_por ? ` por ${d.reaberto_por}` : ''}: {d.motivo_reabertura}
        </p>
      )}

      {SECOES.map((s, i) => (
        <section key={s.titulo} className={caixa} aria-label={s.titulo}>
          <h2 className="text-corpo font-semibold text-tinta">{s.titulo}</h2>
          <div className="flex flex-wrap gap-3">
            {i === 0 && fixos.map((x) => (
              <div key={x.rotulo} className="flex min-w-0 flex-col gap-1" style={{ flex: `${x.largura} 1 ${x.largura * 60}px` }}>
                <span className={rotuloCampo}>{x.num && <b className="text-acao">{x.num}</b>} {x.rotulo}</span>
                <span className="text-controle text-tinta">{x.valor}</span>
              </div>
            ))}
            {s.campos.map((c) => (
              <CampoFicha key={c.k} c={c} valor={f[c.k] ?? ''} somenteLeitura={!aberta}
                mudar={(v) => setF((x) => ({ ...x, [c.k]: v }))} />
            ))}
          </div>
        </section>
      ))}

      <section className={caixa} aria-label="Notificação no SINAN">
        <h2 className="text-corpo font-semibold text-tinta">Notificação no SINAN</h2>
        <label className="flex max-w-sm flex-col gap-1">
          <span className={rotuloCampo}>Nº da notificação no SINAN (se já digitada)</span>
          <Input value={numero} inputMode="numeric" disabled={!aberta} onChange={(e) => setNumero(e.target.value.replace(/\D/g, '').slice(0, 20))} />
        </label>
      </section>

      <section className={caixa} aria-label="Notificador">
        <h2 className="text-corpo font-semibold text-tinta">Notificador</h2>
        <span className="text-controle text-tinta">
          {registrada ? `${d.registrado_por ?? '—'} · registrada ${diaHora(d.registrado_em)}` : notificador}
        </span>
        {aberta && pend.length > 0 && (
          <div className="flex flex-col gap-0.5">
            <span className="text-apoio font-semibold text-critico">Falta para registrar</span>
            {pend.map((t) => <span key={t} className="text-apoio text-critico">{t}</span>)}
          </div>
        )}
        {aberta && avisos.length > 0 && (
          <div className="flex flex-col gap-0.5">
            <span className="text-apoio font-semibold text-atencao">Completar se tiver o dado</span>
            {avisos.map((t) => <span key={t} className="text-apoio text-atencao">{t}</span>)}
          </div>
        )}
        {d.situacao === 'descartado' && (
          <p className="text-apoio text-tinta-sussurro">Suspeita descartada: {d.motivo_descarte}</p>
        )}
        {aviso && <p role="status" className={cn('text-apoio', aviso.erro ? 'text-critico' : 'text-conforme')}>{aviso.texto}</p>}

        {registrada && reabrindo && (
          <div className="flex flex-wrap items-center gap-2">
            <Input className="min-w-60 flex-1" placeholder="Motivo da correção (mínimo de 10 letras)" value={motivo} onChange={(e) => setMotivo(e.target.value)} />
            <Button variant="ghost" size="sm" onClick={() => { setReabrindo(false); setMotivo('') }}>Cancelar</Button>
            <Button size="sm" disabled={ocupado || motivo.trim().length < 10}
              onClick={() => void acao(() => supabase.rpc('reabrir_notificacao', { p_agravo: d.id, p_motivo: motivo }), 'Notificação reaberta para correção.')}>
              Reabrir
            </Button>
          </div>
        )}
        <div className="flex flex-wrap justify-end gap-2">
          {registrada && !reabrindo && <Button variant="outline" onClick={() => setReabrindo(true)}>Reabrir para correção</Button>}
          {aberta && (
            <>
              <Button variant="outline" disabled={ocupado}
                onClick={() => void acao(() => supabase.rpc('salvar_ficha_notificacao', { p_agravo: d.id, p_ficha: f }), 'Ficha salva.')}>
                <Save aria-hidden /> Salvar ficha
              </Button>
              <Button disabled={ocupado || pend.length > 0}
                onClick={() => void acao(() => supabase.rpc('registrar_notificacao', { p_agravo: d.id, p_ficha: f, p_numero_sinan: numero || undefined }),
                  'Notificação registrada.')}>
                <Check aria-hidden /> Registrar notificação
              </Button>
            </>
          )}
        </div>
      </section>
    </div>
  )
}

function Situacao({ d }: { d: FichaAberta }) {
  const [texto, tom] = d.situacao === 'notificado'
    ? [`Notificado${d.numero_sinan ? ` · SINAN ${d.numero_sinan}` : ''}`, 'bg-conforme/10 text-conforme']
    : d.situacao === 'descartado'
      ? ['Descartado', 'bg-trilha text-tinta-apoio']
      : d.reaberto_em ? ['Reaberto', 'bg-atencao/10 text-atencao'] : ['A registrar', 'bg-atencao/10 text-atencao']
  return <span className={cn('rounded-capsula px-2.5 py-[3px] text-apoio font-semibold whitespace-nowrap', tom)}>{texto}</span>
}

function CampoFicha({ c, valor, mudar, somenteLeitura }: { c: Campo; valor: string; mudar: (v: string) => void; somenteLeitura: boolean }) {
  const id = `sinan-${c.k}`
  return (
    <div className="flex min-w-0 flex-col gap-1" style={{ flex: `${c.largura} 1 ${c.largura * 60}px` }}>
      {c.tipo === 'opc' ? (
        <>
          <span className={rotuloCampo} id={id}>{c.num && <b className="text-acao">{c.num}</b>} {c.rotulo}</span>
          {somenteLeitura ? (
            <span className="text-controle text-tinta">{c.opcoes?.find(([k]) => k === valor)?.[1] ?? '—'}</span>
          ) : (
            <div role="group" aria-labelledby={id} className="flex flex-wrap gap-1.5">
              {c.opcoes?.map(([k, r]) => <Chip key={k} ativo={valor === k} onClick={() => mudar(valor === k ? '' : k)}>{r}</Chip>)}
            </div>
          )}
        </>
      ) : (
        <>
          <label htmlFor={id} className={rotuloCampo}>{c.num && <b className="text-acao">{c.num}</b>} {c.rotulo}</label>
          <Input id={id} type={c.tipo === 'data' ? 'date' : 'text'} value={valor} disabled={somenteLeitura}
            max={c.tipo === 'data' ? new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' }) : undefined}
            onChange={(e) => mudar(e.target.value)} />
        </>
      )}
    </div>
  )
}
