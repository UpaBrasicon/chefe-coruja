// ─────────────────────────────────────────────────────────────────────────────
// Observações que você abriu (decisão do RT em 06/11/2026: "Sim, mostrar";
// migrations 20270305000001 e 20270305000002). O médico da porta que pôs o
// paciente em observação, sem escala no setor da observação, vê o paciente
// aqui para pedir parecer, marcar a reavaliação (decisão do RT em 07/11/2026,
// migration 20270307000005) e ENCERRAR a observação, com os mesmos painéis do
// box. Sem atender, prescrever, evoluir, protocolo, passagem ou prancheta: o
// cuidado segue com a equipe escalada.
// O servidor decide quem vê (observacoes_que_abri); quem já vê o paciente no
// painel normal não ganha um cartão repetido.
//
// M1 da revisão do médico (RT, 24/11/2026): a linha entra na lista única da
// observação, no grupo "Que abri"; "Definir conduta" é o botão da linha e o
// resto fica no menu "…"; a alergia aparece como ficha no nome.
// ─────────────────────────────────────────────────────────────────────────────
import { useQueryClient } from '@tanstack/react-query'
import * as React from 'react'

import { cn } from '@/lib/utils'
import { dataIso } from '@/lib/formato'
import { nomeExibido, type ObservacaoQueAbri } from '@/lib/observacoesQueAbri'
import { rotuloIdade } from '@/domain/idade'
import { Button } from '@/components/ui/button'
import { Gaveta, GavetaCabeca } from '@/components/ui/gaveta'
import { tempoNaObservacao } from '@/lib/observacaoLista'
import { Estado } from '@/components/porta/Estado'
import { AlergiasEventos, SeloAlergia } from '@/components/paciente/AlergiasEventos'
import { MenuMais } from '@/components/plantao/MenuMais'

import { TOM_BARRA, msgErro, relogioPermanencia, type Acao } from './modelo'
import { Painel, PainelDesfecho, PainelReavaliar } from './PaineisCartao'
import { AbaParecer } from '@/components/parecer/AbaParecer'

type PainelQueAbri = 'desfecho' | 'reavaliar' | 'parecer' | 'alergias'

export function LinhaQueAbri({ o, agora, unidadeId }: { o: ObservacaoQueAbri; agora: number; unidadeId: string }) {
  const qc = useQueryClient()
  const [painel, setPainel] = React.useState<PainelQueAbri | null>(null)
  const aberto = painel !== null
  const [erro, setErro] = React.useState<string | null>(null)
  const fechar = () => { setErro(null); setPainel(null) }
  const alternar = (p: PainelQueAbri) => { setErro(null); setPainel((atual) => (atual === p ? null : p)) }

  const acao: Acao = async (fn) => {
    try {
      await fn()
      setErro(null)
      for (const k of ['observacoes-que-abri', 'painel-observacao', 'pendencias', 'pacientes-internados', 'ocupacao-setores', 'pendencias-observacao'])
        void qc.invalidateQueries({ queryKey: [k] })
      return true
    } catch (e) {
      setErro(msgErro(e))
      return false
    }
  }

  const rel = relogioPermanencia(o.entrada, o.prazo, agora)
  const tempo = tempoNaObservacao(o.entrada, agora)
  const idade = o.data_nascimento ? rotuloIdade(o.data_nascimento, dataIso()) : null
  const TITULO: Record<PainelQueAbri, string> = { desfecho: 'Definir conduta', reavaliar: 'Reavaliar', parecer: 'Pedir parecer', alergias: 'Alergias' }

  // OB1 e OO1 (RT, 24/11/2026): a mesma linha da lista, sem tabela; as ações numa gaveta lateral
  return (
    <div className="border-b border-trilha last:border-b-0">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3">
        <span className="w-[64px] shrink-0 text-apoio font-semibold text-acao">{o.box ?? 'Sem box'}</span>
        <div className="flex min-w-0 flex-[2_1_220px] flex-col gap-0.5">
          <span className="text-corpo font-medium text-tinta">
            {nomeExibido(o)} {idade && <span className="text-apoio font-normal text-tinta-sussurro">{idade}</span>}
          </span>
          <span className="text-apoio text-tinta-sussurro">{o.setor_nome}</span>
          <span className="flex flex-wrap items-center gap-x-2.5 gap-y-1"><SeloAlergia pacienteId={o.paciente_id} /></span>
        </div>
        <div className="flex min-w-0 flex-[1_1_200px] flex-col items-start gap-0.5">
          <Estado tom="cinza">Com a equipe do setor</Estado>
          <span className="pl-[17px] text-rotulo text-tinta-sussurro">Você abriu esta observação pela porta</span>
        </div>
        <div className="flex w-[150px] shrink-0 flex-col gap-1 tabular-nums">
          <span className={cn('text-apoio', rel.acima ? 'font-semibold text-critico' : 'text-tinta-apoio')}>{tempo.ha}</span>
          <div role="meter" aria-label="Prazo de 6 horas" aria-valuemin={0} aria-valuemax={100} aria-valuenow={rel.pct}
            title={rel.contagem} className="h-1.5 w-full overflow-hidden rounded-capsula bg-trilha">
            <div className={cn('h-full rounded-capsula', TOM_BARRA[rel.tom])} style={{ width: `${rel.pct}%` }} />
          </div>
          <span className="text-rotulo text-tinta-sussurro">{tempo.desde}</span>
        </div>
        <div className="ml-auto flex shrink-0 items-center gap-[7px]">
          <Button size="sm" onClick={() => alternar('desfecho')}>Definir conduta</Button>
          <MenuMais icone rotuloAcessivel={`Mais ações para ${nomeExibido(o)}`} itens={[
            { chave: 'reavaliar', rotulo: 'Reavaliar', onSelecionar: () => alternar('reavaliar') },
            { chave: 'parecer', rotulo: 'Pedir parecer', onSelecionar: () => alternar('parecer') },
            { chave: 'alergias', rotulo: 'Alergias', onSelecionar: () => alternar('alergias') },
          ]} />
        </div>
      </div>
      <Gaveta aberta={aberto} onAbertaChange={(v) => { if (!v) fechar() }} rotulo={`${painel ? TITULO[painel] : ''} · ${nomeExibido(o)}`}
        className={painel === 'desfecho' || painel === 'parecer' ? 'max-w-[680px]' : undefined}>
        {painel && <GavetaCabeca sobre={TITULO[painel]} titulo={nomeExibido(o)} detalhe={[o.box, o.setor_nome].filter(Boolean).join(' · ')} />}
        <div className="flex flex-col gap-2 py-3">
          {painel === 'desfecho' && <PainelDesfecho linha={{ ...o, nome: nomeExibido(o) }} unidadeId={unidadeId} acao={acao} fechar={fechar} erro={erro} />}
          {painel === 'reavaliar' && <PainelReavaliar linha={o} acao={acao} fechar={fechar} erro={erro} />}
          {painel === 'parecer' && (
            <Painel titulo="Parecer">
              <AbaParecer pacienteId={o.paciente_id} internacaoId={o.internacao_id} />
            </Painel>
          )}
          {/* quem abriu registra alergia enquanto a observação está aberta (RT, 08/11/2026) */}
          {painel === 'alergias' && (
            <Painel titulo="Alergias e eventos adversos">
              <AlergiasEventos pacienteId={o.paciente_id} />
            </Painel>
          )}
        </div>
      </Gaveta>
    </div>
  )
}
