// Passagens anteriores do paciente nesta unidade (gaveta de episódios, D5).
// Separado do componente para o fast refresh do Vite.
import { useQuery } from '@tanstack/react-query'

import { useUnidade } from '@/contexts/UnidadeContext'
import { abrirProntuario } from '@/lib/prontuario'
import { supabase } from '@/lib/supabase'

export type Tom = 'success' | 'warning' | 'secondary'

export type EpisodioAnterior = {
  chave: string
  /** instante de referência (chegada ou admissão), para ordenar */
  inicio: string
  quando: string
  desfecho: string
  tom: Tom
  queixa: string
  onde: string
  resumo: string | null
}

// Desfecho do atendimento da porta (registrar_desfecho)
const DESFECHO_EPISODIO: Record<string, [string, Tom]> = {
  alta: ['Alta médica', 'success'],
  alta_apos_medicacao: ['Alta após medicação', 'success'],
  alta_a_pedido: ['Alta a pedido', 'warning'],
  transferencia: ['Transferência', 'warning'],
  evasao: ['Evasão', 'warning'],
  obito: ['Óbito', 'secondary'],
  observacao: ['Observação', 'secondary'],
  internacao: ['Internação', 'secondary'],
}
// Fim da internação (status de internacoes)
const FIM_INTERNACAO: Record<string, [string, Tom]> = {
  alta_melhorada: ['Alta melhorada', 'success'],
  alta_pedido: ['Alta a pedido', 'warning'],
  alta_evasao: ['Evasão', 'warning'],
  transferencia_externa: ['Transferência externa', 'warning'],
  obito: ['Óbito', 'secondary'],
}
const INTERNACAO_ATIVA = ['admitido', 'em_observacao', 'internado']
// ordem de preferência do resumo
const TIPOS_RESUMO = ['sumario_alta', 'sumario_obito', 'evolucao'] as const

const dia = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'America/Sao_Paulo' }) : ''

/** O conteúdo do documento é o que a ferramenta gravou (texto ou JSON); aqui vira texto corrido. */
function textoDoDocumento(conteudo: string): string {
  let obj: unknown
  try {
    obj = JSON.parse(conteudo)
  } catch {
    return conteudo.trim()
  }
  if (typeof obj === 'string') return obj.trim()
  const linhas: string[] = []
  const andar = (v: unknown, chave: string) => {
    if (/(^id$|_id$|^paciente$|^setor|^unidade|cpf|cns|nascimento)/i.test(chave)) return
    if (v === null || v === undefined || v === '' || v === false) return
    if (Array.isArray(v)) return v.forEach((x) => andar(x, chave))
    if (typeof v === 'object') return Object.entries(v as Record<string, unknown>).forEach(([k, x]) => andar(x, k))
    const rotulo = chave.replace(/_/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase()
    const valor = v === true ? 'sim' : String(v)
    linhas.push(rotulo ? `${rotulo.charAt(0).toUpperCase()}${rotulo.slice(1)}: ${valor}` : valor)
  }
  andar(obj, '')
  return linhas.join('\n')
}

/**
 * Passagens anteriores do paciente nesta unidade, o que a RLS deixar ler.
 * Compartilhada entre o botão (que muda o rótulo) e a gaveta.
 */
export function useEpisodiosAnteriores(pacienteId: string) {
  const { unidadeAtiva } = useUnidade()
  const unidadeId = unidadeAtiva?.unidade_id
  return useQuery({
    queryKey: ['episodios-anteriores', pacienteId, unidadeId],
    enabled: !!pacienteId && !!unidadeId,
    staleTime: 60_000,
    queryFn: async (): Promise<EpisodioAnterior[]> => {
      await abrirProntuario(pacienteId)
      const [eps, ints, docs] = await Promise.all([
        supabase
          .from('episodios')
          .select('id, setor_id, queixa, chegada_em, encerrado_em, desfecho, desfecho_motivo')
          .eq('paciente_id', pacienteId)
          .eq('unidade_id', unidadeId!)
          .eq('etapa', 'encerrado')
          .order('chegada_em', { ascending: false }),
        supabase
          .from('internacoes')
          .select('id, episodio_id, setor_atual_id, status, data_admissao, data_alta, motivo_alta, cid_principal, cid_alta')
          .eq('paciente_id', pacienteId)
          .eq('unidade_id', unidadeId!)
          .not('status', 'in', `(${INTERNACAO_ATIVA.join(',')})`)
          .order('data_admissao', { ascending: false }),
        supabase
          .from('documentos_clinicos')
          .select('id, documento_raiz_id, tipo_documento, conteudo, created_at, episodio_id, internacao_id')
          .eq('paciente_id', pacienteId)
          .eq('unidade_id', unidadeId!)
          .in('tipo_documento', [...TIPOS_RESUMO])
          .not('estado', 'in', '(rascunho,cancelado)')
          .order('created_at', { ascending: false }),
      ])
      for (const r of [eps, ints, docs]) if (r.error) throw r.error
      const episodios = eps.data ?? []
      const internacoes = ints.data ?? []

      // só a versão mais recente de cada documento (a lista já vem do mais novo)
      const vistos = new Set<string>()
      const documentos = (docs.data ?? []).filter((d) => (vistos.has(d.documento_raiz_id) ? false : (vistos.add(d.documento_raiz_id), true)))

      const idsSetor = [...new Set([...episodios.map((e) => e.setor_id), ...internacoes.map((i) => i.setor_atual_id)].filter((x): x is string => !!x))]
      const nomes = new Map<string, string>()
      if (idsSetor.length) {
        const { data, error } = await supabase.from('setores').select('id, nome').in('id', idsSetor)
        if (error) throw error
        for (const s of data ?? []) nomes.set(s.id, s.nome)
      }

      const resumoDe = (episodioId: string | null, internacaoId: string | null) => {
        const doDoc = documentos.filter(
          (d) => (internacaoId && d.internacao_id === internacaoId) || (episodioId && d.episodio_id === episodioId),
        )
        for (const tipo of TIPOS_RESUMO) {
          const d = doDoc.find((x) => x.tipo_documento === tipo) // a mais recente do tipo
          if (d) {
            const t = textoDoDocumento(d.conteudo)
            if (t) return t
          }
        }
        return null
      }

      const itens: EpisodioAnterior[] = []
      const internacaoDoEpisodio = new Map(internacoes.filter((i) => i.episodio_id).map((i) => [i.episodio_id!, i]))

      for (const e of episodios) {
        const int = internacaoDoEpisodio.get(e.id)
        const [rotulo, tom] = (int && FIM_INTERNACAO[int.status]) || (e.desfecho && DESFECHO_EPISODIO[e.desfecho]) || ['Encerrado', 'secondary' as Tom]
        const setor = nomes.get(int?.setor_atual_id ?? '') ?? nomes.get(e.setor_id)
        const fim = int?.data_alta ?? e.encerrado_em
        itens.push({
          chave: e.id,
          inicio: e.chegada_em,
          quando: dia(e.chegada_em),
          desfecho: rotulo,
          tom,
          queixa: e.queixa,
          onde: [int ? 'Internação' : 'Atendimento na porta', setor, fim && dia(fim) !== dia(e.chegada_em) ? `até ${dia(fim)}` : null].filter(Boolean).join(' · '),
          resumo: resumoDe(e.id, int?.id ?? null) ?? e.desfecho_motivo ?? int?.motivo_alta ?? null,
        })
      }
      // internações sem episódio da porta (entrada direta ou registro anterior à ficha)
      for (const i of internacoes) {
        if (i.episodio_id && episodios.some((e) => e.id === i.episodio_id)) continue
        const [rotulo, tom] = FIM_INTERNACAO[i.status] ?? ['Encerrada', 'secondary' as Tom]
        const cid = i.cid_principal ?? i.cid_alta
        itens.push({
          chave: i.id,
          inicio: i.data_admissao,
          quando: dia(i.data_admissao),
          desfecho: rotulo,
          tom,
          queixa: cid ? `CID ${cid}` : 'Motivo da internação não registrado',
          onde: ['Internação', nomes.get(i.setor_atual_id ?? ''), i.data_alta ? `até ${dia(i.data_alta)}` : null].filter(Boolean).join(' · '),
          resumo: resumoDe(null, i.id) ?? i.motivo_alta ?? null,
        })
      }
      return itens.sort((a, b) => b.inicio.localeCompare(a.inicio))
    },
  })
}
