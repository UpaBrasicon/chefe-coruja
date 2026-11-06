// Erro de leitura numa tela que pode estar mostrando dados guardados (recarga
// sem conexão, parte 3; achado do teste do RT em 05/11/2026). Falta de rede com
// dados na tela não é erro: a pílula "Sem conexão · dados das HH:MM" já avisa.
// Sem dados, um aviso claro; erro do servidor aparece como veio.
import { ehFalhaDeRede } from './sessaoSemRede.ts'

export const SEM_CONEXAO_SEM_DADOS = 'Sem conexão: esta lista não foi aberta neste aparelho antes da queda. Ela volta quando a conexão voltar.'

export function erroDeLeitura(erro: unknown, temDados: boolean): string | null {
  if (!erro) return null
  if (ehFalhaDeRede(erro)) return temDados ? null : SEM_CONEXAO_SEM_DADOS
  if (erro instanceof Error) return erro.message
  return String((erro as { message?: string })?.message ?? erro)
}
