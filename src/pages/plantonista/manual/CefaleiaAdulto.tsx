import { useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'

import {
  AHS_2025_NIVEIS, ESQUEMA_REFRATARIA, SBCE_TABELAS, SINAIS, THUNDERCLAP, TRATAMENTO, avaliarSinais, clorpromazinaMg, fichaCefaleiaAdulto,
} from '@/clinico/adulto/cefaleia'
import { Chip } from '@/components/monitor/Pagina'
import { ToolLayout } from '@/components/plantonista/ToolLayout'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { numero } from '@/lib/formato'
import { cn } from '@/lib/utils'

import { Bloco, CampoPeso, LinhaManual } from './PecasLoteC'

const Ir = ({ para, children }: { para: string; children: ReactNode }) => <Link to={para} className="text-acao hover:underline">{children}</Link>

/** Cefaleia aguda do adulto: sinais de alarme (SNNOOP10 e Tabela 2) e tratamento das primárias (cap. 41 do manual do HCFMUSP). */
export function CefaleiaAdulto() {
  const [marcados, setMarcados] = useState<string[]>([])
  const alternar = (id: string) => setMarcados((m) => (m.includes(id) ? m.filter((x) => x !== id) : [...m, id]))
  const av = avaliarSinais(marcados)
  const [peso, setPeso] = useState(0)
  const clorpromazina = clorpromazinaMg(peso)

  return (
    <ToolLayout
      title="Cefaleia aguda"
      description="Sinais de alarme da SNNOOP10 com o diferencial e a investigação do manual do HC, thunderclap, tratamento das cefaleias primárias e doses da crise de migrânea pelo consenso da SBCe (2000), com os níveis da AHS 2025. Adulto (14 anos ou mais)."
      ficha={fichaCefaleiaAdulto}
    >
      <Bloco titulo="Sinais de alarme (SNNOOP10)" descricao="Marque os que estão presentes. A lista não foi validada prospectivamente; ausência de sinais não exclui causa secundária.">
        <div role="group" aria-label="Sinais de alarme" className="flex flex-wrap gap-2">
          {SINAIS.map((s) => <Chip key={s.id} ativo={marcados.includes(s.id)} onClick={() => alternar(s.id)}>{s.rotulo}</Chip>)}
        </div>
        {SINAIS.filter((s) => marcados.includes(s.id) && s.nota).map((s) => <p key={s.id} className="text-apoio text-tinta-sussurro">{s.nota}</p>)}
      </Bloco>

      <div role="status" className={cn('rounded-cartao border px-4 py-3', av.alarmes ? 'border-atencao' : 'border-fio')}>
        <p className="text-corpo font-semibold text-tinta">{av.alarmes ? `${av.alarmes} ${av.alarmes > 1 ? 'sinais' : 'sinal'} de alarme` : 'Nenhum sinal de alarme marcado'}</p>
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

      <CampoPeso id="cef-peso" peso={peso} onChange={setPeso} />

      <Bloco
        titulo="Doses na crise de migrânea — consenso da SBCe (2000)"
        descricao="O capítulo do manual não traz essas doses. Elas vêm do consenso da Sociedade Brasileira de Cefaleia, publicado em 2000: é antigo, e algumas drogas e vias saíram de uso. Confira com a diretriz atual antes de prescrever."
      >
        <LinhaManual
          nome="Clorpromazina — crise forte"
          texto="0,1–0,7 mg/kg IM ou IV diluído em SF 0,9%, repetir até 3 vezes nas 24 h; na refratária, 0,1 mg/kg IV em 3 minutos (p. 376). O manual pede monitorização cardíaca na via parenteral (p. 573)."
          conta={clorpromazina ? <strong>{numero(clorpromazina[0])}–{numero(clorpromazina[1])} mg</strong> : 'informe o peso'}
          pagina="Tabela 3, p. 378"
          origem="O consenso traz"
        />
        {SBCE_TABELAS.map((t) => (
          <div key={t.id} className="flex flex-col gap-1">
            <p className="text-apoio font-semibold text-tinta">{t.titulo} — {t.pagina}</p>
            <div className="overflow-x-auto">
              <Table variante="referencia" className="w-full min-w-[560px] text-left align-top text-apoio">
                <TableHeader className="text-tinta-sussurro"><TableRow><TableHead className="pr-3 pb-2">Droga</TableHead><TableHead className="pr-3 pb-2">Dose e posologia</TableHead><TableHead className="pr-3 pb-2">Classe</TableHead></TableRow></TableHeader>
                <TableBody>{t.linhas.map((l) => <TableRow key={l.droga} className="border-t"><TableCell className="pr-3 py-2 font-medium">{l.droga}</TableCell><TableCell className="pr-3 py-2">{l.dose}</TableCell><TableCell className="pr-3 py-2">{l.classe}</TableCell></TableRow>)}</TableBody>
              </Table>
            </div>
            {t.nota && <p className="text-apoio text-tinta-sussurro">{t.nota}</p>}
          </div>
        ))}
      </Bloco>

      <Bloco titulo="Migrânea na emergência — consenso da SBCe (2000), p. 376">
        {ESQUEMA_REFRATARIA.map((e) => <p key={e} className="text-apoio text-tinta-apoio">{e}</p>)}
      </Bloco>

      <Bloco titulo="AHS 2025 — crise de migrânea no PS (pelo resumo)" descricao="Níveis de recomendação da American Headache Society para drogas parenterais no PS. O resumo não traz dose; o texto integral não foi lido.">
        {AHS_2025_NIVEIS.map((n) => <p key={n.nivel} className="text-apoio text-tinta-apoio"><span className="font-medium text-tinta">{n.nivel}:</span> {n.drogas.join(', ')}.</p>)}
      </Bloco>
    </ToolLayout>
  )
}
