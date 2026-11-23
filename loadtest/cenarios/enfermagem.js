// Jornada da enfermagem (20% dos VUs).
import { rpc } from '../lib/supa.js'
import { DADOS, pacienteDoSetor } from '../lib/dados.js'
import { pausa } from '../lib/config.js'

export function enfermagem(token, setor) {
  const u = DADOS.unidade
  rpc(token, 'enfermagem_leitos', { p_unidade: u })
  pausa()

  // Só o setor em que a enfermagem está escalada agora (a RPC recusa os outros).
  rpc(token, 'enfermagem_pacientes_do_setor', { p_setor: setor })
  pausa()

  rpc(token, 'fila_checagem', {})
  const pac = pacienteDoSetor(setor)
  if (pac) rpc(token, 'prescricao_vigente', { p_paciente: pac })
  pausa()
}
