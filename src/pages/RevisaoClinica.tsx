import { useState } from 'react'
import { SquareCheckBig } from 'lucide-react'
import { Link } from 'react-router-dom'

import { ROTA_DA_FICHA } from '@/clinico/indice'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { useDecidirVersao, useFilaAprovacao, useMeuPapelTecnico } from '@/hooks/useFerramentaClinica'

const PUBLICO: Record<string, string> = { adulto: 'Adulto', pediatrico: 'Pediatria', ambos: 'Adulto e pediatria' }

type Fonte = { citacao: string; url?: string; pediatrica?: boolean }

/**
 * Revisão Clínica — fila do responsável técnico médico: cada versão de regra
 * da camada base espera aqui a aprovação nominal (Fase 5). Reprovar exige a
 * correção descrita.
 */
export default function RevisaoClinica() {
  const { data: papeis, isLoading } = useMeuPapelTecnico()
  const rt = papeis?.find((p) => p.tipo === 'medico')
  const { data: fila } = useFilaAprovacao(!!rt)
  const decidir = useDecidirVersao()
  const [notas, setNotas] = useState<Record<string, string>>({})
  const [aviso, setAviso] = useState<{ ok: boolean; texto: string } | null>(null)

  if (isLoading) return null
  if (!rt) {
    return (
      <p className="text-corpo text-tinta-sussurro">
        Esta fila é do responsável técnico médico nomeado pela rede. Seu perfil não tem essa nomeação.
      </p>
    )
  }

  async function decidirItem(ferramenta: string, versao: string, aprovar: boolean) {
    const chave = `${ferramenta}@${versao}`
    try {
      await decidir.mutateAsync({ ferramenta, versao, aprovar, nota: notas[chave] })
      setAviso({ ok: true, texto: aprovar ? 'Versão aprovada.' : 'Versão reprovada com a correção registrada.' })
    } catch (e) {
      setAviso({ ok: false, texto: e instanceof Error ? e.message : 'Não foi possível registrar a decisão.' })
    }
  }

  return (
    <div className="flex flex-col gap-[22px]">
      <header>
        <h1 className="flex items-center gap-2 text-titulo leading-[1.1] font-semibold tracking-[-0.02em] text-tinta">
          <SquareCheckBig className="size-6" aria-hidden /> Revisão Clínica
        </h1>
        <p className="mt-1.5 max-w-2xl text-corpo text-tinta-sussurro">
          Versões de regra da camada base aguardando sua decisão. Sua aprovação fica registrada com o seu nome e {rt.conselho} {rt.registro}/{rt.uf}.
        </p>
      </header>

      {aviso && (
        <p role="status" className={aviso.ok ? 'rounded-lg border border-fio bg-superficie p-3 text-sm text-tinta' : 'rounded-lg border border-critico/30 bg-critico/[0.08] p-3 text-sm text-critico'}>
          {aviso.texto}
        </p>
      )}

      {fila && fila.length === 0 && <p className="text-corpo text-tinta-sussurro">Nada aguardando decisão.</p>}

      {fila?.map((v) => {
        const chave = `${v.ferramenta_id}@${v.versao}`
        const fontes = (v.fontes ?? []) as unknown as Fonte[]
        const nota = notas[chave] ?? ''
        return (
          <Card key={chave}>
            <CardHeader>
              <CardTitle className="flex flex-wrap items-center gap-2 text-base">
                {v.titulo}
                <Badge variant="secondary">versão {v.versao}</Badge>
                <Badge variant="outline">{PUBLICO[v.publico] ?? v.publico}</Badge>
              </CardTitle>
              <CardDescription>
                {v.vigente_versao ? `Substitui a versão aprovada ${v.vigente_versao}.` : 'Primeira versão desta ferramenta.'}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <ul className="flex flex-col gap-1 text-apoio text-tinta">
                {fontes.map((f) => (
                  <li key={f.citacao}>
                    {f.url ? <a href={f.url} target="_blank" rel="noreferrer" className="underline">{f.citacao}</a> : f.citacao}
                    {f.pediatrica && <Badge variant="outline" className="ml-2">fonte pediátrica</Badge>}
                  </li>
                ))}
              </ul>
              {ROTA_DA_FICHA[v.ferramenta_id] && (
                <Link to={ROTA_DA_FICHA[v.ferramenta_id]} className="text-apoio text-acao underline">
                  Abrir a ferramenta para conferir
                </Link>
              )}
              <Textarea
                placeholder="Correção apontada (obrigatória para reprovar)"
                value={nota}
                onChange={(e) => setNotas((n) => ({ ...n, [chave]: e.target.value }))}
              />
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => decidirItem(v.ferramenta_id, v.versao, true)} disabled={decidir.isPending}>
                  Confere — aprovar
                </Button>
                <Button
                  variant="outline"
                  onClick={() => decidirItem(v.ferramenta_id, v.versao, false)}
                  disabled={decidir.isPending || nota.trim().length < 10}
                >
                  Aponta correção — reprovar
                </Button>
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
