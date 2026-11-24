// Rota /minha-escala: a aba Escala (E3) dos papéis que não são plantonista,
// gestor nem administrador. O conteúdo é src/components/escala/EscalaEquipe.
import * as React from 'react'

import { useUnidade } from '@/contexts/UnidadeContext'
import { EscalaEquipe } from '@/components/escala/EscalaEquipe'
import { TabsPagina, type AbaDef } from '@/components/TabsPagina'

// a "Minha agenda" da telemedicina virou esta Escala; o extrato do plantão remoto fica numa aba
const ExtratoTele = React.lazy(() => import('@/pages/telemedicina/Telemedicina').then((m) => ({ default: m.Extrato })))
// ES3 (RT, 24/11/2026): o Telemonitoramento virou a aba "Cobertura dos setores"
const CoberturaSetores = React.lazy(() => import('@/pages/telemedicina/Telemedicina').then((m) => ({ default: m.CoberturaSetores })))
const ABAS_TELE: AbaDef[] = [
  { valor: 'escala', rotulo: 'Escala', conteudo: () => <EscalaEquipe titulo={false} /> },
  { valor: 'cobertura', rotulo: 'Cobertura dos setores', conteudo: () => <CoberturaSetores /> },
  { valor: 'extrato', rotulo: 'Extrato', conteudo: () => <ExtratoTele /> },
]

export default function EscalaEquipePagina() {
  const { papelAtivo } = useUnidade()
  if (papelAtivo === 'telemedicina') {
    return <TabsPagina titulo="Escala" descricao="Seus plantões remotos, quem cobre cada setor e o extrato do mês" abas={ABAS_TELE} />
  }
  return (
    <div className="mx-auto w-full max-w-6xl">
      <EscalaEquipe />
    </div>
  )
}
