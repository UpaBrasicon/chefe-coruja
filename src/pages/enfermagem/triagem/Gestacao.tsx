import { Chip } from '@/components/monitor/Pagina'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { textoFontes } from '@/clinico/ficha'
import { dppPelaDum, ehGestante, fichaNaegele, igPelaDum, TIPOS_GESTACAO, type Gestacao } from '@/clinico/triagem/gestacao'

// Gestação na triagem: não entra no protocolo de classificação; vai junto do
// registro. Com a DUM, IG e DPP saem pela regra de Naegele (o servidor refaz).

const dataBR = (iso: string) => iso.split('-').reverse().join('/')

export function BlocoGestacao({ g, hoje, onChange }: { g: Gestacao; hoje: string; onChange: (patch: Partial<Gestacao>) => void }) {
  const gestante = ehGestante(g.tipo)
  const ig = g.dum ? igPelaDum(g.dum, hoje) : null
  const dpp = g.dum ? dppPelaDum(g.dum) : null
  const campo = (k: 'g' | 'p' | 'a', rotulo: string) => (
    <div className="flex min-w-0 flex-col gap-1">
      <Label htmlFor={`gest-${k}`} className="text-rotulo text-tinta-apoio">{rotulo}</Label>
      <Input id={`gest-${k}`} inputMode="numeric" value={g[k]} onChange={(e) => onChange({ [k]: e.target.value })} />
    </div>
  )

  return (
    <section className="flex flex-col gap-3.5 rounded-cartao border border-fio bg-superficie px-5 py-[18px] shadow-repouso">
      <div className="flex flex-wrap items-baseline gap-2.5">
        <h2 className="text-corpo font-semibold text-tinta">Avaliação · dados da gestação</h2>
        <span className="text-rotulo text-tinta-sussurro">Não entra no protocolo de classificação; vai junto do registro da triagem.</span>
      </div>
      <div className="flex flex-wrap gap-[7px]" role="group" aria-label="Gestação">
        {TIPOS_GESTACAO.map((t) => (
          <Chip key={t.id} ativo={g.tipo === t.id} onClick={() => onChange({ tipo: g.tipo === t.id ? null : t.id })}>{t.rotulo}</Chip>
        ))}
      </div>

      {gestante && (
        <>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(120px,1fr))] gap-2.5">
            {campo('g', 'G (gestações)')}
            {campo('p', 'P (partos)')}
            {campo('a', 'A (abortos)')}
            <div className="flex min-w-0 flex-col gap-1">
              <Label htmlFor="gest-dum" className="text-rotulo text-tinta-apoio">DUM</Label>
              <Input id="gest-dum" type="date" max={hoje} disabled={g.dumNaoInformada} value={g.dum} onChange={(e) => onChange({ dum: e.target.value })} />
            </div>
            <div className="flex min-w-0 flex-col gap-1">
              <Label htmlFor="gest-igs" className="text-rotulo text-tinta-apoio">IG (semanas)</Label>
              <Input id="gest-igs" inputMode="numeric" readOnly={!!g.dum} className={g.dum ? 'bg-trilha' : undefined}
                value={g.dum ? (ig ? String(ig.semanas) : '') : g.igSemanas} onChange={(e) => onChange({ igSemanas: e.target.value })} />
            </div>
            <div className="flex min-w-0 flex-col gap-1">
              <Label htmlFor="gest-igd" className="text-rotulo text-tinta-apoio">IG (dias)</Label>
              <Input id="gest-igd" inputMode="numeric" readOnly={!!g.dum} className={g.dum ? 'bg-trilha' : undefined}
                value={g.dum ? (ig ? String(ig.dias) : '') : g.igDias} onChange={(e) => onChange({ igDias: e.target.value })} />
            </div>
            <div className="flex min-w-0 flex-col gap-1">
              <Label htmlFor="gest-dpp" className="text-rotulo text-tinta-apoio">DPP</Label>
              <Input id="gest-dpp" type="date" readOnly={!!g.dum} className={g.dum ? 'bg-trilha' : undefined}
                value={g.dum ? (dpp ?? '') : g.dpp} onChange={(e) => onChange({ dpp: e.target.value })} />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3.5">
            <label className="flex cursor-pointer items-center gap-[7px] text-apoio text-grafite">
              <input type="checkbox" className="size-4 accent-acao" checked={g.dumNaoInformada}
                onChange={() => onChange({ dumNaoInformada: !g.dumNaoInformada, dum: '' })} />
              DUM não informada
            </label>
            <span className="text-rotulo text-tinta-sussurro">
              {g.dum && ig && dpp
                ? `Pela DUM de ${dataBR(g.dum)}: IG ${ig.semanas} sem ${ig.dias} d · DPP ${dataBR(dpp)} (regra de Naegele: DPP = DUM + 280 dias).`
                : 'Com a DUM, IG e DPP são calculadas pela regra de Naegele (DPP = DUM + 280 dias). Sem DUM, informe a IG se a gestante souber (ex.: pelo ultrassom).'}
            </span>
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-apoio font-medium text-grafite">Intercorrências</span>
            <div className="flex flex-wrap gap-[7px]" role="group" aria-label="Intercorrências">
              <Chip ativo={!g.intercorrencias} onClick={() => onChange({ intercorrencias: false })}>Ausente</Chip>
              <Chip ativo={g.intercorrencias} onClick={() => onChange({ intercorrencias: true })}>Presente</Chip>
            </div>
            {g.intercorrencias && (
              <Textarea rows={2} aria-label="Quais intercorrências" placeholder="Quais intercorrências" value={g.intercorrenciasTexto}
                onChange={(e) => onChange({ intercorrenciasTexto: e.target.value })} />
            )}
          </div>
          <span className="text-rotulo text-tinta-sussurro">{textoFontes(fichaNaegele)}</span>
        </>
      )}

      {g.tipo && (
        <div className="flex flex-col gap-1">
          <Label htmlFor="gest-obs" className="text-apoio font-medium text-grafite">Observação</Label>
          <Textarea id="gest-obs" rows={2} value={g.observacao} onChange={(e) => onChange({ observacao: e.target.value })} />
        </div>
      )}
    </section>
  )
}
