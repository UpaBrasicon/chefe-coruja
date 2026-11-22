// Jornada da enfermagem (20% dos VUs).
import { rpc } from '../lib/supa.js'
import { DADOS, aleatorio } from '../lib/dados.js'
import { pausa } from '../lib/config.js'

export function enfermagem(token) {
  const u = DADOS.unidade
  rpc(token, 'enfermagem_leitos', { p_unidade: u })
  pausa()

  rpc(token, 'enfermagem_pacientes_do_setor', { p_setor: aleatorio(DADOS.setores) })
  pausa()

  rpc(token, 'fila_checagem', {})
  rpc(token, 'prescricao_vigente', { p_paciente: aleatorio(DADOS.pacientes) })
  pausa()
}
