import { useState } from 'react'

import {
  ATAQUE_ESTADO_DE_MAL, DESMAME_ESTADO_DE_MAL, ESTABILIZACAO_ESTADO_DE_MAL, TEMPOS_ESTADO_DE_MAL, TERCEIRA_LINHA,
  calcularAtaque, calcularTerceiraLinha, fichaEstadoDeMalAdulto, type DrogaAtaque, type Faixa,
} from '@/clinico/adulto/estadoDeMal'
import { ToolLayout } from '@/components/plantonista/ToolLayout'

import { Bloco, CampoPeso, LinhaManual } from './PecasLoteC'

const br = (x: number, casas = 1) => (Math.round(x * 10 ** casas) / 10 ** casas).toLocaleString('pt-BR')
const faixa = (f: Faixa, casas = 1) => (f[0] === f[1] ? br(f[0], casas) : `${br(f[0], casas)}–${br(f[1], casas)}`)

function textoDose(d: DrogaAtaque) {
  const dose = d.mgKg ? `${faixa(d.mgKg)} mg/kg${d.maxMg ? ` (máx. ${br(d.maxMg)} mg)` : ''}` : `${faixa(d.fixaMg!)} mg`
  return `${dose}; ${d.apresentacao}; ${d.administracao}`
}

function Ataque({ d, peso }: { d: DrogaAtaque; peso: number }) {
  const r = calcularAtaque(d, peso)
  const conta = !r ? 'informe o peso' : (
    <>
      <strong>{faixa(r.mg, 0)} mg</strong>
      {r.limitadoAoTeto && ' (no teto)'}
      {r.ml && ` · ${faixa(r.ml)} mL`}
      {r.tempos.map((t) => <span key={t.rotulo}> · a {t.rotulo}: ≥ {faixa(t.minutos)} min</span>)}
    </>
  )
  return <LinhaManual nome={d.nome} texto={textoDose(d)} conta={conta} pagina={d.pagina} errata={d.errata} nota={d.nota} />
}

/** Estado de mal epiléptico convulsivo do adulto (cap. 46 do manual do HCFMUSP). */
export function EstadoDeMalAdulto() {
  const [peso, setPeso] = useState(0)
  return (
    <ToolLayout
      title="Estado de mal epiléptico — adulto"
      description="Doses de 1ª, 2ª e 3ª linha do manual do HC por peso, com volume e tempo mínimo de infusão. Adulto (14 anos ou mais)."
      ficha={fichaEstadoDeMalAdulto}
    >
      <CampoPeso id="eme-peso" peso={peso} onChange={setPeso} />

      <Bloco titulo="Tempos do manual" descricao={`Estabilização: ${ESTABILIZACAO_ESTADO_DE_MAL.texto} (${ESTABILIZACAO_ESTADO_DE_MAL.pagina}).`}>
        <ul className="grid gap-1 text-sm md:grid-cols-4">
          {TEMPOS_ESTADO_DE_MAL.map((t) => (
            <li key={t.etapa} className="rounded-lg border px-3 py-2"><span className="font-medium">{t.etapa}</span><br />{t.janela} <span className="text-tinta-sussurro">({t.pagina})</span></li>
          ))}
        </ul>
      </Bloco>

      <Bloco titulo="1ª linha (Tabela 3)" descricao="Crise prolongada por mais de 5 minutos.">
        {ATAQUE_ESTADO_DE_MAL.filter((d) => d.linha === 1).map((d) => <Ataque key={d.id} d={d} peso={peso} />)}
      </Bloco>

      <Bloco titulo="2ª linha (Tabela 4)" descricao="O tempo mostrado é o mínimo para infundir a dose na velocidade citada.">
        {ATAQUE_ESTADO_DE_MAL.filter((d) => d.linha === 2).map((d) => <Ataque key={d.id} d={d} peso={peso} />)}
      </Bloco>

      <Bloco titulo="3ª linha — infusão contínua (Tabela 5)" descricao="mL/h no preparo padrão do Anexo 1 do mesmo manual; o tiopental não tem preparo no anexo.">
        {TERCEIRA_LINHA.map((d) => {
          const r = calcularTerceiraLinha(d, peso)
          const conta = !r ? 'informe o peso' : (
            <>
              bolus <strong>{faixa(r.bolusMg, 0)} mg</strong>
              {r.bolusAcumuladoMaxMg !== null && ` (acumulado até ${br(r.bolusAcumuladoMaxMg, 0)} mg)`}
              {' · '}manutenção <strong>{faixa(r.manutencaoMgH, 0)} mg/h</strong>
              {r.manutencaoMlH && ` = ${faixa(r.manutencaoMlH)} mL/h (${br(r.mgMlPreparo!, 0)} mg/mL)`}
            </>
          )
          return (
            <LinhaManual
              key={d.id}
              nome={d.nome}
              texto={`bolus ${faixa(d.bolusMgKg)} mg/kg (${d.repeticao}); manutenção ${faixa(d.manutencaoMgKgH)} mg/kg/h; ${d.apresentacao}`}
              conta={conta}
              pagina={d.pagina}
            />
          )
        })}
        <p className="text-sm text-tinta-sussurro">{DESMAME_ESTADO_DE_MAL.texto} ({DESMAME_ESTADO_DE_MAL.pagina})</p>
      </Bloco>
    </ToolLayout>
  )
}
