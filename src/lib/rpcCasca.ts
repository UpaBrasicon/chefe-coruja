import { supabase } from '@/lib/supabase'
import { criarCompartilhada } from '@/lib/chamadaCompartilhada'

// Leituras da casca que várias partes da tela pedem ao mesmo tempo (item 03 do
// kit de desempenho). Cada uma vira uma chamada só por recarga; quem pede de
// novo em até 15 s recebe a mesma resposta. Os intervalos de atualização das
// telas (30 s e 60 s) continuam valendo. Sair ou trocar de pessoa limpa tudo
// (limparCompartilhadas, no AuthContext).
const VALIDADE_MS = 15_000

const plantao = criarCompartilhada(() => supabase.rpc('meu_plantao_agora'), { validadeMs: VALIDADE_MS })
const turno = criarCompartilhada(() => supabase.rpc('turno_atual'), { validadeMs: VALIDADE_MS })
const setores = criarCompartilhada(() => supabase.rpc('setores_na_escala_agora'), { validadeMs: VALIDADE_MS })

/** Mesmo retorno de `supabase.rpc('meu_plantao_agora')`, compartilhado. */
export const meuPlantaoAgora = () => plantao.ler()
/** Mesmo retorno de `supabase.rpc('turno_atual')`, compartilhado. */
export const turnoAtual = () => turno.ler()
/** Mesmo retorno de `supabase.rpc('setores_na_escala_agora')`, compartilhado. */
export const setoresNaEscalaAgora = () => setores.ler()
