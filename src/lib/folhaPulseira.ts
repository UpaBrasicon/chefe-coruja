// Folha da pulseira de identificação (lacuna 2; RT 10/11/2026, P6): etiqueta
// do tamanho da pulseira (cerca de 2,5 × 10 cm; RN 2 × 8 cm), letra de 12 pt
// ou mais, sem itálico, numa folha A4 comum para recortar. Não usa o
// cabeçalho das folhas, que traz o leito. Sem dependência do app: roda no
// teste do node.
import type { Pulseira } from '../domain/pulseira.ts'

export function esc(s: unknown): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

const INSTRUCAO = {
  comum: 'Recorte na linha tracejada e prenda na pulseira branca, no punho. Antes de colocar, confira o nome e o nascimento com o paciente ou o acompanhante.',
  rn: 'Recorte na linha tracejada e prenda na pulseira branca, de preferência no tornozelo. Antes de colocar, confira o nome da mãe e o nascimento.',
} as const

/** A folha A4 com a etiqueta e o protocolo da impressão. */
export function folhaPulseira(p: Pulseira, registro: { protocolo: string; emitido: string }): string {
  const linhas = p.linhas
    .map((l) => `<div class="linha${l.destaque ? ' destaque' : ''}">${esc(l.texto)}</div>`)
    .join('')
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Pulseira de identificação</title><style>
@page { size: A4; margin: 12mm; }
* { box-sizing: border-box; }
body { margin: 0; font-family: Arial, Helvetica, sans-serif; color: black; background: white; }
.instrucao { margin: 0 0 4mm; max-width: 150mm; font-size: 10pt; color: dimgray; }
.etiqueta { display: flex; flex-direction: column; justify-content: center; gap: 0.6mm; width: 100mm; min-height: 25mm;
  padding: 2mm 3mm; border: 0.3mm dashed black; break-inside: avoid; }
.etiqueta.rn { width: 80mm; min-height: 20mm; }
.linha { font-size: 12pt; line-height: 1.15; font-style: normal; overflow-wrap: anywhere; }
.destaque { font-size: 13pt; font-weight: 700; }
.registro { margin: 3mm 0 0; font-size: 9pt; color: dimgray; }
</style></head><body>
<p class="instrucao">${esc(INSTRUCAO[p.formato])}</p>
<div class="etiqueta${p.formato === 'rn' ? ' rn' : ''}">${linhas}</div>
<p class="registro">Impressão ${esc(registro.protocolo)} registrada no Chefe Coruja em ${esc(registro.emitido)}</p>
</body></html>`
}
