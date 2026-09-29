import { useState } from 'react'

import {
  BMS_CRITERIOS, DOSES_MENINGITE, DOSES_PROFILAXIA, DURACAO, ERRATA_BMS, ERRATA_LIQUOR, LIQUOR, REFERENCIAS_MENINGITE, bms, fichaMeningitePed, leucocitosLiquorAjustados,
  leucocitosLiquorEstimativa, proteinaLiquorAjustada,
} from '@/clinico/pediatria/meningitePed'
import { NumberField } from '@/components/plantonista/NumberField'
import { ToolLayout } from '@/components/plantonista/ToolLayout'

import { PACIENTE_VAZIO, br, idadePediatrica } from './formatoIcr'
import { Bloco, CampoPaciente, Errata, Nota } from './PecasIcr'
import { Aviso, LinhaDoseLivro, Marcadores, TabelaLivro } from './PecasP4'

/** Meningite na criança — cap. 40 do livro do ICr. */
export function MeningitePed() {
  const [p, setP] = useState(PACIENTE_VAZIO)
  const [lcr, setLcr] = useState({ leucLiquor: 0, hemLiquor: 0, leucSangue: 0, hemSangue: 0, proteina: 0 })
  const [marcados, setMarcados] = useState<Set<string>>(new Set())
  const pediatrico = idadePediatrica(p.anos, p.meses)
  const calc = p.peso > 0 && pediatrico
  const ajust = leucocitosLiquorAjustados(lcr)
  const estim = lcr.leucLiquor > 0 || lcr.hemLiquor > 0 ? leucocitosLiquorEstimativa(lcr.leucLiquor, lcr.hemLiquor) : null
  const prot = lcr.proteina > 0 ? proteinaLiquorAjustada(lcr.proteina, lcr.hemLiquor) : null
  const escore = bms(marcados)
  const campo = (k: keyof typeof lcr, label: string, unit: string) => (
    <NumberField id={`men-${k}`} label={label} unit={unit} value={lcr[k]} onChange={(x) => setLcr({ ...lcr, [k]: x })} min={0} />
  )

  return (
    <ToolLayout
      title="Meningite — criança"
      description="Liquor no acidente de punção, Bacterial Meningitis Score, antibióticos empíricos (neonatal e pós-neonatal), aciclovir, dexametasona e quimioprofilaxia — livro do ICr-HCFMUSP."
      ficha={fichaMeningitePed}
    >
      <CampoPaciente id="men" p={p} onChange={setP} />

      <Bloco titulo="Acidente de punção (p. 409)">
        <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
          {campo('leucLiquor', 'Leucócitos no liquor', '/mm³')}
          {campo('hemLiquor', 'Hemácias no liquor', '/mm³')}
          {campo('proteina', 'Proteína no liquor', 'mg/dL')}
          {campo('leucSangue', 'Leucócitos no sangue', '/mm³')}
          {campo('hemSangue', 'Hemácias no sangue', '/mm³')}
        </div>
        {ajust !== null && <p>Leucócitos ajustados (fórmula): <strong className="tabular-nums">{br(ajust, 1)}/mm³</strong></p>}
        {estim && <p className="text-tinta-sussurro">Estimativa rápida (1 leucócito a cada 500 a 1.500 hemácias): {br(estim[0], 0)} a {br(estim[1], 0)}/mm³.</p>}
        {prot !== null && <p>Proteína ajustada (−1 mg/dL a cada 1.000 hemácias): <strong className="tabular-nums">{br(prot, 1)} mg/dL</strong></p>}
      </Bloco>

      <Bloco titulo="Bacterial Meningitis Score (p. 410)" descricao="Criança com pleocitose. Muito baixo risco (0,1%) só se todos ausentes; qualquer critério presente: tratar como bacteriana até as culturas.">
        <Marcadores itens={BMS_CRITERIOS} marcados={marcados} onChange={setMarcados} />
        <p>
          {escore.pontos} critério(s) presente(s): <strong>{escore.muitoBaixoRisco ? 'muito baixo risco pelo BMS' : 'não é muito baixo risco pelo BMS'}</strong>.
        </p>
        <Errata texto={ERRATA_BMS} />
      </Bloco>

      {!calc ? (
        <Aviso>Informe o peso para calcular as doses.</Aviso>
      ) : (
        <>
          <Bloco titulo="Tratamento (p. 410–411)" descricao={p.rn ? 'Recém-nascido: só as linhas com valor neonatal do livro calculam.' : undefined}>
            {DOSES_MENINGITE.map((d) => <LinhaDoseLivro key={d.id} d={d} peso={p.peso} rn={p.rn} />)}
          </Bloco>
          <Bloco titulo="Quimioprofilaxia de contatos (p. 412–413)">
            {DOSES_PROFILAXIA.map((d) => <LinhaDoseLivro key={d.id} d={d} peso={p.peso} rn={p.rn} />)}
          </Bloco>
        </>
      )}

      <Bloco titulo="Duração por agente (Tabela 5, p. 410)" descricao="Empírico: 14 dias no neonato e 10 dias nas demais idades.">
        <TabelaLivro cabecalho={['Microrganismo', 'Duração']} linhas={DURACAO.map(([a, b]) => [a, b])} largura={320} />
      </Bloco>
      <Bloco titulo="Liquor por etiologia (Tabela 4, p. 409) — referência">
        <TabelaLivro cabecalho={['', 'Normal', 'Vírus', 'Bactéria', 'Fungo', 'Tuberculose']} linhas={LIQUOR.map((l) => [l.lab, l.normal, l.virus, l.bacteria, l.fungo, l.tb])} largura={680} />
        <Errata texto={ERRATA_LIQUOR} />
      </Bloco>
      <Bloco titulo="Do capítulo">
        {REFERENCIAS_MENINGITE.map((r) => (
          <Nota key={r.texto}>
            {r.texto} ({r.pagina})
          </Nota>
        ))}
      </Bloco>
    </ToolLayout>
  )
}
