import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ChevronRight } from 'lucide-react'
import * as React from 'react'

import { Chip, TituloCartao } from '@/components/monitor/Pagina'
import { BotaoLinha } from '@/components/ui/botao-linha'
import { Button } from '@/components/ui/button'
import { CampoSelecao } from '@/components/ui/campo-selecao'
import { useDesfazer } from '@/contexts/DesfazerContext'
import { diaMesHora } from '@/lib/formato'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'

import { chaveMedida, chavePainel, PAINEIS, useDefinirPanorama, usePanorama } from './panorama'

// "O que aparece no Panorama da unidade" e "Adicionar uma medida"
// (P/index.html 9497–9557). A escolha fica no banco, por gestor e unidade;
// a medida pedida fica em preparo, sem número, até ter consulta.

const EXEMPLOS = ['Reinternação em 7 dias por setor', 'Tempo até a primeira prescrição', 'Altas assinadas depois das 18h']

const quando = (iso: string) => diaMesHora(iso)

export function PanoramaConfig({ unidadeId }: { unidadeId: string }) {
  const qc = useQueryClient()
  const { fazer } = useDesfazer()
  const { data } = usePanorama(unidadeId)
  const definir = useDefinirPanorama(unidadeId)
  const [aberto, setAberto] = React.useState<string | null>(null)
  const [texto, setTexto] = React.useState('')
  const [painel, setPainel] = React.useState('')

  const fora = new Set(data?.fora ?? [])
  const alternar = (chave: string) => {
    const novo = new Set(fora)
    if (novo.has(chave)) novo.delete(chave)
    else novo.add(chave)
    definir.mutate([...novo])
  }
  const ligados = PAINEIS.filter((p) => !fora.has(chavePainel(p.chave))).length

  const medidas = useQuery({
    queryKey: ['medidas-pedidas', unidadeId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('medidas_pedidas_da_unidade', { p_unidade: unidadeId })
      if (error) throw error
      return data ?? []
    },
  })
  const recarregar = () => void qc.invalidateQueries({ queryKey: ['medidas-pedidas', unidadeId] })
  const pedir = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('pedir_medida', { p_unidade: unidadeId, p_texto: texto.trim(), p_painel: painel || undefined })
      if (error) throw error
    },
    onSuccess: () => { setTexto(''); setPainel(''); recarregar() },
  })
  const retirar = useMutation({
    mutationFn: async (m: { id: string; texto: string }) => {
      const { error } = await supabase.rpc('retirar_medida', { p_id: m.id })
      if (error) throw error
      return m
    },
    onSuccess: (m) => {
      recarregar()
      fazer(`Medida retirada: ${m.texto}`, async () => {
        const { error } = await supabase.rpc('retirar_medida', { p_id: m.id, p_retirar: false })
        if (error) throw error
        recarregar()
      })
    },
  })

  return (
    <section className="overflow-hidden rounded-cartao border border-fio bg-superficie shadow-repouso">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-trilha px-5 py-[15px]">
        <div className="flex min-w-0 flex-col gap-0.5">
          <TituloCartao className="mb-0">O que aparece no Panorama da unidade</TituloCartao>
          <span className="text-apoio text-pretty text-tinta-sussurro">Escolha os painéis do carrossel e as medidas de cada um. Os números são da unidade inteira; por setor fica em Unidade.</span>
        </div>
        <span className="text-apoio text-tinta-sussurro">{ligados} de {PAINEIS.length} painéis</span>
      </div>

      {PAINEIS.map((p) => {
        const ligado = !fora.has(chavePainel(p.chave))
        const lista = data ? p.medidas(data.n) : []
        const vis = lista.filter((m) => !fora.has(chaveMedida(p.chave, m.chave))).length
        const estaAberto = aberto === p.chave
        return (
          <div key={p.chave} className="border-b border-trilha">
            <div className="flex items-center gap-3 px-5 py-3">
              <BotaoLinha variante="linha" aria-expanded={estaAberto} onClick={() => setAberto(estaAberto ? null : p.chave)}
                className="w-auto min-w-0 flex-1 items-center gap-2.5 border-0 p-0 hover:bg-transparent">
                <ChevronRight className={cn('size-[15px] shrink-0 text-tinta-sussurro transition-transform', estaAberto && 'rotate-90')} aria-hidden />
                <span className="flex min-w-0 flex-col">
                  <span className={cn('text-corpo font-medium', ligado ? 'text-tinta' : 'text-tinta-apoio')}>{p.titulo}</span>
                  <span className={cn('text-apoio', ligado && !vis ? 'text-atencao' : 'text-tinta-sussurro')}>
                    {ligado ? `${vis} de ${lista.length} medidas` : 'Fora do carrossel'}
                  </span>
                </span>
              </BotaoLinha>
              {/* padrao-ok: interruptor liga/desliga do painel (role=switch); não há peça de interruptor */}
              <button type="button" role="switch" aria-checked={ligado} aria-label={`${ligado ? 'Tirar' : 'Pôr'} o painel ${p.titulo} no carrossel`}
                onClick={() => alternar(chavePainel(p.chave))}
                className={cn('relative h-5 w-[34px] shrink-0 rounded-capsula transition-colors', ligado ? 'bg-acao' : 'bg-fio-forte')}>
                <span className={cn('absolute top-0.5 size-4 rounded-capsula bg-superficie transition-[left]', ligado ? 'left-4' : 'left-0.5')} />
              </button>
            </div>
            {estaAberto && (
              <div className="flex flex-wrap gap-[7px] px-5 pb-3.5 pl-[45px]">
                {lista.map((m) => {
                  const on = !fora.has(chaveMedida(p.chave, m.chave))
                  return (
                    <Chip key={m.chave} ativo={on} onClick={() => alternar(chaveMedida(p.chave, m.chave))}>
                      {m.rotulo}
                    </Chip>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}

      <div className="flex flex-col gap-2.5 border-b border-trilha px-5 py-4">
        <span className="text-apoio font-semibold text-grafite">Adicionar uma medida</span>
        <form onSubmit={(e) => { e.preventDefault(); if (texto.trim().length >= 5) pedir.mutate() }} className="flex flex-wrap gap-2">
          <input value={texto} onChange={(e) => setTexto(e.target.value)} maxLength={300} aria-label="O que você quer medir na unidade"
            placeholder="O que você quer medir na unidade"
            className="min-w-[220px] flex-1 rounded-controle border border-fio bg-superficie px-3 py-2 text-controle text-tinta outline-none focus:border-acao" />
          <CampoSelecao value={painel} onChange={(e) => setPainel(e.target.value)} aria-label="Painel da medida"
            className="h-auto bg-superficie px-2.5 py-2 text-controle text-tinta-apoio">
            <option value="">Painel: qualquer</option>
            {PAINEIS.map((p) => <option key={p.chave} value={p.titulo}>{p.titulo}</option>)}
          </CampoSelecao>
          <Button type="submit" disabled={pedir.isPending || texto.trim().length < 5}>
            Pedir medida
          </Button>
        </form>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-rotulo font-semibold tracking-[0.06em] text-tinta-sussurro uppercase">Exemplos</span>
          {EXEMPLOS.map((t) => (
            <Button key={t} variant="outline" size="sm" onClick={() => setTexto(t)} className="rounded-capsula px-3">{t}</Button>
          ))}
        </div>
        {pedir.error && <p className="text-apoio text-critico">{(pedir.error as Error).message}</p>}
        <span className="text-apoio leading-[1.5] text-pretty text-tinta-apoio">
          Escreva com as suas palavras. O pedido fica registrado na unidade e a medida entra no painel quando houver a consulta no banco — até lá ela fica em preparo, sem número.
        </span>
      </div>

      {(medidas.data ?? []).length > 0 && (
        <div className="flex flex-col">
          {(medidas.data ?? []).map((m) => (
            <div key={m.id} className="flex flex-wrap items-center gap-3 border-b border-trilha px-5 py-3">
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="text-corpo text-tinta">{m.texto}</span>
                <span className="text-apoio text-tinta-sussurro">
                  pedida por {m.minha ? 'você' : m.autor_nome} · {quando(m.criado_em)}{m.painel ? ` · ${m.painel}` : ''}
                </span>
              </div>
              <span className="rounded-capsula bg-atencao/10 px-2 py-[3px] text-rotulo font-semibold tracking-[0.03em] text-atencao uppercase">Em preparo</span>
              <Button variant="outline" disabled={retirar.isPending} onClick={() => retirar.mutate({ id: m.id, texto: m.texto })}>
                Retirar
              </Button>
            </div>
          ))}
        </div>
      )}
      <div className="bg-campo px-5 py-3 text-apoio text-tinta-sussurro">
        A escolha dos painéis vale para você nesta unidade, em qualquer aparelho. Tirar uma medida do carrossel não apaga o dado — ele continua nesta página.
      </div>
    </section>
  )
}
