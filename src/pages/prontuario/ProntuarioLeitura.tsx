import { useQuery } from '@tanstack/react-query'
import { BookOpen } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'

import { TituloPagina, Trilha } from '@/components/monitor/Pagina'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Spinner } from '@/components/ui/spinner'
import { abrirProntuario } from '@/lib/prontuario'
import { fmtData, fmtDataHora } from '@/lib/datas'
import { supabase } from '@/lib/supabase'

// Leitura do prontuário (fase 6). Serve a quem tem pedido aprovado e vigente
// e a quem já tem acesso pela escala. Só leitura: não há botão de escrever,
// e o banco também não deixaria (o pedido não entra em pode_atuar_no_paciente).
// Abrir grava o acesso no servidor (abrir_prontuario). Sinais vitais saem
// crus, sem marca de alterado: a análise é de quem lê.

const ROTULO_DOC: Record<string, string> = {
  admissao_anamnese: 'Admissão e anamnese', evolucao: 'Evolução', prescricao: 'Prescrição', sumario_alta: 'Sumário de alta',
  sumario_obito: 'Sumário de óbito', atestado: 'Atestado', termo_consentimento: 'Termo de consentimento',
  boletim_emergencia: 'Boletim de emergência', partograma: 'Partograma', teleinterconsulta: 'Teleinterconsulta',
  receita: 'Receita', encaminhamento: 'Encaminhamento', pedido_exames: 'Pedido de exames', laudo_aih: 'Laudo de AIH',
}
const ETAPA: Record<string, string> = { triagem: 'Triagem', atendimento: 'Atendimento', observacao: 'Observação', internacao: 'Internação', encerrado: 'Encerrado' }

export default function ProntuarioLeitura() {
  const { pacienteId } = useParams<{ pacienteId: string }>()

  const q = useQuery({
    queryKey: ['prontuario-leitura', pacienteId],
    enabled: !!pacienteId,
    staleTime: 60_000,
    queryFn: async () => {
      await abrirProntuario(pacienteId!)
      const id = pacienteId!
      const [pac, eps, docs, obs, presc, alerg, classif] = await Promise.all([
        supabase.from('pacientes').select('id, nome, nome_social, data_nascimento, sexo, prontuario').eq('id', id).maybeSingle(),
        supabase.from('episodios').select('id, etapa, queixa, chegada_em, encerrado_em, desfecho').eq('paciente_id', id).order('chegada_em', { ascending: false }),
        supabase.from('documentos_clinicos').select('id, documento_raiz_id, versao, tipo_documento, conteudo, estado, created_at, episodio_id').eq('paciente_id', id).neq('estado', 'rascunho').order('created_at', { ascending: false }),
        supabase.from('observacao').select('id, aferido_em, valor_num, valor_texto, unidade, conceito:conceito_id(nome, unidade_padrao)').eq('paciente_id', id).order('aferido_em', { ascending: false }).limit(60),
        supabase.from('prescricoes').select('id, status, created_at, assinada_em, prescricao_itens(id, descricao, dose, posologia, via, suspenso_em)').eq('paciente_id', id).order('created_at', { ascending: false }).limit(20),
        supabase.from('alergias_paciente').select('id, substancia, reacao, inativada_em').eq('paciente_id', id).is('inativada_em', null),
        supabase.from('classificacoes_risco').select('id, cor, criado_em, discriminador, episodio_id').eq('paciente_id', id).order('criado_em', { ascending: false }),
      ])
      for (const r of [pac, eps, docs, obs, presc, alerg, classif]) if (r.error) throw r.error
      if (!pac.data) throw new Error('Sem acesso a este paciente. O pedido pode ter vencido ou ainda não foi aprovado.')
      // só a versão mais recente de cada documento
      const vistos = new Set<string>()
      const documentos = (docs.data ?? []).filter((d) => (vistos.has(d.documento_raiz_id) ? false : (vistos.add(d.documento_raiz_id), true)))
      return { paciente: pac.data, episodios: eps.data ?? [], documentos, observacoes: obs.data ?? [], prescricoes: presc.data ?? [], alergias: alerg.data ?? [], classificacoes: classif.data ?? [] }
    },
  })

  if (q.isLoading) return <div className="flex h-40 items-center justify-center"><Spinner /></div>
  if (q.error || !q.data) {
    return (
      <div className="flex max-w-2xl flex-col gap-3">
        <p className="rounded-lg border border-critico/30 bg-critico/[0.08] p-4 text-sm text-critico">{(q.error as Error)?.message ?? 'Sem acesso.'}</p>
        <Button variant="outline" render={<Link to="/prontuarios" />}>Voltar aos pedidos</Button>
      </div>
    )
  }
  const { paciente, episodios, documentos, observacoes, prescricoes, alergias, classificacoes } = q.data

  return (
    <div className="flex w-full max-w-4xl flex-col gap-4">
      <Trilha niveis={[{ rotulo: 'Prontuários', to: '/prontuarios' }, { rotulo: paciente.nome }]} />
      <TituloPagina
        icone={BookOpen}
        titulo={paciente.nome_social ? `${paciente.nome_social} (${paciente.nome})` : paciente.nome}
        descricao={[
          paciente.data_nascimento ? 'nasc. ' + fmtData(paciente.data_nascimento) : null,
          paciente.prontuario ? 'prontuário ' + paciente.prontuario : null,
          'somente leitura · este acesso fica registrado',
        ].filter(Boolean).join(' · ')}
      />

      <Card>
        <CardHeader><CardTitle className="text-base">Alergias ativas</CardTitle></CardHeader>
        <CardContent>
          {alergias.length === 0 ? <p className="text-sm text-tinta-sussurro">Nenhuma registrada.</p> : (
            <ul className="flex flex-wrap gap-2">
              {alergias.map((a) => <li key={a.id}><Badge variant="destructive">{a.substancia}{a.reacao ? ' · ' + a.reacao : ''}</Badge></li>)}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Atendimentos</CardTitle></CardHeader>
        <CardContent>
          {episodios.length === 0 ? <p className="text-sm text-tinta-sussurro">Nenhum.</p> : (
            <ul className="divide-y rounded-lg border">
              {episodios.map((e) => {
                const cls = classificacoes.find((c) => c.episodio_id === e.id)
                return (
                  <li key={e.id} className="p-3 text-sm">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{fmtDataHora(e.chegada_em)}</span>
                      <Badge variant="secondary">{ETAPA[e.etapa] ?? e.etapa}</Badge>
                      {e.desfecho && <Badge variant="outline">desfecho: {e.desfecho.replace(/_/g, ' ')}</Badge>}
                      {cls && <Badge variant="outline">classificação: {cls.cor}</Badge>}
                    </div>
                    <p className="mt-1">{e.queixa}</p>
                    {e.encerrado_em && <p className="text-xs text-tinta-sussurro">Encerrado em {fmtDataHora(e.encerrado_em)}</p>}
                  </li>
                )
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Documentos</CardTitle></CardHeader>
        <CardContent className="flex flex-col gap-3">
          {documentos.length === 0 && <p className="text-sm text-tinta-sussurro">Nenhum documento.</p>}
          {documentos.map((d) => (
            <article key={d.id} className="rounded-lg border p-3">
              <header className="mb-2 flex flex-wrap items-center gap-2 text-sm">
                <span className="font-medium">{ROTULO_DOC[d.tipo_documento] ?? d.tipo_documento}</span>
                <span className="text-tinta-sussurro">{fmtDataHora(d.created_at)}</span>
                {d.versao > 1 && <Badge variant="secondary">versão {d.versao}</Badge>}
                {d.estado === 'cancelado' && <Badge variant="destructive">cancelado</Badge>}
              </header>
              <pre className="whitespace-pre-wrap font-sans text-sm">{d.conteudo}</pre>
            </article>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Sinais vitais e medidas (últimas 60)</CardTitle></CardHeader>
        <CardContent>
          {observacoes.length === 0 ? <p className="text-sm text-tinta-sussurro">Nenhuma.</p> : (
            <table className="w-full text-sm">
              <tbody>
                {observacoes.map((o) => (
                  <tr key={o.id} className="border-b last:border-0">
                    <td className="py-1.5 pr-3 whitespace-nowrap text-tinta-sussurro">{fmtDataHora(o.aferido_em)}</td>
                    <td className="py-1.5 pr-3">{(o.conceito as { nome?: string } | null)?.nome?.replace(/-/g, ' ') ?? '—'}</td>
                    <td className="py-1.5 tabular">
                      {o.valor_num != null ? String(o.valor_num).replace('.', ',') : o.valor_texto ?? '—'}{' '}
                      {o.unidade ?? (o.conceito as { unidade_padrao?: string | null } | null)?.unidade_padrao ?? ''}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Prescrições (últimas 20)</CardTitle></CardHeader>
        <CardContent className="flex flex-col gap-3">
          {prescricoes.length === 0 && <p className="text-sm text-tinta-sussurro">Nenhuma.</p>}
          {prescricoes.map((p) => (
            <div key={p.id} className="rounded-lg border p-3 text-sm">
              <div className="mb-1 flex items-center gap-2">
                <span className="font-medium">{fmtDataHora(p.created_at)}</span>
                <Badge variant="secondary">{p.status}</Badge>
              </div>
              <ul className="list-disc pl-5">
                {(p.prescricao_itens ?? []).map((i) => (
                  <li key={i.id} className={i.suspenso_em ? 'text-tinta-sussurro line-through' : ''}>
                    {i.descricao}{i.dose ? ' · ' + i.dose : ''}{i.via ? ' · ' + i.via : ''}{i.posologia ? ' · ' + i.posologia : ''}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
