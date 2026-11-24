import { lazy } from 'react'
import { Building2 } from 'lucide-react'
import { Link } from 'react-router-dom'

import { PaginaComLista, type SecaoDef } from '@/components/monitor/PaginaComLista'
import { useUnidade } from '@/contexts/UnidadeContext'
import type { QuemMuda } from '@/lib/secretariaCompleta'

const Setores = lazy(() => import('@/pages/Setores').then((m) => ({ default: m.Setores })))
const Configuracao = lazy(() => import('@/pages/Configuracao'))
const Banners = lazy(() => import('@/pages/gestor/Banners').then((m) => ({ default: m.Banners })))
const RevisaoSemConexao = lazy(() => import('@/pages/gestor/RevisaoSemConexao'))
const FerramentasUnidade = lazy(() => import('@/pages/gestor/FerramentasUnidade'))
const Convites = lazy(() => import('@/pages/gestor/Convites'))
const SegurancaEquipe = lazy(() => import('@/pages/gestor/SegurancaEquipe'))
const ModelosTermoUnidade = lazy(() => import('@/components/termo/ModelosTermoUnidade'))
const LiberacaoRede = lazy(() => import('@/components/rede/LiberacaoRede'))
const PessoasDaUnidade = lazy(() => import('@/pages/gestor/PessoasDaUnidade'))

/**
 * Unidade — a configuração da unidade.
 *
 * Revisão do gestor (RT, 24/11/2026): M1 a Unidade fica só com configuração
 * (o mapa de leitos, a ocupação e os alertas foram para a Internação); M2 as
 * abas viram uma lista lateral em grupos; M3 setores e leitos em mestre-detalhe
 * com ação em lote. Os valores de `?aba=` são os mesmos de antes.
 *
 * A seção de setores continua exclusiva do gestor — o agrupamento não alarga
 * permissão de ninguém.
 */
export default function UnidadeGrupo() {
  const { papeisDaUnidade, papelAtivo } = useUnidade()
  const gestor = papeisDaUnidade.includes('gestor')

  // Perfil Gestor da secretaria (RT, 24/11/2026): setores e leitos (sem o mapa,
  // que mostra paciente), convites e configurações da unidade escolhida no topo.
  // Quem também é gestor da unidade fica com as seções do gestor.
  const daSecretaria = papelAtivo === 'gestor_secretaria' && !gestor
  // Pessoas da unidade (RT, 24/11/2026): trocar, pôr e tirar papel sem convite
  // novo; o banco confere quem pode (definir_papeis_na_unidade)
  const quemMuda: QuemMuda | null = daSecretaria ? 'secretaria'
    : papeisDaUnidade.includes('admin') ? 'admin'
    : gestor ? 'gestor'
    : null
  const secaoPessoas: SecaoDef[] = quemMuda
    ? [{ valor: 'pessoas', rotulo: 'Pessoas', grupo: 'Equipe', conteudo: () => <PessoasDaUnidade quem={quemMuda} /> }]
    : []
  const secoes: SecaoDef[] = daSecretaria ? [
    { valor: 'setores', rotulo: 'Setores e leitos', grupo: 'Leitos', conteudo: () => <Setores embutido /> },
    ...secaoPessoas,
    { valor: 'convites', rotulo: 'Convites', grupo: 'Equipe', conteudo: () => <Convites /> },
    { valor: 'configuracoes', rotulo: 'Configurações', grupo: 'Atendimento', conteudo: () => <Configuracao embutido /> },
  ] : [
    ...(gestor
      ? [{
          valor: 'setores', rotulo: 'Setores e leitos', grupo: 'Leitos',
          descricao: 'Cadastro de setores e leitos. A ocupação e o mapa de leitos ficam na Internação.',
          conteudo: () => (
            <>
              <p className="mb-4 text-apoio text-tinta-apoio">
                A ocupação agora e o mapa por setor estão em <Link to="/internacao" className="font-medium text-acao underline-offset-2 hover:underline">Internação</Link>.
              </p>
              <Setores embutido />
            </>
          ),
        }]
      : []),
    ...secaoPessoas,
    // Convites do primeiro acesso: gestor da unidade e admin da rede (o banco confere).
    ...(gestor || papeisDaUnidade.includes('admin')
      ? [{ valor: 'convites', rotulo: 'Convites', grupo: 'Equipe', conteudo: () => <Convites /> }]
      : []),
    ...(gestor
      ? [
          // Segundo fator da equipe: estado e reset (Fase 0, tarefa 1; o banco confere o gestor).
          { valor: 'seguranca', rotulo: 'Segurança da equipe', grupo: 'Equipe', conteudo: () => <SegurancaEquipe /> },
        ]
      : []),
    { valor: 'configuracoes', rotulo: 'Configurações', grupo: 'Atendimento', conteudo: () => <Configuracao embutido /> },
    ...(gestor
      ? [
          { valor: 'ferramentas', rotulo: 'Ferramentas clínicas', grupo: 'Atendimento', conteudo: () => <FerramentasUnidade /> },
          // Modelos de termo de consentimento (onda 4): só o gestor escreve (o banco confere).
          { valor: 'termos', rotulo: 'Termos de consentimento', grupo: 'Atendimento', conteudo: () => <ModelosTermoUnidade /> },
          { valor: 'registros-tardios', rotulo: 'Registros tardios', grupo: 'Atendimento', conteudo: () => <RevisaoSemConexao /> },
        ]
      : []),
    { valor: 'imagens', rotulo: 'Imagens', grupo: 'Unidade', conteudo: () => <Banners embutido /> },
    ...(gestor
      ? [
          // Papéis de rede: o gestor libera ou retira a unidade (Fase 4, tarefa 12; o banco confere).
          { valor: 'rede', rotulo: 'Rede', grupo: 'Unidade', conteudo: () => <LiberacaoRede /> },
        ]
      : []),
  ]

  return (
    <PaginaComLista
      titulo="Unidade"
      descricao="Configuração da unidade: setores e leitos, equipe, atendimento e imagens."
      icone={Building2}
      secoes={secoes}
    />
  )
}
