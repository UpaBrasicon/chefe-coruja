import { useState } from 'react'

import {
  CRITERIOS_CAINE, DOSES_ABSTINENCIA, ERRATA_CIWA, FATORES_RISCO_SAA, NOTAS_TEMPO_SAA, SEM_DOSE_NO_CAPITULO, TEMPOS_SAA,
  caine, ciwaAr, doseDiaria, fichaAbstinenciaAlcoolica, midazolamDelirium, type DoseAbstinencia, type Faixa,
} from '@/clinico/adulto/abstinenciaAlcoolica'
import type { Respostas } from '@/clinico/escore'
import { ToolLayout } from '@/components/plantonista/ToolLayout'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

import { Bloco, LinhaManual } from './PecasLoteC'

const br = (x: number) => (Math.round(x * 10) / 10).toLocaleString('pt-BR')
const faixa = (f: Faixa) => (f[0] === f[1] ? br(f[0]) : `${br(f[0])}–${br(f[1])}`)

const botao = (ativo: boolean) =>
  cn('rounded-md border px-2.5 py-1.5 text-left text-sm transition-colors', ativo ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'hover:bg-muted/50')

function contaDose(d: DoseAbstinencia) {
  if (d.id === 'midazolam') {
    const m = midazolamDelirium()
    return m.mlH === null ? undefined : <>bolus {br(m.bolusMl!)} mL · <strong>{br(m.mlH)} mL/h</strong> ({br(m.mgMl!)} mg/mL, Anexo 1)</>
  }
  if (!d.mg || !d.intervalosH) return undefined
  return (
    <>
      {d.intervalosH.map((h, i) => {
        const dia = doseDiaria(d.mg!, h)
        return dia && <span key={h}>{i > 0 && ' · '}{h}/{h} h = <strong>{faixa(dia)} mg/dia</strong></span>
      })}
      {d.tetoDiaMg && <> · até {faixa(d.tetoDiaMg)} mg/dia</>}
    </>
  )
}

/** Síndrome de abstinência alcoólica (cap. 78 do manual do HCFMUSP). */
export function Abstinencia() {
  const [r, setR] = useState<Respostas>({})
  const [caineMarcados, setCaine] = useState<string[]>([])
  const res = ciwaAr.calcular(r)
  const respondidos = ciwaAr.itens.filter((i) => typeof r[i.id] === 'number').length
  const cn2 = caine(caineMarcados.length)

  return (
    <ToolLayout
      title="Síndrome de abstinência alcoólica — adulto"
      description="CIWA-Ar, critérios de Caine e as doses do manual do HC (benzodiazepínicos, tiamina, magnésio e outras). Adulto (14 anos ou mais)."
      ficha={fichaAbstinenciaAlcoolica}
    >
      <Bloco titulo="CIWA-Ar (Tabela 3, p. 1028–1030)" descricao="Níveis sem descrição no livro (2, 3, 5 e 6) ficam entre o anterior e o seguinte.">
        <div className="flex flex-col gap-4">
          {ciwaAr.itens.map((item) => item.tipo === 'escolha' && (
            <div key={item.id} className="flex flex-col gap-1.5">
              <span className="text-sm font-semibold">{item.rotulo}</span>
              <div className="grid gap-1.5 sm:grid-cols-2">
                {item.opcoes.map((o, idx) => (
                  <button key={o.rotulo} type="button" aria-pressed={r[item.id] === idx} onClick={() => setR((x) => ({ ...x, [item.id]: idx }))} className={botao(r[item.id] === idx)}>
                    {o.rotulo}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Bloco>

      <Bloco titulo="Resultado">
        {!res ? (
          <p className="text-sm text-muted-foreground">Responda os 10 itens ({respondidos} de 10).</p>
        ) : (
          <div className="flex flex-col gap-2 text-sm">
            <p className="flex flex-wrap items-center gap-2">
              CIWA-Ar <Badge className="text-lg">{res.valor}</Badge> <span className="text-muted-foreground">{res.unidade}</span>
              <Badge variant={res.estado === 2 ? 'destructive' : res.estado === 1 ? 'warning' : 'success'}>{res.nota}</Badge>
            </p>
            <dl className="grid gap-x-4 gap-y-1 sm:grid-cols-[auto_1fr]">
              {res.derivados.map(([k, v]) => (
                <div key={k} className="contents"><dt className="text-muted-foreground">{k}</dt><dd>{v}</dd></div>
              ))}
            </dl>
            {res.alerta && <p className="text-atencao"><Badge variant="warning" className="mr-1">errata</Badge>{res.alerta}</p>}
          </div>
        )}
        <p className="text-sm text-atencao"><Badge variant="warning" className="mr-1">errata</Badge>{ERRATA_CIWA.cabecalho}</p>
      </Bloco>

      <Bloco titulo="Critérios de Caine — encefalopatia de Wernicke (Tabela 4, p. 1032)" descricao="O livro exige dois critérios para o diagnóstico.">
        <div className="grid gap-1.5 sm:grid-cols-2">
          {CRITERIOS_CAINE.map((c) => (
            <label key={c} className="flex cursor-pointer items-center gap-2 rounded-md border px-2.5 py-1.5 text-sm hover:bg-muted/50">
              <input type="checkbox" className="size-4" checked={caineMarcados.includes(c)}
                onChange={(e) => setCaine((x) => (e.target.checked ? [...x, c] : x.filter((y) => y !== c)))} />
              {c}
            </label>
          ))}
        </div>
        <p className="text-sm">{cn2.marcados} de 4 — {cn2.preenche ? <strong>critério de Caine preenchido (2 ou mais)</strong> : 'menos de 2 critérios'}</p>
      </Bloco>

      <Bloco titulo="Doses do manual (p. 1031–1034)" descricao="O livro coloca os benzodiazepínicos como esteio do tratamento; a conta mostra só a dose diária do esquema citado.">
        {DOSES_ABSTINENCIA.map((d) => (
          <LinhaManual key={d.id} nome={`${d.nome} — ${d.contexto}`} texto={d.texto} conta={contaDose(d)} pagina={d.pagina} nota={d.nota} />
        ))}
      </Bloco>

      <Bloco titulo="Citados sem dose no capítulo">
        <ul className="flex flex-col gap-1 text-sm">
          {SEM_DOSE_NO_CAPITULO.map((x) => <li key={x.nome}><span className="font-medium">{x.nome}:</span> {x.texto} <span className="text-muted-foreground">({x.pagina})</span></li>)}
        </ul>
      </Bloco>

      <Bloco titulo="Tempo de aparecimento (Tabela 2, p. 1026–1027)" descricao={NOTAS_TEMPO_SAA}>
        <ul className="grid gap-1 text-sm md:grid-cols-2">
          {TEMPOS_SAA.map((t) => (
            <li key={t.sindrome} className="rounded-lg border px-3 py-2"><span className="font-medium">{t.sindrome}</span> · {t.tempo}<br /><span className="text-muted-foreground">{t.achados}</span></li>
          ))}
        </ul>
      </Bloco>

      <Bloco titulo={`Fatores de risco (${FATORES_RISCO_SAA.pagina})`}>
        <ul className="list-disc pl-5 text-sm text-muted-foreground">
          {FATORES_RISCO_SAA.itens.map((f) => <li key={f}>{f}</li>)}
        </ul>
      </Bloco>
    </ToolLayout>
  )
}
