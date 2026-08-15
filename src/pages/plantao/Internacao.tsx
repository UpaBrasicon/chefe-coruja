import { CheckCircle2, ChevronRight, ClipboardPlus, Eraser } from 'lucide-react'
import { Link } from 'react-router-dom'

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useAuth } from '@/contexts/AuthContext'
import { useUnidade } from '@/contexts/UnidadeContext'
import { Button } from '@/components/ui/button'
import { DadosPaciente } from './shared/DadosPaciente'
import { useEscalaSetores } from './shared/useEscalaSetores'
import { PrescricaoTab } from './internacao/PrescricaoTab'
import { EvolucaoTab } from './internacao/EvolucaoTab'
import { ExamesTab } from './internacao/ExamesTab'
import { InternacaoTab } from './internacao/InternacaoTab'
import { ExportarTab } from './internacao/ExportarTab'
import { useRascunho } from './internacao/rascunho'

export default function Internacao() {
  const { unidadeAtiva } = useUnidade()
  const { perfil } = useAuth()
  const unidadeId = unidadeAtiva?.unidade_id
  const perfilId = perfil?.id

  const { dados, atualizar, salvoEm, limpar } = useRascunho(unidadeId, perfilId)
  const { data: escalaSetores } = useEscalaSetores(unidadeId, perfilId)

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-1 text-sm text-muted-foreground">
          <Link to="/plantao" className="transition-colors hover:text-foreground">
            Central de Plantão
          </Link>
          <ChevronRight className="size-3.5" />
          <span className="font-medium text-foreground">Internação</span>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">Internação</h1>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            {salvoEm && (
              <span className="inline-flex items-center gap-1 text-emerald-700">
                <CheckCircle2 className="size-3.5" /> Salvo às {salvoEm}
              </span>
            )}
            <Button variant="outline" size="xs" onClick={limpar}>
              <Eraser /> Limpar rascunho
            </Button>
          </div>
        </div>
        <p className="text-sm text-muted-foreground">
          Preencha os dados do paciente acima e navegue pelas abas. Cada aba salva automaticamente e
          tudo fica pronto para exportar em PDF na última aba.
        </p>
      </div>

      <DadosPaciente
        unidadeId={unidadeId}
        perfilId={perfilId}
        dados={dados.paciente}
        onChange={(p) => atualizar({ paciente: { ...dados.paciente, ...p } })}
        escalaSetores={escalaSetores}
      />

      <Tabs defaultValue="prescricao">
        <TabsList variant="line" className="w-full">
          <TabsTrigger value="prescricao">💊 Prescrição</TabsTrigger>
          <TabsTrigger value="evolucao">📝 Evolução/Admissão</TabsTrigger>
          <TabsTrigger value="exames">🩸 Pedidos de Exames</TabsTrigger>
          <TabsTrigger value="internacao">🏥 Internação</TabsTrigger>
          <TabsTrigger value="exportar">📥 Exportar PDF</TabsTrigger>
        </TabsList>

        <TabsContent value="prescricao">
          <PrescricaoTab
            dados={dados.paciente}
            prescricao={dados.prescricao}
            onChange={(p) => atualizar({ prescricao: { ...dados.prescricao, ...p } })}
          />
        </TabsContent>

        <TabsContent value="evolucao">
          <EvolucaoTab
            dados={dados.paciente}
            evolucao={dados.evolucao}
            onChange={(p) => atualizar({ evolucao: { ...dados.evolucao, ...p } })}
          />
        </TabsContent>

        <TabsContent value="exames">
          <ExamesTab
            dados={dados.paciente}
            exames={dados.exames}
            onChange={(p) => atualizar({ exames: { ...dados.exames, ...p } })}
          />
        </TabsContent>

        <TabsContent value="internacao">
          <InternacaoTab
            dados={dados.paciente}
            aih={dados.aih}
            evolucao={dados.evolucao}
            exames={dados.exames}
            onChange={(p) => atualizar({ aih: { ...dados.aih, ...p } })}
          />
        </TabsContent>

        <TabsContent value="exportar">
          <ExportarTab
            dados={dados.paciente}
            prescricao={dados.prescricao}
            evolucao={dados.evolucao}
            exames={dados.exames}
            aih={dados.aih}
          />
        </TabsContent>
      </Tabs>

      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <ClipboardPlus className="size-3.5" /> Rascunho salvo automaticamente no navegador (somente
        neste dispositivo). Persistência no Supabase será adicionada em etapa futura.
      </p>
    </div>
  )
}
