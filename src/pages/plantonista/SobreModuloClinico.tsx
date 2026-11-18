import { useQuery } from '@tanstack/react-query'
import { Info } from 'lucide-react'
import { Link } from 'react-router-dom'

import { RelatarProblema } from '@/components/clinico/RelatarProblema'
import { TituloPagina, TituloSecao } from '@/components/monitor/Pagina'
import { SOBRE_MODULO_CLINICO } from '@/content/sobreModuloClinico'
import { diaMesHora } from '@/lib/formato'
import { supabase } from '@/lib/supabase'
import { DESFECHO, SITUACAO_RELATO, TIPO_RELATO, type RelatoTv } from '@/lib/tecnovigilancia'

// LG11, decisão C5: rotulagem mínima do módulo clínico (texto aprovado pelo RT em 17/11/2026).
// LG12, V1 = A: o canal de erro passa a ser "Relatar problema", e quem relatou
// acompanha aqui o andamento e a conclusão (RDC 67/2009, art. 6º, XI).
export default function SobreModuloClinico() {
  return (
    <div className="flex max-w-[720px] flex-col gap-[22px]">
      <TituloPagina icone={Info} titulo="Sobre o módulo clínico" descricao="Finalidade, limites e como relatar erro" className="mb-0" />
      {SOBRE_MODULO_CLINICO.map((p) => (
        <section key={p.titulo} className="flex flex-col gap-1.5">
          <TituloSecao className="mb-0">{p.titulo}</TituloSecao>
          {p.texto && <p className="text-corpo text-tinta-apoio">{p.texto}</p>}
          {p.itens && (
            <ul className="flex list-disc flex-col gap-1 pl-5 text-corpo text-tinta-apoio">
              {p.itens.map((i) => (
                <li key={i}>{i}</li>
              ))}
            </ul>
          )}
          {p.titulo === 'Achou um erro?' && <RelatarProblema ferramentaId="modulo-clinico" className="self-start" />}
        </section>
      ))}
      <MeusRelatos />
      <Link to="/plantonista" className="text-apoio text-acao underline-offset-4 hover:underline">
        Voltar à Central
      </Link>
    </div>
  )
}

function MeusRelatos() {
  const { data: relatos } = useQuery({
    queryKey: ['meus-relatos-tecnovigilancia'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('meus_relatos_tecnovigilancia')
      if (error) throw error
      return (data ?? []) as unknown as RelatoTv[]
    },
  })
  if (!relatos?.length) return null
  return (
    <section className="flex flex-col gap-2">
      <TituloSecao className="mb-0">Meus relatos</TituloSecao>
      <ul className="flex flex-col gap-2">
        {relatos.map((r) => {
          const conclusao = [...r.andamento].reverse().find((a) => a.situacao === 'concluido')
          return (
            <li key={r.id} className="rounded-cartao border border-fio bg-superficie px-4 py-3 text-apoio text-tinta-apoio">
              <p className="text-corpo text-tinta">
                Nº {r.numero} · {r.ferramenta_titulo ?? r.ferramenta_id}{r.versao ? ` (versão ${r.versao})` : ''} · {SITUACAO_RELATO[r.situacao]}
              </p>
              <p>{diaMesHora(r.relatado_em)} · {TIPO_RELATO[r.tipo]}{r.desfecho ? ` · ${DESFECHO[r.desfecho]}` : ''}</p>
              <p className="mt-1 whitespace-pre-line">{r.descricao}</p>
              {conclusao && (
                <p className="mt-1 text-tinta">
                  Conclusão: {conclusao.texto} Causa: {conclusao.causa}. Ação: {conclusao.acao}.
                  {conclusao.versao_corrigida ? ` Versão corrigida: ${conclusao.versao_corrigida}.` : ''}
                </p>
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}
