import { useState } from 'react'

import {
  ESC_2021_MP, ERRATA_PROCEDIMENTOS, IMA_MARCA_PASSO, MPTC, MPTV_AS_CEGAS, correnteMptc, fichaMarcaPassoAdulto, saidaMptv, sensibilidadeMptv,
} from '@/clinico/adulto/procedimentos'
import { NumberField } from '@/components/plantonista/NumberField'
import { ToolLayout } from '@/components/plantonista/ToolLayout'

import { Bloco, LinhaManual } from './PecasLoteC'
import { Erratas } from './PecasLoteE7'
import { br, faixa } from './loteE7Formato'


/** Marca-passo provisório transcutâneo e transvenoso (cap. 107 do manual do HCFMUSP). */
export function MarcaPassoProvisorioAdulto() {
  const [limiarTc, setLimiarTc] = useState(0)
  const [limiarSens, setLimiarSens] = useState(0)
  const [limiarCmd, setLimiarCmd] = useState(0)
  const corrente = correnteMptc(limiarTc)
  const sens = sensibilidadeMptv(limiarSens)
  const saida = saidaMptv(limiarCmd)

  return (
    <ToolLayout
      title="Marca-passo provisório — parâmetros (adulto)"
      description="Transcutâneo (frequência, corrente pelo limiar de captura, tempo de ponte) e transvenoso (passagem às cegas, sensibilidade e saída pelos limiares), mais o ímã, pelo manual do HC. Adulto (14 anos ou mais)."
      ficha={fichaMarcaPassoAdulto}
    >
      <Bloco titulo="Transcutâneo (p. 1447–1449)" descricao={`Ponte até o transvenoso, preferencialmente < ${MPTC.pontePorMin} minutos. Conferir captura mecânica no pulso femoral ou braquial (o carotídeo pode não ser fidedigno).`}>
        <LinhaManual nome="Frequência" texto={`${faixa(MPTC.fcPpm, 0)} ppm`} pagina="p. 1448" />
        <LinhaManual
          nome="Corrente"
          texto={`aumentar até a captura elétrica e somar ${faixa(MPTC.margemMa, 0)} mA; ou começar em ${MPTC.inicioDescendenteMa} mA e descer até perder a captura, deixando ${faixa(MPTC.margemMa, 0)} mA acima do limiar`}
          conta={corrente ? <strong>{faixa(corrente, 0)} mA</strong> : 'informe o limiar'}
          pagina="p. 1448–1449"
        />
        <NumberField id="mp-limiar-tc" label="Limiar de captura" unit="mA" value={limiarTc} onChange={setLimiarTc} min={0} />
      </Bloco>

      <Bloco titulo="Transvenoso às cegas (p. 1450–1456)">
        <LinhaManual nome="Modo" texto={MPTV_AS_CEGAS.modo} pagina="p. 1455" />
        <LinhaManual nome="Frequência" texto={`mínima necessária, geralmente ${MPTV_AS_CEGAS.fcBpm} bpm`} pagina="p. 1455" />
        <LinhaManual nome="Comando (saída)" texto={`energia máxima: ${MPTV_AS_CEGAS.saidaMaxima}`} pagina="p. 1456" />
        <LinhaManual nome="Cabo" texto={`introduzir até a marca de ${MPTV_AS_CEGAS.caboCm} cm; com balão, inflar (teste com ${br(MPTV_AS_CEGAS.balaoArMl)} mL de ar) e progredir mais ${MPTV_AS_CEGAS.avancoComBalaoCm} cm conferindo a captura`} pagina="p. 1452–1456" />
        <LinhaManual nome="Material" texto={`introdutor ${faixa(MPTV_AS_CEGAS.introdutorFr, 0)} F; cabo-eletrodo ${faixa(MPTV_AS_CEGAS.caboFr, 0)} F; punção da jugular direita guiada por USG (2ª opção: subclávia esquerda)`} pagina="p. 1450–1452" />
      </Bloco>

      <Bloco titulo="Programação do transvenoso (p. 1456–1457)">
        <div className="grid gap-3 md:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <NumberField id="mp-sens" label="Limiar de sensibilidade" unit="mV" value={limiarSens} onChange={setLimiarSens} min={0} step={0.1} />
            <p className="text-sm tabular-nums">{sens !== null ? <>Programar <strong>{br(sens, 2)} mV</strong> (50% do limiar)</> : '—'}</p>
          </div>
          <div className="flex flex-col gap-1.5">
            <NumberField id="mp-cmd" label="Limiar de comando" unit="V ou mA" value={limiarCmd} onChange={setLimiarCmd} min={0} step={0.1} />
            <p className="text-sm tabular-nums">{saida !== null ? <>Programar <strong>{br(saida, 1)}</strong> (2 × limiar + 1, na unidade do gerador)</> : '—'}</p>
          </div>
        </div>
        <p className="text-sm text-tinta-sussurro">
          Sensibilidade: frequência programada abaixo da intrínseca; começar no menor valor numérico (p. ex., 2 mV) e subir até o gerador assumir. Comando: frequência acima da do paciente; começar em 10 V ou 20 mA e descer até perder a captura. Transporte: saída máxima de 10 V ou 20 mA. Testar o limiar de comando 1 a 2 vezes ao dia (p. 1456–1457).
        </p>
      </Bloco>

      <Bloco titulo="Ímã (p. 1459)">
        <LinhaManual nome="Ímã" texto={IMA_MARCA_PASSO.texto} pagina={IMA_MARCA_PASSO.pagina} />
      </Bloco>

      <Bloco titulo="Errata e notas">
        <Erratas itens={ERRATA_PROCEDIMENTOS.filter((e) => e.startsWith('p. 145'))} />
      </Bloco>
      <Bloco titulo="ESC 2021 — estimulação temporária" descricao="Diretriz de estimulação cardíaca lida no texto. Os parâmetros numéricos do manual acima não são contrariados.">
        {ESC_2021_MP.map((m) => <LinhaManual key={m.texto} nome={`Classe ${m.classe}`} texto={m.texto} pagina="ESC 2021, p. 3438; 3486–3487" />)}
      </Bloco>
    </ToolLayout>
  )
}
