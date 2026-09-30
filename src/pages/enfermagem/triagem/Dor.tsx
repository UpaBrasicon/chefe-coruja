import { Chip } from '@/components/monitor/Pagina'
import { textoFontes } from '@/clinico/ficha'
import { ESCALAS_DOR, escalasDoGrupo, itensMarcados, notaNumerica, totalDor, type EscalaDor, type ItensDor } from '@/clinico/triagem/dor'

// Escala de dor da triagem: NIPS / FLACC (observação) ou autorrelato 0–10.
// A soma vai para o campo "Dor" dos sinais vitais; o escore não mexe na cor.

export function BlocoDor({
  publico,
  escala,
  pelaIdade,
  itens,
  nota,
  onEscala,
  onItem,
}: {
  publico: 'adulto' | 'pediatrico' | null
  escala: EscalaDor
  pelaIdade: EscalaDor
  itens: ItensDor
  /** o valor do campo Dor (autorrelato) */
  nota: string
  onEscala: (e: EscalaDor) => void
  onItem: (id: string, valor: number) => void
}) {
  const def = ESCALAS_DOR[escala]
  const total = totalDor(escala, itens)
  const feitos = itensMarcados(escala, itens)
  const numerica = notaNumerica(nota)

  return (
    <div className="col-span-full flex flex-col gap-2 rounded-container border border-fio bg-campo px-3.5 py-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-apoio font-medium text-grafite">Escala de dor</span>
        {escalasDoGrupo(publico).map((e) => (
          <Chip key={e} ativo={escala === e} onClick={() => onEscala(e)}>
            {ESCALAS_DOR[e].nome}{e === pelaIdade ? ' · pela idade' : ''}
          </Chip>
        ))}
      </div>

      {def.itens.length > 0 ? (
        <>
          <span className="text-apoio text-pretty text-tinta-apoio">
            Dor pela {def.nome} · {def.faixa}. Observe a criança por alguns instantes e marque um item de cada linha.
          </span>
          {def.itens.map((it) => (
            <div key={it.id} className="flex flex-wrap items-start gap-2">
              <span className="flex-[0_0_120px] pt-1.5 text-apoio font-medium text-tinta">{it.rotulo}</span>
              <div className="flex min-w-0 flex-[1_1_280px] flex-wrap gap-1.5" role="group" aria-label={it.rotulo}>
                {it.opcoes.map((o) => (
                  <Chip key={o.valor} ativo={itens[it.id] === o.valor} onClick={() => onItem(it.id, o.valor)}>
                    {o.valor} · {o.rotulo}
                  </Chip>
                ))}
              </div>
            </div>
          ))}
          <span className="text-controle font-semibold text-tinta" role="status">
            {total !== null ? `Total ${total} de ${def.max} · ${def.leitura(total)}` : `${feitos} de ${def.itens.length} itens marcados`}
          </span>
        </>
      ) : (
        <span className="text-apoio text-pretty text-tinta-apoio">
          Pergunte ao paciente a nota da dor de 0 (sem dor) a 10 (a pior dor) e escreva no campo Dor.
          {numerica !== null && <strong className="ml-1 font-semibold text-tinta">{def.leitura(numerica)}.</strong>}
        </span>
      )}
      <span className="text-rotulo text-pretty text-tinta-sussurro">
        {textoFontes(def.ficha)}. Registro da enfermagem; não define a cor.
      </span>
    </div>
  )
}
