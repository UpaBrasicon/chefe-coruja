// ─────────────────────────────────────────────────────────────────────────────
// Tela inicial do técnico de enfermagem: segue a escala de agora. Quem está
// só em setores de internação (internação, UTI, isolamento) começa na
// Internação da enfermagem; quem está na porta ou na observação, ou sem escala
// agora, começa no Pronto Socorro da enfermagem (protótipo INICIO_PAPEL), que
// aponta para a Internação quando a escala também tem setor de internação.
// ─────────────────────────────────────────────────────────────────────────────
import { Navigate } from 'react-router-dom'

import { Spinner } from '@/components/ui/spinner'

import { TIPOS_INTERNACAO, useTiposDaEscala } from './useEnfermagem'

export default function InicioEnfermagem() {
  const { carregando, tipos } = useTiposDaEscala()
  if (carregando) return <div className="flex justify-center py-10"><Spinner /></div>
  const soInternacao = tipos.length > 0 && tipos.every((t) => TIPOS_INTERNACAO.includes(t))
  return <Navigate to={soInternacao ? '/enfermagem/internacao' : '/enfermagem/pronto-socorro'} replace />
}
