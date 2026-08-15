import { useState } from 'react'

import { ToolLayout } from '@/components/plantonista/ToolLayout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

type Item = { label: string; opcoes: { rotulo: string; pontos: number }[] }

const itens: Item[] = [
  { label: 'Nível de consciência', opcoes: [{ rotulo: 'Alerta', pontos: 0 }, { rotulo: 'Agitado ao mínimo estímulo', pontos: 1 }, { rotulo: 'Requer estímulo repetido', pontos: 2 }, { rotulo: 'Coma', pontos: 3 }] },
  { label: 'Orientação (mês e idade)', opcoes: [{ rotulo: 'Responde os 2 corretamente', pontos: 0 }, { rotulo: 'Responde 1 corretamente', pontos: 1 }, { rotulo: 'Ambos errados', pontos: 2 }] },
  { label: 'Comandos (abre/fecha olhos)', opcoes: [{ rotulo: 'Obedece os 2', pontos: 0 }, { rotulo: 'Obedece 1', pontos: 1 }, { rotulo: 'Ambos errados', pontos: 2 }] },
  { label: 'Melhor contemplação', opcoes: [{ rotulo: 'Normal', pontos: 0 }, { rotulo: 'Paralisia parcial', pontos: 1 }, { rotulo: 'Desvio forçado', pontos: 2 }] },
  { label: 'Campo visual', opcoes: [{ rotulo: 'Nenhuma perda', pontos: 0 }, { rotulo: 'Hemianopsia parcial', pontos: 1 }, { rotulo: 'Hemianopsia completa', pontos: 2 }, { rotulo: 'Hemianopsia bilateral / cego', pontos: 3 }] },
  { label: 'Paresia facial', opcoes: [{ rotulo: 'Movimento simétrico normal', pontos: 0 }, { rotulo: 'Paralisia menor', pontos: 1 }, { rotulo: 'Paralisia parcial', pontos: 2 }, { rotulo: 'Paralisia completa', pontos: 3 }] },
  { label: 'Função motora — braço direito', opcoes: [{ rotulo: 'Normal', pontos: 0 }, { rotulo: 'Deslocamento', pontos: 1 }, { rotulo: 'Algum esforço contra a gravidade', pontos: 2 }, { rotulo: 'Nenhum esforço', pontos: 3 }, { rotulo: 'Nenhum movimento', pontos: 4 }, { rotulo: 'Amputado / não testável', pontos: 0 }] },
  { label: 'Função motora — braço esquerdo', opcoes: [{ rotulo: 'Normal', pontos: 0 }, { rotulo: 'Deslocamento', pontos: 1 }, { rotulo: 'Algum esforço contra a gravidade', pontos: 2 }, { rotulo: 'Nenhum esforço', pontos: 3 }, { rotulo: 'Nenhum movimento', pontos: 4 }, { rotulo: 'Amputado / não testável', pontos: 0 }] },
  { label: 'Função motora — perna direita', opcoes: [{ rotulo: 'Normal', pontos: 0 }, { rotulo: 'Deslocamento', pontos: 1 }, { rotulo: 'Algum esforço contra a gravidade', pontos: 2 }, { rotulo: 'Nenhum esforço', pontos: 3 }, { rotulo: 'Nenhum movimento', pontos: 4 }, { rotulo: 'Amputado / não testável', pontos: 0 }] },
  { label: 'Função motora — perna esquerda', opcoes: [{ rotulo: 'Normal', pontos: 0 }, { rotulo: 'Deslocamento', pontos: 1 }, { rotulo: 'Algum esforço contra a gravidade', pontos: 2 }, { rotulo: 'Nenhum esforço', pontos: 3 }, { rotulo: 'Nenhum movimento', pontos: 4 }, { rotulo: 'Amputado / não testável', pontos: 0 }] },
  { label: 'Ataxia dos membros', opcoes: [{ rotulo: 'Nenhum', pontos: 0 }, { rotulo: 'Um membro', pontos: 1 }, { rotulo: 'Dois membros', pontos: 2 }] },
  { label: 'Sensibilidade à picada', opcoes: [{ rotulo: 'Normal', pontos: 0 }, { rotulo: 'Redução suave a moderada', pontos: 1 }, { rotulo: 'Perda grave a total', pontos: 2 }] },
  { label: 'Língua (afasia)', opcoes: [{ rotulo: 'Nenhuma afasia', pontos: 0 }, { rotulo: 'Afasia suave a moderada', pontos: 1 }, { rotulo: 'Afasia grave', pontos: 2 }, { rotulo: 'Nenhuma produção de discurso', pontos: 3 }] },
  { label: 'Disartria', opcoes: [{ rotulo: 'Nenhuma', pontos: 0 }, { rotulo: 'Gaguejo suave a moderado', pontos: 1 }, { rotulo: 'Grave', pontos: 2 }, { rotulo: 'Intubado / impedimento físico', pontos: 2 }] },
  { label: 'Extinção e desatenção', opcoes: [{ rotulo: 'Normal', pontos: 0 }, { rotulo: 'Desatenção em uma modalidade', pontos: 1 }, { rotulo: 'Hemidesatenção severa', pontos: 2 }] },
]

function ItemSelect({ item, valor, set }: { item: Item; valor: number; set: (i: number) => void }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label className="text-sm">{item.label}</Label>
      <Select value={String(valor)} onValueChange={(v) => set(Number(v ?? 0))}>
        <SelectTrigger className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {item.opcoes.map((o, i) => (
            <SelectItem key={i} value={String(i)}>{o.rotulo}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

export function NihAvc() {
  const [valores, setValores] = useState<number[]>(() => itens.map(() => 0))

  function set(i: number, v: number) {
    setValores((prev) => prev.map((p, idx) => (idx === i ? v : p)))
  }

  const total = itens.reduce((s, item, i) => s + item.opcoes[valores[i]].pontos, 0)

  return (
    <ToolLayout
      title="Classificação de AVC — NIH (NIHSS)"
      description="Escala para mensurar o déficit neurológico no AVC agudo."
    >
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-3 text-base">
            NIH =
            <Badge className="text-lg">{total}</Badge>
            <Badge variant={total >= 22 ? 'destructive' : total >= 16 ? 'warning' : total >= 6 ? 'info' : 'success'}>
              {total >= 22 ? 'Muito significativo' : total >= 16 ? 'Grave' : total >= 6 ? 'Moderado' : 'Leve'}
            </Badge>
          </CardTitle>
          <CardDescription>
            NIH &gt; 22 é muito significativo e pode prever maior risco de complicações.
          </CardDescription>
        </CardHeader>
      </Card>

      <Card>
        <CardContent className="grid gap-4 pt-6 md:grid-cols-2">
          {itens.map((item, i) => (
            <ItemSelect key={item.label} item={item} valor={valores[i]} set={(v) => set(i, v)} />
          ))}
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        ☞ Membro não testável por amputação ou outra limitação → não pontua. Referência: Brott T, et al.
        Stroke. 1989;20(7):864-70.
      </p>
    </ToolLayout>
  )
}
