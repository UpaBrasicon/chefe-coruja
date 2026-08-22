import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { ArrowDown, ArrowUp, ImagePlus, Link2, Pencil, Trash2 } from 'lucide-react'
import * as React from 'react'

import { supabase } from '@/lib/supabase'
import { useUnidade } from '@/contexts/UnidadeContext'
import {
  atualizarBanner,
  criarBanner,
  excluirBanner,
  reordenarBanners,
  uploadBannerImagem,
} from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Spinner } from '@/components/ui/spinner'

const schema = z.object({
  titulo: z.string().max(80, 'Máximo de 80 caracteres').optional().or(z.literal('')),
  descricao: z.string().max(200, 'Máximo de 200 caracteres').optional().or(z.literal('')),
  link_url: z.string().url('Informe uma URL válida (https://…)').optional().or(z.literal('')),
})

type FormData = z.infer<typeof schema>

export function Banners({ embutido = false }: { embutido?: boolean } = {}) {
  const { unidadeAtiva } = useUnidade()
  const queryClient = useQueryClient()
  const unidadeId = unidadeAtiva?.unidade_id

  const [dialogAberto, setDialogAberto] = React.useState(false)
  const [editando, setEditando] = React.useState<{ id: string; titulo?: string | null; descricao?: string | null; link_url?: string | null } | null>(null)
  const [arquivo, setArquivo] = React.useState<File | null>(null)
  const [erro, setErro] = React.useState<string | null>(null)

  const { data: banners, isLoading } = useQuery({
    queryKey: ['banners-admin', unidadeId],
    enabled: !!unidadeId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('banners')
        .select('*')
        .eq('unidade_id', unidadeId!)
        .order('ordem', { ascending: true })
      if (error) throw error
      return data ?? []
    },
  })

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { titulo: '', descricao: '', link_url: '' },
  })

  const invalidar = () => {
    queryClient.invalidateQueries({ queryKey: ['banners'] })
    queryClient.invalidateQueries({ queryKey: ['banners-admin'] })
  }

  const salvarMutation = useMutation({
    mutationFn: async (data: FormData) => {
      if (!unidadeId) throw new Error('Unidade não selecionada.')
      let imagemUrl: string | null = null
      if (arquivo) imagemUrl = await uploadBannerImagem(unidadeId, arquivo)

      const campos = {
        titulo: data.titulo || null,
        descricao: data.descricao || null,
        link_url: data.link_url || null,
      }

      if (editando) {
        await atualizarBanner(editando.id, unidadeId, campos)
      } else {
        if (!imagemUrl) throw new Error('Selecione uma imagem.')
        await criarBanner({
          unidade_id: unidadeId,
          titulo: campos.titulo,
          descricao: campos.descricao,
          link_url: campos.link_url,
          imagem_url: imagemUrl,
          ordem: (banners?.length ?? 0),
        })
      }
    },
    onSuccess: () => {
      invalidar()
      setDialogAberto(false)
      setEditando(null)
      setArquivo(null)
      form.reset({ titulo: '', descricao: '', link_url: '' })
    },
    onError: (e) => setErro(e.message),
  })

  const excluirMutation = useMutation({
    mutationFn: (b: { id: string; imagem_url: string }) => excluirBanner(b.id, unidadeId!, b.imagem_url),
    onSuccess: invalidar,
    onError: (e) => setErro(e.message),
  })

  const ordemMutation = useMutation({
    mutationFn: (ids: string[]) => reordenarBanners(unidadeId!, ids),
    onSuccess: invalidar,
    onError: (e) => setErro(e.message),
  })

  function abrirCriar() {
    setEditando(null)
    setArquivo(null)
    setErro(null)
    form.reset({ titulo: '', descricao: '', link_url: '' })
    setDialogAberto(true)
  }

  function abrirEditar(b: { id: string; titulo?: string | null; descricao?: string | null; link_url?: string | null }) {
    setEditando(b)
    setArquivo(null)
    setErro(null)
    form.reset({ titulo: b.titulo ?? '', descricao: b.descricao ?? '', link_url: b.link_url ?? '' })
    setDialogAberto(true)
  }

  function mover(index: number, delta: -1 | 1) {
    if (!banners) return
    const alvo = index + delta
    if (alvo < 0 || alvo >= banners.length) return
    const novo = [...banners]
    ;[novo[index], novo[alvo]] = [novo[alvo], novo[index]]
    ordemMutation.mutate(novo.map((b) => b.id))
  }

  if (!unidadeId) return null

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        {embutido ? (
          <div />
        ) : (
          <div>
            <h1 className="text-xl font-semibold">Imagens da unidade</h1>
            <p className="text-sm text-muted-foreground">
              {unidadeAtiva?.unidade.nome} — o quadro exibido na Central do Plantonista. As imagens
              trocam sozinhas e podem ter links.
            </p>
          </div>
        )}
        <Button onClick={abrirCriar}>
          <ImagePlus />
          Nova imagem
        </Button>
      </div>

      {erro && <p className="text-sm text-destructive">{erro}</p>}

      {isLoading ? (
        <div className="flex h-40 items-center justify-center"><Spinner /></div>
      ) : (
        <div className="flex flex-col gap-3">
          {(banners ?? []).map((b, index) => (
            <div key={b.id} className="flex items-center gap-3 rounded-2xl border bg-card p-3 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
              <div className="relative h-16 w-28 shrink-0 overflow-hidden rounded-lg border bg-muted">
                <img src={b.imagem_url} alt={b.titulo ?? ''} className="h-full w-full object-cover" />
                {!b.ativo && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/50 text-[10px] font-semibold text-white">
                    OCULTO
                  </div>
                )}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm font-medium">{b.titulo || 'Sem título'}</span>
                  {b.link_url && <Link2 className="size-3.5 shrink-0 text-primary" />}
                  {b.ativo && <Badge variant="success">Ativo</Badge>}
                </div>
                {b.descricao && (
                  <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{b.descricao}</p>
                )}
              </div>

              <div className="flex shrink-0 items-center gap-0.5">
                <Button variant="ghost" size="icon-xs" aria-label="Mover para cima" disabled={index === 0 || ordemMutation.isPending} onClick={() => mover(index, -1)}>
                  <ArrowUp />
                </Button>
                <Button variant="ghost" size="icon-xs" aria-label="Mover para baixo" disabled={index === (banners?.length ?? 0) - 1 || ordemMutation.isPending} onClick={() => mover(index, 1)}>
                  <ArrowDown />
                </Button>
                <Button variant="ghost" size="icon-xs" aria-label="Editar" onClick={() => abrirEditar(b)}>
                  <Pencil />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  aria-label="Excluir"
                  disabled={excluirMutation.isPending}
                  onClick={() => {
                    if (window.confirm('Excluir esta imagem do quadro?')) excluirMutation.mutate({ id: b.id, imagem_url: b.imagem_url })
                  }}
                >
                  <Trash2 />
                </Button>
              </div>
            </div>
          ))}

          {(banners ?? []).length === 0 && (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Nenhuma imagem no quadro. Clique em "Nova imagem" para começar.
            </p>
          )}
        </div>
      )}

      <Dialog open={dialogAberto} onOpenChange={(o) => { setDialogAberto(o); if (!o) setEditando(null) }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editando ? 'Editar imagem' : 'Nova imagem'}</DialogTitle>
            <DialogDescription>
              A imagem aparecerá no quadro da Central do Plantonista e trocará automaticamente.
            </DialogDescription>
          </DialogHeader>

          <form
            onSubmit={form.handleSubmit((d) => salvarMutation.mutate(d))}
            className="flex flex-col gap-4"
          >
            <div className="flex flex-col gap-2">
              <Label htmlFor="banner-arquivo">Imagem {editando ? '(opcional)' : ''}</Label>
              <Input
                id="banner-arquivo"
                type="file"
                accept="image/*"
                onChange={(e) => setArquivo(e.target.files?.[0] ?? null)}
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="banner-titulo">Título</Label>
              <Input id="banner-titulo" placeholder="Ex.: Protocolo de Sepse 2026" {...form.register('titulo')} />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="banner-descricao">Descrição</Label>
              <Textarea id="banner-descricao" placeholder="Texto curto sobre a imagem" {...form.register('descricao')} />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="banner-link">Link de redirecionamento</Label>
              <Input id="banner-link" placeholder="https://… (opcional)" {...form.register('link_url')} />
              <p className="text-xs text-muted-foreground">Ao clicar na imagem, abre o link em nova aba.</p>
              {form.formState.errors.link_url && (
                <p className="text-xs text-destructive">{form.formState.errors.link_url.message}</p>
              )}
            </div>

            <DialogFooter>
              <Button type="submit" disabled={salvarMutation.isPending}>
                {salvarMutation.isPending ? <Spinner /> : editando ? 'Salvar' : 'Adicionar'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
