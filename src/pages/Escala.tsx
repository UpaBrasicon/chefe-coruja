import { Link } from 'react-router-dom'
import { CalendarClock, ChevronRight } from 'lucide-react'

import { useUnidade } from '@/contexts/UnidadeContext'
import { useAuth } from '@/contexts/AuthContext'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default function Escala() {
  const { papelAtivo, unidadeAtiva } = useUnidade()
  const { perfil } = useAuth()

  const ehGestor = papelAtivo === 'gestor'
  const ehAdmin = papelAtivo === 'admin'

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-1 text-sm text-muted-foreground">
          <Link to="/" className="transition-colors hover:text-foreground">
            Início
          </Link>
          <ChevronRight className="size-3.5" />
          <span className="font-medium text-foreground">Escala</span>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">Escala de Plantões</h1>
        <p className="text-sm text-muted-foreground">
          {unidadeAtiva?.unidade.nome ?? 'Unidade'} · {perfil?.nome_completo ?? ''}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <CalendarClock className="size-4 text-muted-foreground" />
            Escala de plantões
          </CardTitle>
          <CardDescription>
            {ehGestor || ehAdmin
              ? 'Monte a escala de plantões da unidade por setor, turno e dia.'
              : 'Consulte a sua escala de plantões e gerencie trocas.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-wrap gap-2">
            {ehGestor && <Badge variant="secondary">Gestor — cria e edita</Badge>}
            {ehAdmin && <Badge variant="secondary">Admin — todas as unidades</Badge>}
            {papelAtivo === 'plantonista' && (
              <Badge variant="secondary">Plantonista — consulta e passa plantão</Badge>
            )}
          </div>

          <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
            <p className="font-medium text-foreground">Em construção</p>
            <p className="mt-1">
              A página de escala será implementada a partir do <strong>modelo em Excel</strong> que
              você vai enviar. O formato seguirá a planilha de escala (setores × turnos × dias ×
              profissionais).
            </p>
            <p className="mt-2 text-xs">
              Depois da escala, virão: passagem de plantão com registro na escala e gatilho de
              mensagem no WhatsApp para quem recebeu o plantão.
            </p>
          </div>

          <p className="text-xs text-muted-foreground">
            Escala atual do servidor: consultada via <code className="rounded bg-muted px-1">turno_atual</code>.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
