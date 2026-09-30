// Pendências do leito no desenho do protótipo (index.html 2760–2807): o que
// ficou combinado, com prazo; vencida em vermelho; concluir com "desfazer".
import { ClipboardList, ClipboardPlus, Check, ShieldCheck, Undo2 } from 'lucide-react'
import * as React from 'react'

import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

import { Caixa, CaixaCabeca, Chip } from './caixas'
import { type Acao, diaHora, hora, type Pendencia, rpc, TIPO_PENDENCIA } from './comum'

const PRAZOS = [
  ['1h', '1 hora'],
  ['2h', '2 horas'],
  ['4h', '4 horas'],
  ['fim_plantao', 'Fim do plantão'],
  ['sem_prazo', 'Sem prazo'],
] as const

export function BlocoPendencias({ internacaoId, ativa, lista, eu, acao }: {
  internacaoId: string; ativa: boolean; lista: Pendencia[]; eu?: string; acao: Acao
}) {
  const [aberto, setAberto] = React.useState(false)
  const [tipo, setTipo] = React.useState('reavaliacao')
  const [prazo, setPrazo] = React.useState('fim_plantao')
  const [texto, setTexto] = React.useState('')
  const [desfazer, setDesfazer] = React.useState<string | null>(null)
  const [agora, setAgora] = React.useState(() => Date.now())
  React.useEffect(() => {
    const t = setInterval(() => setAgora(Date.now()), 30_000)
    return () => clearInterval(t)
  }, [])
  React.useEffect(() => {
    if (!desfazer) return
    const t = setTimeout(() => setDesfazer(null), 8000)
    return () => clearTimeout(t)
  }, [desfazer])

  const vencida = (p: Pendencia) => !!p.prazo && Date.parse(p.prazo) < agora
  const abertas = lista
    .filter((p) => p.situacao === 'aberta')
    .sort((a, b) => (a.prazo ? Date.parse(a.prazo) : Infinity) - (b.prazo ? Date.parse(b.prazo) : Infinity))
  const resolvidas = lista.filter((p) => p.situacao !== 'aberta').slice(-5).reverse()
  const nVencidas = abertas.filter(vencida).length
  const resumo = abertas.length === 0
    ? 'Nenhuma pendência neste leito'
    : nVencidas
      ? `${nVencidas} ${nVencidas === 1 ? 'vencida' : 'vencidas'} de ${abertas.length}`
      : `${abertas.length} ${abertas.length === 1 ? 'pendência' : 'pendências'}`

  return (
    <Caixa>
      <CaixaCabeca
        icone={<ClipboardList className="size-[15px] text-marca" aria-hidden />}
        titulo="Pendências"
        resumo={resumo}
        resumoClasse={nVencidas ? 'text-critico' : undefined}
        acao={ativa && !aberto ? (
          <button type="button" onClick={() => setAberto(true)}
            className="flex items-center gap-1.5 rounded-[9px] border border-fio bg-superficie px-[11px] py-1.5 text-apoio font-medium whitespace-nowrap text-tinta-apoio hover:border-marca hover:text-acao">
            <ClipboardPlus className="size-3.5" aria-hidden /> Nova pendência
          </button>
        ) : undefined}
      />

      {abertas.map((p) => {
        const v = vencida(p)
        return (
          <div key={p.id} className="flex flex-wrap items-start gap-[11px] border-b border-fio bg-superficie px-4 py-3">
            <span className={cn('rounded-capsula px-2 py-[3px] text-[12px] font-semibold tracking-[0.04em] whitespace-nowrap uppercase',
              v ? 'bg-critico/[0.08] text-critico' : p.tipo === 'observacao' ? 'bg-atencao/[0.08] text-atencao' : 'bg-trilha text-tinta-apoio')}>
              {TIPO_PENDENCIA[p.tipo] ?? p.tipo}
            </span>
            <div className="flex min-w-0 flex-[1_1_220px] flex-col gap-0.5">
              <span className="text-corpo leading-[1.45] text-pretty text-tinta">{p.descricao}</span>
              <span className="text-apoio text-tinta-sussurro">
                {p.autor_id === null ? 'Aberta pelo sistema' : p.autor_id === eu ? 'Pedida por você' : 'Pedida pela equipe'} · {diaHora(p.criada_em)}
                {p.impeditiva ? ' · impede a alta' : ''}
              </span>
            </div>
            <span className={cn('text-apoio whitespace-nowrap tabular-nums', v ? 'font-semibold text-critico' : 'text-tinta-sussurro')}>
              {p.prazo ? `${v ? 'vencida desde' : 'até'} ${hora(p.prazo)}` : 'sem prazo'}
            </span>
            {ativa && p.tipo !== 'observacao' && (
              <button type="button" onClick={() => void acao(() => rpc('concluir_pendencia', { p_pendencia: p.id })).then((r) => r !== null && setDesfazer(p.id))}
                className="flex items-center gap-1.5 rounded-[9px] border border-fio bg-superficie px-[11px] py-1.5 text-apoio font-medium whitespace-nowrap text-tinta-apoio hover:border-conforme hover:text-conforme">
                <Check className="size-3.5" aria-hidden /> Concluir
              </button>
            )}
          </div>
        )
      })}

      {abertas.length === 0 && (
        <div className="flex items-center gap-2 border-b border-fio bg-superficie px-4 py-3.5">
          <ShieldCheck className="size-[15px] text-conforme" aria-hidden />
          <span className="text-apoio text-conforme">Nada combinado em aberto para este leito.</span>
        </div>
      )}

      {desfazer && (
        <div className="flex items-center gap-2 border-b border-fio bg-superficie px-4 py-2 text-apoio text-tinta-sussurro">
          Pendência concluída.
          <Button size="xs" variant="ghost" onClick={() => void acao(() => rpc('desfazer_pendencia', { p_pendencia: desfazer })).then(() => setDesfazer(null))}>
            <Undo2 /> Desfazer
          </Button>
        </div>
      )}

      {ativa && aberto && (
        <div className="flex flex-col gap-2.5 bg-superficie px-4 py-3.5">
          <div className="flex flex-wrap gap-[7px]" role="radiogroup" aria-label="Tipo da pendência">
            {Object.entries(TIPO_PENDENCIA).filter(([k]) => k !== 'observacao').map(([k, r]) => (
              <Chip key={k} forte role="radio" aria-checked={tipo === k} ativo={tipo === k} onClick={() => setTipo(k)}>{r}</Chip>
            ))}
          </div>
          <input value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="O que precisa ser feito neste leito"
            aria-label="Descrição da pendência"
            className="w-full rounded-[10px] border border-fio bg-campo px-3 py-2.5 text-corpo text-tinta outline-none focus:border-marca" />
          <div className="flex flex-wrap gap-[7px]" role="radiogroup" aria-label="Prazo">
            {PRAZOS.map(([k, r]) => (
              <Chip key={k} role="radio" aria-checked={prazo === k} ativo={prazo === k} onClick={() => setPrazo(k)}>{r}</Chip>
            ))}
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <span className="mr-auto text-apoio text-tinta-sussurro">Parecer sem resposta impede a alta. A observação se resolve com a conduta: alta ou internação.</span>
            <Button size="sm" variant="outline" onClick={() => { setAberto(false); setTexto('') }}>Cancelar</Button>
            <Button size="sm" disabled={texto.trim().length < 3}
              onClick={() => void acao(() => rpc('registrar_pendencia', { p_internacao: internacaoId, p_tipo: tipo, p_descricao: texto, p_prazo: prazo }))
                .then((r) => { if (r !== null) { setTexto(''); setAberto(false) } })}>
              <ClipboardPlus /> Registrar
            </Button>
          </div>
        </div>
      )}

      {resolvidas.length > 0 && (
        <details className="bg-superficie px-4 py-2.5 text-apoio text-tinta-sussurro">
          <summary className="cursor-pointer">Resolvidas ({resolvidas.length})</summary>
          {resolvidas.map((p) => (
            <div key={p.id} className="py-0.5">
              {TIPO_PENDENCIA[p.tipo] ?? p.tipo} · {p.descricao} · {p.situacao} {diaHora(p.resolvida_em)}
            </div>
          ))}
        </details>
      )}
    </Caixa>
  )
}
