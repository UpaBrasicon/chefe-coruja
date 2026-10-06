import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Copy, LifeBuoy, ShieldOff } from 'lucide-react'
import * as React from 'react'

import { supabase } from '@/lib/supabase'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Spinner } from '@/components/ui/spinner'
import { Textarea } from '@/components/ui/textarea'

// Fase 0, tarefa 1 (migration 20261023000001): 10 códigos de recuperação de
// uso único, para quem perdeu o acesso ao email e ao autenticador; e o reset do
// segundo fator, feito só pelo gestor da unidade da pessoa ou pelo super admin.

type RespostaCodigo = {
  ok: boolean
  motivo?: 'invalido' | 'bloqueado' | 'sessao'
  restantes?: number
  bloqueado_ate?: string
  codigos_restantes?: number
}

/** Portão: confirma a sessão com um código de recuperação. */
export function UsarCodigoRecuperacao({ onPronto }: { onPronto: () => void }) {
  const [codigo, setCodigo] = React.useState('')
  const [erro, setErro] = React.useState<string | null>(null)
  const [ocupado, setOcupado] = React.useState(false)

  async function confirmar(e: React.FormEvent) {
    e.preventDefault()
    const limpo = codigo.replace(/[^A-Za-z0-9]/g, '')
    if (limpo.length !== 8) {
      setErro('O código tem 8 letras e números (ex.: ABCD-2345).')
      return
    }
    setErro(null)
    setOcupado(true)
    const { data, error } = await supabase.rpc('usar_codigo_recuperacao', { p_codigo: codigo })
    setOcupado(false)
    const r = data as RespostaCodigo | null
    if (error || !r) {
      setErro('Não foi possível conferir o código agora. Tente de novo.')
      return
    }
    if (r.ok) {
      onPronto()
      return
    }
    setCodigo('')
    if (r.motivo === 'bloqueado') {
      const ate = r.bloqueado_ate ? new Date(r.bloqueado_ate).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : null
      setErro(`Muitas tentativas erradas. Tente de novo ${ate ? `depois das ${ate}` : 'em 15 minutos'} ou peça ao gestor da sua unidade para zerar o segundo fator.`)
    } else if (r.motivo === 'invalido') {
      setErro(`Código não confere ou já foi usado. ${r.restantes ?? 0} tentativa(s) antes do bloqueio.`)
    } else {
      setErro('Sessão inválida. Saia e entre de novo.')
    }
  }

  return (
    <form onSubmit={confirmar} noValidate className="flex flex-col gap-3.5">
      <p className="text-apoio text-tinta-apoio">
        Digite um dos códigos de recuperação que você guardou. Cada código vale uma vez só.
      </p>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="codigo-recuperacao" className="text-apoio font-medium text-grafite">Código de recuperação</label>
        <input
          id="codigo-recuperacao"
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          maxLength={12}
          autoFocus
          value={codigo}
          onChange={(e) => { setCodigo(e.target.value.toUpperCase()); if (erro) setErro(null) }}
          aria-invalid={!!erro}
          className="min-h-[54px] rounded-controle border border-fio bg-campo text-center text-[22px] font-semibold tracking-[0.2em] text-tinta outline-none focus-visible:border-marca"
        />
        {erro && <p role="alert" className="text-apoio text-critico">{erro}</p>}
      </div>
      <Button type="submit" disabled={ocupado}>
        {ocupado ? <Spinner /> : <LifeBuoy />} {ocupado ? 'Conferindo…' : 'Confirmar'}
      </Button>
    </form>
  )
}

/** Perfil: quantos códigos restam e geração de um jogo novo (mostrado uma vez). */
export function SecaoCodigosRecuperacao() {
  const queryClient = useQueryClient()
  const { data, isLoading } = useQuery({
    queryKey: ['codigos-recuperacao'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('codigos_recuperacao_status')
      if (error) throw error
      const s = data?.[0]
      return { restantes: s?.restantes ?? 0, geradosEm: s?.gerados_em ? new Date(s.gerados_em) : null }
    },
  })
  const [codigos, setCodigos] = React.useState<string[] | null>(null)
  const [ocupado, setOcupado] = React.useState(false)
  const [erro, setErro] = React.useState<string | null>(null)
  const [copiado, setCopiado] = React.useState(false)

  async function gerar() {
    if (data?.geradosEm && !window.confirm('Gerar códigos novos anula todos os anteriores. Continuar?')) return
    setErro(null)
    setOcupado(true)
    const { data: novos, error } = await supabase.rpc('gerar_codigos_recuperacao')
    setOcupado(false)
    if (error || !novos) {
      setErro('Não foi possível gerar os códigos. Saia, entre de novo e confirme o código antes de gerar.')
      return
    }
    setCodigos(novos)
    setCopiado(false)
    void queryClient.invalidateQueries({ queryKey: ['codigos-recuperacao'] })
  }

  async function copiar() {
    if (!codigos) return
    try {
      await navigator.clipboard.writeText(codigos.join('\n'))
      setCopiado(true)
    } catch {
      setErro('Não foi possível copiar. Anote os códigos à mão.')
    }
  }

  return (
    <section aria-label="Códigos de recuperação" className="rounded-cartao border border-fio bg-superficie p-5 shadow-repouso">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <LifeBuoy className="size-4 text-tinta-apoio" aria-hidden />
        <h2 className="text-secao font-semibold tracking-[-0.01em] text-tinta">Códigos de recuperação</h2>
        {!isLoading && data && (data.restantes > 0
          ? <Badge variant="success">{data.restantes} disponíveis</Badge>
          : <Badge variant="secondary">Nenhum</Badge>)}
      </div>
      <p className="mb-3 text-apoio text-tinta-apoio">
        Sem acesso ao email e ao autenticador? Um destes códigos confirma o login. São 10, cada um vale uma vez.
        Guarde em lugar seguro, fora do celular.
      </p>
      {erro && <p role="alert" className="mb-2 text-apoio text-critico">{erro}</p>}
      {codigos ? (
        <div className="flex flex-col gap-3">
          <p className="text-apoio font-medium text-tinta">
            Anote ou copie agora: os códigos não aparecem de novo.
          </p>
          <ul className="grid grid-cols-2 gap-2 rounded-controle border border-fio bg-campo p-3 font-mono text-corpo tracking-wider text-tinta">
            {codigos.map((c) => <li key={c}>{c}</li>)}
          </ul>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => void copiar()}>
              <Copy /> {copiado ? 'Copiados' : 'Copiar'}
            </Button>
            <Button size="sm" onClick={() => setCodigos(null)}>Já guardei</Button>
          </div>
        </div>
      ) : (
        <div>
          <Button variant="outline" size="sm" onClick={() => void gerar()} disabled={ocupado || isLoading}>
            {ocupado && <Spinner />}
            {data?.geradosEm ? 'Gerar códigos novos' : 'Gerar códigos'}
          </Button>
          {data?.geradosEm && (
            <p className="mt-2 text-rotulo text-tinta-sussurro">
              Gerados em {data.geradosEm.toLocaleDateString('pt-BR')}.
            </p>
          )}
        </div>
      )}
    </section>
  )
}

/**
 * Gestão de pessoas: zera o segundo fator de alguém que perdeu o celular/email.
 * O banco confere se quem pede é gestor da unidade da pessoa ou super admin,
 * exige motivo e registra quem fez.
 */
export function ZerarSegundoFator({ perfilId, nome, onFeito }: { perfilId: string; nome: string; onFeito?: () => void }) {
  const [aberto, setAberto] = React.useState(false)
  const [motivo, setMotivo] = React.useState('')
  const [erro, setErro] = React.useState<string | null>(null)
  const [ocupado, setOcupado] = React.useState(false)
  const [feito, setFeito] = React.useState(false)

  async function zerar() {
    if (motivo.trim().length < 10) {
      setErro('Escreva o motivo (mínimo 10 caracteres).')
      return
    }
    setErro(null)
    setOcupado(true)
    const { error } = await supabase.rpc('zerar_segundo_fator', { p_usuario: perfilId, p_motivo: motivo.trim() })
    setOcupado(false)
    if (error) {
      setErro(error.message)
      return
    }
    setFeito(true)
    onFeito?.()
  }

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => { setAberto(true); setMotivo(''); setErro(null); setFeito(false) }}
      >
        <ShieldOff />
        Zerar 2FA
      </Button>
      <Dialog open={aberto} onOpenChange={setAberto}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Zerar segundo fator</DialogTitle>
            <DialogDescription>
              {nome} perdeu o celular ou o acesso ao email? Isto apaga o autenticador, os aparelhos confiáveis e os
              códigos de recuperação da pessoa e encerra as sessões dela. No próximo login, ela confirma pelo email.
            </DialogDescription>
          </DialogHeader>
          {feito ? (
            <p role="status" className="text-apoio text-tinta">
              Segundo fator zerado. Ficou registrado que foi você, com o motivo informado.
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              <label htmlFor="motivo-zerar-2fa" className="text-apoio font-medium text-grafite">
                Motivo (fica registrado)
              </label>
              <Textarea
                id="motivo-zerar-2fa"
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                rows={3}
                maxLength={500}
              />
              {erro && <p role="alert" className="text-apoio text-critico">{erro}</p>}
            </div>
          )}
          <DialogFooter>
            {feito ? (
              <Button onClick={() => setAberto(false)}>Fechar</Button>
            ) : (
              <Button variant="destructive" onClick={() => void zerar()} disabled={ocupado}>
                {ocupado && <Spinner />} Zerar segundo fator
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
