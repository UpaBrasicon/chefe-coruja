import { useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'

import { SINAIS, THUNDERCLAP, TRATAMENTO, avaliarSinais, fichaCefaleiaAdulto } from '@/clinico/adulto/cefaleia'
import { Chip } from '@/components/monitor/Pagina'
import { ToolLayout } from '@/components/plantonista/ToolLayout'
import { cn } from '@/lib/utils'

import { Bloco, LinhaManual } from './PecasLoteC'

const Ir = ({ para, children }: { para: string; children: ReactNode }) => <Link to={para} className="text-acao hover:underline">{children}</Link>

/** Cefaleia aguda do adulto: sinais de alarme (SNNOOP10 e Tabela 2) e tratamento das primárias (cap. 41 do manual do HCFMUSP). */
export function CefaleiaAdulto() {
  const [marcados, setMarcados] = useState<string[]>([])
  const alternar = (id: string) => setMarcados((m) => (m.includes(id) ? m.filter((x) => x !== id) : [...m, id]))
  const av = avaliarSinais(marcados)

  return (
    <ToolLayout
      title="Cefaleia aguda"
      description="Sinais de alarme da SNNOOP10 com o diferencial e a investigação do manual do HC, thunderclap e tratamento das cefaleias primárias. Adulto (14 anos ou mais)."
      ficha={fichaCefaleiaAdulto}
    >
      <Bloco titulo="Sinais de alarme (SNNOOP10)" descricao="Marque os que estão presentes. A lista não foi validada prospectivamente; ausência de sinais não exclui causa secundária.">
        <div role="group" aria-label="Sinais de alarme" className="flex flex-wrap gap-2">
          {SINAIS.map((s) => <Chip key={s.id} ativo={marcados.includes(s.id)} onClick={() => alternar(s.id)}>{s.rotulo}</Chip>)}
        </div>
        {SINAIS.filter((s) => marcados.includes(s.id) && s.nota).map((s) => <p key={s.id} className="text-apoio text-tinta-sussurro">{s.nota}</p>)}
      </Bloco>

      <div role="status" className={cn('rounded-cartao border px-4 py-3', av.alarmes ? 'border-atencao' : 'border-fio')}>
        <p className="text-corpo font-semibold text-tinta">{av.alarmes ? `${av.alarmes} sinal${av.alarmes > 1 ? 'is' : ''} de alarme` : 'Nenhum sinal de alarme marcado'}</p>
        <p className="text-apoio text-tinta-apoio">
          {av.alarmes
            ? 'Com sinal de alarme, o manual orienta investigar causa secundária conforme a Tabela 2 (p. 566–568).'
            : 'Sem sinal de alarme, o capítulo trata como provável cefaleia primária; tratar a dor forte com analgesia otimizada, porque a resposta ao tratamento tem pouco valor diagnóstico (p. 575).'}
        </p>
      </div>

      {av.linhas.length > 0 && (
        <Bloco titulo="Diferencial e investigação (Tabela 2, p. 566–568)">
          {av.linhas.map((l) => <LinhaManual key={l.sinal} nome={l.sinal} texto={`${l.diferenciais}. Investigação: ${l.investigacao}`} pagina="Tabela 2" />)}
          {av.semLinha.length > 0 && <p className="text-apoio text-tinta-sussurro">Sem linha própria na Tabela 2: {av.semLinha.join('; ')}.</p>}
        </Bloco>
      )}

      {marcados.includes('subita') && (
        <Bloco titulo="Cefaleia em thunderclap (p. 568–569)" descricao="Pico em segundos a minutos: HSA, vasoconstrição arterial reversível, trombose venosa cerebral e dissecções são as causas mais comuns.">
          <ul className="flex list-disc flex-col gap-1 pl-5 text-apoio text-tinta-apoio">{THUNDERCLAP.map((t) => <li key={t}>{t}</li>)}</ul>
          <p className="text-apoio text-tinta-sussurro">Ver também a <Ir para="/plantonista/emergencias/ottawa-hsa">Regra de Ottawa para HSA</Ir> e a <Ir para="/plantonista/emergencias/hsa-adulto">conduta na HSA</Ir>.</p>
        </Bloco>
      )}

      {Object.values(TRATAMENTO).map((t) => (
        <Bloco key={t.titulo} titulo={`${t.titulo} — tratamento da crise`}>
          {t.itens.map((i) => <LinhaManual key={i.droga} nome={i.droga} texto={i.texto} pagina={i.pagina} />)}
        </Bloco>
      ))}
    </ToolLayout>
  )
}
