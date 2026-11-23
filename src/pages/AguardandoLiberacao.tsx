import { useQuery, useQueryClient } from '@tanstack/react-query'
import * as React from 'react'
import { useNavigate } from 'react-router-dom'

import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { LinhaEntrada, PaginaEntrada } from '@/components/entrada/LadoMarca'
import { INTERVALO_LIBERACAO_MS, estaLiberado } from '@/domain/liberacao'
import { supabase } from '@/lib/supabase'

export function AguardandoLiberacao() {
  const { signOut, perfil } = useAuth()
  const navigate = useNavigate()
  const qc = useQueryClient()

  // Fase 1, item 15: a tela confere sozinha (a cada 30 s e ao voltar para a aba)
  // e abre o app assim que o gestor cria o vínculo, sem sair e entrar de novo.
  const liberacao = useQuery({
    queryKey: ['aguardando-liberacao', perfil?.id],
    enabled: !!perfil,
    refetchInterval: INTERVALO_LIBERACAO_MS,
    refetchOnWindowFocus: true,
    queryFn: async () => {
      const [v, s] = await Promise.all([
        supabase.from('vinculos').select('id', { count: 'exact', head: true }).eq('perfil_id', perfil!.id).eq('ativo', true),
        supabase.from('super_admins').select('perfil_id').eq('perfil_id', perfil!.id).maybeSingle(),
      ])
      if (v.error) throw v.error
      return estaLiberado(v.count ?? 0, !!s.data)
    },
  })

  React.useEffect(() => {
    if (!liberacao.data) return
    // os vínculos guardados antes (vazios) não podem segurar o redirecionamento
    void qc.invalidateQueries({ queryKey: ['vinculos'] })
    void qc.invalidateQueries({ queryKey: ['super_admin'] })
    navigate('/', { replace: true })
  }, [liberacao.data, qc, navigate])

  async function handleSair() {
    await signOut()
    navigate('/login', { replace: true })
  }

  return (
    <PaginaEntrada
      titulo="Aguardando liberação."
      abertura={`Olá, ${perfil?.nome_completo ?? 'colega'}. A sua conta existe, mas ainda não está ligada a nenhuma unidade.`}
      acao={<Button variant="outline" onClick={handleSair}>Sair</Button>}
    >
      <ul className="cc-linhas">
        <LinhaEntrada titulo="Quem libera">
          O gestor da sua unidade (ou a administração da rede) define o seu papel em cada unidade.
        </LinhaEntrada>
        <LinhaEntrada titulo="Quando abre">
          Assim que o vínculo é criado, esta tela abre o app sozinha, em até meio minuto. Não é preciso sair nem pedir de novo.
        </LinhaEntrada>
      </ul>
    </PaginaEntrada>
  )
}
