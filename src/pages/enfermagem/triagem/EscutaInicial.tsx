// Escuta inicial da UBS (5A, tarefa 2, parte 2.4; opção C do RT em
// 02/11/2026): a classificação da demanda espontânea do Caderno de Atenção
// Básica nº 28 em grade, como a figura do Caderno — a situação aguda (vai para
// a consulta) em três cartões e a não aguda (encerra na escuta) à parte, com
// orientação ou agendamento. A cor é a que o enfermeiro marca; o sistema nunca
// pré-seleciona. Sinais vitais opcionais (decisão do RT). O servidor
// (registrar_escuta_aps) confere tudo de novo.
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { CalendarPlus, Check } from 'lucide-react'
import * as React from 'react'
import { Link } from 'react-router-dom'

import { CamposVitais } from '@/components/clinico/CamposVitais'
import { Chip } from '@/components/monitor/Pagina'
import { BotaoLinha } from '@/components/ui/botao-linha'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { linkMarcarNaAgenda } from '@/domain/agenda'
import { CLASSIFICACAO_CAB28, SAIDAS_AZUL, type CorCab28, type SaidaEscuta } from '@/domain/aps'
import { ehPediatrico } from '@/domain/idade'
import { paraNumeros, type Publico } from '@/domain/vitais'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'

import { dataSP, nomeDe, type NaFila } from './comum'

// classes inteiras, para o Tailwind achar
const TOM: Record<CorCab28, { quadro: string; marcado: string }> = {
  vermelho: { quadro: 'bg-mts-vermelho', marcado: 'border-mts-vermelho hover:border-mts-vermelho ring-2 ring-mts-vermelho/25' },
  amarelo: { quadro: 'bg-mts-amarelo', marcado: 'border-mts-amarelo hover:border-mts-amarelo ring-2 ring-mts-amarelo/40' },
  verde: { quadro: 'bg-mts-verde', marcado: 'border-mts-verde hover:border-mts-verde ring-2 ring-mts-verde/25' },
  azul: { quadro: 'bg-mts-azul', marcado: 'border-mts-azul hover:border-mts-azul ring-2 ring-mts-azul/25' },
}

const SAIDA_TEXTO: Record<CorCab28, string> = {
  vermelho: 'vai para a fila do médico como atendimento imediato, à frente de todos.',
  amarelo: 'vai para a fila do médico como prioritário, à frente do verde e de quem não passou pela escuta.',
  verde: 'vai para a fila do médico no dia, pela prioridade legal e pela chegada.',
  azul: 'a ficha encerra na escuta, com a orientação ou o agendamento escrito.',
}

function Cartao({ c, marcado, onEscolher, children }: {
  c: (typeof CLASSIFICACAO_CAB28)[number]; marcado: boolean; onEscolher: () => void; children?: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-2">
      <BotaoLinha role="radio" aria-checked={marcado} onClick={onEscolher}
        className={cn('w-full gap-1.5 py-3', marcado && cn(TOM[c.cor].marcado, 'hover:bg-superficie'))}>
        <span className="flex w-full items-center gap-2">
          <span aria-hidden className={cn('size-4 shrink-0 rounded-capsula', TOM[c.cor].quadro)} />
          <strong className="text-controle text-tinta">{c.rotulo}</strong>
          <span className="sr-only">({c.cor})</span>
          {marcado && <Check className="ml-auto size-4 text-acao" aria-hidden />}
        </span>
        <span className="text-apoio text-pretty text-tinta-apoio">{c.descricao}</span>
        <span className="text-rotulo text-pretty text-tinta-sussurro">Ex.: {c.exemplos}.</span>
      </BotaoLinha>
      {children}
    </div>
  )
}

export function EscutaInicial({ ep, onFim }: { ep: NaFila; onFim: (msg: string | null) => void }) {
  const queryClient = useQueryClient()
  const nasc = ep.paciente?.data_nascimento ?? null
  // pediatria até 13a 11m 29d, pela data de chegada (CLAUDE.md)
  const pubIdade: Publico | null = nasc ? (ehPediatrico(nasc, dataSP(ep.chegada_em)) ? 'pediatrico' : 'adulto') : null
  const [pubManual, setPubManual] = React.useState<Publico | null>(null)
  const publico = pubIdade ?? pubManual
  const [queixa, setQueixa] = React.useState(ep.queixa ?? '')
  const [vitais, setVitais] = React.useState<Record<string, string>>({})
  const [cor, setCor] = React.useState<CorCab28 | null>(null)
  const [saidaAzul, setSaidaAzul] = React.useState<Exclude<SaidaEscuta, 'consulta'> | null>(null)
  const [obs, setObs] = React.useState('')
  const [tentou, setTentou] = React.useState(false)

  const erroAtual = (() => {
    if (!publico) return 'Sem data de nascimento: escolha adulto ou pediatria.'
    if (!cor) return 'Escolha a classificação do CAB 28.'
    if (cor === 'azul' && !saidaAzul) return 'Na situação não aguda, escolha orientação ou agendamento.'
    if (cor === 'azul' && obs.trim().length < 10) return 'Escreva a orientação dada ou o agendamento (mínimo de 10 letras).'
    try { paraNumeros(vitais) } catch (e) { return (e as Error).message }
    return null
  })()

  const salvar = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('registrar_escuta_aps', {
        p_episodio: ep.id,
        p_cor: cor!,
        p_saida: cor === 'azul' ? saidaAzul! : 'consulta',
        p_queixa: queixa.trim() || undefined,
        p_sinais: paraNumeros(vitais),
        p_publico: pubIdade ? undefined : publico!,
        p_obs: obs.trim() || undefined,
      })
      if (error) throw error
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['triagem-fila'] })
      void queryClient.invalidateQueries({ queryKey: ['triagem-espera'] })
      const rotulo = CLASSIFICACAO_CAB28.find((c) => c.cor === cor)!.rotulo.toLowerCase()
      onFim(cor === 'azul'
        ? `${nomeDe(ep)}: escuta registrada (${saidaAzul === 'agendamento' ? 'agendamento' : 'orientação'}); a ficha foi encerrada.`
        : `${nomeDe(ep)}: escuta registrada (${rotulo}); foi para a fila do médico.`)
    },
  })

  const registrar = () => {
    setTentou(true)
    if (!erroAtual) salvar.mutate()
  }
  const agudas = CLASSIFICACAO_CAB28.filter((c) => c.aguda)
  const azul = CLASSIFICACAO_CAB28.find((c) => !c.aguda)!

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="escuta-queixa">Queixa</Label>
        <Input id="escuta-queixa" value={queixa} onChange={(e) => setQueixa(e.target.value)} />
        <span className="text-rotulo text-tinta-sussurro">Vem da recepção; ajuste com o que o paciente contou.</span>
      </div>

      {!pubIdade && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-apoio font-medium text-tinta">Idade não registrada:</span>
          <div role="radiogroup" aria-label="Grupo" className="flex gap-2">
            <Chip variante="opcao" radio ativo={pubManual === 'adulto'} onClick={() => setPubManual('adulto')}>Adulto</Chip>
            <Chip variante="opcao" radio ativo={pubManual === 'pediatrico'} onClick={() => setPubManual('pediatrico')}>Pediatria</Chip>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-2">
        <span className="text-controle font-semibold text-tinta">Sinais vitais <span className="font-normal text-tinta-sussurro">(opcionais)</span></span>
        <CamposVitais publico={publico} opcionais prefixo="escuta" valores={vitais} onChange={(k, v) => setVitais((s) => ({ ...s, [k]: v }))} />
      </div>

      <div role="radiogroup" aria-label="Classificação de risco e vulnerabilidade (CAB 28)" className="flex flex-col gap-2">
        <span className="text-controle font-semibold text-tinta">Classificação de risco e vulnerabilidade</span>
        <span className="rotulo text-tinta-sussurro">Situação aguda ou crônica agudizada · vai para a consulta</span>
        <div className="grid gap-2.5 md:grid-cols-3">
          {agudas.map((c) => <Cartao key={c.cor} c={c} marcado={cor === c.cor} onEscolher={() => { setCor(c.cor); setSaidaAzul(null) }} />)}
        </div>
        <span className="rotulo mt-1.5 text-tinta-sussurro">Situação não aguda · encerra na escuta</span>
        <Cartao c={azul} marcado={cor === 'azul'} onEscolher={() => setCor('azul')}>
          {cor === 'azul' && (
            <div role="radiogroup" aria-label="Saída da situação não aguda" className="flex flex-wrap gap-2 pt-1">
              {SAIDAS_AZUL.map((s) => (
                <Chip key={s.valor} variante="opcao" radio ativo={saidaAzul === s.valor} onClick={() => setSaidaAzul(s.valor)}>{s.rotulo}</Chip>
              ))}
            </div>
          )}
          {/* F6 da tarefa 3: o agendamento pode ser marcado direto na agenda */}
          {cor === 'azul' && saidaAzul === 'agendamento' && (
            <Button size="xs" variant="outline" className="self-start" render={<Link to={linkMarcarNaAgenda(ep.paciente_id, ep.id)} target="_blank" rel="noopener" />}>
              <CalendarPlus /> Marcar na agenda
            </Button>
          )}
        </Cartao>
      </div>

      {cor && (
        <p role="status" className="rounded-container border border-fio bg-campo px-3.5 py-2.5 text-apoio text-tinta">
          <strong>Saída:</strong> {SAIDA_TEXTO[cor]}
        </p>
      )}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="escuta-obs">
          {cor === 'azul' ? (saidaAzul === 'agendamento' ? 'Agendamento' : 'Orientação dada') : 'Observação'}{' '}
          <span className="font-normal text-tinta-sussurro">{cor === 'azul' ? '(mínimo de 10 letras)' : '(opcional)'}</span>
        </Label>
        <Textarea id="escuta-obs" rows={2} value={obs} onChange={(e) => setObs(e.target.value)} />
      </div>

      {tentou && erroAtual && <p role="alert" className="text-apoio text-critico">{erroAtual}</p>}
      {salvar.error && <p role="alert" className="rounded-container border border-critico/30 bg-alerta-critico px-3.5 py-2.5 text-apoio text-critico">{salvar.error.message}</p>}

      <div className="flex flex-wrap items-center justify-end gap-2 border-t border-fio pt-3">
        <span className="mr-auto text-rotulo text-tinta-sussurro">Classificação da demanda espontânea, Cadernos de Atenção Básica nº 28 (MS), vol. II, p. 19.</span>
        <Button variant="ghost" onClick={() => onFim(null)}>Cancelar</Button>
        <Button disabled={salvar.isPending} onClick={registrar}><Check /> Registrar escuta</Button>
      </div>
    </div>
  )
}
