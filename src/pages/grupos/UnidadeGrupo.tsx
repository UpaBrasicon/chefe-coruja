import { lazy } from 'react'
import { Building2 } from 'lucide-react'

import { TabsPagina, type AbaDef } from '@/components/TabsPagina'
import { useUnidade } from '@/contexts/UnidadeContext'

const Setores = lazy(() => import('@/pages/Setores').then((m) => ({ default: m.Setores })))
const Configuracao = lazy(() => import('@/pages/Configuracao'))
const Banners = lazy(() => import('@/pages/gestor/Banners').then((m) => ({ default: m.Banners })))

/**
 * Unidade — as três telas de configuração da mesma unidade.
 *
 * "Imagens da Unidade" estava solta entre telas operacionais; aqui fica junto
 * de setores/leitos e das configurações a que pertence.
 *
 * A aba de setores continua exclusiva do gestor — o agrupamento não alarga
 * permissão de ninguém.
 */
export default function UnidadeGrupo() {
  const { papeisDaUnidade } = useUnidade()

  const abas: AbaDef[] = [
    ...(papeisDaUnidade.includes('gestor')
      ? [{ valor: 'setores', rotulo: 'Setores e Leitos', conteudo: () => <Setores embutido /> }]
      : []),
    { valor: 'configuracoes', rotulo: 'Configurações', conteudo: () => <Configuracao embutido /> },
    { valor: 'imagens', rotulo: 'Imagens', conteudo: () => <Banners embutido /> },
  ]

  return (
    <TabsPagina
      titulo="Unidade"
      descricao="Setores e leitos, configurações de comunicação e check-in, e o quadro de imagens."
      icone={Building2}
      abas={abas}
    />
  )
}
