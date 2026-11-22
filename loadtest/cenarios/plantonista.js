// Jornada do plantonista (60% dos VUs). RPCs conferidas em src/types/database.ts.
// Divergências vs. o prompt (o código manda): acuidade_dos_pacientes/alergias_dos_pacientes
// (em lote) não existem → tendencia_acuidade(p_paciente) e alergias_paciente(p_paciente),
// por paciente.
import { rpc, select } from '../lib/supa.js'
import { DADOS, aleatorio } from '../lib/dados.js'
import { pausa, ESCRITA } from '../lib/config.js'

const TERMOS = ['car', 'pac', 'sil', 'san', 'oli', 'fer', 'rod', 'alm', 'cos', 'lim']

export function plantonista(token) {
  const u = DADOS.unidade
  rpc(token, 'meu_plantao_agora', {})
  rpc(token, 'minhas_notificacoes', { p_unidade: u })
  pausa()

  rpc(token, 'situacao_leitos', { p_unidade: u })
  rpc(token, 'painel_observacao', { p_unidade: u })
  pausa()

  const pac = aleatorio(DADOS.pacientes)
  rpc(token, 'tendencia_acuidade', { p_paciente: pac })
  rpc(token, 'alergias_paciente', { p_paciente: pac })
  rpc(token, 'prescricao_vigente', { p_paciente: pac })
  pausa()

  // Busca no catálogo de medicamentos (PostgREST direto, ~200 itens)
  select(token, `medicamento?select=id,nome&nome=ilike.*${aleatorio(TERMOS)}*&limit=20`, {
    name: 'get:medicamento',
  })
  pausa()

  // Escrita: prescrição em 15% das visitas (só com -e ESCRITA=1).
  // TODO: confirmar o jsonb p_itens igual ao do front (PrescricaoEstruturada.tsx)
  // antes de ligar a escrita na carga/stress.
  if (ESCRITA && Math.random() < 0.15) {
    rpc(
      token,
      'registrar_prescricao_itens',
      { p_paciente: pac, p_observacoes: 'LOADTEST — prescrição de carga', p_itens: [] },
      { tipo: 'escrita' },
    )
  }

  const hoje = new Date().toISOString().slice(0, 10)
  const d30 = new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10)
  rpc(token, 'escala_da_unidade', { p_unidade: u, p_de: hoje, p_ate: d30 })
  pausa()

  // Chat em 10% das visitas.
  if (DADOS.conversas && DADOS.conversas.length) {
    rpc(token, 'contatos_chat', {})
    if (ESCRITA && Math.random() < 0.1) {
      rpc(
        token,
        'enviar_mensagem',
        { p_conversa_id: aleatorio(DADOS.conversas), p_corpo: 'LOADTEST ping' },
        { tipo: 'escrita' },
      )
    }
  }
}
