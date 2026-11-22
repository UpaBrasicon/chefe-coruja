// Jornada do gestor (10% dos VUs). Divergência importante vs. o prompt:
// painel_gestor/panorama_gestor/mapa_leitos_gestor NÃO existem. O painel real do
// gestor é painel_organizacao(p_dias) (escopo pelo JWT, sem p_unidade); o resto
// usa ocupacao_setores, situacao_leitos, escala_mes_gestor, presencas_do_dia_gestor.
import { rpc } from '../lib/supa.js'
import { DADOS } from '../lib/dados.js'
import { pausa } from '../lib/config.js'

export function gestor(token) {
  const u = DADOS.unidade
  rpc(token, 'painel_organizacao', { p_dias: 7 })
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
