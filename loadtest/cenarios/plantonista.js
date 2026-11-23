// Jornada do plantonista (60% dos VUs). RPCs conferidas em src/types/database.ts.
// Divergências vs. o prompt (o código manda): acuidade_dos_pacientes/alergias_dos_pacientes
// (em lote) não existem → tendencia_acuidade(p_paciente) e alergias_paciente(p_paciente),
// por paciente.
import { rpc } from '../lib/supa.js'
import { DADOS, aleatorio, pacienteDoSetor } from '../lib/dados.js'
import { pausa, ESCRITA } from '../lib/config.js'

const TERMOS = ['car', 'pac', 'sil', 'san', 'oli', 'fer', 'rod', 'alm', 'cos', 'lim']

export function plantonista(token, setor) {
  const u = DADOS.unidade
  rpc(token, 'meu_plantao_agora', {})
  rpc(token, 'minhas_notificacoes', { p_unidade: u })
  pausa()

  rpc(token, 'situacao_leitos', { p_unidade: u })
  rpc(token, 'painel_observacao', { p_unidade: u })
  pausa()

  // Paciente do setor em que o médico está escalado (as RPCs recusam os outros).
  // alergias_paciente é tabela; a RPC da tela é alergias_do_paciente.
  const pac = pacienteDoSetor(setor)
  if (pac) {
    rpc(token, 'tendencia_acuidade', { p_paciente: pac })
    rpc(token, 'alergias_do_paciente', { p_paciente: pac })
    rpc(token, 'prescricao_vigente', { p_paciente: pac })
  }
  pausa()

  // Busca no catálogo, como a prescrição faz (PrescricaoEstruturada.tsx:440).
  // A tabela medicamento não tem coluna "nome": o GET direto dava 400.
  rpc(token, 'buscar_medicamento', { p_unidade: u, p_termo: aleatorio(TERMOS) })
  pausa()

  // Escrita: prescrição em 15% das visitas (só com -e ESCRITA=1). A tela usa
  // prescrever(p_paciente, p_item), um item por chamada (PrescricaoEstruturada.tsx:546).
  // registrar_prescricao_itens é legado e só a service_role executa (403 com JWT).
  // Item de cuidado: sem catálogo, sem idade e peso, sem a trava de dois "Agora".
  // ATENÇÃO: prescrição é só inserção (guarda de 20 anos); a massa de carga fica para sempre.
  if (ESCRITA && pac && Math.random() < 0.15) {
    rpc(
      token,
      'prescrever',
      { p_paciente: pac, p_item: { tipo: 'cuidado', descricao: 'LOADTEST cuidado de carga' } },
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
