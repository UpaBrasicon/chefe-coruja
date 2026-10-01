import { Navigate, Outlet } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'

import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { Spinner } from '@/components/ui/spinner'

/**
 * Portão do ADMINISTRADOR GERAL (super admin da plataforma). O super admin
 * aparece como 'admin' em toda unidade, então o guard de papel 'admin' deixa
 * passar também o administrador comum de uma unidade — aqui conferimos o super
 * admin de verdade (public.super_admins), com a MESMA chave do UnidadeContext
 * para reaproveitar o cache. As próprias RPCs da tela também barram no banco.
 */
export function RequireSuperAdmin() {
  const { perfil } = useAuth()

  const { data: isSuper, isLoading } = useQuery({
    queryKey: ['super_admin', perfil?.id],
    enabled: !!perfil,
    queryFn: async () => {
      const { data } = await supabase
        .from('super_admins')
        .select('perfil_id')
        .eq('perfil_id', perfil!.id)
        .maybeSingle()
      return !!data
    },
  })

  if (!perfil || isLoading || isSuper === undefined) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner />
      </div>
    )
  }

  if (!isSuper) return <Navigate to="/" replace />

  return <Outlet />
}
