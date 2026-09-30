// Peças de tela dos documentos da porta e da internação, no desenho do
// protótipo (Documentos do Atendimento.dc.html): cartão com cabeçalho, blocos
// numerados, campo de leitura (o que vem do cadastro), pílulas de opção,
// lista de sugestões e o quadro "Falta para emitir".
import { AlertTriangle, CheckCircle2, Clock, Loader2, Upload, X } from 'lucide-react'
import * as React from 'react'

import { cn } from '@/lib/utils'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import type { AnexoLaudo } from './leituraLaudo'

export function Cartao({ icone, titulo, acoes, children, className, corpo = true }: {
  icone?: React.ReactNode; titulo: React.ReactNode; acoes?: React.ReactNode; children: React.ReactNode; className?: string
  /** false: o conteúdo decide o próprio espaçamento (listas com divisória). */
  corpo?: boolean
}) {
  return (
    <section className={cn('overflow-hidden rounded-cartao border border-fio bg-superficie shadow-repouso', className)}>
      <div className="flex flex-wrap items-center gap-2.5 border-b border-trilha px-5 py-[13px]">
        {icone && <span className="text-marca [&_svg]:size-4" aria-hidden>{icone}</span>}
        <h2 className="text-corpo font-semibold text-tinta">{titulo}</h2>
        {acoes && <div className="ml-auto flex flex-wrap items-center gap-1.5">{acoes}</div>}
      </div>
      {corpo ? <div className="flex flex-col gap-[22px] px-5 py-[18px]">{children}</div> : children}
    </section>
  )
}

export function Bloco({ num, titulo, nota, acao, children }: {
  num?: string; titulo: string; nota?: React.ReactNode; acao?: React.ReactNode; children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex flex-wrap items-baseline gap-2">
        {num && <span className="text-rotulo font-bold tabular-nums text-acao">{num}</span>}
        <h3 className="text-apoio font-semibold tracking-[0.04em] text-grafite uppercase">{titulo}</h3>
        {acao && <div className="ml-auto">{acao}</div>}
      </div>
      {nota && <p className="text-apoio text-pretty text-tinta-sussurro">{nota}</p>}
      <div className="flex flex-wrap gap-3">{children}</div>
    </div>
  )
}

/** Largura no fluxo do protótipo: 'cheio' 100%, 'medio' ~240px, 'curto' ~140px. */
const LARGURA = { cheio: 'basis-full', medio: 'flex-[1_1_240px]', curto: 'flex-[1_1_140px]', mini: 'flex-[0_1_100px]' } as const
export type Largura = keyof typeof LARGURA

export function Leitura({ rotulo, valor, largura = 'medio' }: { rotulo: string; valor?: string | null; largura?: Largura }) {
  const v = (valor ?? '').trim()
  return (
    <div className={cn('flex min-w-0 flex-col gap-[3px]', LARGURA[largura])}>
      <span className="text-apoio font-medium text-grafite">{rotulo}</span>
      <span className={cn('text-corpo break-words', v ? 'text-tinta' : 'text-tinta-sussurro')}>{v || '—'}</span>
    </div>
  )
}

export function Campo({ id, rotulo, largura = 'medio', extra, children, ajuda }: {
  id?: string; rotulo: string; largura?: Largura; extra?: React.ReactNode; children: React.ReactNode; ajuda?: React.ReactNode
}) {
  return (
    <div className={cn('flex min-w-0 flex-col gap-[5px]', LARGURA[largura])}>
      <div className="flex flex-wrap items-center gap-2.5">
        <label htmlFor={id} className="text-apoio font-medium text-grafite">{rotulo}</label>
        {extra && <div className="ml-auto flex items-center gap-2">{extra}</div>}
      </div>
      {children}
      {ajuda && <span className="text-rotulo text-pretty text-tinta-sussurro">{ajuda}</span>}
    </div>
  )
}

export function Texto({ id, rotulo, valor, onChange, dica, largura, longo, linhas = 4, tipo = 'text', extra, ajuda, onBlur, onFocus, inputMode, children, ...rest }: {
  id: string; rotulo: string; valor: string; onChange: (v: string) => void; dica?: string; largura?: Largura
  longo?: boolean; linhas?: number; tipo?: string; extra?: React.ReactNode; ajuda?: React.ReactNode
  onBlur?: () => void; onFocus?: () => void; inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode']
  children?: React.ReactNode
} & Pick<React.TextareaHTMLAttributes<HTMLTextAreaElement>, 'onDragOver' | 'onDragLeave' | 'onDrop' | 'onPaste'>) {
  return (
    <Campo id={id} rotulo={rotulo} largura={largura ?? (longo ? 'cheio' : 'medio')} extra={extra} ajuda={ajuda}>
      {longo ? (
        <Textarea id={id} value={valor} rows={linhas} placeholder={dica} onChange={(e) => onChange(e.target.value)} onBlur={onBlur}
          className="min-h-0 resize-y text-corpo leading-relaxed md:text-corpo" style={{ minHeight: `${linhas * 1.6 + 1}em` }} {...rest} />
      ) : (
        <Input id={id} type={tipo} value={valor} placeholder={dica} inputMode={inputMode} onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur} onFocus={onFocus} className="md:text-corpo" />
      )}
      {children}
    </Campo>
  )
}

export function Pilulas<V extends string>({ opcoes, valor, onChange, rotulos, rotuloAria }: {
  opcoes: readonly V[]; valor: V | '' | undefined; onChange: (v: V) => void; rotulos?: Partial<Record<V, string>>; rotuloAria?: string
}) {
  return (
    <div role="group" aria-label={rotuloAria} className="flex flex-wrap gap-[7px]">
      {opcoes.map((o) => (
        <button key={o} type="button" aria-pressed={valor === o} onClick={() => onChange(o)}
          className={cn('rounded-capsula border px-[13px] py-1.5 text-apoio transition-colors',
            valor === o ? 'border-acao bg-acao font-medium text-white' : 'border-fio bg-superficie text-tinta-apoio hover:border-marca hover:text-acao')}>
          {rotulos?.[o] ?? o}
        </button>
      ))}
    </div>
  )
}

export function Chip({ ativo, onClick, children, titulo, tom = 'acao', desabilitado }: {
  ativo?: boolean; onClick: () => void; children: React.ReactNode; titulo?: string; tom?: 'acao' | 'suave'; desabilitado?: boolean
}) {
  return (
    <button type="button" aria-pressed={!!ativo} title={titulo} onClick={onClick} disabled={desabilitado}
      className={cn('flex items-center gap-1.5 rounded-capsula border px-[13px] py-1.5 text-left text-apoio transition-colors disabled:cursor-not-allowed',
        ativo
          ? tom === 'acao' ? 'border-acao bg-acao font-medium text-white' : 'border-marca bg-alerta-marca font-medium text-acao'
          : 'border-fio bg-superficie text-tinta-apoio hover:border-marca hover:text-acao')}>
      {children}
    </button>
  )
}

/** Lista suspensa de sugestões (CID, SIGTAP, especialidade, procedência). */
export function Sugestoes({ itens, aoEscolher }: {
  itens: { chave: string; codigo?: string; nome: string }[]; aoEscolher: (i: number) => void
}) {
  if (!itens.length) return null
  return (
    <div className="relative z-30 h-0">
      <div role="listbox" className="absolute inset-x-0 top-0 flex max-h-[260px] flex-col overflow-y-auto rounded-controle border border-fio bg-superficie shadow-popover">
        {itens.map((s, i) => (
          <button key={s.chave} type="button" role="option" aria-selected={false} onMouseDown={(e) => e.preventDefault()} onClick={() => aoEscolher(i)}
            className="flex w-full items-baseline gap-2.5 border-b border-trilha px-3 py-2 text-left text-controle text-tinta last:border-0 hover:bg-alerta-marca">
            {s.codigo && <span className="shrink-0 font-semibold tabular-nums text-acao">{s.codigo}</span>}
            <span className="min-w-0 flex-1">{s.nome}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

export function Pendencias({ itens, titulo = 'Falta para emitir' }: { itens: string[]; titulo?: string }) {
  if (!itens.length) return null
  return (
    <div role="status" className="flex flex-col gap-[7px]">
      <span className="text-rotulo font-semibold tracking-[0.05em] text-tinta-sussurro uppercase">{titulo}</span>
      <div className="flex flex-col gap-[5px]">
        {itens.map((t) => (
          <span key={t} className="flex items-start gap-[7px] text-apoio text-pretty text-atencao">
            <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden /> <span>{t}</span>
          </span>
        ))}
      </div>
    </div>
  )
}

export function Aviso({ children, tom = 'atencao', acao }: { children: React.ReactNode; tom?: 'atencao' | 'critico' | 'marca'; acao?: React.ReactNode }) {
  return (
    <div role="status" className={cn('flex flex-wrap items-start gap-2.5 rounded-container border px-3.5 py-3',
      tom === 'critico' ? 'border-critico/30 bg-alerta-critico text-critico'
        : tom === 'marca' ? 'border-marca/30 bg-alerta-marca text-acao'
        : 'border-[#FDE68A] bg-[#FFFBEB] text-atencao')}>
      <AlertTriangle className="mt-px size-4 shrink-0" aria-hidden />
      <span className="min-w-0 flex-[1_1_260px] text-apoio text-pretty">{children}</span>
      {acao}
    </div>
  )
}

/** Rodapé de emissão: pendências, mensagem, rascunho salvo e o botão. */
export function Rodape({ pendencias, tituloPendencias, mensagem, salvoEm, servidorSalvoEm, children }: {
  pendencias: string[]; tituloPendencias?: string; mensagem: string; salvoEm: string | null; servidorSalvoEm?: Date | null; children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-3.5 rounded-cartao border border-fio bg-superficie px-5 py-3.5 shadow-repouso">
      <Pendencias itens={pendencias} titulo={tituloPendencias} />
      <div className="flex flex-wrap items-center justify-between gap-3.5">
        <div className="flex min-w-0 flex-col gap-[3px]">
          <span className="flex items-center gap-[7px] text-apoio text-pretty text-tinta-sussurro">
            {pendencias.length ? <AlertTriangle className="size-3.5 shrink-0" aria-hidden /> : <CheckCircle2 className="size-3.5 shrink-0 text-conforme" aria-hidden />}
            {mensagem}
          </span>
          <span className="flex items-center gap-[7px] text-rotulo text-tinta-sussurro/80">
            <Clock className="size-[13px]" aria-hidden />
            {servidorSalvoEm
              ? `Rascunho salvo no servidor às ${servidorSalvoEm.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`
              : salvoEm ? `Rascunho salvo neste aparelho às ${salvoEm}` : 'O rascunho fica salvo neste aparelho, por paciente, e no servidor ao escrever.'}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">{children}</div>
      </div>
    </div>
  )
}

/** Botão de anexar laudo, a área de soltar e a lista dos anexos lidos. */
export function AnexosLaudo({ anexos, lendo, arrastando, onArquivos, onRemover, onUsar, id }: {
  anexos: AnexoLaudo[]; lendo: boolean; arrastando: boolean; onArquivos: (fs: File[]) => void; onRemover: (id: string) => void
  onUsar: (id: string) => void; id: string
}) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="sr-only">Anexar laudo</label>
      <input id={id} type="file" accept=".pdf,application/pdf,image/*" multiple className="hidden"
        onChange={(e) => { onArquivos(Array.from(e.target.files ?? [])); e.target.value = '' }} />
      {arrastando && (
        <span className="flex items-center gap-[7px] rounded-controle border border-dashed border-marca bg-alerta-marca px-3 py-2 text-apoio text-acao">
          <Upload className="size-3.5" aria-hidden /> Solte aqui: o laudo é lido no aparelho e os pontos principais entram no campo, para conferir.
        </span>
      )}
      {lendo && <span className="flex items-center gap-1.5 text-apoio text-tinta-sussurro"><Loader2 className="size-3.5 animate-spin" /> Lendo o laudo no aparelho…</span>}
      {anexos.map((a) => (
        <span key={a.id} className={cn('flex items-start gap-2 rounded-controle-sm px-2.5 py-1.5 text-apoio',
          a.estado === 'ok' ? 'bg-alerta-conforme text-conforme' : a.estado === 'lendo' ? 'bg-trilha text-tinta-apoio' : 'bg-alerta-atencao text-atencao')}>
          {a.estado === 'ok' ? <CheckCircle2 className="mt-px size-[13px] shrink-0" aria-hidden /> : <AlertTriangle className="mt-px size-[13px] shrink-0" aria-hidden />}
          <span className="min-w-0 flex-1 text-pretty">
            <strong className="font-semibold">{a.nome}</strong> · {a.estado === 'ok' ? 'pontos principais no campo, confira'
              : a.estado === 'nome-diferente' ? 'o nome do paciente não aparece neste laudo. Confira antes de usar.' : a.resumo}
            {a.estado === 'nome-diferente' && (
              <button type="button" className="ml-2 font-medium underline underline-offset-2" onClick={() => onUsar(a.id)}>É deste paciente: usar</button>
            )}
          </span>
          <button type="button" aria-label={`Remover ${a.nome}`} onClick={() => onRemover(a.id)} className="shrink-0 hover:text-critico"><X className="size-3.5" /></button>
        </span>
      ))}
    </div>
  )
}

export function BotaoAnexar({ htmlFor }: { htmlFor: string }) {
  return (
    <label htmlFor={htmlFor} title="Envie o PDF ou a foto do laudo. O texto é lido no aparelho e os pontos principais entram no campo, para conferir."
      className="flex cursor-pointer items-center gap-1.5 rounded-capsula border border-fio bg-superficie px-3 py-[5px] text-apoio text-acao hover:border-marca">
      <Upload className="size-3.5" aria-hidden /> Anexar laudo (PDF ou imagem)
    </label>
  )
}
