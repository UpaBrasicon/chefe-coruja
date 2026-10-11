import { lazy } from 'react'
import { Building2 } from 'lucide-react'

import { TabsPagina, type AbaDef } from '@/components/TabsPagina'
import { useUnidade } from '@/contexts/UnidadeContext'

const MapaLeitos = lazy(() => import('@/pages/gestor/MapaLeitos').then((m) => ({ default: m.MapaLeitos })))
const Setores = lazy(() => import('@/pages/Setores').then((m) => ({ default: m.Setores })))
const Configuracao = lazy(() => import('@/pages/Configuracao'))
const Banners = lazy(() => import('@/pages/gestor/Banners').then((m) => ({ default: m.Banners })))
const RevisaoSemConexao = lazy(() => import('@/pages/gestor/RevisaoSemConexao'))
const FerramentasUnidade = lazy(() => import('@/pages/gestor/FerramentasUnidade'))
const Convites = lazy(() => import('@/pages/gestor/Convites'))
const SegurancaEquipe = lazy(() => import('@/pages/gestor/SegurancaEquipe'))
const ModelosTermoUnidade = lazy(() => import('@/components/termo/ModelosTermoUnidade'))
const LiberacaoRede = lazy(() => import('@/components/rede/LiberacaoRede'))

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
      ? [{
          valor: 'setores', rotulo: 'Setores e Leitos',
          // ocupação, pacientes por plantonista, vencidas e o mapa de leitos
          // (protótipo, aba Setores) antes do cadastro de setores e leitos
          conteudo: () => <><MapaLeitos /><Setores embutido /></>,
        }]
      : []),
    // Convites do primeiro acesso: gestor da unidade e admin da rede (o banco confere).
    ...(papeisDaUnidade.includes('gestor') || papeisDaUnidade.includes('admin')
      ? [{ valor: 'convites', rotulo: 'Convites', conteudo: () => <Convites /> }]
      : []),
    { valor: 'configuracoes', rotulo: 'Configurações', conteudo: () => <Configuracao embutido /> },
    { valor: 'imagens', rotulo: 'Imagens', conteudo: () => <Banners embutido /> },
    ...(papeisDaUnidade.includes('gestor')
      ? [
          { valor: 'registros-tardios', rotulo: 'Registros tardios', conteudo: () => <RevisaoSemConexao /> },
          { valor: 'ferramentas', rotulo: 'Ferramentas clínicas', conteudo: () => <FerramentasUnidade /> },
          // Modelos de termo de consentimento (onda 4): só o gestor escreve (o banco confere).
          { valor: 'termos', rotulo: 'Termos de consentimento', conteudo: () => <ModelosTermoUnidade /> },
          // Segundo fator da equipe: estado e reset (Fase 0, tarefa 1; o banco confere o gestor).
          { valor: 'seguranca', rotulo: 'Segurança da equipe', conteudo: () => <SegurancaEquipe /> },
          // Papéis de rede: o gestor libera ou retira a unidade (Fase 4, tarefa 12; o banco confere).
          { valor: 'rede', rotulo: 'Rede', conteudo: () => <LiberacaoRede /> },
        ]
      : []),
  ]

  return (
    <TabsPagina
      titulo="Unidade"
      descricao="Setores e leitos, convites de primeiro acesso, configurações de comunicação e check-in, e o quadro de imagens."
      icone={Building2}
      abas={abas}
    />
  )
}
