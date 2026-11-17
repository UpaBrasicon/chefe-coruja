import { useState } from 'react'

import { fichaAcessoVenoso, NOTA_ACESSO_9A_EDICAO, recomendarAcesso, type EntradaAcesso } from '@/clinico/acessoVenoso'
import { textoFontes } from '@/clinico/ficha'
import { passosDaFaixa } from '@/clinico/guia'
import { guiaDa } from '@/clinico/guias'
import { Chip } from '@/components/monitor/Pagina'
import { AbasResultado } from '@/components/plantonista/calc/AbasResultado'
import { ID_ABAS_RESULTADO, type IdAba } from '@/components/plantonista/calc/contexto'
import { ResumoFlutuante } from '@/components/plantonista/calc/ResumoFlutuante'
import { SemReferenciaPediatrica } from '@/components/plantonista/SemReferenciaPediatrica'
import { ToolLayout } from '@/components/plantonista/ToolLayout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { textoCopia } from '@/domain/copiaCalculo'

type Opcao = { valor: string; label: string }

const PERFIL: Opcao[] = [{ valor: 'adulto', label: 'Adulto (14 anos ou mais)' }, { valor: 'crianca', label: 'Criança (menos de 14 anos)' }]
const TERAPIA: Opcao[] = [{ valor: 'curta', label: 'Curta (≤ 6 dias)' }, { valor: 'longa', label: 'Longa (> 6 dias)' }]
const CARACTERISTICA: Opcao[] = [{ valor: 'nao', label: 'Compatível com via periférica' }, { valor: 'irritante', label: 'Irritante / vesicante' }, { valor: 'osmolaridade', label: 'Osmolaridade alta (> 900 mOsm/L)' }]
const REDE: Opcao[] = [{ valor: 'boa', label: 'Boa rede venosa' }, { valor: 'ruim', label: 'Rede venosa comprometida / sem acesso periférico' }]
const URGENCIA: Opcao[] = [{ valor: 'urgente', label: 'Emergencial (instabilidade)' }, { valor: 'programada', label: 'Não urgente' }]

const ULTRASSOM = 'Considerar ultrassom para guiar punção quando a rede venosa estiver comprometida.'
const rotulo = (opcoes: Opcao[], valor: string) => opcoes.find((o) => o.valor === valor)?.label ?? ''

function Grupo({ titulo, opcoes, valor, set }: { titulo: string; opcoes: Opcao[]; valor: string; set: (v: string) => void }) {
  return (
    <div className="flex flex-col gap-2">
      <Label className="text-apoio font-semibold">{titulo}</Label>
      <div role="radiogroup" aria-label={titulo} className="flex flex-wrap gap-2">
        {opcoes.map((o) => (
          <Chip key={o.valor} variante="opcao" radio ativo={valor === o.valor} onClick={() => set(o.valor)}>
            {o.label}
          </Chip>
        ))}
      </div>
    </div>
  )
}

export function AcessoVenoso() {
  const [perfil, setPerfil] = useState('')
  const [terapia, setTerapia] = useState('')
  const [caracteristica, setCaracteristica] = useState('')
  const [rede, setRede] = useState('')
  const [urgencia, setUrgencia] = useState('')
  const [aba, setAba] = useState<IdAba>('proximos')
  const guia = guiaDa(fichaAcessoVenoso.id)

  const crianca = perfil === 'crianca'
  const completo = perfil === 'adulto' && terapia && caracteristica && rede && urgencia
  const resultado = completo
    ? recomendarAcesso({
        terapia: terapia as EntradaAcesso['terapia'],
        infusao: (caracteristica === 'nao' ? 'periferica' : caracteristica) as EntradaAcesso['infusao'],
        rede: rede as EntradaAcesso['rede'],
        urgencia: urgencia as EntradaAcesso['urgencia'],
      })
    : null

  // Texto do "Copiar" (C4 = A): as respostas, o dispositivo e o motivo.
  const copia = resultado
    ? textoCopia({
        ferramenta: 'Escolha do acesso venoso (adulto)',
        dados: [
          ['Perfil', rotulo(PERFIL, perfil)],
          ['Terapia', rotulo(TERAPIA, terapia)],
          ['Infusão', rotulo(CARACTERISTICA, caracteristica)],
          ['Rede venosa', rotulo(REDE, rede)],
          ['Urgência', rotulo(URGENCIA, urgencia)],
        ],
        resultado: [`Dispositivo recomendado: ${resultado.dispositivo}`, `Motivo: ${resultado.motivo}`, ULTRASSOM],
        fonte: textoFontes(fichaAcessoVenoso),
        versao: fichaAcessoVenoso.versao,
        quando: new Date(),
      })
    : undefined

  return (
    <ToolLayout
      title="Escolha do Acesso Venoso"
      description="Avalie terapia, duração e rede venosa do adulto para receber uma recomendação estruturada."
      ficha={fichaAcessoVenoso}
    >
      <div className="flex flex-col gap-5">
        <Grupo titulo="1. Perfil do paciente" opcoes={PERFIL} valor={perfil} set={setPerfil} />
        <Grupo titulo="2. Terapia" opcoes={TERAPIA} valor={terapia} set={setTerapia} />
        <Grupo titulo="3. Características da infusão" opcoes={CARACTERISTICA} valor={caracteristica} set={setCaracteristica} />
        <Grupo titulo="4. Rede venosa" opcoes={REDE} valor={rede} set={setRede} />
        <Grupo titulo="5. Urgência" opcoes={URGENCIA} valor={urgencia} set={setUrgencia} />

        {crianca && <SemReferenciaPediatrica detalhe="A escolha de dispositivo nesta tela segue padrão de adulto; o ramo pediátrico e neonatal que existia não tinha fonte e foi retirado." />}

        {!completo && !crianca && (
          <Card>
            <CardContent className="pt-6 text-apoio text-tinta-sussurro">
              Responda todas as etapas para gerar a recomendação.
            </CardContent>
          </Card>
        )}

        {resultado && (
          <Card className="border-acao">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-corpo">
                Dispositivo recomendado
                <Badge className="text-corpo">{resultado.dispositivo}</Badge>
              </CardTitle>
              <CardDescription>{resultado.motivo}</CardDescription>
            </CardHeader>
            <CardContent className="text-apoio text-tinta-sussurro">
              {ULTRASSOM}
            </CardContent>
          </Card>
        )}

        <p role="note" className="rounded-controle border border-atencao/40 bg-alerta-atencao px-3 py-2 text-apoio text-atencao">{NOTA_ACESSO_9A_EDICAO}</p>
      </div>

      <AbasResultado
        aba={aba}
        onAba={setAba}
        passos={passosDaFaixa(guia, undefined)}
        semResultado={!resultado}
        armadilhas={guia?.armadilhas ?? []}
        ficha={fichaAcessoVenoso}
        guia={guia}
      />
      <ResumoFlutuante
        principal={resultado ? resultado.dispositivo : crianca ? 'Sem referência pediátrica' : 'Responda as 5 etapas'}
        detalhe={resultado?.motivo}
        textoCopia={copia}
        alvoDetalhes={ID_ABAS_RESULTADO}
        rotuloDetalhes="Próximos passos"
        aoIrDetalhes={() => setAba('proximos')}
      />
    </ToolLayout>
  )
}
