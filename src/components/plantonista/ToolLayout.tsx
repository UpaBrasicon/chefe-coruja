import { BadgeCheck, Building2, CircleSlash, Clock, TriangleAlert } from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'

import { textoFontes, type Ficha } from '@/clinico/ficha'
import { textoRef, type ItemGuia } from '@/clinico/guia'
import { topoDa, type Topo } from '@/clinico/topos'
import { Link } from 'react-router-dom'

import { Chip, TituloPagina } from '@/components/monitor/Pagina'
import { useRelacionadas, type Relacionada } from '@/components/plantonista/calc/contexto'
import { ROTA_SOBRE_MODULO } from '@/content/sobreModuloClinico'
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
  // Relacionadas (piloto das calculadoras): coluna da direita na tela larga, no fim nas outras.
  const relacionadas = useRelacionadas()
  const temLado = indice.length >= 3 || relacionadas.length > 0
  // Textos do topo (modelo das calculadoras, RT 16/11/2026): frase-resumo no lugar da descrição.
  const topo = ficha ? topoDa(ficha.id) : undefined
  return (
    <div className={cn('flex flex-col gap-[22px]', className)}>
      <TituloPagina titulo={title} descricao={topo?.resumo ?? description} className="mb-0" />
      {topo && <CabecalhoTopo topo={topo} />}
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
        <div className={cn('grid items-start gap-x-10', temLado && 'xl:grid-cols-[minmax(0,1fr)_220px]')}>
          <div ref={corpo} className="cc-leitura flex min-w-0 flex-col gap-[22px]">{children}</div>
          {temLado && (
            <div className="sticky top-4 hidden flex-col gap-6 border-l border-fio pl-4 xl:flex">
              {indice.length >= 3 && (
                <nav aria-label="Nesta página" className="flex flex-col gap-1.5">
                  <span className="text-rotulo font-semibold text-tinta-apoio">Nesta página</span>
                  {indice.map((s) => (
                    <a key={s.id} href={`#${s.id}`} className="text-apoio text-acao underline-offset-4 hover:underline">{s.texto}</a>
                  ))}
                </nav>
              )}
              <ListaRelacionadas itens={relacionadas} />
            </div>
          )}
        </div>
      )}
      {relacionadas.length > 0 && (
        <div className="rounded-cartao border border-fio bg-superficie px-5 py-4 xl:hidden">
          <ListaRelacionadas itens={relacionadas} />
        </div>
      )}
      <div role="note" className="flex gap-2.5 border-t border-fio pt-3 text-apoio text-atencao">
        <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
        <p>
          Apoio à decisão clínica: confira antes de prescrever. Não substitui o julgamento do profissional responsável.{' '}
          <Link to={ROTA_SOBRE_MODULO} className="text-acao underline underline-offset-4">Sobre o módulo clínico</Link>
        </p>
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
      ) : s === 'substituida' && situacao.decidida_em ? (
        // LG10: a versão nova é aprovada antes de ir ao ar; até a publicação,
        // a tela segue com esta, que foi aprovada.
        <p className="flex items-center gap-2 text-apoio text-tinta-apoio">
          <BadgeCheck className="size-4 shrink-0 text-acao" aria-hidden />
          Versão {versao} aprovada por {situacao.decidida_por ?? 'responsável técnico'}
          {situacao.decisao_registro ? ` (${situacao.decisao_registro})` : ''} em {dataBr(situacao.decidida_em)}. A versão nova já foi aprovada e entra na próxima publicação.
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

function ListaRelacionadas({ itens }: { itens: Relacionada[] }) {
  if (itens.length === 0) return null
  return (
    <nav aria-label="Ferramentas relacionadas" className="flex flex-col gap-2">
      <span className="text-rotulo font-semibold text-tinta-apoio">Relacionadas</span>
      <ul className="flex flex-col gap-2.5">
        {itens.map((i) => (
          <li key={i.to} className="flex flex-col gap-0.5">
            <Link to={i.to} className="text-apoio font-medium text-acao underline-offset-4 hover:underline">{i.rotulo}</Link>
            <span className="text-rotulo text-tinta-sussurro">{i.descricao}</span>
          </li>
        ))}
      </ul>
    </nav>
  )
}

// Abas recolhidas do topo, como no modelo do RT (MDCalc): "Quando usar" e
// "Por que usar", com a fonte de cada frase; abaixo, as instruções curtas.
function CabecalhoTopo({ topo }: { topo: Topo }) {
  const [aberta, setAberta] = useState<'quando' | 'porque' | null>(null)
  const abas = ([['quando', 'Quando usar', topo.quandoUsar], ['porque', 'Por que usar', topo.porQueUsar]] as const).filter(([, , itens]) => (itens ?? []).length > 0)
  const itens: ItemGuia[] = (aberta === 'quando' ? topo.quandoUsar : aberta === 'porque' ? topo.porQueUsar : undefined) ?? []
  return (
    <div className="flex flex-col gap-3">
      {abas.length > 0 && (
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap gap-2">
            {abas.map(([id, rotulo]) => (
              <Chip key={id} variante="opcao" ativo={aberta === id} onClick={() => setAberta((a) => (a === id ? null : id))}>
                {rotulo}
              </Chip>
            ))}
          </div>
          {aberta && (
            <ul className="flex list-disc flex-col gap-1.5 rounded-container border border-fio bg-superficie py-3 pr-4 pl-8 text-apoio text-tinta">
              {itens.map((i) => <li key={i.texto}>{i.texto} <span className="text-tinta-sussurro">({textoRef(i.ref)})</span></li>)}
            </ul>
          )}
        </div>
      )}
      {topo.instrucoes && (
        <div role="note" className="rounded-container border border-fio bg-superficie px-4 py-3 text-apoio text-tinta">
          <span className="font-semibold">Instruções</span> · {topo.instrucoes}
        </div>
      )}
    </div>
  )
}
