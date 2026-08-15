import { useState } from 'react'
import { Check, Copy } from 'lucide-react'

import { Button } from '@/components/ui/button'

export function CopyResult({ texto, rotulo = 'Copiar' }: { texto: string; rotulo?: string }) {
  const [copiado, setCopiado] = useState(false)

  async function copiar() {
    try {
      await navigator.clipboard.writeText(texto)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2000)
    } catch {
      setCopiado(false)
    }
  }

  return (
    <Button variant="outline" size="sm" onClick={copiar}>
      {copiado ? <Check className="text-emerald-600" /> : <Copy />}
      {copiado ? 'Copiado!' : rotulo}
    </Button>
  )
}
