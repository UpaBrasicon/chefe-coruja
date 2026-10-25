import { useState } from 'react'

import {
  FATORES_NEUROTOXICIDADE, faixaBilirrubina, fichaIctericiaNeonatal, limiaresIctericia, pedirSerica, suspensaoFototerapia,
} from '@/clinico/pediatria/ictericia'
import { NumberField } from '@/components/plantonista/NumberField'
import { ToolLayout } from '@/components/plantonista/ToolLayout'
import { numero } from '@/lib/formato'
import { cn } from '@/lib/utils'

import { Bloco, Pergunta } from '../manual/PecasLoteC'

const mg = (x: number) => numero(Math.round(x * 10) / 10)

const TEXTO_FAIXA = {
  abaixo: 'Abaixo do limiar de fototerapia.',
  fototerapia: 'No limiar de fototerapia ou acima: a AAP recomenda fototerapia intensiva (KAS 10).',
  escalonamento: 'No limiar de escalonamento de cuidado ou acima: bilirrubina total e direta, hemograma, albumina, bioquímica e tipagem com prova cruzada em caráter STAT; hidratação EV e fototerapia intensiva de emergência (KAS 17–19).',
  exsanguineo: 'No limiar de exsanguineotransfusão ou acima (Tabelas Suplementares 3 e 4).',
}

/** Icterícia neonatal ≥ 35 semanas: limiares hora a hora da AAP 2022. */
export function IctericiaNeonatal() {
  const [ig, setIg] = useState(0)
  const [horas, setHoras] = useState(0)
  const [bt, setBt] = useState(0)
  const [btc, setBtc] = useState(0)
  const [fator, setFator] = useState<boolean>()
  const [subindo, setSubindo] = useState<boolean>()
  const l = ig > 0 && horas > 0 && fator !== undefined ? limiaresIctericia({ igSemanas: ig, horasDeVida: Math.floor(horas), fatorRisco: fator, subindoNaFoto: subindo }) : null
  const faixa = l && bt > 0 ? faixaBilirrubina(bt, l) : null

  return (
    <ToolLayout
      title="Icterícia neonatal ≥ 35 semanas — fototerapia e escalonamento"
      description="Limiares hora a hora de fototerapia, escalonamento de cuidado e exsanguineotransfusão pela AAP 2022, pela idade gestacional e pelos fatores de risco de neurotoxicidade. Recém-nascido de 35 semanas ou mais, até 14 dias."
      ficha={fichaIctericiaNeonatal}
    >
      <Bloco titulo="Recém-nascido">
        <div className="grid gap-4 md:grid-cols-2">
          <NumberField id="ict-ig" label="Idade gestacional" unit="semanas" value={ig} onChange={setIg} min={0} />
          <NumberField id="ict-horas" label="Horas de vida" unit="h" value={horas} onChange={setHoras} min={0} />
        </div>
        <Pergunta rotulo="Algum fator de risco de neurotoxicidade além da IG" valor={fator} onChange={setFator} />
        <ul className="list-disc pl-5 text-apoio text-tinta-sussurro">{FATORES_NEUROTOXICIDADE.map((f) => <li key={f}>{f}</li>)}</ul>
        <p className="text-apoio text-tinta-sussurro">A IG abaixo de 38 semanas já entra nos limiares de cada idade gestacional (Tabela 2).</p>
        <Pergunta rotulo="Bilirrubina subindo apesar da fototerapia" valor={subindo} onChange={setSubindo} />
        {ig > 0 && ig < 35 && <p className="text-apoio text-atencao">A AAP 2022 vale só para 35 semanas ou mais.</p>}
        {horas > 335 && <p className="text-apoio text-atencao">As tabelas vão até 14 dias de vida (335 h).</p>}
      </Bloco>

      {l && (
        <Bloco titulo={`Limiares às ${Math.floor(horas)} h de vida`}>
          <p className="text-apoio text-tinta">Fototerapia: <strong>{mg(l.fototerapia)} mg/dL</strong> <span className="text-tinta-sussurro">(Tabela Suplementar {l.tabelaFoto})</span></p>
          <p className="text-apoio text-tinta">Escalonamento de cuidado: <strong>{mg(l.escalonamento)} mg/dL</strong> <span className="text-tinta-sussurro">(2 mg/dL abaixo da exsanguineotransfusão, KAS 17)</span></p>
          <p className="text-apoio text-tinta">Exsanguineotransfusão: <strong>{mg(l.exsanguineo)} mg/dL</strong> <span className="text-tinta-sussurro">(Tabela Suplementar {l.tabelaExs})</span></p>
          <div className="grid gap-4 pt-2 md:grid-cols-2">
            <NumberField id="ict-bt" label="Bilirrubina total sérica" unit="mg/dL" value={bt} onChange={setBt} min={0} step={0.1} />
            <NumberField id="ict-btc" label="Bilirrubina transcutânea (se houver)" unit="mg/dL" value={btc} onChange={setBtc} min={0} step={0.1} />
          </div>
          {btc > 0 && (
            <p className="text-apoio text-tinta-apoio">
              {pedirSerica(btc, l.fototerapia) ? 'Transcutânea a até 3 mg/dL do limiar de fototerapia ou ≥ 15 mg/dL: dosar a bilirrubina total sérica (KAS 6).' : 'Transcutânea abaixo do critério de dosagem sérica do KAS 6.'}
            </p>
          )}
          {faixa && (
            <div role="status" className={cn('rounded-cartao border px-4 py-3', faixa === 'abaixo' ? 'border-fio' : faixa === 'fototerapia' ? 'border-atencao' : 'border-critico')}>
              <p className="text-corpo font-semibold text-tinta">{mg(bt)} mg/dL</p>
              <p className="text-apoio text-tinta-apoio">{TEXTO_FAIXA[faixa]}</p>
              {faixa !== 'abaixo' && <p className="text-apoio text-tinta-sussurro">Suspender a fototerapia é opção quando a bilirrubina cair a {mg(suspensaoFototerapia(l.fototerapia))} mg/dL ou menos (2 mg/dL abaixo do limiar no início, KAS 15).</p>}
            </div>
          )}
          <p className="text-apoio text-tinta-sussurro">Usar a bilirrubina total; não subtrair a direta. Os limiares vêm de opinião de especialistas (Tabelas Suplementares).</p>
        </Bloco>
      )}
    </ToolLayout>
  )
}
