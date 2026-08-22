import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { UserPlus, UserRoundX } from 'lucide-react'
import * as React from 'react'

import { usePessoasAdmin } from '@/hooks/usePessoas'
import { criarOuReativarVinculo, revogarVinculo } from '@/lib/api'
import { PAPEL_DESCRIPTION, PAPEL_LABEL, TIPO_UNIDADE_LABEL } from '@/lib/constants'
import type { Papel } from '@/types/database'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Spinner } from '@/components/ui/spinner'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

const schema = z.object({
  perfil_id: z.string().min(1, 'Selecione uma pessoa.'),
  unidade_id: z.string().min(1, 'Selecione uma unidade.'),
  papel: z.enum(['admin', 'gestor', 'plantonista']),
})

type FormData = z.infer<typeof schema>

export function Pessoas({ embutido = false }: { embutido?: boolean } = {}) {
  const { data, isLoading, error } = usePessoasAdmin()
  const { perfil } = useAuth()
  const queryClient = useQueryClient()
  const [dialogAberto, setDialogAberto] = React.useState(false)
  const [erro, setErro] = React.useState<string | null>(null)

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { perfil_id: '', unidade_id: '', papel: undefined },
  })

  const invalidar = () => queryClient.invalidateQueries({ queryKey: ['pessoas-admin'] })

  const criarMutation = useMutation({
    mutationFn: (form: FormData) =>
      criarOuReativarVinculo({
        perfil_id: form.perfil_id,
        unidade_id: form.unidade_id,
        papel: form.papel,
        criado_por: perfil!.id,
      }),
    onSuccess: () => {
      invalidar()
      setDialogAberto(false)
      reset()
    },
    onError: (err) => setErro(err.message),
  })

  const revogarMutation = useMutation({
    mutationFn: (v: { id: string; unidadeId: string }) => revogarVinculo(v.id, v.unidadeId),
    onSuccess: invalidar,
    onError: (err) => setErro(err.message),
  })

  function abrirDialog(perfilPreselecionado?: string) {
    reset({ perfil_id: perfilPreselecionado ?? '', unidade_id: '', papel: undefined })
    setErro(null)
    setDialogAberto(true)
  }

  async function onSubmit(form: FormData) {
    setErro(null)
    criarMutation.mutate(form)
  }

  if (isLoading) {
    return (
      <div className="flex h-40 items-center justify-center">
        <Spinner />
      </div>
    )
  }

  if (error || !data) {
    return <p className="text-sm text-destructive">Falha ao carregar pessoas: {error?.message}</p>
  }

  const { perfis, unidades, vinculos } = data
  const vinculosAtivos = vinculos.filter((v) => v.ativo)
  const semVinculo = perfis.filter((p) => !vinculosAtivos.some((v) => v.perfil_id === p.id))

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        {embutido ? (
          <div />
        ) : (
          <div>
            <h1 className="text-xl font-semibold">Pessoas</h1>
            <p className="text-sm text-muted-foreground">
              Crie e revogue vínculos por unidade. Todas as alterações ficam no log de auditoria.
            </p>
          </div>
        )}
        <Button onClick={() => abrirDialog()}>
          <UserPlus />
          Novo vínculo
        </Button>
      </div>

      {erro && <p className="text-sm text-destructive">{erro}</p>}

      <Card>
        <CardHeader>
          <CardTitle>Vínculos ativos</CardTitle>
          <CardDescription>Pessoas vinculadas a unidades da sua organização.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Pessoa</TableHead>
                <TableHead>Unidade</TableHead>
                <TableHead>Papel</TableHead>
                <TableHead className="text-right">Ação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {vinculosAtivos.map((v) => {
                const pessoa = perfis.find((p) => p.id === v.perfil_id)
                const unidade = unidades.find((u) => u.id === v.unidade_id)
                return (
                  <TableRow key={v.id}>
                    <TableCell>
                      <div className="font-medium">{pessoa?.nome_completo ?? '—'}</div>
                      <div className="text-xs text-muted-foreground">{pessoa?.email}</div>
                    </TableCell>
                    <TableCell>{unidade?.nome ?? '—'}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{PAPEL_LABEL[v.papel]}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={revogarMutation.isPending}
                        onClick={() => revogarMutation.mutate({ id: v.id, unidadeId: v.unidade_id })}
                      >
                        <UserRoundX />
                        Revogar
                      </Button>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>

          {vinculosAtivos.length === 0 && (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Nenhum vínculo ativo ainda.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Pessoas sem vínculo</CardTitle>
          <CardDescription>
            Contas criadas que ainda aguardam liberação. Vincule uma unidade e um papel para liberar
            o acesso.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-2">
            {semVinculo.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between rounded-lg border px-3 py-2"
              >
                <div>
                  <div className="text-sm font-medium">{p.nome_completo}</div>
                  <div className="text-xs text-muted-foreground">{p.email}</div>
                </div>
                <Button variant="outline" size="sm" onClick={() => abrirDialog(p.id)}>
                  Vincular
                </Button>
              </div>
            ))}
            {semVinculo.length === 0 && (
              <p className="py-4 text-center text-sm text-muted-foreground">
                Nenhuma conta aguardando liberação.
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      <Dialog open={dialogAberto} onOpenChange={(o) => { setDialogAberto(o); if (!o) reset() }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Criar vínculo</DialogTitle>
            <DialogDescription>
              Atribua um papel por unidade. O acesso passa a valer na sessão seguinte.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label>Pessoa</Label>
              <Controller
                control={control}
                name="perfil_id"
                render={({ field }) => (
                  <Select value={field.value || null} onValueChange={field.onChange}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Selecione a pessoa" />
                    </SelectTrigger>
                    <SelectContent>
                      {perfis.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.nome_completo}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.perfil_id && (
                <p className="text-xs text-destructive">{errors.perfil_id.message}</p>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <Label>Unidade</Label>
              <Controller
                control={control}
                name="unidade_id"
                render={({ field }) => (
                  <Select value={field.value || null} onValueChange={field.onChange}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Selecione a unidade" />
                    </SelectTrigger>
                    <SelectContent>
                      {unidades.map((u) => (
                        <SelectItem key={u.id} value={u.id}>
                          {u.nome} ({TIPO_UNIDADE_LABEL[u.tipo]})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.unidade_id && (
                <p className="text-xs text-destructive">{errors.unidade_id.message}</p>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <Label>Papel</Label>
              <Controller
                control={control}
                name="papel"
                render={({ field }) => (
                  <Select value={field.value || null} onValueChange={field.onChange}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Selecione o papel" />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.keys(PAPEL_LABEL) as Papel[]).map((p) => (
                        <SelectItem key={p} value={p}>
                          <div className="flex flex-col gap-0.5">
                            <span>{PAPEL_LABEL[p]}</span>
                            <span className="text-xs text-muted-foreground">
                              {PAPEL_DESCRIPTION[p]}
                            </span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.papel && <p className="text-xs text-destructive">{errors.papel.message}</p>}
            </div>

            <DialogFooter>
              <Button type="submit" disabled={criarMutation.isPending}>
                {criarMutation.isPending ? <Spinner /> : 'Criar vínculo'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
