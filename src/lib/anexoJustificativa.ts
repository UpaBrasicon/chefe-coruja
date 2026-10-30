// Anexo (atestado) da justificativa de falta, no bucket privado `atendimento`.
// A coluna anexo_url guarda o caminho do arquivo; os pedidos antigos guardaram a
// URL pública (que não abre em bucket privado), então os dois formatos valem.
// O arquivo abre com URL assinada na hora (A5, docs/escala/CORRECAO-A5-ATESTADO-FALTA.md).

export const BUCKET_JUSTIFICATIVA = 'atendimento'

/** Caminho do arquivo no bucket a partir do que está em anexo_url (caminho ou URL antiga). */
export function caminhoDoAnexo(anexo: string | null | undefined): string | null {
  const valor = anexo?.trim()
  if (!valor) return null
  if (!/^https?:\/\//i.test(valor)) return valor
  const m = valor.match(/\/storage\/v1\/object\/(?:public|sign|authenticated)\/atendimento\/([^?#]+)/)
  return m ? decodeURIComponent(m[1]) : null
}

/** Onde gravar o anexo: <unidade>/justificativas/<uuid>-<nome sem caracteres estranhos>. */
export function caminhoNovoAnexo(unidadeId: string, nomeArquivo: string, id: string): string {
  const nomeSeguro = nomeArquivo.replace(/[^a-zA-Z0-9._-]/g, '_')
  return `${unidadeId}/justificativas/${id}-${nomeSeguro}`
}
