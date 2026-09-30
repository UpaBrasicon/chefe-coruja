// Pediatria: Phoenix (rastreio de sepse) e PELOD-2, calculados no banco.
import { useQuery, useQueryClient } from '@tanstack/react-query'
import * as React from 'react'

import { Button } from '@/components/ui/button'

import { Secao } from './caixas'
import { type Acao, type Acuidade, msg, rpc } from './comum'

const BANDA = [
  'border-conforme/30 bg-conforme/[0.08] text-conforme',
  'border-atencao/30 bg-atencao/[0.08] text-atencao',
  'border-critico/30 bg-critico/[0.08] text-critico',
]

/** Na porta: o mesmo rastreio do leito, para a criança ainda em atendimento. */
export function SepsePorta({ pacienteId }: { pacienteId: string }) {
  const qc = useQueryClient()
  const [erro, setErro] = React.useState<string | null>(null)
  const acuidade = useQuery({
    queryKey: ['acuidade', pacienteId],
    queryFn: async () => (await rpc('acuidade', { p_paciente: pacienteId })) as Acuidade,
  })
  if (acuidade.data?.escala !== 'PEWS') return null
  const acao: Acao = (fn) =>
    fn()
      .then((r) => { setErro(null); void qc.invalidateQueries({ queryKey: ['acuidade'] }); return r })
      .catch((e) => { setErro(msg(e)); return null })
  return (
    <div className="flex flex-col gap-2 text-sm">
      {erro && <p className="text-critico">{erro}</p>}
      <BlocoSepse a={acuidade.data} pacienteId={pacienteId} podeMarcar acao={acao} />
    </div>
  )
}

export function BlocoSepse({ a, pacienteId, podeMarcar, acao }: { a: Acuidade; pacienteId: string; podeMarcar: boolean; acao: Acao }) {
  const ph = a.phoenix
  const marcar = (ativa: boolean) =>
    acao(() => rpc('marcar_suspeita_infeccao', { p_paciente: pacienteId, p_ativa: ativa }),
      ativa ? 'Suspeita de infecção marcada: o Phoenix passa a ser calculado.' : 'Suspeita de infecção retirada.')
  return (
    <>
      <Secao titulo="Rastreio de sepse · Phoenix"
        acao={podeMarcar && (!ph || ph.gatilho.motivo === 'suspeita') ? (
          <Button size="xs" variant="ghost" onClick={() => void marcar(!ph)}>
            {ph ? 'Retirar suspeita de infecção' : 'Marcar suspeita de infecção'}
          </Button>
        ) : undefined}>
        {!ph ? (
          <p className="text-tinta-sussurro">
            Não calculado: sem CID de infecção no episódio e sem suspeita de infecção marcada.
          </p>
        ) : (
          <>
            <div className={`flex flex-wrap items-baseline gap-2 rounded-lg border px-3 py-2 ${ph.choque || ph.sepse ? BANDA[2] : BANDA[0]}`}>
              <span className="text-2xl font-semibold tabular-nums">{ph.total}{ph.parcial ? '*' : ''}</span>
              <span className="font-medium">
                {ph.choque ? 'critérios de choque séptico' : ph.sepse ? 'critérios de sepse' : 'abaixo do critério de sepse (< 2)'}
              </span>
              <span className="ml-auto text-xs">{ph.gatilho.descricao}</span>
            </div>
            <ul className="grid gap-x-4 gap-y-0.5 sm:grid-cols-2">
              {ph.itens.map((x) => (
                <li key={x.sistema} className="flex justify-between gap-2 border-b border-fio py-0.5 last:border-0">
                  <span className="text-tinta-apoio">{x.sistema}</span>
                  <span className="text-right tabular-nums">{x.detalhe ? `${x.detalhe} · ` : ''}{x.pontos}/{x.maximo}</span>
                </li>
              ))}
            </ul>
            {ph.parcial && <p className="text-xs text-atencao">* Faltou medir: {ph.faltando.join(', ')}. Variável não medida não soma ponto.</p>}
            <p className="text-xs text-tinta-sussurro">{ph.fonte} {ph.notas}</p>
          </>
        )}
      </Secao>
      {a.pelod2?.indicado && (
        <Secao titulo="PELOD-2 · disfunção orgânica">
          <div className="flex flex-wrap items-baseline gap-2 rounded-lg border border-fio px-3 py-2">
            <span className="text-2xl font-semibold tabular-nums">{a.pelod2.total}{a.pelod2.completo ? '' : '*'}</span>
            <span className="font-medium">pontos</span>
            <span className="text-tinta-apoio">· mortalidade prevista na coorte de origem {(a.pelod2.mortalidade_prevista * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%</span>
          </div>
          <ul className="grid gap-x-4 gap-y-0.5 sm:grid-cols-2">
            {a.pelod2.itens.map((x) => (
              <li key={x.rotulo} className="flex justify-between gap-2 border-b border-fio py-0.5 last:border-0">
                <span className="text-tinta-apoio">{x.rotulo}</span>
                <span className="text-right tabular-nums">{x.valor ?? '—'} · {x.pontos} pt</span>
              </li>
            ))}
          </ul>
          {!a.pelod2.completo && (
            <p className="text-xs text-atencao">
              * Não medidos (contam como normais): {a.pelod2.faltando.join(', ')}. A pendência “PELOD-2 do dia” fecha sozinha quando as 10 variáveis estiverem registradas.
            </p>
          )}
          <p className="text-xs text-tinta-sussurro">{a.pelod2.fonte} {a.pelod2.notas}</p>
        </Secao>
      )}
    </>
  )
}
