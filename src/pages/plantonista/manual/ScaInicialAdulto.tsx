import { useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'

import {
  EQUIVALENTES_SUPRA, OUTRAS_MEDIDAS, condutaSca, fichaScaInicialAdulto, limiarSupraV2V3, type Dose, type TipoSca,
} from '@/clinico/adulto/scaInicial'
import { NumberField } from '@/components/plantonista/NumberField'
import { ToolLayout } from '@/components/plantonista/ToolLayout'
import { numero } from '@/lib/formato'

import { Bloco, CampoPeso, LinhaManual, Pergunta } from './PecasLoteC'

const br = (x: number, casas = 1) => numero(Math.round(x * 10 ** casas) / 10 ** casas)


const LinhaDose = ({ d }: { d: Dose }) => (
  <LinhaManual nome={d.droga} texto={d.manutencao ? `ataque ${d.ataque}; manutenção ${d.manutencao}` : d.ataque} pagina={d.pagina} nota={d.nota} />
)

const Ir = ({ para, children }: { para: string; children: ReactNode }) => <Link to={para} className="text-acao hover:underline">{children}</Link>


/** SCA — conduta inicial do adulto (caps. 13 e 14 do manual do HCFMUSP). */
export function ScaInicialAdulto() {
  const [tipo, setTipo] = useState<TipoSca | undefined>()
  const [peso, setPeso] = useState(0)
  const [idade, setIdade] = useState(0)
  const [clcr, setClcr] = useState(0)
  const [horas, setHoras] = useState(0)
  const [atraso, setAtraso] = useState(0)
  const [contra, setContra] = useState<boolean>()
  const [isquemia, setIsquemia] = useState<boolean>()
  const [precoce, setPrecoce] = useState<boolean>()
  const [icp6h, setIcp6h] = useState<boolean>()
  const [avc, setAvc] = useState<boolean>()

  const pos = (x: number) => (x > 0 ? x : undefined)
  const c = tipo && condutaSca({
    tipo, pesoKg: pos(peso), idadeAnos: pos(idade), clcr: pos(clcr), horasSintomas: pos(horas), atrasoIcpMin: atraso > 0 ? atraso : undefined,
    contraindicacaoLitico: contra, isquemiaPersistente: isquemia, invasivaPrecoce: precoce, icpEm6h: icp6h, avcAitPrevio: avc,
  })
  const enox = c?.enoxaparina?.dose

  return (
    <ToolLayout
      title="SCA — conduta inicial"
      description="Antiagregantes, anticoagulante e reperfusão no IAM com e sem supra, com as doses e as páginas do manual. Adulto (14 anos ou mais)."
      ficha={fichaScaInicialAdulto}
    >
      <CampoPeso id="sca-peso" peso={peso} onChange={setPeso}>
        <NumberField id="sca-idade" label="Idade" unit="anos" value={idade} onChange={setIdade} min={0} />
        <NumberField id="sca-clcr" label="Clearance de creatinina" unit="mL/min" value={clcr} onChange={setClcr} min={0} />
      </CampoPeso>

      <Bloco titulo="Eletrocardiograma" descricao={`Supra: 1 mm no ponto J em duas derivações contíguas; em V2–V3, 1,5 mm na mulher, ${br(limiarSupraV2V3(false, 39))} mm no homem com menos de 40 anos e ${br(limiarSupraV2V3(false, 40), 0)} mm a partir dos 40; em V7–V9, 0,5 mm (p. 212). ECG interpretado em até 10 minutos (p. 199).`}>
        <Pergunta rotulo="Achado" valor={tipo} onChange={setTipo} opcoes={[['supra', 'Supra de ST'], ['equivalente', 'Equivalente de supra'], ['sem_supra', 'Sem supra']]} />
        {tipo === 'supra' && (
          <>
            <div className="grid gap-4 py-2 md:grid-cols-2">
              <NumberField id="sca-horas" label="Início dos sintomas" unit="horas" value={horas} onChange={setHoras} min={0} step={0.5} />
              <NumberField id="sca-atraso" label="Tempo previsto até a ICP" unit="min" value={atraso} onChange={setAtraso} min={0} />
            </div>
            <Pergunta rotulo="Contraindicação ao fibrinolítico (Tabela 1, p. 219–220)" valor={contra} onChange={setContra} />
            {horas > 12 && <Pergunta rotulo="Ainda há evidência de isquemia" valor={isquemia} onChange={setIsquemia} />}
          </>
        )}
        {tipo === 'sem_supra' && (
          <>
            <Pergunta rotulo="Estratificação invasiva disponível em menos de 6–24 h" valor={precoce} onChange={setPrecoce} />
            {precoce === false && (
              <>
                <Pergunta rotulo="AVC ou AIT prévio" valor={avc} onChange={setAvc} />
                <Pergunta rotulo="Candidato a intervenção coronária em até 6 h" valor={icp6h} onChange={setIcp6h} />
              </>
            )}
          </>
        )}
      </Bloco>

      {c && (
        <>
          {c.reperfusao && (
            <Bloco titulo="Reperfusão">
              <p className="text-corpo text-tinta">
                {c.reperfusao.via === 'angioplastia' ? 'Angioplastia primária' : c.reperfusao.via === 'fibrinolitico' ? 'Fibrinolítico' : 'Sem definição no manual'}
              </p>
              <p className="text-apoio text-tinta-apoio">{c.reperfusao.motivo} ({c.reperfusao.pagina})</p>
              {c.reperfusao.via === 'fibrinolitico' && (
                <p className="text-apoio text-tinta-apoio">Doses e contraindicações em <Ir para="/plantonista/emergencias/fibrinoliticos-adulto">Fibrinolíticos</Ir>. Depois do lítico, cateterismo em 24 horas; angioplastia de resgate se, em 60–90 minutos, o supra não cai mais de 50% ou há instabilidade ou isquemia (p. 221).</p>
              )}
            </Bloco>
          )}
          {tipo === 'supra' && !c.reperfusao && (
            <p className="text-apoio text-tinta-sussurro">Informe o início dos sintomas e o tempo previsto até a ICP (ou a contraindicação ao fibrinolítico) para ver a reperfusão.</p>
          )}

          <Bloco titulo="Antiagregantes">
            {c.antiagregantes.map((d) => <LinhaDose key={d.droga} d={d} />)}
            {c.avisos.map((a) => <p key={a} className="text-apoio text-tinta-apoio">{a}</p>)}
          </Bloco>

          <Bloco titulo="Anticoagulação">
            <p className="text-apoio text-tinta-apoio">{c.anticoagulacaoTexto}</p>
            {c.enoxaparina && (
              <LinhaManual
                nome={`Enoxaparina — ${c.enoxaparina.contexto.toLowerCase()}`}
                texto={tipo === 'sem_supra' ? '1 mg/kg 12/12 h SC' : 'ataque 30 mg EV e 1 mg/kg SC 12/12 h por 7 dias; acima de 75 anos sem ataque e 0,75 mg/kg 12/12 h; ClCr 15–30: 1 mg/kg 1 x/d'}
                conta={!enox ? 'informe o peso' : enox.doseMg === null ? 'sem dose no capítulo' : (
                  <>{enox.bolusEvMg !== null && <>ataque <strong>{enox.bolusEvMg} mg EV</strong> + </>}<strong>{br(enox.doseMg)} mg</strong> {enox.intervalo}</>
                )}
                pagina={c.enoxaparina.pagina}
                nota={enox?.observacoes.join(' ')}
              />
            )}
            <p className="text-apoio text-tinta-sussurro">Ajuste renal, tetos da AHA 2025 e outros anticoagulantes em <Ir para="/plantonista/emergencias/anticoagulacao-plena-adulto">Anticoagulação plena por peso</Ir>.</p>
          </Bloco>
        </>
      )}

      <Bloco titulo="Equivalentes de supra (cap. 14)" descricao="No consenso europeu citado no manual, angioplastia primária, mas não trombólise (p. 213).">
        {EQUIVALENTES_SUPRA.map((q) => (
          <LinhaManual key={q.nome} nome={q.nome} pagina={q.pagina} texto={q.nome.startsWith('BRE') ? <>critério de Sgarbossa positivo; calcule no <Ir para="/plantonista/escores/sgarbossa-modificado">Sgarbossa modificado</Ir></> : q.texto} />
        ))}
      </Bloco>

      <Bloco titulo="Demais medidas">
        {OUTRAS_MEDIDAS.map((d) => <LinhaDose key={d.droga} d={d} />)}
        <p className="text-apoio text-tinta-sussurro">
          Escores de risco do IAM sem supra (Tabela 2, p. 210): <Ir para="/plantonista/escores/grace">GRACE</Ir>, <Ir para="/plantonista/escores/timi">TIMI</Ir> e <Ir para="/plantonista/escores/heart">HEART</Ir>.
        </p>
      </Bloco>
    </ToolLayout>
  )
}
