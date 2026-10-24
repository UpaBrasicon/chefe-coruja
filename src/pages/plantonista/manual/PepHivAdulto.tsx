import { useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'

import {
  IST_VIOLENCIA, LEVONORGESTREL, SEGUIMENTO_PEP, VIOLENCIA_SEXUAL, esquemaPep, fichaPepHivAdulto, ighahbMl, indicacaoPep, type StatusFonte,
} from '@/clinico/adulto/pepHiv'
import { NumberField } from '@/components/plantonista/NumberField'
import { ToolLayout } from '@/components/plantonista/ToolLayout'
import { numero } from '@/lib/formato'
import { cn } from '@/lib/utils'

import { Bloco, CampoPeso, LinhaManual, Pergunta } from './PecasLoteC'

const br = (x: number) => numero(Math.round(x * 10) / 10)
const Ir = ({ para, children }: { para: string; children: ReactNode }) => <Link to={para} className="text-acao hover:underline">{children}</Link>

const ROTULO_STATUS = { indicada: 'PEP indicada', nao_indicada: 'PEP não indicada', individualizar: 'Decisão individualizada' }

/** PEP de HIV, IST e hepatite B no adulto (PCDT PEP do Ministério da Saúde, 2024). */
export function PepHivAdulto() {
  const [peso, setPeso] = useState(0)
  const [material, setMaterial] = useState<boolean>()
  const [exposicao, setExposicao] = useState<boolean>()
  const [horas, setHoras] = useState(0)
  const [exposta, setExposta] = useState<'nao_reagente' | 'reagente' | 'discordante'>()
  const [fonte, setFonte] = useState<StatusFonte>()
  const [janela, setJanela] = useState<boolean>()
  const [violencia, setViolencia] = useState<boolean>()
  const [gestante, setGestante] = useState<boolean>()
  const [semTdf, setSemTdf] = useState<boolean>()
  const [semDtg, setSemDtg] = useState<boolean>()
  const [indutor, setIndutor] = useState<boolean>()
  const [tfg, setTfg] = useState(0)

  const respondido = horas > 0 && material !== undefined && exposicao !== undefined && exposta !== undefined && fonte !== undefined
  const ind = respondido ? indicacaoPep({ materialDeRisco: material, exposicaoDeRisco: exposicao, horas, exposta, fonte, fonteJanela: janela }) : null
  const esq = esquemaPep({ gestante, semTenofovir: semTdf, semDolutegravir: semDtg, indutor, tfg: tfg > 0 ? tfg : undefined })
  const ig = ighahbMl(peso)

  return (
    <ToolLayout
      title="PEP de HIV, IST e hepatite B"
      description="Indicação pelos quatro passos do PCDT, esquema antirretroviral por 28 dias, profilaxias da violência sexual e seguimento. Adulto e adolescente com mais de 45 kg."
      ficha={fichaPepHivAdulto}
    >
      <CampoPeso id="pep-peso" peso={peso} onChange={setPeso}>
        <NumberField id="pep-horas" label="Horas desde a exposição" unit="h" value={horas} onChange={setHoras} min={0} />
        <NumberField id="pep-tfg" label="TFG (se conhecida)" unit="mL/min" value={tfg} onChange={setTfg} min={0} />
      </CampoPeso>

      <Bloco titulo="Os quatro passos (Quadro 1, p. 4)" descricao="Material com risco: sangue, sêmen, fluidos vaginais, líquidos de serosas, amniótico e líquor. Exposição com risco: percutânea, mucosas (inclui sexo desprotegido), pele não íntegra e mordedura com sangue (Quadros 2 e 3, p. 5).">
        <Pergunta rotulo="Material biológico de risco" valor={material} onChange={setMaterial} />
        <Pergunta rotulo="Exposição de risco" valor={exposicao} onChange={setExposicao} />
        <Pergunta rotulo="Teste rápido da pessoa exposta" valor={exposta} onChange={setExposta} opcoes={[['nao_reagente', 'Não reagente'], ['reagente', 'Reagente'], ['discordante', 'Discordante']]} />
        <Pergunta rotulo="Pessoa-fonte" valor={fonte} onChange={setFonte} opcoes={[['reagente', 'Reagente'], ['nao_reagente', 'Não reagente'], ['desconhecida', 'Desconhecida']]} />
        {fonte === 'nao_reagente' && <Pergunta rotulo="Fonte com exposição de risco nos últimos 30 dias" valor={janela} onChange={setJanela} />}
      </Bloco>

      {!ind && <p className="text-apoio text-tinta-sussurro">Informe as horas desde a exposição e responda os quatro passos para ver a indicação.</p>}
      {ind && (
        <div role="status" className={cn('rounded-cartao border px-4 py-3', ind.status === 'indicada' ? 'border-acao' : ind.status === 'individualizar' ? 'border-atencao' : 'border-fio')}>
          <p className="text-corpo font-semibold text-tinta">{ROTULO_STATUS[ind.status]}</p>
          <p className="text-apoio text-tinta-apoio">{ind.texto} ({ind.pagina})</p>
        </div>
      )}

      <Bloco titulo="Esquema antirretroviral por 28 dias" descricao="Iniciar o mais cedo possível, até 72 horas. A ausência de infectologista não deve atrasar a prescrição (p. 13).">
        <Pergunta rotulo="Gestante" valor={gestante} onChange={setGestante} />
        <Pergunta rotulo="Não pode usar tenofovir (inclui insuficiência renal aguda)" valor={semTdf} onChange={setSemTdf} />
        <Pergunta rotulo="Não pode usar dolutegravir (inclui dofetilida, pilsicainida ou oxcarbazepina)" valor={semDtg} onChange={setSemDtg} />
        {!semDtg && <Pergunta rotulo="Usa rifampicina, carbamazepina, fenitoína ou fenobarbital" valor={indutor} onChange={setIndutor} />}
        <p className="pt-2 text-controle font-medium text-tinta">{esq.nome} ({esq.pagina})</p>
        {esq.remedios.map((r) => <LinhaManual origem="O PCDT traz" key={r.droga} nome={r.droga} texto={r.posologia} pagina={esq.pagina} />)}
        {esq.avisos.map((a) => <p key={a} className="text-apoio text-tinta-apoio">{a}</p>)}
        <p className="text-apoio text-tinta-sussurro">
          Oxcarbazepina: o PCDT diz, num trecho, que o dolutegravir pode ter a posologia alterada e, em outro, que não é recomendado; aqui ela entra como impedimento ao dolutegravir (p. 12). Hepatite B crônica: usar o esquema preferencial e encaminhar (p. 13).
        </p>
      </Bloco>

      <Bloco titulo="Hepatite B" descricao="Vacinar quem não é vacinado e tem HBsAg não reagente, de preferência em 24 horas (p. 29).">
        <LinhaManual
          origem="O PCDT traz"
          nome="Imunoglobulina anti-hepatite B (IGHAHB)"
          texto="0,06 mL/kg IM em dose única, máximo de 5 mL, em extremidade diferente da vacina; até 14 dias na exposição sexual e até 7 dias na percutânea, de preferência em 24 horas"
          conta={ig ? <><strong>{br(ig.ml)} mL</strong>{ig.noTeto && ' (no teto)'}</> : 'informe o peso'}
          pagina="p. 29–30"
        />
        <p className="text-apoio text-tinta-sussurro">A indicação no acidente ocupacional segue o Quadro 15 (p. 30), que está em <Ir para="/plantonista/emergencias/hepatite-b-pos-exposicao-adulto">Hepatite B pós-exposição</Ir>. Na violência sexual, a IGHAHB está entre as indicações do CRIE (p. 29).</p>
      </Bloco>

      <Bloco titulo="Violência sexual">
        <Pergunta rotulo="Exposição por violência sexual" valor={violencia} onChange={setViolencia} />
        {violencia && (
          <>
            <p className="pt-2 text-controle font-medium text-tinta">Profilaxia das IST (Quadro 13, p. 26) — só na violência sexual; na exposição consentida, investigar e seguir</p>
            {IST_VIOLENCIA.map((d) => <LinhaManual origem="O PCDT traz" key={d.nome} nome={d.nome} texto={d.dose} pagina={d.pagina} nota={d.nota} />)}
            <LinhaManual origem="O PCDT traz" nome={LEVONORGESTREL.nome} texto={LEVONORGESTREL.dose} pagina={LEVONORGESTREL.pagina} nota={LEVONORGESTREL.nota} />
            <ul className="mt-1 flex list-disc flex-col gap-1 pl-5 text-apoio text-tinta-apoio">
              {VIOLENCIA_SEXUAL.map((v) => <li key={v}>{v}</li>)}
            </ul>
            <p className="text-apoio text-tinta-sussurro">Cuidados e notificação: Quadros 20 e 21 (p. 36–37). Avaliar também o <Ir para="/plantonista/emergencias/tetano-profilaxia-adulto">tétano</Ir> se houver lesões (p. 35).</p>
          </>
        )}
      </Bloco>

      <Bloco titulo="Seguimento (Quadro 12, p. 21)">
        <ul className="flex list-disc flex-col gap-1 pl-5 text-apoio text-tinta-apoio">
          {SEGUIMENTO_PEP.map((s) => <li key={s}>{s}</li>)}
        </ul>
        <p className="text-apoio text-tinta-sussurro">Avaliar PrEP ao fim dos 28 dias para quem relata exposições repetidas (p. 21).</p>
      </Bloco>
    </ToolLayout>
  )
}
