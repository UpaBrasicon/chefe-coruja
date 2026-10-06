import { useQuery } from '@tanstack/react-query'

import { supabase } from '@/lib/supabase'
import { useUnidade } from '@/contexts/UnidadeContext'
import { useAuth } from '@/contexts/AuthContext'
import { PAPEL_LABEL } from '@/lib/constants'
import type { Papel } from '@/types/database'
import { ZerarSegundoFator } from '@/components/seguranca/CodigosRecuperacao'
import { Badge } from '@/components/ui/badge'
import { Spinner } from '@/components/ui/spinner'

/**
 * Segurança da equipe (Fase 0, tarefa 1): o estado do segundo fator de quem tem
 * vínculo na unidade e o reset para quem perdeu o celular ou o email. Só o
 * gestor da unidade (o banco confere); super admin só é zerado por super admin.
 */
export default function SegurancaEquipe() {
  const { unidadeAtiva } = useUnidade()
  const { perfil } = useAuth()
  const unidadeId = unidadeAtiva?.unidade_id
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['equipe-segundo-fator', unidadeId],
    enabled: !!unidadeId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('equipe_segundo_fator', { p_unidade: unidadeId! })
      if (error) throw error
      return data ?? []
    },
  })

  if (isLoading) return <div className="flex h-32 items-center justify-center"><Spinner /></div>
  if (error) return <p role="alert" className="text-apoio text-critico">Não foi possível carregar a equipe: {error.message}</p>

  return (
    <section aria-label="Segurança da equipe" className="flex flex-col gap-3">
      <p className="text-apoio text-tinta-apoio">
        Alguém perdeu o celular ou o acesso ao email e não tem código de recuperação? Zere o segundo fator da
        pessoa: no próximo login ela confirma pelo email. Fica registrado quem zerou e o motivo.
      </p>
      <ul className="flex flex-col divide-y divide-fio rounded-cartao border border-fio bg-superficie">
        {(data ?? []).map((p) => (
          <li key={p.perfil_id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
            <div className="min-w-0">
              <p className="truncate text-apoio font-medium text-tinta">{p.nome}</p>
              <p className="truncate text-rotulo text-tinta-sussurro">
                {(p.papeis ?? []).map((x) => PAPEL_LABEL[x as Papel] ?? x).join(' · ')}
                {p.email && ` · ${p.email}`}
              </p>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {p.tem_autenticador
                  ? <Badge variant="success">Autenticador ativo</Badge>
                  : <Badge variant="secondary">Só email</Badge>}
                <Badge variant="secondary">{p.codigos_restantes} código(s) de recuperação</Badge>
                {p.zerado_em && (
                  <Badge variant="secondary">Zerado em {new Date(p.zerado_em).toLocaleDateString('pt-BR')}</Badge>
                )}
              </div>
            </div>
            {p.perfil_id !== perfil?.id && !p.super_admin && (
              <ZerarSegundoFator perfilId={p.perfil_id} nome={p.nome} onFeito={() => void refetch()} />
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}
