import { useState } from 'react'

import {
  FATORES_NEUROTOXICIDADE, faixaBilirrubina, fichaIctericiaNeonatal, limiaresIctericia, pedirSerica, suspensaoFototerapia,
} from '@/clinico/pediatria/ictericia'
import { textoFontes } from '@/clinico/ficha'
import { passosDaFaixa } from '@/clinico/guia'
import { guiaDa } from '@/clinico/guias'
import { NumberField } from '@/components/plantonista/NumberField'
import { AbasResultado } from '@/components/plantonista/calc/AbasResultado'
import { ID_ABAS_RESULTADO, type IdAba } from '@/components/plantonista/calc/contexto'
import { ResumoFlutuante } from '@/components/plantonista/calc/ResumoFlutuante'
import { ToolLayout } from '@/components/plantonista/ToolLayout'
import { numeroBr, textoCopia } from '@/domain/copiaCalculo'
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

/** Rótulo curto da faixa para o resumo flutuante (o texto inteiro fica no quadro acima). */
const FAIXA_CURTA = {
  abaixo: 'abaixo do limiar de fototerapia',
  fototerapia: 'no limiar de fototerapia ou acima',
  escalonamento: 'no limiar de escalonamento ou acima',
  exsanguineo: 'no limiar de exsanguineotransfusão ou acima',
}

const NOTA_BT = 'Usar a bilirrubina total; não subtrair a direta. Os limiares vêm de opinião de especialistas (Tabelas Suplementares).'

/** Icterícia neonatal ≥ 35 semanas: limiares hora a hora da AAP 2022. */
export function IctericiaNeonatal() {
  const [ig, setIg] = useState(0)
  const [horas, setHoras] = useState(0)
  const [bt, setBt] = useState(0)
  const [btc, setBtc] = useState(0)
  const [fator, setFator] = useState<boolean>()
  const [subindo, setSubindo] = useState<boolean>()
  const [aba, setAba] = useState<IdAba>('proximos')
  const guia = guiaDa(fichaIctericiaNeonatal.id)
  const l = ig > 0 && horas > 0 && fator !== undefined ? limiaresIctericia({ igSemanas: ig, horasDeVida: Math.floor(horas), fatorRisco: fator, subindoNaFoto: subindo }) : null
  const faixa = l && bt > 0 ? faixaBilirrubina(bt, l) : null
  const textoSerica = l && btc > 0 ? (pedirSerica(btc, l.fototerapia) ? 'Transcutânea a até 3 mg/dL do limiar de fototerapia ou ≥ 15 mg/dL: dosar a bilirrubina total sérica (KAS 6).' : 'Transcutânea abaixo do critério de dosagem sérica do KAS 6.') : null

  // Texto do "Copiar" (C4 = A): dados, limiares da hora de vida, faixa da bilirrubina e a tabela da AAP.
  const copia = () =>
    l &&
    textoCopia({
      ferramenta: 'Icterícia neonatal ≥ 35 semanas — fototerapia e escalonamento (AAP 2022)',
      dados: [
        ['Idade gestacional', `${numeroBr(ig)} semanas`],
        ['Horas de vida', `${Math.floor(horas)} h`],
        ['Fator de risco de neurotoxicidade além da IG', fator ? 'sim' : 'não'],
        ['Bilirrubina subindo apesar da fototerapia', subindo === undefined ? '' : subindo ? 'sim' : 'não'],
        ['Bilirrubina total sérica', bt > 0 ? `${mg(bt)} mg/dL` : ''],
        ['Bilirrubina transcutânea', btc > 0 ? `${mg(btc)} mg/dL` : ''],
      ],
      resultado: [
        `Limiar de fototerapia: ${mg(l.fototerapia)} mg/dL (Tabela Suplementar ${l.tabelaFoto})`,
        `Limiar de escalonamento de cuidado: ${mg(l.escalonamento)} mg/dL (2 mg/dL abaixo da exsanguineotransfusão, KAS 17)`,
        `Limiar de exsanguineotransfusão: ${mg(l.exsanguineo)} mg/dL (Tabela Suplementar ${l.tabelaExs})`,
        ...(textoSerica ? [textoSerica] : []),
        ...(faixa ? [`Bilirrubina ${mg(bt)} mg/dL: ${TEXTO_FAIXA[faixa]}`] : []),
        ...(faixa && faixa !== 'abaixo' ? [`Suspender a fototerapia é opção quando a bilirrubina cair a ${mg(suspensaoFototerapia(l.fototerapia))} mg/dL ou menos (2 mg/dL abaixo do limiar no início, KAS 15).`] : []),
      ],
      fonte: textoFontes(fichaIctericiaNeonatal),
      versao: fichaIctericiaNeonatal.versao,
      quando: new Date(),
    })

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
          {textoSerica && (
            <p className="text-apoio text-tinta-apoio">
              {textoSerica}
            </p>
          )}
          {faixa && (
            <div role="status" className={cn('rounded-cartao border px-4 py-3', faixa === 'abaixo' ? 'border-fio' : faixa === 'fototerapia' ? 'border-atencao' : 'border-critico')}>
              <p className="text-corpo font-semibold text-tinta">{mg(bt)} mg/dL</p>
              <p className="text-apoio text-tinta-apoio">{TEXTO_FAIXA[faixa]}</p>
              {faixa !== 'abaixo' && <p className="text-apoio text-tinta-sussurro">Suspender a fototerapia é opção quando a bilirrubina cair a {mg(suspensaoFototerapia(l.fototerapia))} mg/dL ou menos (2 mg/dL abaixo do limiar no início, KAS 15).</p>}
            </div>
          )}
          <p className="text-apoio text-tinta-sussurro">{NOTA_BT}</p>
        </Bloco>
      )}
      <AbasResultado
        aba={aba}
        onAba={setAba}
        passos={passosDaFaixa(guia, undefined)}
        semResultado={!l}
        armadilhas={[NOTA_BT, ...(guia?.armadilhas ?? [])]}
        ficha={fichaIctericiaNeonatal}
        guia={guia}
      />
      <ResumoFlutuante
        principal={faixa ? `BT ${mg(bt)} mg/dL · ${FAIXA_CURTA[faixa]}` : l ? `Fototerapia a partir de ${mg(l.fototerapia)} mg/dL` : 'Informe IG, horas de vida e fator de risco'}
        detalhe={l ? `Às ${Math.floor(horas)} h: fototerapia ${mg(l.fototerapia)} · escalonamento ${mg(l.escalonamento)} · exsanguineotransfusão ${mg(l.exsanguineo)} mg/dL` : undefined}
        tom={faixa === 'escalonamento' || faixa === 'exsanguineo' ? 'critico' : faixa === 'fototerapia' ? 'atencao' : 'neutro'}
        textoCopia={copia() || undefined}
        alvoDetalhes={ID_ABAS_RESULTADO}
        rotuloDetalhes="Próximos passos"
        aoIrDetalhes={() => setAba('proximos')}
      />
    </ToolLayout>
  )
}
