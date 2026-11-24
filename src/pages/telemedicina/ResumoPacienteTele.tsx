// Resumo do prontuário na sala do chamado (SA1, RT 24/11/2026): alergias,
// últimos sinais vitais, problemas e prescrição em uso, ao lado do parecer.
// Lê o que o teleconsultor já pode ler pela teleinterconsulta aceita: abre o
// prontuário (o acesso fica registrado, como no "Ler prontuário") e pega o
// atendimento mais recente de prontuario_leitura. Sinais vitais saem crus, sem
// marca de alterado: a análise é de quem lê. Sem RPC nova.
import { ativas, rotuloGravidade, useAlergias } from '@/components/paciente/useAlergias'
import { dataHora } from '@/lib/formato'
import { agruparAfericoes, textoItemPrescricao } from '@/lib/prontuarioLinhaTempo'

import { useResumoPaciente } from './resumoPaciente'

function Bloco({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-1 border-t border-trilha px-4 py-3 first:border-t-0">
      <h3 className="text-apoio font-semibold text-tinta">{titulo}</h3>
      {children}
    </section>
  )
}

const Quieto = ({ children }: { children: React.ReactNode }) => <p className="text-apoio text-tinta-sussurro">{children}</p>

export function ResumoPacienteTele({ pacienteId }: { pacienteId: string }) {
  const q = useResumoPaciente(pacienteId)
  const alergias = useAlergias(pacienteId)
  const p = q.data
  const sinais = p ? agruparAfericoes(p.observacoes ?? [])[0] ?? null : null
  const cids = p
    ? [...new Set([
        ...p.internacoes.flatMap((i) => [i.cid_principal]),
        ...p.atendimentos.flatMap((a) => [a.cid_desfecho, ...(a.cid_aps ?? [])]),
        ...p.registros.map((r) => r.cid),
      ].filter((c): c is string => !!c))]
    : []
  const avaliacao = p ? [...p.registros].sort((a, b) => b.criado_em.localeCompare(a.criado_em)).find((r) => r.avaliacao?.trim())?.avaliacao ?? null : null
  const prescricao = p ? [...p.prescricoes].filter((x) => x.status === 'ativa').sort((a, b) => b.created_at.localeCompare(a.created_at))[0] ?? null : null
  const itens = (prescricao?.itens ?? []).filter((i) => !i.suspenso_em)
  const listaAlergias = ativas(alergias.data)
  const sinaisLista = sinais
    ? ([['PA', sinais.pa], ['FC', sinais.fc], ['FR', sinais.fr], ['Temp', sinais.temp], ['SpO2', sinais.spo2], ['Glicemia', sinais.glicemia], ['Dor', sinais.dor]] as const)
        .filter(([, v]) => v != null)
    : []

  return (
    <div className="flex flex-col overflow-hidden rounded-cartao border border-fio bg-superficie">
      <Bloco titulo="Alergias">
        {alergias.isLoading ? <Quieto>Carregando…</Quieto>
          : alergias.error || !alergias.data ? <p className="text-apoio text-atencao">Alergia não verificada</p>
            : alergias.data.estado === 'tem' && listaAlergias.length > 0 ? (
              <ul className="flex flex-col gap-1">
                {listaAlergias.map((a) => (
                  <li key={a.id} className="text-apoio font-medium text-critico">{a.substancia} <span className="font-normal">· {rotuloGravidade(a.gravidade).toLowerCase()}</span></li>
                ))}
              </ul>
            ) : alergias.data.estado === 'nega' ? <p className="text-apoio text-tinta">Nega alergias</p>
              : alergias.data.estado === 'desconhece' ? <p className="text-apoio text-atencao">Alergia não informada</p>
                : <p className="text-apoio text-atencao">Alergia não registrada</p>}
      </Bloco>
      {q.isLoading && <Bloco titulo="Prontuário"><Quieto>Abrindo o prontuário…</Quieto></Bloco>}
      {q.error && <Bloco titulo="Prontuário"><p role="alert" className="text-apoio text-critico">{(q.error as Error).message}</p></Bloco>}
      {p && (
        <>
          <Bloco titulo="Últimos sinais vitais">
            {sinaisLista.length === 0 && !sinais?.outras.length ? <Quieto>Nenhum registrado no último atendimento</Quieto> : (
              <>
                <p className="text-apoio tabular-nums text-tinta">
                  {[...sinaisLista.map(([r, v]) => `${r} ${v}`), ...(sinais?.outras ?? []).map((o) => `${o.nome} ${o.valor}`)].join(' · ')}
                </p>
                {sinais && <p className="text-rotulo text-tinta-sussurro">Aferidos em {dataHora(sinais.em)}</p>}
              </>
            )}
          </Bloco>
          <Bloco titulo="Problemas">
            {cids.length === 0 && !avaliacao ? <Quieto>Nenhum problema registrado no último atendimento</Quieto> : (
              <>
                {cids.length > 0 && <p className="text-apoio text-tinta">CID {cids.join(', ')}</p>}
                {avaliacao && <p className="line-clamp-4 text-apoio whitespace-pre-wrap text-tinta-apoio">{avaliacao}</p>}
              </>
            )}
          </Bloco>
          <Bloco titulo="Prescrição em uso">
            {itens.length === 0 ? <Quieto>Nenhuma prescrição ativa</Quieto> : (
              <ul className="flex flex-col gap-1">
                {itens.map((i) => <li key={i.id} className="text-apoio text-tinta">{textoItemPrescricao(i)}</li>)}
              </ul>
            )}
          </Bloco>
        </>
      )}
    </div>
  )
}
