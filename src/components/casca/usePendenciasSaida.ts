import { useQuery } from '@tanstack/react-query'

import { supabase } from '@/lib/supabase'
import { contar } from '@/lib/offline/fila'

// O que fica para trás quando alguém sai no meio do plantão (P/index.html
// ~33485, "Sair com o plantão aberto?"). Sair do sistema não encerra o turno
// nem faz check-out: a pergunta existe para isso aparecer antes da porta.
// Só roda com o diálogo aberto.

export type PendenciaSaida = { chave: 'checkout' | 'rascunhos' | 'passagens' | 'fila'; texto: string }

export function usePendenciasSaida(aberto: boolean, unidadeId: string | undefined, perfilId: string | undefined, emPlantao: boolean) {
  return useQuery({
    queryKey: ['pendencias-saida', unidadeId, perfilId],
    enabled: aberto && !!unidadeId && !!perfilId && emPlantao,
    staleTime: 0,
    queryFn: async (): Promise<PendenciaSaida[]> => {
      const [presenca, rascunhos, passagens, fila] = await Promise.all([
        supabase
          .from('presenca_plantonista')
          .select('id, checkin_em, checkout_em')
          .eq('unidade_id', unidadeId!)
          .eq('perfil_id', perfilId!)
          .order('checkin_em', { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from('documentos_clinicos')
          .select('id', { count: 'exact', head: true })
          .eq('unidade_id', unidadeId!)
          .eq('autor_id', perfilId!)
          .eq('estado', 'rascunho'),
        supabase
          .from('passagens_plantao')
          .select('id', { count: 'exact', head: true })
          .eq('unidade_id', unidadeId!)
          .eq('de_perfil', perfilId!)
          .eq('situacao', 'aguardando'),
        contar(perfilId!).catch(() => ({ pendentes: 0, recusados: 0 })),
      ])
      const lista: PendenciaSaida[] = []
      const p = presenca.data as { checkin_em: string | null; checkout_em: string | null } | null
      if (p?.checkin_em && !p.checkout_em) lista.push({ chave: 'checkout', texto: 'Check-out ainda não realizado' })
      const r = rascunhos.count ?? 0
      if (r > 0) lista.push({ chave: 'rascunhos', texto: r === 1 ? '1 documento em rascunho, ainda não emitido' : `${r} documentos em rascunho, ainda não emitidos` })
      const s = passagens.count ?? 0
      if (s > 0) lista.push({ chave: 'passagens', texto: s === 1 ? '1 passagem de plantão aguardando aceite' : `${s} passagens de plantão aguardando aceite` })
      // O4: registros sem conexão ainda no aparelho ficam ilegíveis depois de
      // sair, até a mesma pessoa entrar de novo com conexão
      if (fila.pendentes > 0) lista.push({ chave: 'fila', texto: fila.pendentes === 1
        ? '1 registro sem conexão ainda no aparelho: sobe quando você entrar de novo com conexão'
        : `${fila.pendentes} registros sem conexão ainda no aparelho: sobem quando você entrar de novo com conexão` })
      return lista
    },
  })
}
