import { Link2, SlidersHorizontal, X } from 'lucide-react'
import * as React from 'react'

import { Chip, Chips } from '@/components/monitor/Pagina'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { Periodo } from '@/lib/esperaTriagem'
import type { useFiltrosBI } from './useFiltrosBI'

// Barra única de filtros da tela Indicadores (Fase 1, tarefa 7 do BACKLOG):
// período, setor de entrada, cor final, turno da chegada, adulto/pediátrico e
// médico que atendeu. Fica no endereço da página — o link leva os filtros.

const PERIODOS: { chave: Periodo; rotulo: string }[] = [
  { chave: 'hoje', rotulo: 'Hoje' }, { chave: '7d', rotulo: '7 dias' },
  { chave: '30d', rotulo: '30 dias' }, { chave: 'intervalo', rotulo: 'Intervalo' },
]
const seletor = 'h-9 rounded-controle border border-fio bg-superficie px-2.5 text-apoio text-tinta'

export function BarraFiltrosBI({ ctx }: { ctx: ReturnType<typeof useFiltrosBI> }) {
  const { filtros: f, definir, limpar, opcoes } = ctx
  const hoje = new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' })
  const [copiado, setCopiado] = React.useState(false)
  const algum = f.setor || f.cor || f.turno || f.grupo || f.medico || f.periodo !== '7d'

  async function copiar() {
    try {
      await navigator.clipboard.writeText(window.location.href)
      setCopiado(true)
      window.setTimeout(() => setCopiado(false), 2000)
    } catch {
      // sem permissão de área de transferência: o endereço continua na barra do navegador
    }
  }

  return (
    <section aria-label="Filtros dos indicadores" className="flex flex-col gap-2.5 rounded-container border border-fio bg-superficie px-4 py-3">
      <div className="flex flex-wrap items-center gap-3">
        <span className="flex items-center gap-1.5 text-apoio font-medium text-tinta"><SlidersHorizontal className="size-4 text-tinta-sussurro" aria-hidden /> Filtros</span>
        <Chips rotulo="Período">
          {PERIODOS.map((p) => <Chip key={p.chave} ativo={f.periodo === p.chave} onClick={() => definir({ periodo: p.chave })}>{p.rotulo}</Chip>)}
        </Chips>
        {f.periodo === 'intervalo' && (
          <div className="flex items-center gap-2 text-apoio">
            <Input type="date" aria-label="De" value={f.de} max={hoje} onChange={(e) => definir({ de: e.target.value })} className="w-40" />
            <span className="text-tinta-sussurro">a</span>
            <Input type="date" aria-label="Até" value={f.ate} max={hoje} onChange={(e) => definir({ ate: e.target.value })} className="w-40" />
          </div>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <select aria-label="Setor de entrada" value={f.setor} onChange={(e) => definir({ setor: e.target.value })} className={seletor}>
          <option value="">Todos os setores</option>
          {opcoes.setores.map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}
        </select>
        <select aria-label="Cor" value={f.cor} onChange={(e) => definir({ cor: e.target.value })} className={seletor}>
          <option value="">Todas as cores</option>
          {['vermelho', 'laranja', 'amarelo', 'verde', 'azul'].map((c) => <option key={c} value={c} className="capitalize">{c[0].toUpperCase() + c.slice(1)}</option>)}
        </select>
        <select aria-label="Turno" value={f.turno} onChange={(e) => definir({ turno: e.target.value })} className={seletor}>
          <option value="">Todos os turnos</option>
          <option value="manha">Manhã (07–13)</option>
          <option value="tarde">Tarde (13–19)</option>
          <option value="noite">Noite (19–07)</option>
        </select>
        <select aria-label="Grupo" value={f.grupo} onChange={(e) => definir({ grupo: e.target.value })} className={seletor}>
          <option value="">Adulto e pediátrico</option>
          <option value="adulto">Adulto</option>
          <option value="pediatrico">Pediátrico</option>
        </select>
        <select aria-label="Médico que atendeu" value={f.medico} onChange={(e) => definir({ medico: e.target.value })} className={seletor}>
          <option value="">Todos os médicos</option>
          {opcoes.medicos.map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}
        </select>
        {algum && <Button variant="ghost" size="sm" onClick={limpar}><X /> Limpar</Button>}
        <Button variant="outline" size="sm" onClick={copiar} className="ml-auto"><Link2 /> {copiado ? 'Link copiado' : 'Copiar link'}</Button>
      </div>
      {f.periodo === 'intervalo' && f.de > f.ate && <p className="text-apoio text-critico">A data inicial é depois da final.</p>}
    </section>
  )
}
