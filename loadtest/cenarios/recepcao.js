// Jornada da recepção/porta (10% dos VUs).
import { rpc } from '../lib/supa.js'
import { DADOS, aleatorio } from '../lib/dados.js'
import { pausa, ESCRITA } from '../lib/config.js'

const TERMOS = ['car', 'pac', 'sil', 'san', 'oli', 'fer', 'rod', 'alm']

export function recepcao(token) {
  rpc(token, 'fila_da_porta', { p_setor: aleatorio(DADOS.setores) })
  pausa()

  rpc(token, 'buscar_pacientes', { p_unidade: DADOS.unidade, p_termo: aleatorio(TERMOS) })
  pausa()

  // Cadastro de paciente em 5% das visitas (só com -e ESCRITA=1), sempre
  // "PACIENTE CARGA" com documento inválido. Payload igual ao do front
  // (SeletorPaciente.tsx): p_dados (jsonb do cadastro) + p_setor + p_outra_pessoa.
  if (ESCRITA && Math.random() < 0.05) {
    const n = Math.floor(Math.random() * 1e6)
    rpc(
      token,
      'salvar_cadastro_paciente',
      {
        p_dados: { nome: `PACIENTE CARGA ${n}`, sem_documento: true },
        p_setor: aleatorio(DADOS.setores),
        p_outra_pessoa: false,
      },
      { tipo: 'escrita' },
    )
  }
}
