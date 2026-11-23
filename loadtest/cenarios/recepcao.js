// Jornada da recepção/porta (10% dos VUs).
import { rpc } from '../lib/supa.js'
import { DADOS, aleatorio } from '../lib/dados.js'
import { pausa, ESCRITA } from '../lib/config.js'

const TERMOS = ['car', 'pac', 'sil', 'san', 'oli', 'fer', 'rod', 'alm']

export function recepcao(token) {
  rpc(token, 'fila_da_porta', { p_setor: DADOS.setorPorta }) // a recepção está escalada na Porta
  pausa()

  rpc(token, 'buscar_pacientes', { p_unidade: DADOS.unidade, p_termo: aleatorio(TERMOS) })
  pausa()

  // Ficha da porta em 5% das visitas (só com -e ESCRITA=1): a tela da recepção
  // chama registrar_ficha (Recepcao.tsx:536), que cria paciente e episódio na fila
  // da triagem. Exige setor de emergência em que a recepção esteja escalada agora.
  // Sem CPF, CNS e nascimento: não há conferência de duplicata.
  // ATENÇÃO: paciente e episódio são só inserção; ficam para sempre.
  if (ESCRITA && Math.random() < 0.05) {
    const n = Math.floor(Math.random() * 1e6)
    rpc(
      token,
      'registrar_ficha',
      {
        p_setor: DADOS.setorPorta,
        p_queixa: 'LOADTEST queixa de carga',
        p_dados: { nome: `PACIENTE CARGA ${n}` },
        p_prioridades: [],
        p_outra_pessoa: false,
      },
      { tipo: 'escrita' },
    )
  }
}
