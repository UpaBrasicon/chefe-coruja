// Indicadores da APS no Painel do Gestor da UBS (percurso da UBS, U13, PR 1).
// Para cada indicador (C1 a C7): o resultado do que o app registra, a estimativa
// do Ministério (o que o app não registra conta zero; G1 = A), o conceito e a
// fonte. A nota final segue os pesos da NT 8/2026.
import { useQuery } from '@tanstack/react-query'
import { Award } from 'lucide-react'

import { Spinner } from '@/components/ui/spinner'
import { TETO_NO_APP as TETO_HIPERDIA, pontosDoPaciente, type HiperdiaLinha } from '@/domain/hiperdia'
import {
  ROTULO_CONCEITO, SEMAFORO, TETO_APP, c7Ministerio, conceitoBoasPraticas, conceitoC1, conceitoNotaFinal, media, notaFinal,
  type Conceito, type Indicador, type ResultadoApsBanco, type Semaforo,
} from '@/domain/indicadoresAps'
import { TETO_NO_APP as TETO_PRE_NATAL, pontosDa as pontosPreNatal, type PreNatalLinha } from '@/domain/preNatal'
import { TETO_NO_APP as TETO_PUERICULTURA, pontosDa as pontosCrianca, type CriancaLinha } from '@/domain/puericultura'
import { dataIso } from '@/lib/formato'
import { cn } from '@/lib/utils'
import { supabase } from '@/lib/supabase'

type Linha = { ind: Indicador; nome: string; app: string; ministerio: number | null; conceito: Conceito | null; fora: string; base: string }

// classes inteiras, para o Tailwind achar
const TOM_SEMAFORO: Record<Semaforo, { fundo: string; ponto: string; texto: string }> = {
  verde: { fundo: 'bg-conforme/10', ponto: 'bg-conforme', texto: 'text-conforme' },
  amarelo: { fundo: 'bg-atencao/10', ponto: 'bg-atencao', texto: 'text-atencao' },
  vermelho: { fundo: 'bg-critico/10', ponto: 'bg-critico', texto: 'text-critico' },
}

/** Semáforo do conceito (RF7): a bolinha colorida e o nome do conceito. */
function SinalConceito({ conceito }: { conceito: Conceito }) {
  const tom = TOM_SEMAFORO[SEMAFORO[conceito]]
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-capsula px-2 py-0.5 text-apoio font-semibold', tom.fundo, tom.texto)}>
      <span aria-hidden className={cn('size-2.5 rounded-capsula', tom.ponto)} />
      {ROTULO_CONCEITO[conceito]}
      <span className="sr-only">(sinal {SEMAFORO[conceito]})</span>
    </span>
  )
}

async function rpc<T>(nome: 'indicadores_aps' | 'puericultura_painel' | 'pre_natal_painel' | 'hiperdia_painel', unidadeId: string): Promise<T> {
  const { data, error } = await supabase.rpc(nome, { p_unidade: unidadeId })
  if (error) throw error
  return data as unknown as T
}

export function IndicadoresAps({ unidadeId }: { unidadeId: string }) {
  const q = useQuery({
    queryKey: ['indicadores-aps', unidadeId],
    queryFn: async () => {
      const [banco, criancas, gestantes, hiperdia] = await Promise.all([
        rpc<ResultadoApsBanco>('indicadores_aps', unidadeId), rpc<CriancaLinha[]>('puericultura_painel', unidadeId),
        rpc<PreNatalLinha[]>('pre_natal_painel', unidadeId), rpc<HiperdiaLinha[]>('hiperdia_painel', unidadeId),
      ])
      // a hora da leitura: o hiperdia conta os prazos a partir dela
      return { banco, criancas: criancas ?? [], gestantes: gestantes ?? [], hiperdia: hiperdia ?? [], agora: Date.now() }
    },
  })
  if (q.isLoading) return <Spinner />
  if (q.error || !q.data) return <p className="text-apoio text-critico">{(q.error as Error | null)?.message ?? 'Sem dados.'}</p>

  const { banco, criancas, gestantes, hiperdia, agora } = q.data
  const hoje = dataIso()
  const pct = (v: number | null, teto: number) => (v === null ? '—' : `${Math.round((v / teto) * 100)}% do que o app registra`)

  const c1 = banco.c1.total > 0 ? Math.round((banco.c1.programados / banco.c1.total) * 1000) / 10 : null
  const c2 = media(criancas.map((c) => pontosCrianca(c, hoje)))
  const c3 = media(gestantes.map((g) => pontosPreNatal(g, hoje)))
  const prog = (p: 'diabetes' | 'hipertensao') => media(hiperdia.filter((l) => l.programas.some((x) => x.programa === p))
    .map((l) => pontosDoPaciente(l, agora)[p] ?? 0))
  const c4 = prog('diabetes'); const c5 = prog('hipertensao')
  const c6 = banco.c6.media
  const c7 = banco.c7.colo.faixa + banco.c7.ssr.faixa + banco.c7.mama.faixa + (banco.c7.hpv?.faixa ?? 0) > 0 ? c7Ministerio(banco.c7) : null
  const cbp = (v: number | null) => (v === null ? null : conceitoBoasPraticas(v))

  const linhas: Linha[] = [
    { ind: 'C1', nome: 'Mais acesso', app: c1 === null ? '—' : `${banco.c1.programados} de ${banco.c1.total} atendimentos programados (4 meses)`,
      ministerio: c1, conceito: c1 === null ? null : conceitoC1(c1), fora: '—', base: 'ótimo acima de 50% até 70%' },
    { ind: 'C2', nome: 'Criança até 2 anos', app: pct(c2, TETO_PUERICULTURA), ministerio: c2, conceito: cbp(c2),
      fora: 'visitas do ACS', base: `${criancas.length} crianças` },
    { ind: 'C3', nome: 'Gestação e puerpério', app: pct(c3, TETO_PRE_NATAL), ministerio: c3, conceito: cbp(c3),
      fora: 'ACS e saúde bucal', base: `${gestantes.length} gestantes e puérperas` },
    { ind: 'C4', nome: 'Diabetes', app: pct(c4, TETO_HIPERDIA.diabetes), ministerio: c4, conceito: cbp(c4),
      fora: 'visitas do ACS', base: `${hiperdia.filter((l) => l.programas.some((x) => x.programa === 'diabetes')).length} pessoas` },
    { ind: 'C5', nome: 'Hipertensão', app: pct(c5, TETO_HIPERDIA.hipertensao), ministerio: c5, conceito: cbp(c5),
      fora: 'visitas do ACS', base: `${hiperdia.filter((l) => l.programas.some((x) => x.programa === 'hipertensao')).length} pessoas` },
    { ind: 'C6', nome: 'Pessoa idosa', app: pct(c6, TETO_APP.C6!), ministerio: c6, conceito: cbp(c6),
      fora: 'visitas do ACS', base: `${banco.c6.pessoas} pessoas de 60 anos ou mais · influenza ${banco.c6.influenza ?? 0}` },
    { ind: 'C7', nome: 'Mulher, prevenção do câncer', app: pct(c7, TETO_APP.C7!), ministerio: c7, conceito: cbp(c7),
      fora: '—',
      base: `preventivo ${banco.c7.colo.feito}/${banco.c7.colo.faixa} · vacina HPV ${banco.c7.hpv?.feito ?? 0}/${banco.c7.hpv?.faixa ?? 0} · saúde sexual ${banco.c7.ssr.feito}/${banco.c7.ssr.faixa} · mamografia ${banco.c7.mama.feito}/${banco.c7.mama.faixa}` },
  ]
  const nota = notaFinal(Object.fromEntries(linhas.map((l) => [l.ind, l.conceito])))

  return (
    <section aria-label="Indicadores da APS" className="flex flex-col gap-3 rounded-cartao border border-fio bg-superficie px-4 py-3">
      <div className="flex flex-wrap items-center gap-2">
        <Award className="size-4 text-acao" aria-hidden />
        <span className="text-controle font-semibold text-tinta">Indicadores da APS (C1 a C7)</span>
        <span className="ml-auto flex items-center gap-2 text-apoio text-tinta">
          Nota final estimada: <strong>{String(nota).replace('.', ',')}</strong> de 10 <SinalConceito conceito={conceitoNotaFinal(nota)} />
        </span>
      </div>
      <ul className="flex flex-col">
        {linhas.map((l) => (
          <li key={l.ind} className="grid gap-1 border-t border-trilha py-2 md:grid-cols-[12rem_1fr_9rem] md:items-baseline md:gap-3">
            <span className="text-apoio font-medium text-tinta">{l.ind} · {l.nome}</span>
            <span className="text-apoio text-tinta-apoio">
              {l.app}{l.fora !== '—' ? ` · fora do app: ${l.fora}` : ''}
              <span className="block text-rotulo text-tinta-sussurro">{l.base}</span>
            </span>
            <span className="text-apoio text-tinta">
              {/* RF7 (RT, 23/11/2026): a cor e o conceito na frente; o número em segundo plano */}
              {l.conceito ? <SinalConceito conceito={l.conceito} /> : <span className="text-tinta-sussurro">sem dado</span>}
              {l.ministerio !== null && (
                <span className="block text-rotulo tabular-nums text-tinta-sussurro">{String(l.ministerio).replace('.', ',')}{l.ind === 'C1' ? '%' : ''}</span>
              )}
            </span>
          </li>
        ))}
      </ul>
      <p className="text-rotulo text-pretty text-tinta-sussurro">
        Estimativa pelas notas metodológicas C1 a C7 da SAPS/MS (junho de 2026) e pela NT 8/2026: o que o app não registra conta zero.
        Médico e enfermeiro pelo papel na unidade (o Ministério usa o CBO); pessoas pelo cadastro ativo na UBS (o Ministério usa o vínculo da Portaria SAPS 161/2024).
      </p>
    </section>
  )
}
