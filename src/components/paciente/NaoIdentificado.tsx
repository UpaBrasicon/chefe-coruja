// ─────────────────────────────────────────────────────────────────────────────
// Paciente não identificado (lacuna 1 do Portão de 11/10/2026; decisão do RT
// em 10/11/2026, A em N1–N4).
//  - FormNaoIdentificado: a recepção abre a ficha com o que se sabe (sexo
//    aparente, idade estimada, sinais e quem trouxe). O nome provisório
//    "Não identificado <prontuário>" sai do servidor.
//  - IdentificarPaciente: nome e, se houver, nascimento, sexo e documentos.
//    Se o servidor achar outro cadastro (mesmo CPF/CNS, ou mesmo nome e
//    nascimento), nada é gravado e a tela oferece o pedido de unificação que
//    já existe (o gestor aprova).
//  - NaoIdentificadosDaUnidade: a lista da recepção, com "Identificar".
// Toda regra é do servidor (registrar_nao_identificado, identificar_paciente);
// aqui só se confere a digitação e se mostra o resultado.
// ─────────────────────────────────────────────────────────────────────────────
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { GitMerge, UserRoundCheck, UserRoundSearch } from 'lucide-react'
import * as React from 'react'

import { supabase } from '@/lib/supabase'
import { SEXOS } from '@/lib/cadastro'
import { erroCns, erroCpf, erroNascimento, formatarCns, formatarCpf, soDigitos } from '@/lib/documentos'
import { hojeSP } from '@/lib/cadastroPaciente'
import { rotuloIdade } from '@/domain/idade'
import { PRIORIDADE_ROTULO, PRIORIDADES_INFORMADAS, type PrioridadeLegal } from '@/domain/prioridade'
import {
  erroNaoIdentificado, erroNomeIdentificado, lerIdadeEstimada, motivoUnificacao, rotuloCandidato, SINAIS_MAX,
  type Candidato, type ResultadoIdentificacao,
} from '@/domain/naoIdentificado'
import { Aviso } from '@/components/ui/aviso'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { Textarea } from '@/components/ui/textarea'
import { Chip, TituloCartao } from '@/components/monitor/Pagina'
import { Campo, Escolhas } from '@/components/paciente/CamposCadastro'

export type NaoIdentificadoCriado = { paciente_id: string; episodio_id: string; prontuario: string; nome: string }

// ── a ficha do não identificado ─────────────────────────────────────────────
export function FormNaoIdentificado({ setorId, publico, onCriado, onCancelar }: {
  setorId: string
  /** público da porta, para avisar idade estimada fora dela */
  publico?: 'todos' | 'adulto' | 'pediatrico'
  onCriado: (r: NaoIdentificadoCriado) => void
  onCancelar: () => void
}) {
  const [sexo, setSexo] = React.useState('')
  const [idade, setIdade] = React.useState('')
  const [sinais, setSinais] = React.useState('')
  const [queixa, setQueixa] = React.useState('')
  const [prioridades, setPrioridades] = React.useState<PrioridadeLegal[]>([])
  const [erro, setErro] = React.useState<string | null>(null)
  const [enviando, setEnviando] = React.useState(false)

  const anos = lerIdadeEstimada(idade)
  const foraDaPorta =
    anos !== null && !Number.isNaN(anos) && anos < 14 && publico === 'adulto' ? 'Idade estimada pediátrica numa porta adulta: confira a porta.'
    : anos !== null && !Number.isNaN(anos) && anos >= 14 && publico === 'pediatrico' ? 'Idade estimada de 14 anos ou mais numa porta pediátrica: confira a porta.'
    : null

  async function enviar() {
    const e = erroNaoIdentificado({ queixa, idade, sinais })
    if (e) return setErro(e)
    setErro(null)
    setEnviando(true)
    const { data, error } = await supabase.rpc('registrar_nao_identificado', {
      p_setor: setorId,
      p_queixa: queixa.trim(),
      p_sexo: sexo || undefined,
      p_idade_estimada: anos ?? undefined,
      p_sinais: sinais.trim() || undefined,
      p_prioridades: prioridades,
    })
    setEnviando(false)
    if (error) return setErro(error.message)
    onCriado(data as unknown as NaoIdentificadoCriado)
  }

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex flex-wrap gap-3">
        <Escolhas rotulo="Sexo aparente" opcoes={SEXOS} valor={sexo} onChange={(v) => { setSexo(v); setErro(null) }} className="flex-[1_1_220px]" />
        <Campo id="ni-idade" rotulo="Idade estimada (anos)" className="flex-[1_1_160px]"
          dica="Sem idade, a triagem escolhe adulto ou pediatria e a prescrição pede a idade estimada.">
          <Input id="ni-idade" inputMode="decimal" autoComplete="off" placeholder="Ex.: 40" value={idade}
            onChange={(e) => { setIdade(e.target.value); setErro(null) }} />
        </Campo>
      </div>
      {foraDaPorta && <p className="text-apoio text-atencao">{foraDaPorta}</p>}
      <Campo id="ni-sinais" rotulo="Sinais e quem trouxe" dica={`${sinais.trim().length}/${SINAIS_MAX}. Ex.: SAMU, ocorrência 123; tatuagem no braço direito.`}>
        <Textarea id="ni-sinais" maxLength={SINAIS_MAX} rows={3} value={sinais}
          placeholder="Quem trouxe, número da ocorrência, roupa, tatuagem, cicatriz"
          onChange={(e) => { setSinais(e.target.value); setErro(null) }} />
      </Campo>
      <Campo id="ni-queixa" rotulo="Queixa ou motivo da vinda">
        <Input id="ni-queixa" value={queixa} placeholder="Ex.: encontrado desacordado na via pública"
          onChange={(e) => { setQueixa(e.target.value); setErro(null) }} />
      </Campo>
      <div className="flex flex-col gap-2">
        <span className="text-apoio font-medium text-grafite">Atendimento prioritário (Lei 10.048/2000)</span>
        <div role="group" aria-label="Atendimento prioritário" className="flex flex-wrap gap-[7px]">
          {PRIORIDADES_INFORMADAS.map((p) => (
            <Chip key={p} variante="opcao" ativo={prioridades.includes(p)}
              onClick={() => setPrioridades((l) => (l.includes(p) ? l.filter((x) => x !== p) : [...l, p]))}>
              {PRIORIDADE_ROTULO[p]}
            </Chip>
          ))}
        </div>
        <span className="text-rotulo text-tinta-sussurro">60 anos ou mais e 80 anos ou mais entram sozinhos, pela idade estimada.</span>
      </div>
      <div className="flex flex-wrap items-center gap-2.5">
        <span role={erro ? 'alert' : undefined} className="min-w-0 flex-[1_1_240px] text-apoio text-critico">{erro}</span>
        <Button variant="outline" onClick={onCancelar}>Cancelar</Button>
        <Button disabled={enviando} onClick={() => void enviar()}>
          {enviando ? <Spinner className="size-4" /> : <UserRoundSearch />} Enviar para a triagem
        </Button>
      </div>
    </div>
  )
}

// ── identificar ─────────────────────────────────────────────────────────────
export type PacienteProvisorio = { id: string; nome: string; prontuario: string | null; sinais_identificacao?: string | null }

/** Chaves das telas que mostram o nome ou o selo do paciente. */
const AFETADAS = ['nao-identificados', 'recepcao-fila', 'triagem-fila', 'triagem-espera', 'pacientes-internados', 'fila-medica',
  'paciente-identidade', 'paciente-cadastro']

export function IdentificarPaciente({ paciente, onIdentificado, onCancelar }: {
  paciente: PacienteProvisorio
  onIdentificado: (r: { paciente_id: string; nome: string; prontuario: string | null }) => void
  onCancelar?: () => void
}) {
  const qc = useQueryClient()
  const hoje = hojeSP()
  const [nome, setNome] = React.useState('')
  const [nasc, setNasc] = React.useState('')
  const [sexo, setSexo] = React.useState('')
  const [cpf, setCpf] = React.useState('')
  const [cns, setCns] = React.useState('')
  const [erro, setErro] = React.useState<string | null>(null)
  const [enviando, setEnviando] = React.useState(false)
  const [achado, setAchado] = React.useState<Extract<ResultadoIdentificacao, { identificado: false }> | null>(null)
  const [motivo, setMotivo] = React.useState(() => motivoUnificacao(paciente.prontuario))
  const [pedido, setPedido] = React.useState<string | null>(null)

  const mudou = () => { setErro(null); setAchado(null); setPedido(null) }

  async function enviar(outraPessoa = false) {
    const e = erroNomeIdentificado(nome) || erroNascimento(nasc, hoje) || erroCpf(cpf) || erroCns(cns)
    if (e) return setErro(e)
    setErro(null)
    setPedido(null)
    setEnviando(true)
    const { data, error } = await supabase.rpc('identificar_paciente', {
      p_paciente: paciente.id,
      p_dados: { nome: nome.trim(), data_nascimento: nasc, sexo, cpf: soDigitos(cpf), cns: soDigitos(cns) },
      p_outra_pessoa: outraPessoa,
    })
    setEnviando(false)
    if (error) return setErro(error.message)
    const r = data as unknown as ResultadoIdentificacao
    if (!r.identificado) return setAchado(r)
    setAchado(null)
    for (const k of AFETADAS) void qc.invalidateQueries({ queryKey: [k] })
    onIdentificado({ paciente_id: r.paciente_id, nome: r.nome, prontuario: r.prontuario })
  }

  async function pedirUnificacao(c: Candidato) {
    if (motivo.trim().length < 10) return setErro('Escreva o motivo do pedido (ao menos 10 letras).')
    setErro(null)
    setEnviando(true)
    const { error } = await supabase.rpc('pedir_unificacao', { p_principal: c.id, p_absorvido: paciente.id, p_motivo: motivo.trim() })
    setEnviando(false)
    if (error) return setErro(error.message)
    void qc.invalidateQueries({ queryKey: ['pedidos-unificacao'] })
    setPedido(`Pedido de unificação com ${c.nome} enviado. O gestor da unidade aprova; até lá, o cadastro continua como não identificado.`)
  }

  return (
    <div className="flex flex-col gap-3.5">
      <p className="text-apoio text-tinta-sussurro">
        {paciente.nome}{paciente.sinais_identificacao ? ` · ${paciente.sinais_identificacao}` : ''}. O nome provisório e os sinais ficam no histórico do cadastro.
      </p>
      <div className="flex flex-wrap gap-3">
        <Campo id="idn-nome" rotulo="Nome completo" className="basis-full">
          <Input id="idn-nome" autoComplete="off" value={nome} onChange={(e) => { setNome(e.target.value); mudou() }} />
        </Campo>
        <Campo id="idn-nasc" rotulo="Data de nascimento" className="flex-[1_1_180px]"
          dica={nasc && !erroNascimento(nasc, hoje) ? rotuloIdade(nasc, hoje) : 'Se souber. A data real substitui a idade estimada.'}>
          <Input id="idn-nasc" type="date" max={hoje} value={nasc} onChange={(e) => { setNasc(e.target.value); mudou() }} />
        </Campo>
        <Escolhas rotulo="Sexo" opcoes={SEXOS} valor={sexo} onChange={(v) => { setSexo(v); mudou() }} className="flex-[1_1_200px]" />
        <Campo id="idn-cpf" rotulo="CPF" className="flex-[1_1_180px]">
          <Input id="idn-cpf" inputMode="numeric" autoComplete="off" placeholder="000.000.000-00" value={formatarCpf(cpf)}
            onChange={(e) => { setCpf(soDigitos(e.target.value).slice(0, 11)); mudou() }} />
        </Campo>
        <Campo id="idn-cns" rotulo="Cartão SUS" className="flex-[1_1_200px]">
          <Input id="idn-cns" inputMode="numeric" autoComplete="off" placeholder="000 0000 0000 0000" value={formatarCns(cns)}
            onChange={(e) => { setCns(soDigitos(e.target.value).slice(0, 15)); mudou() }} />
        </Campo>
      </div>

      {achado && (
        <Aviso tom="atencao" anunciar
          titulo={achado.motivo === 'documento' ? 'Este CPF ou Cartão SUS já está em outro cadastro da unidade.' : 'Já existe cadastro com o mesmo nome e nascimento.'}>
          <span>
            {achado.motivo === 'documento'
              ? 'Nada foi gravado. Se é a mesma pessoa, peça a unificação. Se o documento foi digitado errado, corrija.'
              : 'Nada foi gravado. Se é a mesma pessoa, peça a unificação. Se não é, confirme que é outra pessoa.'}
          </span>
          <ul className="mt-1.5 flex flex-col gap-2">
            {achado.candidatos.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center gap-2.5 rounded-controle border border-fio bg-superficie px-3 py-2 text-tinta">
                <span className="flex min-w-0 flex-[1_1_220px] flex-col">
                  <span className="text-controle font-medium">{c.nome_social ? `${c.nome_social} (${c.nome})` : c.nome}</span>
                  <span className="text-rotulo text-tinta-sussurro">
                    {[rotuloCandidato(c), c.aberto ? 'com atendimento aberto' : '', c.ativo ? '' : 'cadastro inativo'].filter(Boolean).join(' · ')}
                  </span>
                </span>
                {c.ativo && (
                  <Button variant="outline" size="sm" disabled={enviando || !!pedido} onClick={() => void pedirUnificacao(c)}>
                    <GitMerge /> Pedir unificação
                  </Button>
                )}
              </li>
            ))}
          </ul>
          <Campo id="idn-motivo" rotulo="Motivo do pedido de unificação" className="mt-2"
            dica="Se os dois cadastros tiverem atendimento aberto, a unificação só é aprovada depois que um deles for encerrado.">
            <Textarea id="idn-motivo" rows={2} value={motivo} onChange={(e) => setMotivo(e.target.value)} />
          </Campo>
        </Aviso>
      )}
      {pedido && <Aviso tom="conforme">{pedido}</Aviso>}

      <div className="flex flex-wrap items-center gap-2.5">
        <span role={erro ? 'alert' : undefined} className="min-w-0 flex-[1_1_240px] text-apoio text-critico">{erro}</span>
        {onCancelar && <Button variant="outline" onClick={onCancelar}>{pedido ? 'Fechar' : 'Cancelar'}</Button>}
        {achado?.motivo === 'nome_nascimento' && !pedido && (
          <Button variant="outline" disabled={enviando} onClick={() => void enviar(true)}>É outra pessoa</Button>
        )}
        {!pedido && (
          <Button disabled={enviando} onClick={() => void enviar(false)}>
            {enviando ? <Spinner className="size-4" /> : <UserRoundCheck />} Identificar
          </Button>
        )}
      </div>
    </div>
  )
}

/** Diálogo com o formulário de identificação. */
export function DialogoIdentificar({ paciente, onFechar, onIdentificado }: {
  paciente: PacienteProvisorio | null
  onFechar: () => void
  onIdentificado?: (r: { paciente_id: string; nome: string; prontuario: string | null }) => void
}) {
  return (
    <Dialog open={!!paciente} onOpenChange={(v) => { if (!v) onFechar() }}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-[620px]">
        <DialogHeader>
          <DialogTitle className="text-dialogo">Identificar paciente</DialogTitle>
          <DialogDescription className="text-controle">
            Antes de gravar, o sistema procura outro cadastro com o mesmo CPF, Cartão SUS ou nome e nascimento.
          </DialogDescription>
        </DialogHeader>
        {paciente && (
          <IdentificarPaciente paciente={paciente} onCancelar={onFechar}
            onIdentificado={(r) => { onIdentificado?.(r); onFechar() }} />
        )}
      </DialogContent>
    </Dialog>
  )
}

// ── a lista da recepção ─────────────────────────────────────────────────────
type NaoIdentificado = {
  id: string; nome: string; prontuario: string | null; sexo: string | null
  data_nascimento: string | null; data_nascimento_estimada: boolean; sinais_identificacao: string | null
  criado_em: string; setor: string | null; episodio_id: string | null; etapa: string | null
}

const ETAPA: Record<string, string> = { triagem: 'aguardando triagem', atendimento: 'no atendimento médico' }

export function NaoIdentificadosDaUnidade({ unidadeId }: { unidadeId: string }) {
  const hoje = hojeSP()
  const [alvo, setAlvo] = React.useState<PacienteProvisorio | null>(null)
  const [feito, setFeito] = React.useState<string | null>(null)
  const lista = useQuery({
    queryKey: ['nao-identificados', unidadeId],
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('pacientes_nao_identificados', { p_unidade: unidadeId })
      if (error) throw error
      return (data ?? []) as unknown as NaoIdentificado[]
    },
  })
  if (!lista.data?.length) return feito ? <Aviso tom="conforme" className="mt-5">{feito}</Aviso> : null

  return (
    <section aria-label="Pacientes não identificados" className="mt-5 flex flex-col gap-2.5 rounded-cartao border border-fio bg-superficie px-5 py-[18px]">
      <TituloCartao className="mb-0">Não identificados na unidade ({lista.data.length})</TituloCartao>
      <p className="-mt-1 text-apoio text-tinta-sussurro">Quando souber quem é, use Identificar. O nome provisório e os sinais ficam no histórico.</p>
      {feito && <Aviso tom="conforme">{feito}</Aviso>}
      <ul className="flex flex-col">
        {lista.data.map((p) => (
          <li key={p.id} className="flex flex-wrap items-center gap-3 border-b border-trilha py-2.5 last:border-0">
            <span className="flex min-w-0 flex-[1_1_260px] flex-col gap-0.5">
              <span className="text-controle font-medium text-tinta">{p.nome}</span>
              {p.sinais_identificacao && <span className="text-apoio text-observacao">{p.sinais_identificacao}</span>}
              <span className="text-rotulo text-tinta-sussurro">
                {[
                  p.sexo ? `sexo aparente ${p.sexo}` : '',
                  p.data_nascimento ? `${p.data_nascimento_estimada ? 'idade estimada ' : ''}${rotuloIdade(p.data_nascimento, hoje)}` : 'idade não informada',
                  p.setor ?? '',
                  p.etapa ? ETAPA[p.etapa] ?? '' : '',
                ].filter(Boolean).join(' · ')}
              </span>
            </span>
            <Button variant="outline" size="sm" onClick={() => { setFeito(null); setAlvo(p) }}><UserRoundCheck /> Identificar</Button>
          </li>
        ))}
      </ul>
      <DialogoIdentificar paciente={alvo} onFechar={() => setAlvo(null)}
        onIdentificado={(r) => setFeito(`Paciente identificado: ${r.nome}${r.prontuario ? ` · prontuário ${r.prontuario}` : ''}.`)} />
    </section>
  )
}
