// Anexar laudo num campo de texto (provas do laudo de AIH, exames do
// encaminhamento): botão, arrastar e colar sobre o próprio campo. Cada
// arquivo é lido no aparelho e a linha dos pontos principais entra no fim do
// campo — quem prefere digitar continua digitando.
import * as React from 'react'

import { lerLaudo, type AnexoLaudo } from './leituraLaudo'

export function useLeituraLaudo({ nomePaciente, anexos, texto, aplicar }: {
  nomePaciente: string
  anexos: AnexoLaudo[]
  texto: string
  /** grava anexos e o novo texto do campo no rascunho */
  aplicar: (p: { anexos: AnexoLaudo[]; texto?: string }) => void
}) {
  const [lendo, setLendo] = React.useState(false)
  const [arrastando, setArrastando] = React.useState(false)
  // o rascunho muda enquanto a leitura roda: sempre o mais recente
  const atual = React.useRef({ anexos, texto })
  React.useEffect(() => {
    atual.current = { anexos, texto }
  }, [anexos, texto])

  const juntar = (base: string, linha: string) => (base.trim() ? `${base.trim()}\n${linha}` : linha)

  async function ler(files: File[]) {
    if (!files.length) return
    setLendo(true)
    try {
      for (const f of files) {
        const a = await lerLaudo(f, nomePaciente)
        const { anexos: ax, texto: tx } = atual.current
        const novo = { anexos: [...ax, a], texto: a.estado === 'ok' ? juntar(tx, a.resumo) : tx }
        atual.current = novo
        aplicar({ anexos: novo.anexos, texto: a.estado === 'ok' ? novo.texto : undefined })
      }
    } finally {
      setLendo(false)
    }
  }

  function usar(id: string) {
    const { anexos: ax, texto: tx } = atual.current
    const a = ax.find((x) => x.id === id)
    if (!a) return
    aplicar({ anexos: ax.map((x) => (x.id === id ? { ...x, estado: 'ok' } : x)), texto: juntar(tx, a.resumo) })
  }

  function remover(id: string) {
    aplicar({ anexos: atual.current.anexos.filter((x) => x.id !== id) })
  }

  const doCampo = {
    onDragOver: (e: React.DragEvent) => { e.preventDefault(); if (!arrastando) setArrastando(true) },
    onDragLeave: () => setArrastando(false),
    onDrop: (e: React.DragEvent) => {
      const fs = Array.from(e.dataTransfer?.files ?? [])
      setArrastando(false)
      // sem arquivo, o navegador solta o texto no campo: não atrapalhar
      if (!fs.length) return
      e.preventDefault()
      void ler(fs)
    },
    onPaste: (e: React.ClipboardEvent) => {
      const fs = Array.from(e.clipboardData?.files ?? [])
      if (!fs.length) return
      e.preventDefault()
      void ler(fs)
    },
  }

  return { lendo, arrastando, ler, usar, remover, doCampo }
}
