import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  ArrowDown,
  ArrowUp,
  BedDouble,
  Lock,
  LockOpen,
  Plus,
  Trash2,
} from 'lucide-react'
import * as React from 'react'

import { useUnidade } from '@/contexts/UnidadeContext'
import { useLeitos, useSetores } from '@/hooks/useDadosUnidade'
import {
  atualizarStatusLeito,
  criarLeitos,
  criarSetor,
  excluirLeito,
  excluirSetor,
  salvarOrdemSetores,
} from '@/lib/api'
import { STATUS_LEITO_LABEL, STATUS_LEITO_VARIANT, TIPO_LEITO_LABEL, TIPO_SETOR_LABEL } from '@/lib/constants'
import type { StatusLeito, TipoLeito, TipoSetor } from '@/types/database'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Spinner } from '@/components/ui/spinner'
import { cn } from '@/lib/utils'

const setorSchema = z.object({
  nome: z.string().min(2, 'Informe o nome do setor.'),
  tipo: z.enum(['emergencia', 'observacao', 'internacao', 'isolamento', 'uti', 'outro']),
})

type SetorForm = z.infer<typeof setorSchema>

const leitosSchema = z.object({
  prefixo: z
    .string()
    .min(1, 'Informe um prefixo (ex.: ENF).')
    .regex(/^[A-Za-z0-9_-]+$/, 'Use apenas letras, números, hífen ou sublinhado.'),
  quantidade: z.coerce.number().int().min(1, 'Mínimo de 1 leito.').max(100, 'Máximo de 100.'),
  tipo: z.enum(['clinico', 'isolamento', 'estabilizacao', 'observacao']),
})

type LeitosForm = z.infer<typeof leitosSchema>

export function Setores() {
  const { unidadeAtiva } = useUnidade()
  const queryClient = useQueryClient()
  const unidadeId = unidadeAtiva?.unidade_id

  const [setorSelecionadoId, setSetorSelecionadoId] = React.useState<string | null>(null)
  const [dialogSetorAberto, setDialogSetorAberto] = React.useState(false)
  const [dialogLeitosAberto, setDialogLeitosAberto] = React.useState(false)
  const [erro, setErro] = React.useState<string | null>(null)

  const setoresQuery = useSetores(unidadeId)
  const setores = setoresQuery.data ?? []
  const setorEfetivoId =
    setorSelecionadoId && setores.some((s) => s.id === setorSelecionadoId)
      ? setorSelecionadoId
      : (setores[0]?.id ?? null)
  const leitosQuery = useLeitos(setorEfetivoId ?? undefined)

  const setorForm = useForm<SetorForm>({ resolver: zodResolver(setorSchema) })
  const leitosForm = useForm<LeitosForm>({
    resolver: zodResolver(leitosSchema),
    defaultValues: { prefixo: '', quantidade: 1, tipo: 'clinico' },
  })

  const invalidar = () => {
    queryClient.invalidateQueries({ queryKey: ['setores', unidadeId] })
    queryClient.invalidateQueries({ queryKey: ['leitos'] })
    queryClient.invalidateQueries({ queryKey: ['censo'] })
  }

  const criarSetorMutation = useMutation({
    mutationFn: (f: SetorForm) =>
      criarSetor({
        unidade_id: unidadeId!,
        nome: f.nome,
        tipo: f.tipo,
        ordem: setoresQuery.data?.length ?? 0,
      }),
    onSuccess: () => {
      invalidar()
      setDialogSetorAberto(false)
      setorForm.reset()
    },
    onError: (e) => setErro(e.message),
  })

  const excluirSetorMutation = useMutation({
    mutationFn: (s: { id: string; nome: string }) => excluirSetor(s.id, unidadeId!, s.nome),
    onSuccess: () => {
      setSetorSelecionadoId(null)
      invalidar()
    },
    onError: (e) => setErro(e.message),
  })

  const ordemMutation = useMutation({
    mutationFn: (idsEmOrdem: string[]) => salvarOrdemSetores(unidadeId!, idsEmOrdem),
    onSuccess: invalidar,
    onError: (e) => setErro(e.message),
  })

  const criarLeitosMutation = useMutation({
    mutationFn: (f: LeitosForm) =>
      criarLeitos({
        setor_id: setorEfetivoId!,
        unidade_id: unidadeId!,
        prefixo: f.prefixo,
        quantidade: f.quantidade,
        tipo: f.tipo,
      }),
    onSuccess: () => {
      invalidar()
      setDialogLeitosAberto(false)
      leitosForm.reset({ prefixo: '', quantidade: 1, tipo: 'clinico' })
    },
    onError: (e) => setErro(e.message),
  })

  const statusMutation = useMutation({
    mutationFn: (v: { id: string; status: StatusLeito }) =>
      atualizarStatusLeito(v.id, unidadeId!, v.status),
    onSuccess: invalidar,
    onError: (e) => setErro(e.message),
  })

  const excluirLeitoMutation = useMutation({
    mutationFn: (id: string) => excluirLeito(id, unidadeId!),
    onSuccess: invalidar,
    onError: (e) => setErro(e.message),
  })

  if (!unidadeId) return null
  if (setoresQuery.isLoading) {
    return (
      <div className="flex h-40 items-center justify-center">
        <Spinner />
      </div>
    )
  }

  const setorSelecionado = setores.find((s) => s.id === setorEfetivoId) ?? null

  function moverSetor(index: number, delta: -1 | 1) {
    const alvo = index + delta
    if (alvo < 0 || alvo >= setores.length) return
    const novo = [...setores]
    ;[novo[index], novo[alvo]] = [novo[alvo], novo[index]]
    ordemMutation.mutate(novo.map((s) => s.id))
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Setores e Leitos</h1>
          <p className="text-sm text-muted-foreground">
            {unidadeAtiva?.unidade.nome} — gerencie setores e crie leitos em lote.
          </p>
        </div>
        <Button onClick={() => setDialogSetorAberto(true)}>
          <Plus />
          Novo setor
        </Button>
      </div>

      {erro && <p className="text-sm text-destructive">{erro}</p>}

      <div className="grid gap-4 md:grid-cols-[320px_1fr]">
        {/* Lista de setores */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Setores</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-1">
            {setores.map((s, index) => (
              <div
                key={s.id}
                className={cn(
                  'group flex items-center justify-between gap-1 rounded-lg border px-3 py-2 transition-colors',
                  s.id === setorSelecionadoId
                    ? 'border-primary bg-primary/5'
                    : 'hover:bg-muted/50'
                )}
              >
                <button
                  type="button"
                  className="flex min-w-0 flex-1 flex-col items-start text-left"
                  onClick={() => setSetorSelecionadoId(s.id)}
                >
                  <span className="text-sm font-medium">{s.nome}</span>
                  <span className="text-xs text-muted-foreground">
                    {TIPO_SETOR_LABEL[s.tipo]} · {s.leitos[0]?.count ?? 0} leitos
                  </span>
                </button>
                <div className="flex shrink-0 items-center gap-0.5">
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    aria-label="Mover para cima"
                    disabled={index === 0 || ordemMutation.isPending}
                    onClick={() => moverSetor(index, -1)}
                  >
                    <ArrowUp />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    aria-label="Mover para baixo"
                    disabled={index === setores.length - 1 || ordemMutation.isPending}
                    onClick={() => moverSetor(index, 1)}
                  >
                    <ArrowDown />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    aria-label="Excluir setor"
                    onClick={() => {
                      if (window.confirm(`Excluir o setor "${s.nome}"? Os leitos dele também serão excluídos.`)) {
                        excluirSetorMutation.mutate({ id: s.id, nome: s.nome })
                      }
                    }}
                  >
                    <Trash2 />
                  </Button>
                </div>
              </div>
            ))}
            {setores.length === 0 && (
              <p className="py-6 text-center text-sm text-muted-foreground">
                Nenhum setor criado ainda.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Leitos do setor */}
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle className="flex items-center gap-2 text-base">
              <BedDouble className="size-4 text-muted-foreground" />
              {setorSelecionado ? setorSelecionado.nome : 'Selecione um setor'}
            </CardTitle>
            {setorSelecionado && (
              <Button size="sm" onClick={() => setDialogLeitosAberto(true)}>
                <Plus />
                Adicionar leitos
              </Button>
            )}
          </CardHeader>
          <CardContent>
            {!setorSelecionado && (
              <p className="py-6 text-center text-sm text-muted-foreground">
                Selecione um setor para ver os leitos.
              </p>
            )}

            {setorSelecionado && leitosQuery.isLoading && (
              <div className="flex h-24 items-center justify-center">
                <Spinner />
              </div>
            )}

            {setorSelecionado && !leitosQuery.isLoading && (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                {(leitosQuery.data ?? []).map((leito) => (
                  <div
                    key={leito.id}
                    className="flex flex-col gap-2 rounded-lg border p-3"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold">{leito.identificador}</span>
                      <Badge variant={STATUS_LEITO_VARIANT[leito.status]}>
                        {STATUS_LEITO_LABEL[leito.status]}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">
                        {TIPO_LEITO_LABEL[leito.tipo]}
                      </span>
                      <div className="flex items-center gap-0.5">
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          aria-label={
                            leito.status === 'bloqueado' ? 'Desbloquear leito' : 'Bloquear leito'
                          }
                          disabled={statusMutation.isPending}
                          onClick={() =>
                            statusMutation.mutate({
                              id: leito.id,
                              status: leito.status === 'bloqueado' ? 'livre' : 'bloqueado',
                            })
                          }
                        >
                          {leito.status === 'bloqueado' ? <LockOpen /> : <Lock />}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          aria-label="Excluir leito"
                          disabled={excluirLeitoMutation.isPending}
                          onClick={() => {
                            if (window.confirm(`Excluir o leito ${leito.identificador}?`)) {
                              excluirLeitoMutation.mutate(leito.id)
                            }
                          }}
                        >
                          <Trash2 />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}

                {leitosQuery.data?.length === 0 && (
                  <p className="col-span-full py-6 text-center text-sm text-muted-foreground">
                    Este setor ainda não tem leitos.
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Dialog: novo setor */}
      <Dialog open={dialogSetorAberto} onOpenChange={setDialogSetorAberto}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo setor</DialogTitle>
            <DialogDescription>Adicione um setor à unidade ativa.</DialogDescription>
          </DialogHeader>
          <form
            onSubmit={setorForm.handleSubmit((f) => criarSetorMutation.mutate(f))}
            className="flex flex-col gap-4"
          >
            <div className="flex flex-col gap-2">
              <Label htmlFor="setor-nome">Nome</Label>
              <Input
                id="setor-nome"
                placeholder="Ex.: Emergência Norte"
                {...setorForm.register('nome')}
              />
              {setorForm.formState.errors.nome && (
                <p className="text-xs text-destructive">
                  {setorForm.formState.errors.nome.message}
                </p>
              )}
            </div>
            <div className="flex flex-col gap-2">
              <Label>Tipo</Label>
              <Controller
                control={setorForm.control}
                name="tipo"
                render={({ field }) => (
                  <Select value={field.value || null} onValueChange={field.onChange}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Selecione o tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.keys(TIPO_SETOR_LABEL) as TipoSetor[]).map((t) => (
                        <SelectItem key={t} value={t}>
                          {TIPO_SETOR_LABEL[t]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
            <DialogFooter>
              <Button type="submit" disabled={criarSetorMutation.isPending}>
                {criarSetorMutation.isPending ? <Spinner /> : 'Criar setor'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog: criar leitos em lote */}
      <Dialog open={dialogLeitosAberto} onOpenChange={setDialogLeitosAberto}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adicionar leitos</DialogTitle>
            <DialogDescription>
              Informe a quantidade e o prefixo. Ex.: prefixo <strong>ENF</strong> e quantidade 12
              gera <strong>ENF-01</strong> … <strong>ENF-12</strong>.
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={leitosForm.handleSubmit((f) => criarLeitosMutation.mutate(f))}
            className="flex flex-col gap-4"
          >
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-2">
                <Label htmlFor="leitos-prefixo">Prefixo</Label>
                <Input
                  id="leitos-prefixo"
                  placeholder="ENF"
                  {...leitosForm.register('prefixo')}
                />
                {leitosForm.formState.errors.prefixo && (
                  <p className="text-xs text-destructive">
                    {leitosForm.formState.errors.prefixo.message}
                  </p>
                )}
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="leitos-qtd">Quantidade</Label>
                <Input
                  id="leitos-qtd"
                  type="number"
                  min={1}
                  max={100}
                  {...leitosForm.register('quantidade')}
                />
                {leitosForm.formState.errors.quantidade && (
                  <p className="text-xs text-destructive">
                    {leitosForm.formState.errors.quantidade.message}
                  </p>
                )}
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <Label>Tipo de leito</Label>
              <Controller
                control={leitosForm.control}
                name="tipo"
                render={({ field }) => (
                  <Select value={field.value || null} onValueChange={field.onChange}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Selecione o tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.keys(TIPO_LEITO_LABEL) as TipoLeito[]).map((t) => (
                        <SelectItem key={t} value={t}>
                          {TIPO_LEITO_LABEL[t]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
            <DialogFooter>
              <Button type="submit" disabled={criarLeitosMutation.isPending}>
                {criarLeitosMutation.isPending ? <Spinner /> : 'Criar leitos'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
