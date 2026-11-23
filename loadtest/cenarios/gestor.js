// Jornada do gestor (10% dos VUs). painel_organizacao só devolve linhas para
// admin (conferido em 23/11/2026); o painel do gestor é painel_gestor(p_unidade).
import { rpc } from '../lib/supa.js'
import { DADOS } from '../lib/dados.js'
import { pausa } from '../lib/config.js'

export function gestor(token) {
  const u = DADOS.unidade
  rpc(token, 'painel_gestor', { p_unidade: u })
  pausa()

  rpc(token, 'ocupacao_setores', { p_unidade: u })
  rpc(token, 'situacao_leitos', { p_unidade: u })
  pausa()

  const agora = new Date()
  rpc(token, 'escala_mes_gestor', {
    p_unidade: u,
    p_ano: agora.getFullYear(),
    p_mes: agora.getMonth() + 1,
  }) // leitura pesada: vigie o p95
  rpc(token, 'presencas_do_dia_gestor', { p_unidade: u })
  pausa()
}
