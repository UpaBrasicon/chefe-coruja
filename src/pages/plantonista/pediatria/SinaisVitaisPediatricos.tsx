import { useState } from 'react'

import { idadeEmDias } from '@/clinico/pediatria/fonteP2'
import { DICA_CAP2, fichaSinaisVitais, referenciasPorIdade } from '@/clinico/pediatria/sinaisVitais'
import { NumberField } from '@/components/plantonista/NumberField'
import { ToolLayout } from '@/components/plantonista/ToolLayout'
import { textoFontes } from '@/clinico/ficha'
import { AbasResultado } from '@/components/plantonista/calc/AbasResultado'
import { ResumoFlutuante } from '@/components/plantonista/calc/ResumoFlutuante'
import { ID_ABAS_RESULTADO, type IdAba } from '@/components/plantonista/calc/contexto'
import { passosDaFaixa } from '@/clinico/guia'
import { guiaDa } from '@/clinico/guias'
import { textoCopia } from '@/domain/copiaCalculo'
import { Card, CardContent } from '@/components/ui/card'

import { Bloco } from './PecasP2'

const f = (a: [number, number]) => `${a[0]}–${a[1]}`

/** Sinais vitais por idade: as tabelas de referência do livro do ICr, sem marcar valor do paciente. */
export function SinaisVitaisPediatricos() {
  const [anos, setAnos] = useState(0)
  const [meses, setMeses] = useState(0)
  const [dias, setDias] = useState(0)
  const idade = idadeEmDias(anos, meses, dias)
  const informada = anos > 0 || meses > 0 || dias > 0
  const r = informada && idade !== null ? referenciasPorIdade(idade) : null
  const [aba, setAba] = useState<IdAba>('proximos')
  const guia = guiaDa(fichaSinaisVitais.id)
  const idadeTxt = `${anos} anos, ${meses} meses e ${dias} dias`

  // Texto do "Copiar" (C4 = A): as referências da idade que estão na tela, com a página do livro (sem valor do paciente).
  const copia = () =>
    r &&
    textoCopia({
      ferramenta: 'Sinais vitais por idade (PS Pediatria ICr-HCFMUSP)',
      dados: [['Idade', idadeTxt]],
      resultado: [
        ...(r.fc ? [`FC normal (${r.fc.rotulo}): acordado ${f(r.fc.valor.acordado)} bpm · sono ${f(r.fc.valor.sono)} bpm (cap. 2, Quadro 1, p. 40)`] : []),
        ...(r.anormal
          ? [`Anormais no choque séptico (${r.anormal.rotulo}): FC > ${r.anormal.valor.fcAcima} · FR > ${r.anormal.valor.frAcima} · PA sistólica < ${r.anormal.pas} mmHg${r.anormal.valor.pasAbaixo === 'formula' ? ' (70 + 2 × idade em anos)' : ''} · temperatura central ${r.anormal.valor.temperatura} °C (cap. 5, Tabela 1, p. 87)`]
          : []),
        ...(r.pasAnafilaxia ? [`PA sistólica baixa na anafilaxia (${r.pasAnafilaxia.rotulo}): < ${r.pasAnafilaxia.pas} mmHg (cap. 6, Quadro 3, p. 98)`] : []),
        ...(r.frAsma ? [`FR normal (${r.frAsma.rotulo}): ${r.frAsma.valor} (cap. 8, Tabela 1, rodapé, p. 114)`] : []),
      ],
      fonte: textoFontes(fichaSinaisVitais),
      versao: fichaSinaisVitais.versao,
      quando: new Date(),
    })

  return (
    <ToolLayout
      title="Sinais vitais por idade"
      description="Referências do livro do ICr-HCFMUSP para a idade: FC normal, valores anormais no choque séptico, PA sistólica baixa e FR normal. Só referência — a análise é de quem avalia."
      ficha={fichaSinaisVitais}
    >
      <Card>
        <CardContent className="grid gap-4 pt-6 md:grid-cols-3">
          <NumberField id="sv-anos" label="Anos completos" unit="anos" value={anos} onChange={setAnos} min={0} max={13} step={1} />
          <NumberField id="sv-meses" label="Meses" unit="meses" value={meses} onChange={setMeses} min={0} max={11} step={1} />
          <NumberField id="sv-dias" label="Dias" unit="dias" value={dias} onChange={setDias} min={0} max={30} step={1} />
        </CardContent>
      </Card>

      {informada && !r && (
        <Card><CardContent className="pt-6 text-apoio text-tinta-sussurro">Pediatria vai até antes dos 14 anos.</CardContent></Card>
      )}

      {r && (
        <>
          <Bloco titulo="FC normal (cap. 2, Quadro 1, p. 40)">
            {r.fc && <p><span className="text-tinta-sussurro">{r.fc.rotulo}:</span> acordado <strong>{f(r.fc.valor.acordado)} bpm</strong> · sono <strong>{f(r.fc.valor.sono)} bpm</strong></p>}
            <p className="text-tinta-sussurro">{DICA_CAP2}</p>
          </Bloco>
          <Bloco titulo="Valores considerados anormais no choque séptico (cap. 5, Tabela 1, p. 87)">
            {r.anormal && (
              <p>
                <span className="text-tinta-sussurro">{r.anormal.rotulo}:</span> FC &gt; <strong>{r.anormal.valor.fcAcima}</strong> · FR &gt; <strong>{r.anormal.valor.frAcima}</strong> · PA sistólica &lt; <strong>{r.anormal.pas} mmHg</strong>
                {r.anormal.valor.pasAbaixo === 'formula' && <span className="text-tinta-sussurro"> (70 + 2 × idade em anos)</span>}
                {' '}· temperatura central {r.anormal.valor.temperatura} °C
              </p>
            )}
          </Bloco>
          <Bloco titulo="PA sistólica baixa na anafilaxia (cap. 6, Quadro 3, p. 98)">
            {r.pasAnafilaxia ? <p><span className="text-tinta-sussurro">{r.pasAnafilaxia.rotulo}:</span> &lt; <strong>{r.pasAnafilaxia.pas} mmHg</strong></p> : <p className="text-tinta-sussurro">O quadro começa em 1 mês de vida.</p>}
          </Bloco>
          <Bloco titulo="FR normal (cap. 8, Tabela 1, rodapé, p. 114)">
            {r.frAsma && <p><span className="text-tinta-sussurro">{r.frAsma.rotulo}:</span> <strong>{r.frAsma.valor}</strong></p>}
          </Bloco>
        </>
      )}

      <AbasResultado
        aba={aba}
        onAba={setAba}
        passos={passosDaFaixa(guia, undefined)}
        semResultado={!r}
        armadilhas={[...(guia?.armadilhas ?? [])]}
        ficha={fichaSinaisVitais}
        guia={guia}
      />
      <ResumoFlutuante
        principal={r?.fc ? `FC acordado ${f(r.fc.valor.acordado)} bpm · sono ${f(r.fc.valor.sono)} bpm` : r ? 'Referências da idade acima' : informada ? 'Pediatria vai até antes dos 14 anos' : 'Informe a idade'}
        detalhe={r ? `${idadeTxt} · referências do livro, sem valor do paciente` : undefined}
        textoCopia={r ? copia() || undefined : undefined}
        alvoDetalhes={ID_ABAS_RESULTADO}
        rotuloDetalhes="Próximos passos"
        aoIrDetalhes={() => setAba('proximos')}
      />
    </ToolLayout>
  )
}
