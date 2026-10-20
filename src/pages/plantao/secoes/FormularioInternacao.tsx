import { Navigate, useSearchParams } from 'react-router-dom'

import { rotaDoLeito } from '@/components/internacao/rotas'

// O formulário de internação antigo saiu (guia do padrão 5.4, parte 4.7a). O
// endereço continua valendo para favoritos e links antigos: leva ao leito
// aberto do paciente na lista de internados.
export default function RedirecionarFormulario() {
  const [params] = useSearchParams()
  return <Navigate to={rotaDoLeito(params.get('paciente'))} replace />
}
