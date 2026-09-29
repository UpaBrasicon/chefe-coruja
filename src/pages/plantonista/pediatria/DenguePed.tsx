import { useState } from 'react'

import {
  ACHADOS_GRUPO_B, ALTA, ERRATA_HT, ERRATA_LACO, INTERNACAO, LACO_CRIANCA, NOTA_ALBUMINA, NOTA_MANUTENCAO_CRIANCA, REFERENCIAS_DENGUE, SINAIS_ALARME, SINAIS_GRAVIDADE,
  DIFERENCAS_MS_2024_PED, MS_CRIANCA_TEXTO, SINAIS_VITAIS_MS, albumina5, analgesicosMs2024, expansaoGrupoC, expansaoGrupoD, fichaDenguePed, grupoBParaC, grupoCMs2024, grupoDenguePed, hidratacaoOral, manutencaoAdolescente, pasP5Ms, pesoAproximadoMs, pressaoMediaLaco, type Perfil,
} from '@/clinico/pediatria/denguePed'
import { manutencao } from '@/clinico/pediatria/manutencao'
import { NumberField } from '@/components/plantonista/NumberField'
import { ToolLayout } from '@/components/plantonista/ToolLayout'

import { PACIENTE_VAZIO, br, faixaBr, podeCalcular } from './formatoIcr'
import { Bloco, CampoPaciente, Errata, Nota, Opcoes, Pendencia } from './PecasIcr'
import { Marcadores } from './PecasP4'
import { LinhaFaixa, ListaLivro, ListaQuadro } from './PecasP5'

const DESCRICAO_GRUPO = {
  A: 'Sem sinais de alarme, prova do laço negativa e sem alto risco (p. 448).',
  B: 'Manifestação hemorrágica espontânea ou prova do laço positiva, sem repercussão hemodinâmica e sem alarme, ou alto risco (p. 449).',
  C: 'Algum sinal de alarme (p. 449).',
  D: 'Sinais de choque, sangramento grave ou disfunção grave de órgãos (p. 450).',
} as const

/** Dengue na criança — cap. 44 do livro do ICr. */
export function DenguePed() {
  const [p, setP] = useState(PACIENTE_VAZIO)
  const [perfil, setPerfil] = useState<Perfil>('crianca')
  const [marcados, setMarcados] = useState<Set<string>>(new Set())
  const [lab, setLab] = useState({ ht: 0, plaq: 0 })
  const [pa, setPa] = useState({ pas: 0, pad: 0 })
  const grupo = grupoDenguePed(marcados)
  const reclass = grupo === 'B' ? grupoBParaC(lab.ht, lab.plaq) : null
  const media = pressaoMediaLaco(pa.pas, pa.pad)
  const calc = podeCalcular(p)
  const oral = calc ? hidratacaoOral(p.peso, perfil) : null
  const hs = calc ? manutencao(p.peso) : null
  const alb = calc ? albumina5(p.peso) : null
  const cMs = calc ? grupoCMs2024(p.peso) : null
  const analg = calc ? analgesicosMs2024(p.peso) : null
  const idadeMeses = p.anos * 12 + p.meses
  const pesoEst = p.rn ? null : pesoAproximadoMs(idadeMeses)
  const pasP5 = p.rn ? null : pasP5Ms(p.anos)

  return (
    <ToolLayout
      title="Dengue — criança (grupos e hidratação)"
      description="Grupos A–D pelos achados marcados, hidratação por faixa de peso da criança (Quadro 8), expansões dos grupos C e D, albumina 5% e prova do laço — livro do ICr-HCFMUSP. A conduta é do médico."
      ficha={fichaDenguePed}
    >
      <CampoPaciente id="den" p={p} onChange={setP}>
        <Opcoes<Perfil> label="Linha do Quadro 8" valor={perfil} opcoes={[['crianca', 'Criança'], ['adolescente', 'Adolescente']]} onChange={setPerfil} />
      </CampoPaciente>
      <Nota>O Quadro 8 separa "criança" de "adolescente" sem idade de corte; a linha é escolhida pelo médico.</Nota>

      <Bloco titulo="Achados (p. 445–450)" descricao="O grupo sai do achado mais grave marcado, como o capítulo descreve.">
        <p className="font-medium">Gravidade (grupo D)</p>
        <Marcadores itens={SINAIS_GRAVIDADE} marcados={marcados} onChange={setMarcados} />
        <p className="font-medium">Sinais de alarme — Quadro 2 (grupo C)</p>
        <Marcadores itens={SINAIS_ALARME} marcados={marcados} onChange={setMarcados} />
        <p className="font-medium">Grupo B</p>
        <Marcadores itens={ACHADOS_GRUPO_B} marcados={marcados} onChange={setMarcados} />
        <p>
          Pelo texto do livro: <strong>grupo {grupo}</strong> — {DESCRICAO_GRUPO[grupo]}
        </p>
        {grupo === 'B' && (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              <NumberField id="den-ht" label="Hematócrito" unit="%" value={lab.ht} onChange={(ht) => setLab({ ...lab, ht })} min={0} step={0.1} />
              <NumberField id="den-plaq" label="Plaquetas" unit="/mm³" value={lab.plaq} onChange={(plaq) => setLab({ ...lab, plaq })} min={0} />
            </div>
            {reclass !== null && (
              <p>{reclass ? <strong>Ht &gt; 38% e/ou plaquetas &lt; 100.000: o livro reclassifica para o grupo C (p. 449).</strong> : 'Ht e plaquetas abaixo dos limiares de reclassificação do grupo B (p. 449).'}</p>
            )}
            <Errata texto={ERRATA_HT} />
          </>
        )}
      </Bloco>

      <Bloco titulo="Prova do laço (Quadro 5, p. 447)" descricao={`Criança: insuflar até o valor médio por ${LACO_CRIANCA.minutos} minutos; positiva com ${LACO_CRIANCA.petequias} ou mais petéquias no quadrado de 2,5 cm.`}>
        <div className="grid gap-3 sm:grid-cols-2">
          <NumberField id="den-pas" label="PA sistólica" unit="mmHg" value={pa.pas} onChange={(pas) => setPa({ ...pa, pas })} min={0} />
          <NumberField id="den-pad" label="PA diastólica" unit="mmHg" value={pa.pad} onChange={(pad) => setPa({ ...pa, pad })} min={0} />
        </div>
        {media !== null && <p>Valor médio: <strong className="tabular-nums">{br(media, 0)} mmHg</strong></p>}
        <Errata texto={ERRATA_LACO} />
      </Bloco>

      {!calc ? (
        <Pendencia p={p} />
      ) : (
        <Bloco titulo="Hidratação (Quadro 8, p. 450)" descricao="Volumes do livro para o peso; reavaliação e escolha da fase são do médico.">
          {oral && (
            <LinhaFaixa
              nome={`Grupos A e B — hidratação oral (${oral.mlKgDia} mL/kg/dia)`}
              faixa={[oral.dia, oral.dia]}
              unidade="mL/dia"
              casas={0}
              texto={perfil === 'crianca' ? '< 10 kg: 130 mL/kg/dia; 10 a 20 kg: 100 mL/kg/dia; > 20 kg: 80 mL/kg/dia; 1/3 em SRO em 4–6 h e 2/3 em líquidos caseiros; manter até 48 h após o último pico febril' : 'adolescente: 60 mL/kg/dia; 1/3 em SRO em 4–6 h e 2/3 em líquidos caseiros'}
              pagina="p. 450"
              extra={<span className="text-tinta-sussurro"> · SRO {br(oral.sro, 0)} mL ({faixaBr(oral.sroMlH, 0)} mL/h) · caseiros {br(oral.caseiros, 0)} mL</span>}
            />
          )}
          <LinhaFaixa nome="Grupo C — expansão com cristaloide" faixa={expansaoGrupoC(p.peso)} unidade="mL/h" casas={0} texto="10 a 20 mL/kg/h, repetindo até 3 vezes (criança e adolescente)" pagina="p. 450" />
          {perfil === 'crianca' ? (
            <LinhaFaixa
              nome="Grupo C — manutenção (criança)"
              faixa={hs ? [hs.mlDia, hs.mlDia] : null}
              unidade="mL/dia"
              casas={0}
              texto="necessidade hídrica basal (Holliday-Segar) com solução balanceada; internação por 48 h"
              pagina="p. 450; Holliday-Segar: cap. 77, p. 840"
              nota={NOTA_MANUTENCAO_CRIANCA}
              extra={hs && <span className="text-tinta-sussurro"> · {br(hs.mlH, 0)} mL/h{hs.noTeto ? ' (teto do cap. 77)' : ''}</span>}
            />
          ) : (
            manutencaoAdolescente(p.peso)?.map((e) => (
              <LinhaFaixa key={e.etapa} nome={`Grupo C — manutenção (adolescente), ${e.etapa}`} faixa={e.volumeMl} unidade="mL" casas={0} texto={e.regra} pagina="p. 450" extra={e.mlH && <span className="text-tinta-sussurro"> · {faixaBr(e.mlH, 0)} mL/h</span>} />
            ))
          )}
          <LinhaFaixa nome="Grupo D — expansão" faixa={expansaoGrupoD(p.peso)} unidade="mL" casas={0} texto="solução salina isotônica 20 mL/kg em até 20 minutos, até 3 vezes" pagina="p. 450" />
          {alb && (
            <LinhaFaixa
              nome="Grupo D — albumina 5% (Ht em ascensão e choque)"
              faixa={alb.volume}
              unidade="mL"
              casas={0}
              texto="cada 100 mL: 25 mL de albumina 20% + 75 mL de SF 0,9%"
              pagina="p. 450–451"
              nota={NOTA_ALBUMINA}
              extra={<span className="text-tinta-sussurro"> · albumina 20% {faixaBr(alb.albumina20, 0)} mL + SF {faixaBr(alb.sf, 0)} mL ({faixaBr(alb.gramas, 1)} g)</span>}
            />
          )}
        </Bloco>
      )}

      <Bloco titulo="Manual do Ministério da Saúde (6ª ed., 2024) — ao lado do livro" descricao="Hidratação dos grupos C e D do MS vale para adulto e criança; analgésicos e parâmetros por idade dos Apêndices B–H.">
        {cMs && (
          <p>Grupo C (MS, p. 33): <strong>{br(cMs.hora1Ml, 0)} mL</strong> na 1ª hora e {br(cMs.hora2Ml, 0)} mL/h na 2ª até o Ht (máx. {br(cMs.maxFaseMl, 0)} mL por fase, até 3 fases); manutenção com SF {br(cMs.manut6hMl, 0)} mL em 6 h ({br(cMs.manut6hMlH, 0)} mL/h) e {br(cMs.manut8hMl, 0)} mL em 8 h ({br(cMs.manut8hMlH, 0)} mL/h).</p>
        )}
        {analg && <p>Analgesia (MS, Apêndice H): dipirona <strong>{br(analg.dipironaMg, 0)} mg</strong> e paracetamol <strong>{br(analg.paracetamolMg, 0)} mg</strong> por dose (10 mg/kg), até de 6/6 h, respeitando a dose máxima por peso e idade.</p>}
        {pesoEst !== null && <p>Peso aproximado pela idade (MS, Apêndice B): <strong>{br(pesoEst, 1)} kg</strong> — só quando não for possível pesar.</p>}
        {pasP5 !== null && <p>5º percentil da PAS para a idade (MS, p. 16): <strong>{pasP5} mmHg</strong> — abaixo disso é hipotensão.</p>}
        {MS_CRIANCA_TEXTO.map((t) => <p key={t} className="text-tinta-sussurro">{t}</p>)}
        {SINAIS_VITAIS_MS.map((t) => <p key={t.tabela} className="text-tinta-sussurro"><span className="font-medium text-tinta">{t.tabela}:</span> {t.linhas.join('; ')}.</p>)}
        <ul className="list-disc pl-5 text-tinta-sussurro">{DIFERENCAS_MS_2024_PED.map((d) => <li key={d}>{d}</li>)}</ul>
      </Bloco>

      <Bloco titulo="Critérios de internação (Quadro 7)">
        <ListaQuadro itens={INTERNACAO} pagina="p. 449" />
      </Bloco>
      <Bloco titulo="Critérios de alta (Quadro 10)">
        <ListaQuadro itens={ALTA} pagina="p. 451" />
      </Bloco>
      <Bloco titulo="Do capítulo">
        <ListaLivro itens={REFERENCIAS_DENGUE} />
      </Bloco>
    </ToolLayout>
  )
}
