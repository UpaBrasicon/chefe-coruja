// "Alta e documentos" do leito em quatro passos (pontos 14 e 16 do
// plantonista; o RT aprovou em 28/10/2026 a opção A): 1 receita para casa,
// 2 atestado, 3 orientações (o pacote de alta), 4 alta. Cada passo abre e
// fecha e mostra se já foi feito. Receita e atestado são as peças da porta,
// com o paciente fixo; o documento é emitido pelo rascunho do banco, que o liga
// à internação. Nenhum passo é obrigatório para a alta (decisão do RT): o
// passo 4 só mostra o que foi feito.
import { useQuery } from '@tanstack/react-query'
import { ChevronDown } from 'lucide-react'
import * as React from 'react'

import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { faixaEtaria } from '@/domain/idade'
import { dataIso, hora as horaFmt } from '@/lib/formato'
import { sugestoesDaPrescricao, type EstadoDocs } from '@/lib/documentosAlta'
import { CartaoAtestado, ReceitaAlta } from '@/components/documentos/AtestadoReceita'
import { useEmissaoAtestadoReceita } from '@/components/documentos/emissaoAtestadoReceita'
import { Estado } from '@/components/porta/Estado'
import { Button } from '@/components/ui/button'

import { type Acao, diaHora, type Internacao, type Pacote } from './comum'
import { BlocoAlta, BlocoPacote, CancelarAlta } from './Alta'

const hora = (iso: string) => horaFmt(iso)

type DocAlta = { id: string; tipo_documento: string; created_at: string; emitido_em: string | null; versao: number }

function Passo({ n, titulo, feito, aberto, onAlternar, children }: {
  n: number; titulo: string; feito: string | null; aberto: boolean; onAlternar: () => void; children: React.ReactNode
}) {
  return (
    <section className="overflow-hidden rounded-cartao border border-fio bg-superficie">
      <Button type="button" variant="ghost" onClick={onAlternar} aria-expanded={aberto}
        className="h-auto w-full justify-start gap-3 rounded-none px-4 py-3 text-left hover:bg-campo">
        <span className={cn('flex size-7 shrink-0 items-center justify-center rounded-capsula text-apoio font-semibold',
          feito ? 'bg-conforme text-superficie' : 'bg-trilha text-tinta-apoio')}>{n}</span>
        <span className="text-controle font-semibold text-tinta">{titulo}</span>
        <Estado tom={feito ? 'verde' : 'cinza'}>{feito ?? 'Não feito'}</Estado>
        <ChevronDown className={cn('ml-auto size-4 text-tinta-sussurro transition-transform', aberto && 'rotate-180')} aria-hidden />
      </Button>
      {aberto && <div className="flex flex-col gap-3 border-t border-trilha px-4 py-3">{children}</div>}
    </section>
  )
}

export function PassosAlta({ i, pacienteId, pacienteNome, ativa, altaRecente, ehGestor, eu, acao, impeditivos, pacotes, cidSugerido, leito, diagnostico, estado, setEstado }: {
  i: Internacao; pacienteId: string; pacienteNome: string; ativa: boolean; altaRecente: boolean; ehGestor: boolean; eu: string | null
  acao: Acao; impeditivos: { tipo: string; descricao: string }[]; pacotes: Pacote[]; cidSugerido: string | null
  leito: string; diagnostico: string
  /** a receita e o atestado em curso ficam no leito aberto (trocar de aba não perde o que foi escrito) */
  estado: EstadoDocs; setEstado: (f: (s: EstadoDocs) => EstadoDocs) => void
}) {
  const podeEmitir = !ehGestor && (ativa || altaRecente)
  // mesma chave e colunas do cabeçalho do paciente: uma leitura só
  const paciente = useQuery({
    queryKey: ['cabecalho-paciente', pacienteId],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.from('pacientes').select('nome, nome_social, data_nascimento, sexo').eq('id', pacienteId).maybeSingle()
      if (error) throw error
      return data
    },
  })
  const docs = useQuery({
    queryKey: ['documentos-alta', i.id],
    queryFn: async () => {
      const { data, error } = await supabase.from('documentos_clinicos')
        .select('id, tipo_documento, created_at, emitido_em, versao')
        .eq('internacao_id', i.id).in('tipo_documento', ['receita', 'atestado']).neq('estado', 'rascunho')
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as DocAlta[]
    },
  })
  // "Trazer da prescrição" (opção a do RT): só o medicamento; "como tomar" é do médico
  const prescricao = useQuery({
    queryKey: ['prescricao-vigente', pacienteId],
    enabled: podeEmitir,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('prescricao_vigente', { p_paciente: pacienteId })
      if (error) throw error
      return (data ?? []) as unknown as { tipo: string; descricao: string; medicamento_id: string | null }[]
    },
  })
  const sugestoes = sugestoesDaPrescricao(prescricao.data ?? [])

  const p = paciente.data
  const nascimento = p?.data_nascimento ? p.data_nascimento.slice(0, 10) : null
  const { erro, emitirAtestado, emitirReceita } = useEmissaoAtestadoReceita({
    pacienteId, nome: p?.nome_social || p?.nome || pacienteNome, nascimento, leito, diagnostico,
    ondePreencherCid: 'registre o diagnóstico em Evolução › Diagnóstico', estado, setEstado, aoEmitir: () => void docs.refetch(),
  })

  const ultima = (tipo: string) => (docs.data ?? []).find((d) => d.tipo_documento === tipo)
  const receita = ultima('receita')
  const atestados = (docs.data ?? []).filter((d) => d.tipo_documento === 'atestado')
  const pacote = pacotes.find((x) => x.situacao === 'ativo') ?? pacotes[0]
  const feitoReceita = receita ? `Emitida ${hora(receita.emitido_em ?? receita.created_at)}` : null
  const feitoAtestado = atestados[0] ? `Emitido ${hora(atestados[0].emitido_em ?? atestados[0].created_at)}` : null
  const feitoPacote = pacote ? 'Gerado' : null
  const feitoAlta = !ativa ? 'Alta dada' : null

  // a receita abre primeiro; os outros, quando o médico chega neles
  const [abertos, setAbertos] = React.useState<number[]>(() => [1])
  const alternar = (n: number) => setAbertos((xs) => (xs.includes(n) ? xs.filter((x) => x !== n) : [...xs, n]))

  return (
    <div className="flex flex-col gap-3">
      {erro && <p role="alert" className="rounded-container border border-critico/30 bg-alerta-critico px-3.5 py-2.5 text-apoio text-critico">{erro}</p>}

      <Passo n={1} titulo="Receita para casa" feito={feitoReceita} aberto={abertos.includes(1)} onAlternar={() => alternar(1)}>
        {podeEmitir ? (
          <ReceitaAlta titulo="Receita para casa" faixa={faixaEtaria(nascimento, dataIso())} estado={estado} setEstado={setEstado}
            sugestoes={sugestoes} onEmitir={() => void emitirReceita()} />
        ) : <p className="text-apoio text-tinta-sussurro">{receita ? `Receita emitida ${hora(receita.emitido_em ?? receita.created_at)}.` : 'Nenhuma receita emitida nesta internação.'}</p>}
      </Passo>

      <Passo n={2} titulo="Atestado" feito={feitoAtestado} aberto={abertos.includes(2)} onAlternar={() => alternar(2)}>
        {podeEmitir && <CartaoAtestado estado={estado} setEstado={setEstado} cid={cidSugerido ?? ''} onEmitir={() => void emitirAtestado(cidSugerido ?? '')} />}
        {atestados.length === 0 ? <p className="text-apoio text-tinta-sussurro">Nenhum atestado emitido nesta internação.</p> : (
          <div className="flex flex-col">
            {atestados.map((d) => (
              <span key={d.id} className="border-t border-trilha py-1.5 text-apoio text-tinta first:border-0">
                Atestado{d.versao > 1 ? ` · versão ${d.versao}` : ''} <span className="text-tinta-sussurro">· {diaHora(d.emitido_em ?? d.created_at)}</span>
              </span>
            ))}
          </div>
        )}
      </Passo>

      <Passo n={3} titulo="Orientações" feito={feitoPacote} aberto={abertos.includes(3)} onAlternar={() => alternar(3)}>
        {(ativa || altaRecente || ehGestor) ? (
          <BlocoPacote i={i} pacienteId={pacienteId} pacienteNome={pacienteNome} lista={pacotes} podeGerar={!ehGestor && (ativa || altaRecente)} acao={acao} />
        ) : <p className="text-apoio text-tinta-sussurro">Alta há mais de 24 horas.</p>}
      </Passo>

      <Passo n={4} titulo="Alta" feito={feitoAlta} aberto={abertos.includes(4)} onAlternar={() => alternar(4)}>
        {ativa && (
          <p className="text-apoio text-tinta-apoio">
            Feito nesta alta: receita {feitoReceita ? 'emitida' : 'não emitida'} · atestado {feitoAtestado ? 'emitido' : 'não emitido'} · orientações {feitoPacote ? 'geradas' : 'não geradas'}.
            <span className="text-tinta-sussurro"> Nenhum é obrigatório para a alta.</span>
          </p>
        )}
        {ativa && impeditivos.length === 0 && !ehGestor && <p className="text-apoio text-tinta-sussurro">Sem impeditivos: a alta pode ser dada.</p>}
        {ativa && !ehGestor && <BlocoAlta i={i} impeditivos={impeditivos} acao={acao} cidSugerido={cidSugerido} />}
        {!ativa && altaRecente && (i.alta_por === eu || ehGestor) && <CancelarAlta i={i} acao={acao} />}
        {!ativa && !altaRecente && !ehGestor && <p className="text-apoio text-tinta-sussurro">Alta há mais de 24 horas: o cancelamento é com o gestor.</p>}
      </Passo>
    </div>
  )
}
