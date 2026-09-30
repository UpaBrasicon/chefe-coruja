import { useState } from 'react'

import {
  CRITERIOS_CLINICOS, DOSES_KAWASAKI, ERRATA_Z, LAB_INCOMPLETA, ROTULO_CORONARIA, classificarZ, fichaKawasaki, lerCriterios, lerIncompleta, velocidadeIvigMlH,
} from '@/clinico/pediatria/kawasaki'
import { NumberField } from '@/components/plantonista/NumberField'
import { ToolLayout } from '@/components/plantonista/ToolLayout'

import { PACIENTE_VAZIO, br, idadePediatrica } from './formatoIcr'
import { Bloco, CampoPaciente, Errata, Nota, Pendencia } from './PecasIcr'
import { LinhaDoseLivro, Marcadores } from './PecasP4'

const TEXTO_INCOMPLETA = {
  'inflamacao-baixa': 'PCR < 3 mg/dL e VHS < 40 mm/h: a Figura 1 indica avaliação clínica e laboratorial seriada se a febre persistir, e ecocardiograma se ocorrer descamação típica.',
  'tratar-lab': 'PCR ≥ 3 mg/dL e/ou VHS ≥ 40 mm/h com ≥ 3 alterações laboratoriais: a Figura 1 leva a "tratar como doença de Kawasaki".',
  'depende-eco': 'PCR ≥ 3 mg/dL e/ou VHS ≥ 40 mm/h com menos de 3 alterações: a Figura 1 depende do ecocardiograma (coronária Z ≥ 2,5, ou ≥ 3 entre realce coronariano, disfunção de VE, regurgitação mitral, pericardite, Z entre 2 e 2,5).',
} as const

/** Doença de Kawasaki — cap. 70 do livro do ICr. */
export function KawasakiPed() {
  const [p, setP] = useState(PACIENTE_VAZIO)
  const [dias, setDias] = useState(0)
  const [crit, setCrit] = useState<Set<string>>(new Set())
  const [lab, setLab] = useState<Set<string>>(new Set())
  const [pcr, setPcr] = useState(0)
  const [vhs, setVhs] = useState(0)
  const [z, setZ] = useState(0)
  const [mm, setMm] = useState(0)
  const idadeMeses = p.anos * 12 + p.meses
  const leitura = lerCriterios(dias, crit.size, idadeMeses)
  const incompleta = pcr > 0 || vhs > 0 ? lerIncompleta(pcr, vhs, lab.size) : null
  const coronaria = z !== 0 || mm > 0 ? classificarZ(z, mm > 0 ? mm : undefined) : null
  const calc = !p.rn && p.peso > 0 && idadePediatrica(p.anos, p.meses)
  const vel = calc ? velocidadeIvigMlH(p.peso) : null

  return (
    <ToolLayout
      title="Doença de Kawasaki — critérios e doses"
      description="Critérios clássicos, algoritmo da AHA para a forma incompleta, classificação coronariana pelo Z-score e doses por peso (Tabela 1) — livro do ICr-HCFMUSP. O diagnóstico é do médico."
      ficha={fichaKawasaki}
    >
      <CampoPaciente id="kaw" p={p} onChange={setP} />

      <Bloco titulo="Critérios clássicos (p. 747)" descricao="Febre alta por ao menos 5 dias + ao menos 4 das 5 manifestações.">
        <NumberField id="kaw-dias" label="Dias de febre" unit="dias" value={dias} onChange={setDias} min={0} />
        <Marcadores itens={CRITERIOS_CLINICOS} marcados={crit} onChange={setCrit} />
        {leitura && (
          <p>
            {leitura.criterios} de 5 manifestações.{' '}
            {leitura.classica && <strong>Preenche os critérios clássicos do livro.</strong>}
            {leitura.quartoDia && <strong>Com 4 ou mais manifestações, a AHA admite o diagnóstico já no 4º dia de febre (p. 747).</strong>}
            {leitura.incompletaAvaliar && <strong>Situação de entrada do algoritmo da forma incompleta (Figura 1, p. 748).</strong>}
          </p>
        )}
      </Bloco>

      <Bloco titulo="Forma incompleta (Figura 1, p. 748)" descricao="Febre ≥ 5 dias com 2 ou 3 critérios, ou lactente < 6 meses com febre ≥ 7 dias sem explicação.">
        <div className="grid gap-3 sm:grid-cols-2">
          <NumberField id="kaw-pcr" label="PCR" unit="mg/dL" value={pcr} onChange={setPcr} min={0} step={0.1} />
          <NumberField id="kaw-vhs" label="VHS" unit="mm/h" value={vhs} onChange={setVhs} min={0} />
        </div>
        <Marcadores itens={LAB_INCOMPLETA} marcados={lab} onChange={setLab} />
        {incompleta && <p>{TEXTO_INCOMPLETA[incompleta]}</p>}
      </Bloco>

      <Bloco titulo="Coronárias — Z-score (p. 749–750)">
        <div className="grid gap-3 sm:grid-cols-2">
          <NumberField id="kaw-z" label="Z-score" value={z} onChange={setZ} min={-10} step={0.1} />
          <NumberField id="kaw-mm" label="Diâmetro (opcional)" unit="mm" value={mm} onChange={setMm} min={0} step={0.1} />
        </div>
        {coronaria && <p><strong>{ROTULO_CORONARIA[coronaria]}</strong></p>}
        <Errata texto={ERRATA_Z} />
      </Bloco>

      <Pendencia p={p} />
      {calc && (
        <Bloco titulo="Doses (Tabela 1, p. 750–751)">
          {DOSES_KAWASAKI.map((d) => (
            <LinhaDoseLivro
              key={d.id}
              d={d}
              peso={p.peso}
              extra={
                d.id === 'ivig' && vel ? (
                  <p className="text-tinta-sussurro">
                    Velocidade pelo Apêndice (p. 904): iniciar a {br(vel.inicial, 1)} mL/h (0,01 mL/kg/min), dobrando a cada 15–30 min até {br(vel.maxima, 1)} mL/h (0,08 mL/kg/min); monitorar PA.
                  </p>
                ) : undefined
              }
            />
          ))}
          <Nota>Refratário: febre persistente ou recrudescente 36 a 48 h após o fim da imunoglobulina (p. 749).</Nota>
        </Bloco>
      )}
    </ToolLayout>
  )
}
