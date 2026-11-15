import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { UserPlus, UserRoundCheck, UserRoundX, Users } from 'lucide-react'
import * as React from 'react'

import { usePessoasAdmin, type AdesaoAdmin } from '@/hooks/usePessoas'
import { concluirAdesao, reativarVinculo, revogarVinculo } from '@/lib/api'
import { PAPEL_LABEL, TIPO_UNIDADE_LABEL } from '@/lib/constants'
import { useAuth } from '@/contexts/AuthContext'
import { ZerarSegundoFator } from '@/components/seguranca/CodigosRecuperacao'
import { TituloPagina } from '@/components/monitor/Pagina'
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

// S1 da trilha de segurança: o admin não cria vínculo direto. Revoga e reativa
// vínculos da própria organização e conclui a entrada de quem aderiu ao
// contrato. Pessoa nova ou papel novo entram pelo convite (aba Convites da
// unidade). O banco confere tudo e grava a auditoria.
export function Pessoas({ embutido = false }: { embutido?: boolean } = {}) {
  const { data, isLoading, error } = usePessoasAdmin()
  const { perfil } = useAuth()
  const queryClient = useQueryClient()
  const [erro, setErro] = React.useState<string | null>(null)
  const [adesaoAberta, setAdesaoAberta] = React.useState<AdesaoAdmin | null>(null)
  const [unidadeEscolhida, setUnidadeEscolhida] = React.useState<string>('')

  const invalidar = () => queryClient.invalidateQueries({ queryKey: ['pessoas-admin'] })

  const revogarMutation = useMutation({
    mutationFn: (id: string) => revogarVinculo(id),
    onSuccess: invalidar,
    onError: (err) => setErro(err.message),
  })

  const reativarMutation = useMutation({
    mutationFn: (id: string) => reativarVinculo(id),
    onSuccess: invalidar,
    onError: (err) => setErro(err.message),
  })

  const concluirMutation = useMutation({
    mutationFn: (v: { adesaoId: string; unidadeId: string }) => concluirAdesao(v.adesaoId, v.unidadeId),
    onSuccess: () => {
      invalidar()
      setAdesaoAberta(null)
      setUnidadeEscolhida('')
    },
    onError: (err) => setErro(err.message),
  })

  if (isLoading) {
    return (
      <div className="flex h-40 items-center justify-center">
        <Spinner />
      </div>
    )
  }

  if (error || !data) {
    return <p className="text-apoio text-critico">Falha ao carregar pessoas: {error?.message}</p>
  }

  const { perfis, unidades, vinculos, adesoes } = data
  const vinculosAtivos = vinculos.filter((v) => v.ativo)
  const vinculosInativos = vinculos.filter((v) => !v.ativo)
  // adesão espera entrada enquanto a pessoa não tem vínculo ativo numa unidade da organização do contrato
  const adesoesPendentes = adesoes.filter(
    (a) =>
      !vinculosAtivos.some(
        (v) => v.perfil_id === a.perfil_id && unidades.some((u) => u.id === v.unidade_id && u.organizacao_id === a.organizacao_id)
      )
  )
  const unidadesDaAdesao = adesaoAberta ? unidades.filter((u) => u.organizacao_id === adesaoAberta.organizacao_id) : []

  const botaoConvite = (
    <Button render={<Link to="/unidade?aba=convites" />} nativeButton={false}>
      <UserPlus />
      Gerar convite
    </Button>
  )

  const nomeDe = (perfilId: string) => perfis.find((p) => p.id === perfilId)
  const unidadeDe = (unidadeId: string) => unidades.find((u) => u.id === unidadeId)

  return (
    <div className="flex flex-col gap-6">
      {embutido ? (
        <div className="flex items-center justify-between">
          <p className="text-apoio text-tinta-apoio">Pessoa nova ou papel novo entram pelo convite da unidade.</p>
          {botaoConvite}
        </div>
      ) : (
        <TituloPagina
          icone={Users}
          titulo="Pessoas"
          descricao="Revogue e reative vínculos da sua organização. Pessoa nova ou papel novo entram pelo convite. Tudo fica no log de auditoria."
          acoes={botaoConvite}
          className="mb-0"
        />
      )}

      {erro && <p className="text-apoio text-critico">{erro}</p>}

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
                const pessoa = nomeDe(v.perfil_id)
                const unidade = unidadeDe(v.unidade_id)
                return (
                  <TableRow key={v.id}>
                    <TableCell>
                      <div className="font-medium">{pessoa?.nome_completo ?? '—'}</div>
                      <div className="text-rotulo text-tinta-sussurro">{pessoa?.email}</div>
                    </TableCell>
                    <TableCell>{unidade?.nome ?? '—'}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{PAPEL_LABEL[v.papel]}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {pessoa && pessoa.id !== perfil?.id && (
                        <ZerarSegundoFator perfilId={pessoa.id} nome={pessoa.nome_completo} />
                      )}
                      {v.perfil_id !== perfil?.id && (
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={revogarMutation.isPending}
                          onClick={() => revogarMutation.mutate(v.id)}
                        >
                          <UserRoundX />
                          Revogar
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>

          {vinculosAtivos.length === 0 && (
            <p className="py-6 text-center text-apoio text-tinta-sussurro">
              Nenhum vínculo ativo ainda.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Entrada pelo contrato</CardTitle>
          <CardDescription>
            Pessoas que aderiram ao contrato da rede. Escolha a unidade para concluir a entrada, com o papel do contrato.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-2">
            {adesoesPendentes.map((a) => {
              const pessoa = nomeDe(a.perfil_id)
              return (
                <div key={a.id} className="flex items-center justify-between rounded-controle border px-3 py-2">
                  <div>
                    <div className="text-apoio font-medium">{pessoa?.nome_completo ?? '—'}</div>
                    <div className="text-rotulo text-tinta-sussurro">
                      {pessoa?.email} · {PAPEL_LABEL[a.papel]}
                      {!a.email_confirmado && ' · e-mail não confirmado'}
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={a.perfil_id === perfil?.id || !a.email_confirmado}
                    title={a.email_confirmado ? undefined : 'A entrada é concluída depois de a pessoa confirmar o e-mail.'}
                    onClick={() => {
                      setErro(null)
                      setUnidadeEscolhida('')
                      setAdesaoAberta(a)
                    }}
                  >
                    <UserRoundCheck />
                    Concluir entrada
                  </Button>
                </div>
              )
            })}
            {adesoesPendentes.length === 0 && (
              <p className="py-4 text-center text-apoio text-tinta-sussurro">Ninguém aguardando entrada pelo contrato.</p>
            )}
          </div>
        </CardContent>
      </Card>

      {vinculosInativos.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Vínculos revogados</CardTitle>
            <CardDescription>Quem já passou pela organização. Reativar devolve o mesmo papel na mesma unidade.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-2">
              {vinculosInativos.map((v) => {
                const pessoa = nomeDe(v.perfil_id)
                return (
                  <div key={v.id} className="flex items-center justify-between rounded-controle border px-3 py-2">
                    <div>
                      <div className="text-apoio font-medium">{pessoa?.nome_completo ?? '—'}</div>
                      <div className="text-rotulo text-tinta-sussurro">
                        {unidadeDe(v.unidade_id)?.nome ?? '—'} · {PAPEL_LABEL[v.papel]}
                      </div>
                    </div>
                    {v.perfil_id !== perfil?.id && (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={reativarMutation.isPending}
                        onClick={() => reativarMutation.mutate(v.id)}
                      >
                        Reativar
                      </Button>
                    )}
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog open={adesaoAberta !== null} onOpenChange={(o) => { if (!o) setAdesaoAberta(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Concluir entrada</DialogTitle>
            <DialogDescription>
              {adesaoAberta ? `${nomeDe(adesaoAberta.perfil_id)?.nome_completo ?? 'A pessoa'} entra como ${PAPEL_LABEL[adesaoAberta.papel]}, o papel do contrato. O acesso passa a valer na sessão seguinte.` : null}
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-2">
            <Label>Unidade</Label>
            <Select
              items={Object.fromEntries(unidadesDaAdesao.map((u) => [u.id, `${u.nome} (${TIPO_UNIDADE_LABEL[u.tipo]})`]))}
              value={unidadeEscolhida || null}
              onValueChange={(v) => setUnidadeEscolhida(v ?? '')}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Selecione a unidade" />
              </SelectTrigger>
              <SelectContent>
                {unidadesDaAdesao.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.nome} ({TIPO_UNIDADE_LABEL[u.tipo]})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <DialogFooter>
            <Button
              disabled={!adesaoAberta || !unidadeEscolhida || concluirMutation.isPending}
              onClick={() => adesaoAberta && concluirMutation.mutate({ adesaoId: adesaoAberta.id, unidadeId: unidadeEscolhida })}
            >
              {concluirMutation.isPending ? <Spinner /> : 'Concluir entrada'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
