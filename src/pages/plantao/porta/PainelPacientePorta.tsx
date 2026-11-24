// Painel "Paciente" à direita da janela do atendimento (M5 da revisão do
// médico, RT 24/11/2026; o mesmo desenho do painel do caderno do leito). Só
// mostra o que a janela já leu: queixa, classificação da enfermagem, sinais da
// triagem como vieram, alergias e o que está em aberto. Nada é calculado aqui.
import { AlertTriangle } from 'lucide-react'

import { PilulaRisco } from '@/components/clinico/PilulaRisco'
import type { FaixaEtaria } from '@/domain/idade'
import { rotulosPrioridade } from '@/domain/prioridade'
import { textoVitais } from '@/domain/vitais'
import type { AlergiaRegistro, EstadoAlergia } from '@/components/paciente/useAlergias'

import type { Classificacao } from './AbaAtendimento'
import { hora, type EpFila, type PainelPS } from './comum'

const ESTADO_ALERGIA: Record<EstadoAlergia, string> = {
  tem: 'Tem alergia',
  nega: 'Nega alergia',
  desconhece: 'Não sabe informar',
  nao_registrada: 'Alergia não registrada',
}

function Linha({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-rotulo text-tinta-sussurro">{rotulo}</span>
      <div className="text-apoio text-tinta">{children}</div>
    </div>
  )
}

export function PainelPacientePorta({ ep, queixa, faixa, ubs, classificacoes, painel, alergias, estadoAlergia }: {
  ep: EpFila
  queixa: string
  faixa: FaixaEtaria
  ubs: boolean
  classificacoes: Classificacao[]
  painel: PainelPS | undefined
  alergias: AlergiaRegistro[]
  estadoAlergia: EstadoAlergia | undefined
}) {
  const ultima = classificacoes.at(-1)
  const comSinais = [...classificacoes].reverse().find((c) => c.sinais && Object.keys(c.sinais).length > 0)
  const sinais = textoVitais(comSinais?.sinais)
  const prescricao = (painel?.prescricao ?? []).filter((i) => !i.suspenso_em).length
  const exames = (painel?.exames ?? []).filter((x) => !['resultado', 'realizado', 'cancelado'].includes(x.situacao)).length
  const pendencias = painel?.pendencias ?? []

  return (
    <aside aria-label="Paciente" className="flex flex-col gap-3.5 border-t border-fio bg-superficie px-5 py-5 xl:sticky xl:top-4 xl:border-t-0 xl:border-l">
      <span className="text-controle font-semibold text-tinta">Paciente</span>
      <Linha rotulo="Queixa">{queixa || '—'}</Linha>
      <Linha rotulo="Chegada">
        <span className="tabular-nums">{hora(ep.chegada_em)}</span>
        {faixa === 'pediatrico' && <span className="text-pediatria"> · pediatria</span>}
        {faixa === 'desconhecida' && <span className="text-atencao"> · sem data de nascimento</span>}
      </Linha>
      {ep.prioridades_legais.length > 0 && <Linha rotulo="Prioridade legal">{rotulosPrioridade(ep.prioridades_legais).join(', ')}</Linha>}
      {!ubs && (
        <Linha rotulo="Classificação da enfermagem">
          <span className="flex flex-wrap items-center gap-2">
            <PilulaRisco cor={ultima?.cor ?? ep.cor_atual} />
            {ultima && <span className="text-rotulo text-tinta-sussurro">{hora(ultima.criado_em)}</span>}
          </span>
          {ultima && !ultima.reclassificacao && (ultima.fluxograma_nome || ultima.discriminador) && (
            <span className="mt-1 block text-rotulo text-tinta-apoio">{[ultima.fluxograma_nome, ultima.discriminador].filter(Boolean).join(' · ')}</span>
          )}
        </Linha>
      )}
      <Linha rotulo={ubs ? 'Sinais da escuta' : 'Sinais da triagem'}>
        {sinais ? <span className="tabular-nums">{sinais}</span> : <span className="text-tinta-sussurro">Sem sinais vitais registrados.</span>}
      </Linha>
      <Linha rotulo="Alergias">
        {alergias.length > 0 ? (
          <span className="flex flex-wrap gap-1.5">
            {alergias.map((a) => (
              <span key={a.id} className="inline-flex items-center gap-1 rounded-capsula border border-critico/30 bg-alerta-critico px-2 py-0.5 text-rotulo font-semibold text-critico">
                <AlertTriangle className="size-3" aria-hidden /> {a.substancia}
              </span>
            ))}
          </span>
        ) : (
          <span className={estadoAlergia === 'nega' ? 'text-tinta' : 'text-atencao'}>{estadoAlergia ? ESTADO_ALERGIA[estadoAlergia] : '—'}</span>
        )}
      </Linha>
      {painel && (
        <Linha rotulo="Em aberto">
          <span className="block tabular-nums">
            {prescricao === 0 ? 'Sem prescrição ativa' : `${prescricao} ${prescricao === 1 ? 'item prescrito' : 'itens prescritos'}`}
            {' · '}
            {exames === 0 ? 'nenhum exame aguardando' : `${exames} ${exames === 1 ? 'exame aguardando' : 'exames aguardando'}`}
          </span>
          {pendencias.length > 0 && (
            <ul className="mt-1 flex flex-col gap-0.5 text-rotulo text-atencao">
              {pendencias.map((p) => <li key={p}>{p}</li>)}
            </ul>
          )}
        </Linha>
      )}
    </aside>
  )
}
