import { BadgeCheck, Building2, Calculator, CircleSlash, Clock, TriangleAlert } from 'lucide-react'
import type { ReactNode } from 'react'
import { useParams } from 'react-router-dom'

import { textoFontes, type Ficha } from '@/clinico/ficha'
import { TituloCartao, TituloPagina } from '@/components/monitor/Pagina'
import { acharSecao } from '@/content/registry'
import { useUnidade } from '@/contexts/UnidadeContext'
import { useSituacaoFerramenta, type SituacaoFerramenta } from '@/hooks/useFerramentaClinica'
import { data } from '@/lib/formato'
import { cn } from '@/lib/utils'

// Casco visual das ferramentas clínicas (design_handoff/telas/20). A ressalva
// âmbar e o bloco Fonte não são decoração: são o contrato clínico da tela —
// a ferramenta apresenta cálculo e referência; a decisão é do profissional.

export function ToolLayout({
  title,
  description,
  children,
  className,
  referencia,
  revisadoEm,
  ficha,
  semFonte,
}: {
  title: string
  description?: string
  children: ReactNode
  className?: string
  referencia?: string
  revisadoEm?: string
  /** ferramenta do pacote src/clinico: fonte, revisão e versão saem da ficha */
  ficha?: Ficha
  /** material de consulta sem dose e sem fonte declarada: fora da camada base aprovada */
  semFonte?: boolean
}) {
  const { unidadeAtiva } = useUnidade()
  const { data: situacao } = useSituacaoFerramenta(ficha, unidadeAtiva?.unidade_id)
  const suspensa = !!situacao?.unidade?.oculta
  const fonte = ficha ? textoFontes(ficha) : referencia
  const revisado = ficha ? ficha.revisadoEm : revisadoEm
  // O azulejo do título leva o ícone da seção da Central em que a ferramenta está.
  const { section } = useParams()
  const icone = acharSecao(section ?? '')?.icon ?? Calculator
  return (
    <div className={cn('flex flex-col gap-[22px]', className)}>
      <TituloPagina icone={icone} titulo={title} descricao={description} className="mb-0" />
      {ficha && situacao && <FaixaSituacao situacao={situacao} versao={ficha.versao} />}
      {semFonte && (
        <div role="note" className="flex gap-2.5 rounded-container border border-fio bg-superficie px-4 py-3 text-apoio text-tinta-apoio">
          <Clock className="mt-0.5 size-4 shrink-0" aria-hidden />
          <p>Sem fonte declarada: material de consulta, sem dose, fora da camada base aprovada pelo responsável técnico.</p>
        </div>
      )}
      {suspensa ? (
        <div role="status" className="flex gap-2.5 rounded-container border border-fio bg-superficie px-4 py-3 text-corpo text-tinta">
          <CircleSlash className="mt-0.5 size-4 shrink-0 text-tinta-apoio" aria-hidden />
          <p>A gestão desta unidade suspendeu o uso desta ferramenta. A regra da camada base continua registrada.</p>
        </div>
      ) : (
        children
      )}
      <div role="note" className="flex gap-2.5 rounded-container bg-alerta-atencao px-4 py-3 text-apoio text-atencao">
        <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
        <p>Apoio à decisão clínica: confira antes de prescrever. Não substitui o julgamento do profissional responsável.</p>
      </div>
      {(fonte || revisado) && (
        <section aria-label="Fonte" className="rounded-container border border-fio bg-superficie px-4 py-3">
          <TituloCartao className="mb-0">Fonte</TituloCartao>
          {fonte && <p className="mt-1 text-apoio text-tinta">{fonte}</p>}
          {revisado && <p className="mt-0.5 text-rotulo text-tinta-sussurro">Revisado em {revisado}</p>}
          {ficha && <p className="mt-0.5 text-rotulo text-tinta-sussurro">Versão da regra: {ficha.versao}</p>}
        </section>
      )}
    </div>
  )
}

const dataBr = (iso: string | null) => (iso ? data(iso) : '')

// Camada base (aprovação do responsável técnico) e camada da unidade, sempre
// visíveis: quem usa a ferramenta sabe se a regra já foi aprovada e o que a
// unidade acrescentou.
function FaixaSituacao({ situacao, versao }: { situacao: SituacaoFerramenta; versao: string }) {
  const s = situacao.status
  return (
    <div className="flex flex-col gap-2">
      {s === 'aprovada' ? (
        <p className="flex items-center gap-2 text-apoio text-tinta-apoio">
          <BadgeCheck className="size-4 shrink-0 text-acao" aria-hidden />
          Versão {versao} aprovada por {situacao.decidida_por ?? 'responsável técnico'}
          {situacao.decisao_registro ? ` (${situacao.decisao_registro})` : ''} em {dataBr(situacao.decidida_em)}.
        </p>
      ) : s === 'reprovada' ? (
        <div role="alert" className="flex gap-2.5 rounded-container bg-alerta-critico px-4 py-3 text-apoio text-critico">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          <p>
            Versão {versao} reprovada pelo responsável técnico{situacao.decisao_registro ? ` (${situacao.decisao_registro})` : ''}:{' '}
            {situacao.decisao_nota}
          </p>
        </div>
      ) : (
        <div role="note" className="flex gap-2.5 rounded-container bg-alerta-atencao px-4 py-3 text-apoio text-atencao">
          <Clock className="mt-0.5 size-4 shrink-0" aria-hidden />
          <p>
            {s === 'substituida'
              ? `A versão ${versao} desta regra já foi substituída por outra aprovada. Atualize a página.`
              : `Regra (versão ${versao}) aguardando aprovação do responsável técnico.`}
          </p>
        </div>
      )}
      {situacao.unidade?.nota_local && (
        <div className="flex gap-2.5 rounded-container border border-fio bg-superficie px-4 py-3 text-apoio text-tinta">
          <Building2 className="mt-0.5 size-4 shrink-0 text-tinta-apoio" aria-hidden />
          <p>
            <span className="font-medium">Nota da unidade: </span>
            {situacao.unidade.nota_local}
            <span className="text-tinta-sussurro"> — {situacao.unidade.definida_por}, {dataBr(situacao.unidade.definida_em)}</span>
          </p>
        </div>
      )}
    </div>
  )
}
