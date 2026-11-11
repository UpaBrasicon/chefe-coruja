// Laudo por grupo (pedido do RT de 11/11/2026; G1 a G5 = A): anexar de uma vez
// um único arquivo a vários exames do mesmo grupo (laboratório, ECG e gráficos,
// imagem) que aguardam resultado. Fica nas listas da porta e do leito; o
// registro por exame (ResultadoExame) continua igual, e a retificação, o visto
// e a ciência seguem por exame.
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Files } from 'lucide-react'
import * as React from 'react'

import { AreaDeAnexo } from '@/components/ui/area-de-anexo'
import { Button } from '@/components/ui/button'
import { caminhoLaudo, erroLaudo, LAUDO_MAX_BYTES } from '@/lib/exames'
import { gruposParaLaudo, laudoAceitaFoto, ROTULO_GRUPO_LAUDO, type ExameAguardandoLaudo } from '@/lib/laudoGrupo'
import { supabase } from '@/lib/supabase'
import { Chip } from '@/components/monitor/Pagina'

/** Sobe o arquivo no caminho do primeiro exame e registra o mesmo laudo em todos (registrar_laudo_grupo). */
async function enviarLaudoDoGrupo(ids: string[], arquivo: File): Promise<void> {
  const caminho = caminhoLaudo(ids[0], arquivo.name, Date.now())
  const up = await supabase.storage.from('exames').upload(caminho, arquivo, { contentType: arquivo.type, upsert: false })
  if (up.error) throw up.error
  const { error } = await supabase.rpc('registrar_laudo_grupo', { p_exames: ids, p_pdf_caminho: caminho, p_pdf_nome: arquivo.name })
  if (error) throw error
}

export function LaudoDoGrupo({ pacienteId, episodioId, aoMudar }: { pacienteId: string; episodioId?: string; aoMudar: () => void }) {
  const qc = useQueryClient()
  const chave = ['laudo-grupo', pacienteId, episodioId ?? null]
  const lista = useQuery({
    queryKey: chave,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('exames_aguardando_laudo', { p_paciente: pacienteId, p_episodio: episodioId })
      if (error) throw error
      return (data ?? []) as unknown as ExameAguardandoLaudo[]
    },
  })
  const grupos = gruposParaLaudo(lista.data ?? [])
  const [aberto, setAberto] = React.useState(false)
  const [grupo, setGrupo] = React.useState<string | null>(null)
  const [desmarcados, setDesmarcados] = React.useState<Set<string>>(new Set())
  const [arquivo, setArquivo] = React.useState<File | null>(null)
  const [erro, setErro] = React.useState<string | null>(null)
  const [aviso, setAviso] = React.useState<string | null>(null)
  const [gravando, setGravando] = React.useState(false)

  if (grupos.length === 0) return aviso ? <p role="status" className="px-4 py-2 text-apoio text-conforme">{aviso}</p> : null

  const atual = grupos.find((g) => g.grupo === grupo) ?? grupos[0]
  const marcados = atual.exames.filter((e) => !desmarcados.has(e.id))
  const aceitaFoto = laudoAceitaFoto(marcados)
  const escolherGrupo = (g: string) => { setGrupo(g); setDesmarcados(new Set()); setArquivo(null); setErro(null) }
  const alternar = (id: string) => setDesmarcados((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n })

  const registrar = async () => {
    if (!arquivo || marcados.length < 2) return
    const problema = erroLaudo(arquivo, aceitaFoto)
    if (problema) return setErro(problema)
    setErro(null)
    setGravando(true)
    try {
      await enviarLaudoDoGrupo(marcados.map((e) => e.id), arquivo)
      setAviso(`Laudo registrado em ${marcados.length} exames de ${ROTULO_GRUPO_LAUDO[atual.grupo].toLowerCase()}.`)
      setAberto(false); setArquivo(null); setDesmarcados(new Set())
      void qc.invalidateQueries({ queryKey: ['laudo-grupo'] })
      aoMudar()
    } catch (e) {
      setErro((e as Error).message)
    } finally {
      setGravando(false)
    }
  }

  if (!aberto) {
    return (
      <div className="flex flex-wrap items-center gap-2 px-4 py-2">
        <Button size="xs" variant="outline" onClick={() => { setAberto(true); setAviso(null) }}>
          <Files /> Anexar laudo de vários exames
        </Button>
        {aviso && <span role="status" className="text-apoio text-conforme">{aviso}</span>}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2 rounded-controle border border-fio p-3 mx-4 my-2">
      <p className="text-controle font-medium text-tinta">Um laudo para vários exames</p>
      <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Grupo do laudo">
        {grupos.map((g) => (
          <Chip key={g.grupo} radio ativo={g.grupo === atual.grupo} onClick={() => escolherGrupo(g.grupo)}>
            {ROTULO_GRUPO_LAUDO[g.grupo]} ({g.exames.length})
          </Chip>
        ))}
      </div>
      <fieldset className="flex flex-col gap-1">
        <legend className="text-rotulo text-tinta-sussurro">Exames que recebem este arquivo</legend>
        {atual.exames.map((e) => (
          <label key={e.id} className="flex items-center gap-2 text-apoio">
            <input type="checkbox" className="size-4" checked={!desmarcados.has(e.id)} onChange={() => alternar(e.id)} disabled={gravando} />
            {e.exame}
          </label>
        ))}
      </fieldset>
      <AreaDeAnexo
        id={`laudo-grupo-${pacienteId}`}
        rotulo={aceitaFoto ? 'Laudo ou imagem' : 'Laudo'}
        descricao={aceitaFoto ? 'PDF, JPG ou PNG, até 10 MB' : 'PDF até 10 MB'}
        accept={aceitaFoto ? 'application/pdf,image/jpeg,image/png' : 'application/pdf'}
        maxBytes={LAUDO_MAX_BYTES}
        validar={(f) => erroLaudo(f, aceitaFoto)}
        disabled={gravando}
        valor={arquivo}
        onArquivos={(fs) => setArquivo(fs[0] ?? null)}
        onRemover={() => setArquivo(null)}
      />
      <p className="text-rotulo text-tinta-sussurro">Exame que já tem resultado não aparece aqui: para trocar o laudo dele, use Retificar no próprio exame.</p>
      {erro && <p role="alert" className="text-critico">{erro}</p>}
      <div className="flex justify-end gap-2">
        <Button size="sm" variant="ghost" onClick={() => { setAberto(false); setErro(null) }} disabled={gravando}>Voltar</Button>
        <Button size="sm" disabled={!arquivo || marcados.length < 2 || gravando} onClick={() => void registrar()}>
          {gravando ? 'Registrando…' : `Registrar em ${marcados.length} exames`}
        </Button>
      </div>
    </div>
  )
}
