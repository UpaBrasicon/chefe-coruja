import { BadgeCheck, Building2, CircleSlash, Clock, TriangleAlert } from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'

import { textoFontes, type Ficha } from '@/clinico/ficha'
import { TituloPagina } from '@/components/monitor/Pagina'
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
  const corpo = useRef<HTMLDivElement>(null)
  const indice = useIndice(corpo)
  return (
    <div className={cn('flex flex-col gap-[22px]', className)}>
      <TituloPagina titulo={title} descricao={description} className="mb-0" />
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
        // Leitura de manual (revisão visual 3.8, opção C): com três partes ou
        // mais, "Nesta página" à direita leva a cada uma (tela larga).
        <div className={cn('grid items-start gap-x-10', indice.length >= 3 && 'xl:grid-cols-[minmax(0,1fr)_200px]')}>
          <div ref={corpo} className="cc-leitura flex min-w-0 flex-col gap-[22px]">{children}</div>
          {indice.length >= 3 && (
            <nav aria-label="Nesta página" className="sticky top-4 hidden flex-col gap-1.5 border-l border-fio pl-4 xl:flex">
              <span className="text-rotulo font-semibold text-tinta-apoio">Nesta página</span>
              {indice.map((s) => (
                <a key={s.id} href={`#${s.id}`} className="text-apoio text-tinta-sussurro hover:text-acao">{s.texto}</a>
              ))}
            </nav>
          )}
        </div>
      )}
      <div role="note" className="flex gap-2.5 border-t border-fio pt-3 text-apoio text-atencao">
        <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
        <p>Apoio à decisão clínica: confira antes de prescrever. Não substitui o julgamento do profissional responsável.</p>
      </div>
      {(fonte || revisado) && (
        <section aria-label="Fonte" className="flex flex-col gap-0.5">
          <p className="text-apoio text-tinta-apoio"><span className="font-semibold text-tinta">Fonte</span>{fonte && <> · {fonte}</>}</p>
          {revisado && <p className="text-rotulo text-tinta-sussurro">Revisado em {revisado}</p>}
          {ficha && <p className="text-rotulo text-tinta-sussurro">Versão da regra: {ficha.versao}</p>}
        </section>
      )}
    </div>
  )
}

type ItemIndice = { id: string; texto: string }
const slugDe = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48)

/**
 * As partes da ferramenta são os títulos dos cartões (CardTitle) ou o que
 * marcar `data-indice`. Lê do DOM e acompanha as mudanças: o resultado de
 * uma calculadora só aparece depois que os campos são preenchidos.
 */
function useIndice(ref: React.RefObject<HTMLDivElement | null>) {
  const [itens, setItens] = useState<ItemIndice[]>([])
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ler = () => {
      const novos = [...el.querySelectorAll<HTMLElement>('[data-slot="card-title"], [data-indice]')]
        .map((h, i) => {
          const texto = (h.dataset.indice || h.textContent || '').trim()
          if (!h.id) h.id = `parte-${slugDe(texto) || i}`
          return { id: h.id, texto }
        })
        .filter((x) => x.texto)
      setItens((antes) => (antes.length === novos.length && antes.every((a, i) => a.id === novos[i].id && a.texto === novos[i].texto) ? antes : novos))
    }
    ler()
    const obs = new MutationObserver(ler)
    obs.observe(el, { childList: true, subtree: true, characterData: true })
    return () => obs.disconnect()
  }, [ref])
  return itens
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
