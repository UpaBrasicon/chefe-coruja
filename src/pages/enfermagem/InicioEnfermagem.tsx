// ─────────────────────────────────────────────────────────────────────────────
// Tela inicial do técnico de enfermagem: segue a escala de agora. Quem está
// só em setores de internação (internação, UTI, isolamento) começa na
// Internação da enfermagem; quem está na porta ou na observação, ou sem escala
// agora, começa no Pronto Socorro da enfermagem (protótipo INICIO_PAPEL), que
// aponta para a Internação quando a escala também tem setor de internação.
// ─────────────────────────────────────────────────────────────────────────────
import { Navigate } from 'react-router-dom'

import { EsqueletoLinhas } from '@/components/ui/esqueleto-linhas'

import { TIPOS_INTERNACAO, useTiposDaEscala } from './useEnfermagem'

export default function InicioEnfermagem() {
  const { carregando, tipos } = useTiposDaEscala()
  if (carregando) return <EsqueletoLinhas linhas={4} rotulo="Carregando a sua escala…" />
  const soInternacao = tipos.length > 0 && tipos.every((t) => TIPOS_INTERNACAO.includes(t))
  return <Navigate to={soInternacao ? '/enfermagem/internacao' : '/enfermagem/pronto-socorro'} replace />
}
