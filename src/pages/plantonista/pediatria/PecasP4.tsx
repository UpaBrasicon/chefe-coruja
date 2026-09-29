import type { ReactNode } from 'react'

import { calcularBolus, type Bolus } from '@/clinico/pediatria/bolus'
import { SEM_VALOR_NEONATAL_P4, calcularDoseLivro, textoDoseLivro, type DoseLivro } from '@/clinico/pediatria/fonteP4'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'

import { faixaBr } from './formatoIcr'
import { Errata } from './PecasIcr'

// Peças visuais do lote P4 (livro do ICr). Só componentes.

const casas = (u: DoseLivro['unidade'], x: number) => (u === 'UI' ? 0 : x >= 100 ? 0 : x >= 10 ? 1 : 2)

/**
 * Uma linha de dose do livro calculada para o peso: por dose e por dia, o que
 * o livro escreve, via, página, máximo emprestado do Apêndice, nota e errata.
 * RN sem valor neonatal explícito não calcula.
 */
export function LinhaDoseLivro({ d, peso, rn = false, extra }: { d: DoseLivro; peso: number; rn?: boolean; extra?: ReactNode }) {
  const bloqueadaRn = rn && !d.neonatal
  const r = bloqueadaRn ? null : calcularDoseLivro(d, peso)
  const fmt = (f: [number, number]) => faixaBr(f, casas(d.unidade, f[1]))
  return (
    <div className={`rounded-lg border px-3 py-2 text-sm ${bloqueadaRn ? 'opacity-70' : ''}`}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="font-medium">
          {d.nome}
          {d.neonatal && <Badge variant="outline" className="ml-2 align-middle">valor neonatal do livro</Badge>}
        </span>
        {r && (
          <span className="tabular-nums">
            {r.porDose && <strong>{fmt(r.porDose)} {d.unidade}/dose</strong>}
            {r.dia && (
              <span className={r.porDose ? 'text-tinta-sussurro' : 'font-semibold'}>
                {r.porDose ? ' · ' : ''}
                {fmt(r.dia)} {d.unidade}/dia
              </span>
            )}
          </span>
        )}
      </div>
      <p className="mt-1 text-tinta-sussurro">
        O livro traz: {textoDoseLivro(d)} · {d.via}
      </p>
      {bloqueadaRn && <p className="text-atencao">{SEM_VALOR_NEONATAL_P4}</p>}
      {r?.noMaximo && <p className="text-atencao">Limitado ao máximo{d.fonteMaximo ? ` (${d.fonteMaximo})` : ' do livro'}.</p>}
      {!r?.noMaximo && d.fonteMaximo && <p className="text-tinta-sussurro">Máximo usado: {d.fonteMaximo}.</p>}
      {extra}
      {d.nota && <p className="text-tinta-sussurro">{d.nota}</p>}
      {d.errata && <Errata texto={d.errata} />}
      <p className="text-rotulo text-tinta-sussurro">Livro ICr, {d.pagina}.</p>
    </div>
  )
}

/** Dose do Apêndice já cadastrada em bolus.ts (reaproveitada, sem copiar número). */
export function LinhaBolusApendice({ b, peso, idadeMeses }: { b: Bolus; peso: number; idadeMeses?: number }) {
  const r = calcularBolus(b, peso, idadeMeses)
  if (r?.aplica === 'nao') return null
  return (
    <div className="rounded-lg border px-3 py-2 text-sm">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="font-medium">
          {b.nome}
          {b.condicao && <Badge variant="outline" className="ml-2 align-middle">{b.condicao.texto}</Badge>}
        </span>
        {r && (
          <span className="tabular-nums">
            <strong>{faixaBr(r.faixa, r.faixa[1] >= 10 ? 1 : 2)} {b.unidade}</strong>
            {r.volumeMl && <span className="text-tinta-sussurro"> · {faixaBr(r.volumeMl, 2)} mL</span>}
          </span>
        )}
      </div>
      <p className="mt-1 text-tinta-sussurro">
        {b.porKg ? `${faixaBr(b.faixa, 3)} ${b.unidade}/kg` : `${faixaBr(b.faixa, 3)} ${b.unidade}`}
        {b.maximo !== undefined && ` · máximo ${b.maximo.toLocaleString('pt-BR')} ${b.unidade}`}
        {b.apresentacao && ` · ${b.apresentacao}`} · {b.via}
      </p>
      {r?.aplica === 'indefinido' && <p className="text-tinta-sussurro">Depende da idade: informe a idade para conferir a condição do livro.</p>}
      {r?.noMaximo && <p className="text-atencao">Limitado ao máximo do livro.</p>}
      {b.nota && <p className="text-tinta-sussurro">{b.nota}</p>}
      {b.errata && <Errata texto={b.errata} />}
      <p className="text-rotulo text-tinta-sussurro">Livro ICr, Apêndice, {b.pagina}.</p>
    </div>
  )
}

/** Tabela simples de referência (texto do livro). */
export function TabelaLivro({ cabecalho, linhas, largura = 520 }: { cabecalho: string[]; linhas: ReactNode[][]; largura?: number }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-xs" style={{ minWidth: largura }}>
        <thead className="text-tinta-sussurro">
          <tr>
            {cabecalho.map((h) => (
              <th key={h} className="px-1.5 py-1 font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {linhas.map((l, i) => (
            <tr key={i} className="border-t align-top">
              {l.map((c, j) => (
                <td key={j} className={`px-1.5 py-1 ${j === 0 ? 'font-medium' : ''}`}>
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/** Lista de caixas de marcar (critérios do livro). */
export function Marcadores({ itens, marcados, onChange }: { itens: { id: string; texto: string }[]; marcados: Set<string>; onChange: (s: Set<string>) => void }) {
  return (
    <div className="flex flex-col gap-1.5">
      {itens.map((c) => (
        <label key={c.id} className="flex cursor-pointer items-start gap-2 rounded-md border px-3 py-2 text-sm hover:bg-trilha/50">
          <input
            type="checkbox"
            className="mt-0.5 size-4"
            checked={marcados.has(c.id)}
            onChange={(e) => {
              const s = new Set(marcados)
              if (e.target.checked) s.add(c.id)
              else s.delete(c.id)
              onChange(s)
            }}
          />
          {c.texto}
        </label>
      ))}
    </div>
  )
}

/** Aviso de que a idade informada é de adulto (≥ 14 anos) ou pedido de peso. */
export function Aviso({ children }: { children: ReactNode }) {
  return (
    <Card>
      <CardContent className="pt-6 text-sm text-tinta-sussurro">{children}</CardContent>
    </Card>
  )
}
