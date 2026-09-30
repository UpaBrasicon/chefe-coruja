// Aba "Atendimento" (protótipo): SOAP com rascunho contínuo no servidor, os
// sinais da triagem logo abaixo do Objetivo, os registros já feitos e a
// reclassificação (só o médico). Nada aqui sugere cor, dose ou conduta.
import { useMutation } from '@tanstack/react-query'
import { ClipboardCheck } from 'lucide-react'
import * as React from 'react'

import { supabase } from '@/lib/supabase'
import { CORES_RISCO, gravidade, NIVEL_RISCO, type CorRisco } from '@/domain/risco'
import { faltandoVitais, paraNumeros, textoVitais, type Publico } from '@/domain/vitais'
import { useTerminologia } from '@/hooks/useTerminologia'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { PilulaRisco } from '@/components/clinico/PilulaRisco'
import { CamposVitais } from '@/components/clinico/CamposVitais'
import { SepsePorta } from '@/components/internacao/LeitoAberto'

import { hora, msg, soapVazio, type Soap } from './comum'

export type Classificacao = {
  id: string; cor: CorRisco; fluxograma_nome: string | null; discriminador: string | null; queixa: string | null
  reclassificacao: boolean; motivo: string | null; justificativa: string | null; autor_nome: string | null
  criado_em: string; sinais: Record<string, number> | null
}
export type RegistroSoap = { id: string; subjetivo: string | null; objetivo: string | null; avaliacao: string | null; cid: string | null; plano: string | null; criado_em: string }

/** Sugestões de CID-10 enquanto digita (terminologia do servidor). */
export function CampoCid({ id, valor, onChange, placeholder }: { id: string; valor: string; onChange: (v: string) => void; placeholder?: string }) {
  const [foco, setFoco] = React.useState(false)
  const sug = useTerminologia('cid10', foco && valor.trim().length >= 2 ? valor : '', 6)
  const lista = (sug.data ?? []).filter((r) => r.codigo.toUpperCase() !== valor.trim().toUpperCase())
  return (
    <div className="relative">
      <Input id={id} value={valor} placeholder={placeholder ?? 'Código ou nome'} autoComplete="off"
        onFocus={() => setFoco(true)} onBlur={() => window.setTimeout(() => setFoco(false), 150)}
        onChange={(e) => onChange(e.target.value.toUpperCase())} />
      {foco && lista.length > 0 && (
        <div role="listbox" className="absolute top-full right-0 left-0 z-20 mt-1 max-h-56 overflow-y-auto rounded-controle border border-fio bg-superficie shadow-popover">
          {lista.map((r) => (
            <button key={r.codigo} type="button" role="option" aria-selected={false}
              onMouseDown={(e) => e.preventDefault()} onClick={() => { onChange(r.codigo); setFoco(false) }}
              className="flex w-full gap-2 border-b border-trilha px-3 py-2 text-left text-apoio last:border-0 hover:bg-trilha">
              <span className="font-semibold tabular-nums text-tinta">{r.codigo}</span>
              <span className="text-tinta-apoio">{r.descricao}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export function AbaAtendimento({
  episodioId, pacienteId, publico, corAtual, soap, setSoap, salvoEm, classificacoes, registros, aoRegistrar,
}: {
  episodioId: string; pacienteId: string; publico: Publico | null; corAtual: CorRisco
  soap: Soap; setSoap: (s: Soap) => void; salvoEm: Date | null
  classificacoes: Classificacao[]; registros: RegistroSoap[]; aoRegistrar: () => void
}) {
  const triagem = classificacoes.find((c) => !c.reclassificacao) ?? classificacoes[0]
  const comSinais = classificacoes.find((c) => c.sinais && Object.keys(c.sinais).length > 0)
  const sinais = textoVitais(comSinais?.sinais)
  const muda = (k: keyof Soap) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setSoap({ ...soap, [k]: k === 'cid' ? e.target.value.toUpperCase() : e.target.value })

  const registrar = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('registrar_soap', {
        p_episodio: episodioId, p_subjetivo: soap.s, p_objetivo: soap.o, p_avaliacao: soap.a, p_plano: soap.p, p_cid: soap.cid || undefined,
      })
      if (error) throw error
    },
    onSuccess: aoRegistrar,
  })

  return (
    <div className="flex flex-col gap-5">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="soap-s">Subjetivo · história da doença atual</Label>
          <Textarea id="soap-s" rows={6} value={soap.s} onChange={muda('s')} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="soap-o">Objetivo · exame físico</Label>
          <Textarea id="soap-o" rows={6} value={soap.o} onChange={muda('o')} />
          <span className="text-rotulo text-tinta-sussurro [text-wrap:pretty]">
            {sinais ? <>Sinais da triagem{comSinais ? ` (${hora(comSinais.criado_em)})` : ''}: {sinais}</> : 'Sem sinais vitais da triagem.'}
          </span>
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_200px]">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="soap-a">Avaliação · hipótese diagnóstica</Label>
          <Input id="soap-a" value={soap.a} onChange={muda('a')} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="soap-cid">CID-10</Label>
          <CampoCid id="soap-cid" valor={soap.cid} onChange={(v) => setSoap({ ...soap, cid: v })} placeholder="Ex.: I20.0" />
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="soap-p">Plano</Label>
        <Textarea id="soap-p" rows={3} value={soap.p} onChange={muda('p')} />
      </div>
      <div className="flex flex-wrap items-center justify-end gap-3">
        <span className="mr-auto text-rotulo text-tinta-sussurro">
          {salvoEm ? `Rascunho salvo às ${hora(salvoEm.toISOString())}` : 'O rascunho é salvo enquanto você digita.'} Registrar grava o texto no prontuário com seu nome.
        </span>
        {registrar.error && <p className="w-full text-apoio text-critico">{msg(registrar.error)}</p>}
        <Button disabled={registrar.isPending || soapVazio({ ...soap, cid: '' })} onClick={() => registrar.mutate()}>
          <ClipboardCheck /> Registrar
        </Button>
      </div>

      {registros.length > 0 && (
        <section className="flex flex-col gap-2">
          <h3 className="rotulo text-tinta-sussurro">Registros do atendimento</h3>
          {registros.map((s) => (
            <div key={s.id} className="rounded-container border border-fio bg-campo px-3.5 py-2.5 text-apoio text-tinta-apoio">
              <div className="text-rotulo text-tinta-sussurro">{hora(s.criado_em)}{s.cid && ` · CID ${s.cid}`}</div>
              {s.subjetivo && <p><strong className="text-tinta">S</strong> {s.subjetivo}</p>}
              {s.objetivo && <p><strong className="text-tinta">O</strong> {s.objetivo}</p>}
              {s.avaliacao && <p><strong className="text-tinta">A</strong> {s.avaliacao}</p>}
              {s.plano && <p><strong className="text-tinta">P</strong> {s.plano}</p>}
            </div>
          ))}
        </section>
      )}

      <section id={`triagem-${episodioId}`} className="flex scroll-mt-4 flex-col gap-1.5">
        <h3 className="rotulo text-tinta-sussurro">Classificação de risco</h3>
        {classificacoes.map((c) => (
          <div key={c.id} className="text-apoio text-tinta-apoio">
            <PilulaRisco cor={c.cor} className="mr-2" />
            {c.reclassificacao ? `Reclassificado pelo médico: ${c.motivo}` : [c.fluxograma_nome, c.discriminador].filter(Boolean).join(' · ')}
            {c.justificativa && ` · justificativa: ${c.justificativa}`}
            <span className="text-rotulo text-tinta-sussurro"> · {c.autor_nome ? `${c.autor_nome} · ` : ''}{hora(c.criado_em)}</span>
          </div>
        ))}
        {!triagem && <p className="text-apoio text-tinta-sussurro">Sem classificação registrada.</p>}
      </section>

      {publico === 'pediatrico' && <SepsePorta pacienteId={pacienteId} />}

      <Reclassificar episodioId={episodioId} publico={publico} corAtual={corAtual} aoRegistrar={aoRegistrar} />
    </div>
  )
}

function Reclassificar({ episodioId, publico, corAtual, aoRegistrar }: { episodioId: string; publico: Publico | null; corAtual: CorRisco; aoRegistrar: () => void }) {
  const [aberto, setAberto] = React.useState(false)
  const [novaCor, setNovaCor] = React.useState<CorRisco | null>(null)
  const [vitais, setVitais] = React.useState<Record<string, string>>({})
  const [motivo, setMotivo] = React.useState('')
  const [justif, setJustif] = React.useState('')
  const baixando = !!novaCor && gravidade(novaCor) > gravidade(corAtual)
  const salvar = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('classificar_risco', {
        p_episodio: episodioId, p_cor: novaCor!, p_sinais: paraNumeros(vitais), p_motivo: motivo, p_justificativa: justif || undefined,
      })
      if (error) throw error
    },
    onSuccess: () => { setAberto(false); setNovaCor(null); setMotivo(''); setJustif(''); setVitais({}); aoRegistrar() },
  })
  return (
    <section className="flex flex-col gap-3 rounded-container border border-fio px-4 py-3">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-controle font-semibold text-tinta">Reclassificar</h3>
        <span className="text-rotulo text-tinta-sussurro">Só o médico reclassifica: motivo, sinais vitais novos e, para baixar a prioridade, justificativa.</span>
        {!aberto && <Button size="sm" variant="outline" className="ml-auto" onClick={() => setAberto(true)}>Reclassificar</Button>}
      </div>
      {aberto && (
        <>
          <CamposVitais publico={publico} valores={vitais} onChange={(k, v) => setVitais((s) => ({ ...s, [k]: v }))} prefixo="rv" />
          <div className="flex flex-wrap gap-2">
            {CORES_RISCO.map((c) => (
              <Button key={c} size="sm" variant={novaCor === c ? 'default' : 'outline'} onClick={() => setNovaCor(c)} className="capitalize">
                {c} · {NIVEL_RISCO[c]}
              </Button>
            ))}
          </div>
          <Input aria-label="Motivo" placeholder="Motivo (mínimo de 10 letras)" value={motivo} onChange={(e) => setMotivo(e.target.value)} />
          {baixando && <Input aria-label="Justificativa" placeholder="Justificativa para baixar a prioridade (mínimo de 20 letras)" value={justif} onChange={(e) => setJustif(e.target.value)} />}
          {salvar.error && <p className="text-apoio text-critico">{msg(salvar.error)}</p>}
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => setAberto(false)}>Cancelar</Button>
            <Button
              disabled={!novaCor || motivo.trim().length < 10 || (baixando && justif.trim().length < 20) || faltandoVitais(vitais, publico).length > 0 || salvar.isPending}
              onClick={() => salvar.mutate()}
            >
              Registrar reclassificação
            </Button>
          </div>
        </>
      )}
    </section>
  )
}
