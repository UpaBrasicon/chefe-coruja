import { useState } from 'react'

import {
  ALERTAS_ITU, AMINOGLICOSIDEO, BACTERIURIA_TRATAR, CISTITE, PIELONEFRITE, SONDA, UROCULTURA_CISTITE, aminoglicosideo, duracaoItu, fichaItuAdulto,
  type Esquema, type QuadroItu,
} from '@/clinico/adulto/itu'
import { textoFontes } from '@/clinico/ficha'
import { passosDaFaixa } from '@/clinico/guia'
import { guiaDa } from '@/clinico/guias'
import { AbasResultado } from '@/components/plantonista/calc/AbasResultado'
import { ID_ABAS_RESULTADO, type IdAba } from '@/components/plantonista/calc/contexto'
import { ResumoFlutuante } from '@/components/plantonista/calc/ResumoFlutuante'
import { ToolLayout } from '@/components/plantonista/ToolLayout'
import { textoCopia } from '@/domain/copiaCalculo'
import { numero } from '@/lib/formato'

import { Bloco, CampoPeso, LinhaManual, Pergunta } from './PecasLoteC'

const br = (x: number) => numero(Math.round(x))


const ROTULO_QUADRO: Record<QuadroItu, string> = { cistite: 'Cistite', pielonefrite: 'Pielonefrite', sonda: 'ITU na sonda vesical' }
const ESQUEMAS: Record<QuadroItu, Esquema[]> = { cistite: CISTITE, pielonefrite: PIELONEFRITE, sonda: SONDA }
const IDSA_VIA_ORAL = 'IDSA 2025: passar para via oral quando o paciente melhora, aceita medicação oral e há opção oral ativa contra o germe, com nível adequado na urina e no tecido. Betalactâmico oral em curso curto pode precisar de dose maior.'

const Linha = ({ e }: { e: Esquema }) => (
  <LinhaManual nome={e.droga} texto={e.duracao ? `${e.dose}, ${e.duracao}` : e.dose} pagina={e.pagina} errata={e.errata} nota={e.nota} />
)


/** ITU do adulto: cistite, pielonefrite e sonda vesical (cap. 89 do manual do HCFMUSP). */
export function ItuAdulto() {
  const [peso, setPeso] = useState(0)
  const [quadro, setQuadro] = useState<QuadroItu>('cistite')
  const [homem, setHomem] = useState<boolean>()
  const [prostatite, setProstatite] = useState<boolean>()
  const ag = aminoglicosideo(peso)
  const dur = duracaoItu({ quadro, homem, prostatiteSuspeita: prostatite })
  const [aba, setAba] = useState<IdAba>('proximos')
  const guia = guiaDa(fichaItuAdulto.id)

  // Texto do "Copiar" (C3 e C4 = A): o quadro e os dados usados, os esquemas do quadro (com a errata, que muda a leitura da dose), duração e alertas.
  const copia = textoCopia({
    ferramenta: 'ITU — adulto',
    dados: [
      ['Quadro', ROTULO_QUADRO[quadro]],
      ['Homem', homem === undefined ? '' : homem ? 'sim' : 'não'],
      ['Febre com suspeita de prostatite', homem && prostatite !== undefined ? (prostatite ? 'sim' : 'não') : ''],
      ['Peso', peso > 0 ? `${br(peso)} kg` : ''],
    ],
    resultado: [
      `${ROTULO_QUADRO[quadro]} — esquemas do manual:`,
      ...ESQUEMAS[quadro].map((e) => `- ${e.droga}: ${e.duracao ? `${e.dose}, ${e.duracao}` : e.dose} (${e.pagina})${e.errata ? ` — errata: ${e.errata}` : ''}${e.nota ? ` ${e.nota}` : ''}`),
      ...(quadro === 'pielonefrite'
        ? [`- Aminoglicosídeo, dose única diária IM ou EV: amicacina ${AMINOGLICOSIDEO.amicacinaMgKg} mg/kg ou gentamicina ${AMINOGLICOSIDEO.gentamicinaMgKg} mg/kg${ag ? ` = amicacina ${br(ag.amicacinaMg)} mg · gentamicina ${br(ag.gentamicinaMg)} mg` : ''} (${AMINOGLICOSIDEO.pagina})`]
        : []),
      `Duração (manual): ${dur.manual.texto} (${dur.manual.pagina})`,
      ...(dur.idsa ? [`Duração (IDSA 2025, ITU complicada): ${dur.idsa.texto}`] : []),
      ...(quadro !== 'cistite' ? [IDSA_VIA_ORAL] : []),
      'Alertas do capítulo:',
      ...ALERTAS_ITU.map((a) => `- ${a.texto} (${a.pagina})`),
    ],
    fonte: textoFontes(fichaItuAdulto),
    versao: fichaItuAdulto.versao,
    quando: new Date(),
  })

  return (
    <ToolLayout
      title="ITU — adulto"
      description="Cistite, pielonefrite e ITU na sonda vesical: esquemas e doses do manual do HC, duração e troca para via oral pela IDSA 2025. Adulto (14 anos ou mais)."
      ficha={fichaItuAdulto}
    >
      <CampoPeso id="itu-peso" peso={peso} onChange={setPeso} />

      <Bloco titulo="Quadro">
        <Pergunta rotulo="Quadro" valor={quadro} onChange={setQuadro} opcoes={[['cistite', 'Cistite'], ['pielonefrite', 'Pielonefrite'], ['sonda', 'Sonda vesical']]} />
        <Pergunta rotulo="Homem" valor={homem} onChange={setHomem} />
        {homem && <Pergunta rotulo="Febre com suspeita de prostatite" valor={prostatite} onChange={setProstatite} />}
      </Bloco>

      {quadro === 'cistite' && (
        <Bloco titulo="Cistite" descricao="Tratamento-padrão de 3 dias; a dose única recorre mais, mas é boa opção na gestante (p. 1212). A escolha inicial depende da resistência local ao SMX-TMP (p. 1213).">
          {CISTITE.map((e) => <Linha key={e.droga} e={e} />)}
        </Bloco>
      )}
      {quadro === 'pielonefrite' && (
        <Bloco titulo="Pielonefrite" descricao="Antibiótico com penetração no trato urinário alto; norfloxacina não serve (p. 1213).">
          {PIELONEFRITE.map((e) => <Linha key={e.droga} e={e} />)}
          <LinhaManual
            nome="Aminoglicosídeo, dose única diária IM ou EV"
            texto={`amicacina ${AMINOGLICOSIDEO.amicacinaMgKg} mg/kg ou gentamicina ${AMINOGLICOSIDEO.gentamicinaMgKg} mg/kg`}
            conta={ag ? <>amicacina <strong>{br(ag.amicacinaMg)} mg</strong> · gentamicina <strong>{br(ag.gentamicinaMg)} mg</strong></> : 'informe o peso'}
            pagina={AMINOGLICOSIDEO.pagina}
          />
        </Bloco>
      )}
      {quadro === 'sonda' && (
        <Bloco titulo="ITU na sonda vesical" descricao="Retirar a sonda; doente crítico recebe antibiótico imediatamente (p. 1214).">
          {SONDA.map((e) => <Linha key={e.droga} e={e} />)}
        </Bloco>
      )}

      <Bloco titulo="Duração e troca para via oral">
        <p className="text-apoio text-tinta"><span className="font-medium">Manual:</span> {dur.manual.texto} ({dur.manual.pagina})</p>
        {dur.idsa && <p className="text-apoio text-tinta"><span className="font-medium">IDSA 2025, ITU complicada:</span> {dur.idsa.texto}</p>}
        {quadro !== 'cistite' && (
          <p className="text-apoio text-tinta-apoio">{IDSA_VIA_ORAL}</p>
        )}
      </Bloco>

      <Bloco titulo="Alertas do capítulo">
        {ALERTAS_ITU.map((a) => <p key={a.texto} className="text-apoio text-tinta-apoio">{a.texto} ({a.pagina})</p>)}
      </Bloco>

      <Bloco titulo="Urocultura e bacteriúria">
        <p className="text-apoio text-tinta-apoio"><span className="font-medium text-tinta">Urocultura na cistite (Tabela 2, p. 1211–1212):</span> {UROCULTURA_CISTITE.join('; ')}.</p>
        <p className="text-apoio text-tinta-apoio"><span className="font-medium text-tinta">Tratar bacteriúria assintomática só em (Tabela 3, p. 1212):</span> {BACTERIURIA_TRATAR.join('; ')}.</p>
      </Bloco>
      <AbasResultado
        aba={aba}
        onAba={setAba}
        passos={passosDaFaixa(guia, undefined)}
        armadilhas={[
          // As erratas mudam a leitura da dose: ficam também na linha de cada esquema, visíveis.
          ...[...CISTITE, ...PIELONEFRITE, ...SONDA].flatMap((e) => (e.errata ? [`${e.droga} — errata do livro: ${e.errata}`] : [])),
          ...ALERTAS_ITU.map((a) => `${a.texto} (${a.pagina})`),
          ...(guia?.armadilhas ?? []),
        ]}
        ficha={fichaItuAdulto}
        guia={guia}
      />
      <ResumoFlutuante
        principal={[ROTULO_QUADRO[quadro], homem ? 'homem' : '', peso > 0 ? `${br(peso)} kg` : ''].filter(Boolean).join(' · ')}
        detalhe={`Duração no manual: ${dur.manual.texto}`}
        textoCopia={copia}
        alvoDetalhes={ID_ABAS_RESULTADO}
        rotuloDetalhes="Próximos passos"
        aoIrDetalhes={() => setAba('proximos')}
      />
    </ToolLayout>
  )
}
