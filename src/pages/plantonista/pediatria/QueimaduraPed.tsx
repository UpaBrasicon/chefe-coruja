import { useState } from 'react'

import { SEM_VALOR_NEONATAL } from '@/clinico/pediatria/fonteIcr'
import {
  AVISO_ELETRICA, COLUNAS_LB, ERRATA_LUND_BROWDER, GRANDE_QUEIMADO_PCT, MAO_ESPALMADA_PCT, NOTA_MANUTENCAO, PRE_HOSPITALAR_ML_KG_H, REGIOES_LB, colunaPorIdade, diureseAlvo,
  fichaQueimaduraPed, manutencao24hMl, parkland, somaManutencao, superficieQueimada, totalCorpo, valorRegiao,
} from '@/clinico/pediatria/queimadura'
import { NumberField } from '@/components/plantonista/NumberField'
import { ToolLayout } from '@/components/plantonista/ToolLayout'

import { PACIENTE_VAZIO, br, faixaBr, idadeAnos, podeCalcular } from './formatoIcr'
import { Bloco, CampoPaciente, Errata, LinhaLivro, Nota, Opcoes } from './PecasIcr'

const FRACOES: [number, string][] = [
  [0, '0'],
  [0.25, '¼'],
  [0.5, '½'],
  [0.75, '¾'],
  [1, 'toda'],
]

/** Queimadura na criança: superfície queimada (Lund e Browder) e Parkland — cap. 14 do Pronto-Socorro ICr-HCFMUSP. */
export function QueimaduraPed() {
  const [p, setP] = useState(PACIENTE_VAZIO)
  const [fracoes, setFracoes] = useState<Record<string, number>>({})
  const [scqManual, setScqManual] = useState(0)
  const [horas, setHoras] = useState(0)
  const [pigmento, setPigmento] = useState(false)
  const idade = idadeAnos(p.anos, p.meses)
  const coluna = colunaPorIdade(idade)
  const scqLB = coluna !== null ? superficieQueimada(coluna, fracoes) : null
  const scq = scqManual > 0 ? scqManual : scqLB ?? 0
  const calc = podeCalcular(p)
  const pk = calc && scq > 0 ? parkland(p.peso, scq, horas) : null
  const soma = calc ? somaManutencao(idade, p.peso) : null
  const man = soma ? manutencao24hMl(p.peso) : null
  const diurese = calc ? diureseAlvo(p.peso, pigmento) : null

  return (
    <ToolLayout
      title="Queimadura — superfície queimada e Parkland (criança)"
      description="Superfície corporal queimada pelo esquema de Lund e Browder e volume pela fórmula de Parkland como o livro do ICr-HCFMUSP traz. A fórmula é ponto de partida; o ajuste é clínico."
      ficha={fichaQueimaduraPed}
    >
      <CampoPaciente id="qm" p={p} onChange={setP} />

      <Bloco
        titulo="Superfície corporal queimada — Lund e Browder (Figura 1, p. 160)"
        descricao={`Só entram queimaduras de 2º e 3º graus (p. 159). Marque a fração de cada superfície atingida. Regra da mão espalmada: a mão da criança ≈ ${MAO_ESPALMADA_PCT}% da superfície (p. 159).`}
      >
        {coluna === null ? (
          <p className="text-tinta-sussurro">Informe a idade (até 13 anos e 11 meses) para escolher a coluna da tabela.</p>
        ) : (
          <>
            <p className="tabular-nums">
              Coluna de {coluna} ano{coluna === 1 ? '' : 's'}: A = {br(COLUNAS_LB[coluna].a, 2)} · B = {br(COLUNAS_LB[coluna].b, 2)} · C = {br(COLUNAS_LB[coluna].c, 2)} · total da coluna{' '}
              {br(totalCorpo(coluna), 2)}%
            </p>
            <div className="grid gap-2 md:grid-cols-2">
              {REGIOES_LB.map((r) => (
                <div key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-1.5">
                  <span>
                    {r.nome} {r.face !== 'única' && <span className="text-tinta-sussurro">({r.face})</span>} <span className="text-xs text-tinta-sussurro">{br(valorRegiao(r, coluna), 2)}%</span>
                  </span>
                  <div className="flex gap-1">
                    {FRACOES.map(([v, t]) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setFracoes({ ...fracoes, [r.id]: v })}
                        className={`rounded border px-2 py-0.5 text-xs ${(fracoes[r.id] ?? 0) === v ? 'bg-acao text-white' : ''}`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <p className="tabular-nums">
              SCQ pela Figura 1: <strong>{br(scqLB, 2)}%</strong>
              {scqLB !== null && scqLB > GRANDE_QUEIMADO_PCT && <span className="text-atencao"> — acima de {GRANDE_QUEIMADO_PCT}%: grande queimado em pediatria (p. 159)</span>}
            </p>
          </>
        )}
        <NumberField id="qm-scq" label="Ou informe a SCQ estimada (substitui a soma acima)" unit="%" value={scqManual} onChange={setScqManual} max={100} step={0.5} />
        {ERRATA_LUND_BROWDER.map((e) => (
          <Errata key={e} texto={e} />
        ))}
      </Bloco>

      {p.rn && (
        <Bloco titulo="Reposição">
          <p className="text-atencao">{SEM_VALOR_NEONATAL}</p>
        </Bloco>
      )}
      {!p.rn && !(p.peso > 0) && (
        <Bloco titulo="Reposição">
          <p className="text-tinta-sussurro">Informe o peso para calcular.</p>
        </Bloco>
      )}

      {calc && (
        <Bloco titulo="Reposição — Parkland (p. 161–162)" descricao="< 14 anos: 3 mL/kg/%SCQ; acima de 50% de SCQ, calcula-se com 50%. Ringer lactato ou SF: 50% nas primeiras 8 h a contar do acidente, 50% nas 16 h seguintes.">
          <NumberField id="qm-horas" label="Horas desde o acidente" unit="h" value={horas} onChange={setHoras} step={0.5} />
          {pk ? (
            <>
              <LinhaLivro
                nome="Volume em 24 h"
                texto={`3 × ${br(p.peso)} kg × ${br(pk.scqUsada)}%${scq > 50 ? ' (teto de 50%)' : ''}`}
                conta={<strong>{br(pk.totalMl, 0)} mL</strong>}
                pagina="p. 161"
              />
              <LinhaLivro
                nome="Até completar 8 h do acidente"
                texto="metade do volume nas primeiras 8 h a contar do acidente"
                conta={<strong>{pk.mlHAte8h === null ? 'as 8 h já passaram' : `${br(pk.primeiras8hMl, 0)} mL em ${br(pk.horasRestantes8h, 1)} h ≈ ${br(pk.mlHAte8h, 0)} mL/h`}</strong>}
                pagina="p. 162"
              />
              <LinhaLivro nome="16 h seguintes" texto="a outra metade nas 16 h subsequentes" conta={<strong>{br(pk.seguintes16hMl, 0)} mL ≈ {br(pk.mlH16h, 0)} mL/h</strong>} pagina="p. 162" />
              {man !== null && (
                <LinhaLivro
                  nome="+ soro de manutenção (< 5 anos ou < 30 kg)"
                  texto="a Parkland é acrescida de soro de manutenção"
                  conta={<strong>{br(man, 0)} mL/dia ≈ {br(man / 24, 0)} mL/h</strong>}
                  pagina="p. 161"
                  nota={NOTA_MANUTENCAO}
                />
              )}
            </>
          ) : (
            <p className="text-tinta-sussurro">Informe a superfície queimada.</p>
          )}
          <Nota>Pré-hospitalar: com SCQ &gt; 10% ou transporte prolongado, SF ou Ringer lactato {PRE_HOSPITALAR_ML_KG_H} mL/kg/h = {br(PRE_HOSPITALAR_ML_KG_H * p.peso, 0)} mL/h (p. 161).</Nota>
        </Bloco>
      )}

      {calc && diurese && (
        <Bloco titulo="Diurese-alvo nas primeiras 24 h (p. 162)">
          <Opcoes label="Hematúria ou mioglobinúria?" valor={pigmento} opcoes={[[false, 'Não'], [true, 'Sim (dobro)']]} onChange={setPigmento} />
          <p className="tabular-nums">
            {faixaBr(diurese.mlKgH, 1)} mL/kg/h = <strong>{faixaBr(diurese.mlH, 0)} mL/h</strong>
          </p>
          <Nota>Até 30 kg: 1–2 mL/kg/h; acima de 30 kg: 0,5–1 mL/kg/h. Hiperglicemia com diurese osmótica pode dar falsa impressão de hidratação adequada (p. 162).</Nota>
        </Bloco>
      )}

      <Nota>{AVISO_ELETRICA}</Nota>
    </ToolLayout>
  )
}
