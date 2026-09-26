import { clsx, type ClassValue } from 'clsx'
import { extendTailwindMerge } from 'tailwind-merge'

// O tailwind-merge precisa conhecer os tokens do Monitor de Cabeceira
// (src/index.css): sem isso ele lê `text-apoio text-tinta` como duas cores e
// descarta o tamanho, e `rounded-controle` como um valor desconhecido.
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      text: ['rotulo', 'apoio', 'corpo', 'secao', 'titulo', 'numeral-ok', 'numeral-atencao', 'numeral-critico'],
      radius: ['controle-sm', 'controle', 'container', 'cartao', 'capsula'],
      shadow: ['repouso', 'halo', 'halo-ferramenta', 'dialogo', 'desfazer', 'lateral'],
      color: [
        'acao', 'acao-pressionada', 'marca', 'leitos', 'observacao', 'turno', 'suprimento',
        'ok', 'atencao', 'critico', 'conforme', 'tinta', 'tinta-apoio', 'tinta-sussurro',
        'grafite', 'superficie', 'campo', 'trilha', 'fio', 'fio-forte', 'pediatria',
        'mts-vermelho', 'mts-laranja', 'mts-amarelo', 'mts-amarelo-texto', 'mts-verde', 'mts-azul',
      ],
    },
  },
})

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Escapa caracteres HTML de dados externos (anti-XSS) antes de interpolar em
 * templates/innerHTML. Usado na geração de documentos (PDF/impressão).
 */
export function escapeHtml(s: string | null | undefined): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
