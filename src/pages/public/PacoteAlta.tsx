// Pacote de alta — a página do paciente, sem login (Fase 3.6; visual do
// protótipo alta.html no porte do frontend).
// O link sozinho não mostra nada: o código de 6 dígitos impresso na orientação
// de alta é pedido a CADA abertura (nada fica guardado no aparelho, de
// propósito). Três códigos errados bloqueiam o link. SMS e WhatsApp ainda não
// estão configurados, então não há "enviar de novo": o código está no papel.
//
// Visão da equipe: /alta/equipe?pacote=<id>, aberta pelo leito com login. Pula
// o código (quem está na plataforma já se autenticou) e mostra a faixa
// "Imprimir o pacote inteiro".
import { useQuery } from '@tanstack/react-query'
import { Bird, ShieldCheck } from 'lucide-react'
import * as React from 'react'
import { useParams, useSearchParams } from 'react-router-dom'

import { DocumentosAlta } from '@/components/alta/DocumentosAlta'
import type { ConteudoPacote } from '@/components/alta/lerPacote'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { supabase } from '@/lib/supabase'

type Resposta = ConteudoPacote | { situacao: string; restantes?: number }

const RECUSA: Record<string, string> = {
  inexistente: 'Este link não existe. Confira o endereço na folha da alta.',
  revogado: 'Este link foi desativado pela unidade. Peça um novo na recepção.',
  bloqueado: 'Três códigos errados bloquearam este link. Peça um novo na unidade.',
  expirado: 'Este link venceu (vale 30 dias). Peça um novo na unidade.',
}

function Topo({ unidade }: { unidade: string }) {
  return (
    <header className="bg-acao-pressionada px-5 pb-[26px] pt-[22px] text-white print:hidden">
      <div className="mx-auto max-w-[620px]">
        <span className="flex items-center gap-[9px] text-sm font-medium opacity-90">
          <Bird className="size-[18px]" />{unidade}
        </span>
        <h1 className="mb-1.5 mt-3.5 text-[26px] leading-[1.15] font-semibold tracking-[-0.02em] max-[420px]:text-[23px]">Seus documentos de alta</h1>
        <p className="text-[15px] text-[#CFE7E3]">Guarde este link. Cada abertura pede o código de 6 dígitos impresso na sua orientação de alta.</p>
      </div>
    </header>
  )
}

function Caixa({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="mx-auto max-w-[620px] px-5 pb-[60px] pt-5" aria-labelledby="portao-titulo">
      <div className="rounded-2xl border border-fio bg-superficie px-5 py-[22px] max-[420px]:px-4">
        <span className="grid size-11 place-items-center rounded-[13px] bg-alerta-marca text-acao" aria-hidden="true">
          <ShieldCheck className="size-[22px]" />
        </span>
        <h2 id="portao-titulo" className="mb-1.5 mt-3.5 text-[21px] leading-[1.2] font-semibold tracking-[-0.02em]">{titulo}</h2>
        {children}
      </div>
    </section>
  )
}

function VisaoEquipe({ pacote }: { pacote: string }) {
  const q = useQuery({
    queryKey: ['pacote-alta-equipe', pacote],
    enabled: !!pacote,
    retry: false,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('ver_pacote_alta_equipe', { p_pacote: pacote })
      if (error) throw error
      return data as unknown as ConteudoPacote
    },
  })
  if (q.data) {
    return (
      <>
        <Topo unidade={q.data.unidade} />
        <DocumentosAlta p={q.data} equipe />
      </>
    )
  }
  return (
    <>
      <Topo unidade="Chefe Coruja" />
      <Caixa titulo="Visão da equipe">
        {q.isLoading ? (
          <Spinner />
        ) : (
          <p className="text-pretty text-tinta-apoio">
            {!pacote
              ? 'Falta o pacote no endereço. Abra pelo leito do paciente.'
              : /jwt|auth|permission/i.test(q.error?.message ?? '')
                ? 'Entre no Chefe Coruja com a sua conta e abra de novo pelo leito do paciente.'
                : (q.error?.message ?? 'Não foi possível abrir o pacote.')}
          </p>
        )}
      </Caixa>
    </>
  )
}

function VisaoPaciente({ token }: { token: string }) {
  const [codigo, setCodigo] = React.useState('')
  const [resposta, setResposta] = React.useState<Resposta | null>(null)
  const [enviando, setEnviando] = React.useState(false)
  const campo = React.useRef<HTMLInputElement>(null)

  const situacao = useQuery({
    queryKey: ['pacote-alta-situacao', token],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('situacao_pacote_alta', { p_token: token })
      if (error) throw error
      return data as unknown as { situacao: string; unidade?: string }
    },
  })

  async function conferir(c: string) {
    if (c.length < 6) {
      setResposta({ situacao: 'curto' })
      return
    }
    setEnviando(true)
    const { data, error } = await supabase.rpc('abrir_pacote_alta', { p_token: token, p_codigo: c })
    setEnviando(false)
    setCodigo('')
    setResposta(error ? { situacao: 'falha' } : (data as unknown as Resposta))
    requestAnimationFrame(() => campo.current?.focus({ preventScroll: true }))
  }

  const r = resposta
  const aberto = r?.situacao === 'ok' ? (r as ConteudoPacote) : null
  const recusa = RECUSA[r?.situacao ?? ''] ?? (situacao.data && situacao.data.situacao !== 'ativo' ? RECUSA[situacao.data.situacao] : null)
  const unidade = aberto?.unidade ?? situacao.data?.unidade ?? 'Chefe Coruja'

  if (aberto) {
    return (
      <>
        <Topo unidade={unidade} />
        <DocumentosAlta p={aberto} />
      </>
    )
  }

  const restantes = (r as { restantes?: number } | null)?.restantes
  const erro =
    r?.situacao === 'curto' ? 'Digite os 6 dígitos do código.'
      : r?.situacao === 'codigo_errado' ? (restantes === 1 ? 'Código errado. Resta 1 tentativa.' : `Código errado. Restam ${restantes} tentativas.`)
        : r?.situacao === 'falha' ? 'Sem conexão. Tente de novo.'
          : null

  return (
    <>
      <Topo unidade={unidade} />
      {recusa ? (
        <Caixa titulo="Este link não abre mais">
          <p className="text-pretty text-critico" role="alert">{recusa}</p>
          <div className="mt-[18px] border-t border-trilha pt-4 text-sm text-tinta-apoio">
            <p className="text-pretty"><b className="font-semibold text-tinta">Os documentos impressos</b> entregues na alta continuam valendo.</p>
          </div>
        </Caixa>
      ) : situacao.isLoading ? (
        <Caixa titulo="Confirme que é você"><Spinner /></Caixa>
      ) : (
        <Caixa titulo="Confirme que é você">
          <p className="mb-[18px] text-pretty text-tinta-apoio">
            O código de 6 dígitos está impresso na <b className="font-semibold text-tinta">sua orientação de alta</b>, logo abaixo deste link.
          </p>
          <form className="flex flex-col gap-2" noValidate onSubmit={(e) => { e.preventDefault(); void conferir(codigo) }}>
            <label htmlFor="codigo" className="text-sm font-medium text-tinta-apoio">Código de 6 dígitos</label>
            <input
              id="codigo"
              ref={campo}
              autoFocus
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={codigo}
              disabled={enviando}
              aria-describedby="portao-erro"
              onChange={(e) => {
                const c = e.target.value.replace(/\D/g, '').slice(0, 6)
                setCodigo(c)
                if (r && r.situacao !== 'codigo_errado' && c.length < 6) setResposta(null)
                if (c.length === 6) void conferir(c)
              }}
              className="min-h-14 w-full rounded-xl border border-fio bg-campo px-2.5 py-3 text-center indent-[0.28em] text-[27px] font-semibold tracking-[0.28em] tabular-nums text-tinta outline-none focus:border-marca focus:ring-[3px] focus:ring-marca/15 disabled:bg-trilha disabled:text-tinta-sussurro max-[420px]:text-2xl"
            />
            {erro && <p id="portao-erro" className="mt-0.5 text-pretty text-sm text-critico" role="alert">{erro}</p>}
            <Button type="submit" size="bloco" className="mt-1" disabled={enviando}>
              {enviando ? <Spinner /> : null}Ver meus documentos
            </Button>
          </form>
          <div className="mt-[18px] border-t border-trilha pt-4 text-sm text-tinta-apoio">
            <p className="text-pretty"><b className="font-semibold text-tinta">Sem celular à mão?</b> Os documentos impressos foram entregues na alta.</p>
            <p className="mt-3 text-pretty text-[13px] text-tinta-sussurro">
              O código é pedido a cada abertura: quem tiver só o link não abre sem ele. Três códigos errados bloqueiam o link.
            </p>
          </div>
        </Caixa>
      )}
    </>
  )
}

export default function PacoteAlta() {
  const { token = '' } = useParams()
  const [busca] = useSearchParams()

  React.useEffect(() => {
    const antes = document.title
    document.title = 'Seus documentos de alta · Chefe Coruja'
    return () => { document.title = antes }
  }, [])

  return (
    <div className="min-h-screen bg-campo text-base leading-[1.55] text-tinta print:bg-white">
      {token === 'equipe' ? <VisaoEquipe pacote={busca.get('pacote') ?? ''} /> : <VisaoPaciente token={token} />}
    </div>
  )
}
