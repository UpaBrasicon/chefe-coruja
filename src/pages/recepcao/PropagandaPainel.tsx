import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowDown, ArrowUp, ChevronDown, Eye, EyeOff, ImagePlus, Megaphone, Trash2 } from 'lucide-react'
import * as React from 'react'

import { supabase } from '@/lib/supabase'
import { reduzirImagem } from '@/lib/reduzirImagem'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { Campo } from '@/components/documentos/ui'

// Propaganda do painel da TV (P/Painel de Chamada.dc.html: artes 16:9 em
// rodízio, com o rótulo "Informe da Prefeitura" e o tempo de cada uma). No
// protótipo eram espaços de imagem no próprio arquivo; aqui é conteúdo da
// unidade (painel_config e painel_propagandas, migration 20261008000001),
// cadastrado pelo gestor. A Recepção vê o que está no ar.
// RF3 (revisão do perfil Recepção, RT 24/11/2026): no Painel de chamada as
// artes são configuração; o cartão abre recolhido, abaixo das chamadas.

type Item = { id: string; caminho: string; titulo: string; ativo: boolean; ordem: number }
type Propaganda = { rotulo: string; segundos: number; posso_editar: boolean; itens: Item[] }

const urlArte = (caminho: string) => supabase.storage.from('painel').getPublicUrl(caminho).data.publicUrl

const cartao = 'overflow-hidden rounded-cartao border border-fio bg-superficie shadow-repouso'

export function PropagandaPainel({ unidadeId }: { unidadeId: string }) {
  const queryClient = useQueryClient()
  const chave = ['painel-propaganda', unidadeId]
  const { data, isLoading, error } = useQuery({
    queryKey: chave,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('painel_propaganda', { p_unidade: unidadeId })
      if (error) throw error
      return data as unknown as Propaganda
    },
  })
  const [aberto, setAberto] = React.useState(false)
  const [erro, setErro] = React.useState<string | null>(null)
  const invalidar = () => queryClient.invalidateQueries({ queryKey: chave })
  const aoErro = (e: Error) => setErro(e.message)

  const [rotulo, setRotulo] = React.useState<string | null>(null)
  const [segundos, setSegundos] = React.useState<string | null>(null)
  const [arquivo, setArquivo] = React.useState<File | null>(null)
  const [titulo, setTitulo] = React.useState('')
  const inputArquivo = React.useRef<HTMLInputElement>(null)

  const salvarConfig = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('salvar_painel_config', {
        p_unidade: unidadeId, p_rotulo: (rotulo ?? data!.rotulo).trim(), p_segundos: Number(segundos ?? data!.segundos),
      })
      if (error) throw error
    },
    onSuccess: () => { setRotulo(null); setSegundos(null); setErro(null); void invalidar() },
    onError: aoErro,
  })

  const adicionar = useMutation({
    mutationFn: async () => {
      if (!arquivo) throw new Error('Escolha a imagem da arte (PNG, JPG ou WebP, até 5 MB).')
      if (titulo.trim().length < 2) throw new Error('Descreva a arte (texto para quem não enxerga a tela).')
      // item 02 do kit de desempenho: a arte vai à TV em até 1920 px; sobe reduzida
      const imagem = await reduzirImagem(arquivo, 1920)
      const ext = (imagem.name.split('.').pop() ?? 'png').toLowerCase().replace(/[^a-z0-9]/g, '') || 'png'
      const caminho = `${unidadeId}/${crypto.randomUUID()}.${ext}`
      const up = await supabase.storage.from('painel').upload(caminho, imagem, { contentType: imagem.type, upsert: false })
      if (up.error) throw up.error
      const { error } = await supabase.rpc('adicionar_propaganda', { p_unidade: unidadeId, p_caminho: caminho, p_titulo: titulo.trim() })
      if (error) {
        await supabase.storage.from('painel').remove([caminho])
        throw error
      }
    },
    onSuccess: () => {
      setArquivo(null); setTitulo(''); setErro(null)
      if (inputArquivo.current) inputArquivo.current.value = ''
      void invalidar()
    },
    onError: aoErro,
  })

  const alternar = useMutation({
    mutationFn: async (i: Item) => {
      const { error } = await supabase.rpc('atualizar_propaganda', { p_id: i.id, p_titulo: i.titulo, p_ativo: !i.ativo })
      if (error) throw error
    },
    onSuccess: () => void invalidar(),
    onError: aoErro,
  })

  const reordenar = useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase.rpc('reordenar_propagandas', { p_unidade: unidadeId, p_ids: ids })
      if (error) throw error
    },
    onSuccess: () => void invalidar(),
    onError: aoErro,
  })

  const remover = useMutation({
    mutationFn: async (i: Item) => {
      const { data: caminho, error } = await supabase.rpc('remover_propaganda', { p_id: i.id })
      if (error) throw error
      if (caminho) await supabase.storage.from('painel').remove([caminho])
    },
    onSuccess: () => void invalidar(),
    onError: aoErro,
  })

  function mover(k: number, d: -1 | 1) {
    if (!data) return
    const ids = data.itens.map((i) => i.id)
    const alvo = k + d
    if (alvo < 0 || alvo >= ids.length) return
    ;[ids[k], ids[alvo]] = [ids[alvo], ids[k]]
    reordenar.mutate(ids)
  }

  const editar = !!data?.posso_editar
  const ativos = data?.itens.filter((i) => i.ativo).length ?? 0

  return (
    <section className={cn(cartao, 'mt-4')} aria-labelledby="propaganda-titulo">
      <h3>
        <button
          type="button"
          aria-expanded={aberto}
          aria-controls="propaganda-conteudo"
          onClick={() => setAberto((v) => !v)}
          className={cn('flex w-full flex-wrap items-center gap-2.5 px-5 py-3 text-left hover:bg-trilha/60', aberto && 'border-b border-trilha')}
        >
          <Megaphone className="size-4 text-tinta-sussurro" aria-hidden />
          <span id="propaganda-titulo" className="text-controle leading-[1.3] font-semibold text-tinta">Artes da TV</span>
          <span className="ml-auto text-apoio font-normal text-tinta-sussurro">
            {data ? `${ativos} ${ativos === 1 ? 'arte no ar' : 'artes no ar'} · ${data.segundos} s cada` : ''}
          </span>
          <ChevronDown className={cn('size-4 text-tinta-sussurro transition-transform', aberto && 'rotate-180')} aria-hidden />
        </button>
      </h3>
      {aberto && isLoading && <div className="px-5 py-4"><Spinner /></div>}
      {aberto && error && <p className="px-5 py-4 text-apoio text-critico">{(error as Error).message}</p>}
      {aberto && data && (
        <div id="propaganda-conteudo" className="flex flex-col gap-4 px-5 py-4">
          <p className="text-apoio text-pretty text-tinta-sussurro">
            {editar
              ? 'As artes ativas passam em rodízio ao lado das chamadas. Quando alguém é chamado, o nome ocupa a tela toda por 9 segundos. Use arte 16:9, sem dado de paciente.'
              : 'As artes são cadastradas pelo gestor da unidade. Quando alguém é chamado, o nome ocupa a tela toda por 9 segundos.'}
          </p>

          {editar && (
            <div className="flex flex-wrap items-end gap-3">
              <Campo id="pp-rotulo" rotulo="Rótulo na TV" largura="medio">
                <Input id="pp-rotulo" value={rotulo ?? data.rotulo} onChange={(e) => setRotulo(e.target.value)} maxLength={60} />
              </Campo>
              <Campo id="pp-seg" rotulo="Segundos por arte" largura="curto">
                <Input id="pp-seg" type="number" min={4} max={60} value={segundos ?? String(data.segundos)} onChange={(e) => setSegundos(e.target.value)} />
              </Campo>
              <Button variant="outline" disabled={(rotulo === null && segundos === null) || salvarConfig.isPending} onClick={() => salvarConfig.mutate()}>
                {salvarConfig.isPending && <Spinner className="size-4" />} Salvar
              </Button>
            </div>
          )}

          {data.itens.length === 0 && (
            <p className="rounded-container border border-dashed border-fio px-4 py-6 text-center text-apoio text-tinta-sussurro">
              Nenhuma arte cadastrada: a TV mostra só as chamadas.
            </p>
          )}
          {data.itens.length > 0 && (
            <ul className="flex flex-col divide-y divide-trilha rounded-container border border-fio">
              {data.itens.map((i, k) => (
                <li key={i.id} className="flex flex-wrap items-center gap-3 px-3 py-2.5">
                  <div className="relative aspect-video w-28 shrink-0 overflow-hidden rounded-controle border border-fio bg-trilha">
                    <img src={urlArte(i.caminho)} alt={i.titulo} loading="lazy" decoding="async" className="size-full object-cover" />
                  </div>
                  <div className="flex min-w-0 flex-[1_1_180px] flex-col gap-0.5">
                    <span className="text-controle font-medium text-tinta">{i.titulo}</span>
                    <span className={cn('text-rotulo', i.ativo ? 'text-conforme' : 'text-tinta-sussurro')}>{i.ativo ? 'No ar' : 'Pausada'}</span>
                  </div>
                  {editar && (
                    <div className="flex items-center gap-0.5">
                      <Button variant="ghost" size="icon-xs" aria-label="Mover para cima" disabled={k === 0 || reordenar.isPending} onClick={() => mover(k, -1)}><ArrowUp /></Button>
                      <Button variant="ghost" size="icon-xs" aria-label="Mover para baixo" disabled={k === data.itens.length - 1 || reordenar.isPending} onClick={() => mover(k, 1)}><ArrowDown /></Button>
                      <Button variant="ghost" size="icon-xs" aria-label={i.ativo ? 'Pausar arte' : 'Pôr no ar'} disabled={alternar.isPending} onClick={() => alternar.mutate(i)}>
                        {i.ativo ? <EyeOff /> : <Eye />}
                      </Button>
                      <Button variant="ghost" size="icon-xs" aria-label="Remover arte" disabled={remover.isPending}
                        onClick={() => { if (window.confirm('Remover esta arte do painel?')) remover.mutate(i) }}>
                        <Trash2 />
                      </Button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}

          {editar && (
            <div className="flex flex-wrap items-end gap-3">
              <Campo id="pp-arq" rotulo="Nova arte (16:9)" largura="medio">
                <Input id="pp-arq" ref={inputArquivo} type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => setArquivo(e.target.files?.[0] ?? null)} />
              </Campo>
              <Campo id="pp-tit" rotulo="Descrição da arte" largura="medio">
                <Input id="pp-tit" value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ex.: Campanha de vacinação contra a gripe" maxLength={120} />
              </Campo>
              <Button disabled={adicionar.isPending} onClick={() => adicionar.mutate()}>
                {adicionar.isPending ? <Spinner className="size-4" /> : <ImagePlus />} Adicionar
              </Button>
            </div>
          )}
          {erro && <p role="alert" className="text-apoio text-critico">{erro}</p>}
        </div>
      )}
    </section>
  )
}
