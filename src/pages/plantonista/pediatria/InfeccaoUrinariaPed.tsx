import { useState } from 'react'

import {
  AVISO_AAP_2026, DOSES_ITU_ORAL, DOSES_ITU_PARENTERAL, ERRATA_ITU, FAIXAS_ITU, FATORES_FIGURA2, FIGURA2_ENTRADA, LEUCOCITURIA, NOTA_CONTAGEM_AAP, NOTA_ESCOLHA_AAP, NOTA_FIGURA1,
  NOTA_FIGURA2, NOTA_LIMIARES_AAP, NOTA_NITRITO, NOTA_VIA_AAP, OPCOES_ESTERASE, OPCOES_LEUCOCITOS, QUADRO3, REFERENCIAS_ITU, REFERENCIA_AAP, REFERENCIA_LIVRO, SEM_URINALISE,
  faixaCompativel, fichaItuPed, lerUrinaliseAap, lerUrocultura, usaAap, type Coleta, type FaixaItu, type Urinalise,
} from '@/clinico/pediatria/ituPed'
import { NumberField } from '@/components/plantonista/NumberField'
import { ToolLayout } from '@/components/plantonista/ToolLayout'

import { PACIENTE_VAZIO, idadePediatrica } from './formatoIcr'
import { Bloco, CampoPaciente, Errata, Nota, Opcoes, Pendencia } from './PecasIcr'
import { LinhaDoseLivro } from './PecasP4'

/** Infecção urinária na criança — cap. 57 do livro do ICr; AAP 2026 de 8 dias a 5 anos. */
export function InfeccaoUrinariaPed() {
  const [p, setP] = useState(PACIENTE_VAZIO)
  const [faixa, setFaixa] = useState<FaixaItu | ''>('')
  const [ua, setUa] = useState<Urinalise>(SEM_URINALISE)
  const [coleta, setColeta] = useState<Coleta>('sondagem')
  const [ufc, setUfc] = useState(0)
  const [umGerme, setUmGerme] = useState(true)
  const aap = faixa !== '' && usaAap(faixa)
  const leituraUa = faixa !== '' ? lerUrinaliseAap(faixa, ua) : null
  const uro = faixa !== '' && (ufc > 0 || coleta === 'saco') ? lerUrocultura(faixa, coleta, ufc, umGerme, ua) : null
  const incompativel = faixa !== '' && !faixaCompativel(faixa, p.anos, p.meses, p.rn)
  const calc = !p.rn && p.peso > 0 && idadePediatrica(p.anos, p.meses)

  return (
    <ToolLayout
      title="Infecção urinária — criança"
      description="Quem testar e leitura da urinálise e da urocultura pela AAP 2026 de 8 dias a 5 anos (pelo livro fora dessa faixa), e antibióticos orais e parenterais por peso (Tabelas 3 e 4) — livro do ICr-HCFMUSP."
      ficha={fichaItuPed}
    >
      <CampoPaciente id="itu" p={p} onChange={setP} />

      <div role="note" className="flex flex-col gap-1 rounded-controle border border-atencao/40 bg-alerta-atencao px-3 py-2 text-apoio text-atencao">
        <p className="font-medium">Diretriz nova da AAP (Pediatrics, out/2026), posterior ao livro</p>
        <ul className="list-disc pl-5">
          {AVISO_AAP_2026.map((t) => <li key={t}>{t}</li>)}
        </ul>
      </div>

      <Bloco titulo="Testar a urina? Figura 2 da AAP 2026 (CPG p. 28)" descricao={FIGURA2_ENTRADA}>
        <p>Fatores de risco (sem número mínimo):</p>
        <ul className="list-disc pl-5">
          {FATORES_FIGURA2.map((f) => <li key={f}>{f}</li>)}
        </ul>
        <Nota>{NOTA_FIGURA2}</Nota>
        <Nota>{NOTA_FIGURA1}</Nota>
      </Bloco>

      <Bloco
        titulo="Urinálise e urocultura"
        descricao="A faixa de idade decide a referência: de 8 dias a 5 anos, AAP 2026 (Tabela 1, CPG p. 5); até 7 dias e acima de 5 anos, livro do ICr (p. 593–595)."
      >
        <Opcoes label="Faixa de idade" valor={faixa} opcoes={FAIXAS_ITU} onChange={setFaixa} />
        {incompativel && <p className="text-atencao">A faixa marcada não bate com a idade digitada acima. Confira.</p>}
        {faixa === '' && <p className="text-tinta-sussurro">Escolha a faixa de idade para ler a urinálise e a urocultura.</p>}
        {faixa !== '' && (
          <p>
            Referência aplicada: <strong>{aap ? REFERENCIA_AAP : REFERENCIA_LIVRO}</strong>
          </p>
        )}

        {aap && (
          <>
            <Opcoes label="Leucócitos por campo de grande aumento (urina não centrifugada)" valor={ua.leucocitos} opcoes={OPCOES_LEUCOCITOS} onChange={(leucocitos) => setUa({ ...ua, leucocitos })} />
            <Opcoes label="Esterase leucocitária" valor={ua.esterase} opcoes={OPCOES_ESTERASE} onChange={(esterase) => setUa({ ...ua, esterase })} />
            <Nota>{NOTA_CONTAGEM_AAP}</Nota>
            {leituraUa && <p>{leituraUa}</p>}
            <Nota>{NOTA_LIMIARES_AAP}</Nota>
            <Nota>{NOTA_NITRITO}</Nota>
          </>
        )}
        {faixa !== '' && !aap && (
          <Nota>
            Leucocitúria pelo livro: ≥ {LEUCOCITURIA.centrifugadaCampo}/campo (centrifugada) ou ≥ {LEUCOCITURIA.naoCentrifugadaMm3}/mm³ = 10.000/mL (não centrifugada) (p. 593).
          </Nota>
        )}

        {faixa !== '' && (
          <>
            <Opcoes label="Coleta da urocultura" valor={coleta} opcoes={[['sondagem', 'Sondagem vesical'], ['psp', 'Punção suprapúbica'], ['jato', 'Jato médio'], ['saco', 'Saco coletor']]} onChange={setColeta} />
            <NumberField id="itu-ufc" label="Contagem" unit="UFC/mL" value={ufc} onChange={setUfc} min={0} step={1000} />
            <Opcoes label="Crescimento" valor={umGerme} opcoes={[[true, 'Um uropatógeno'], [false, 'Mais de um germe']]} onChange={setUmGerme} />
            {uro && uro.linhas.map((l) => <p key={l}>{l}</p>)}
          </>
        )}
      </Bloco>

      <Pendencia p={p} />
      <Nota>{NOTA_ESCOLHA_AAP}</Nota>
      {calc && (
        <>
          <Bloco titulo="Via oral (Tabela 3, p. 597)">
            {DOSES_ITU_ORAL.map((d) => <LinhaDoseLivro key={d.id} d={d} peso={p.peso} />)}
          </Bloco>
          <Bloco titulo="Via parenteral (Tabela 4, p. 597–598)">
            {DOSES_ITU_PARENTERAL.map((d) => <LinhaDoseLivro key={d.id} d={d} peso={p.peso} />)}
          </Bloco>
        </>
      )}
      {p.rn && <Nota>No recém-nascido o livro associa ampicilina à cefalosporina de 3ª geração ou aminoglicosídeo, sem dose neonatal (p. 596).</Nota>}

      <Bloco titulo="Tratamento parenteral e internação na pielonefrite (Quadro 3, p. 596–597)">
        <Nota>{NOTA_VIA_AAP}</Nota>
        <ul className="list-disc pl-5 text-tinta-sussurro">
          {QUADRO3.map((q) => <li key={q}>{q}</li>)}
        </ul>
      </Bloco>
      <Bloco titulo="Do capítulo">
        {REFERENCIAS_ITU.map((r) => (
          <div key={r.texto} className="flex flex-col gap-1">
            <Nota>
              {r.texto} ({r.pagina})
            </Nota>
            {r.notaAap && <Nota>{r.notaAap}</Nota>}
          </div>
        ))}
        <Errata texto={ERRATA_ITU} />
      </Bloco>
    </ToolLayout>
  )
}
