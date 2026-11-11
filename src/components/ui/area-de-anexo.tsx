import { Loader2, Paperclip, Upload, X, type LucideIcon } from 'lucide-react'
import * as React from 'react'

import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { MensagemErro } from '@/components/ui/mensagem-erro'
import { ehNomeDeColagem, nomeDeColado, tamanhoLegivel, triarArquivos } from '@/lib/anexo'
import { cn } from '@/lib/utils'

/**
 * Área de anexo (pedido do RT de 10/11/2026, opção A): arrastar e soltar, colar
 * (Ctrl+V) ou clicar para escolher o arquivo, numa peça só.
 *
 * - **Clique e teclado**: a área é um botão (Enter ou Espaço abre o seletor do
 *   sistema). O `<input type="file">` fica escondido e é zerado depois de cada
 *   escolha, para a mesma pessoa poder escolher o mesmo arquivo de novo. No
 *   celular só o toque vale; o "ou arraste" some. O "Escolher arquivo" aparece
 *   em destaque (cor de ação, com borda), porque o botão do navegador parecia
 *   texto comum (RT, 10/11/2026).
 * - **Colar**: vale quando o foco está na área (clicar nela ou chegar pelo Tab)
 *   ou, se a área está dentro de uma janela (role="dialog"), em qualquer ponto
 *   da janela que não seja campo de texto (no campo de texto, Ctrl+V continua
 *   colando texto). Só reage quando a área de transferência traz arquivo. A
 *   imagem colada (captura de tela) chega como "image.png" e ganha o nome
 *   "colado-<data>-<hora>.png".
 * - **Conferência**: antes de devolver, confere a regra da tela (`validar`), o
 *   tipo contra o `accept` (MIME e extensão) e o tamanho (`maxBytes`). O erro
 *   aparece na hora, sob a área (role="alert"); só os arquivos que passam chegam
 *   a `onArquivos`.
 * - **Escolhidos**: com `valor`, a área mostra o que já foi escolhido. Um
 *   arquivo só: nome, tamanho, "Trocar" e "Remover" no lugar da área. Vários: a
 *   lista com "Remover" em cada um, e a área continua para juntar mais. Sem
 *   `valor` (a tela envia na hora), a área só recebe; `ocupado` mostra o envio.
 */
export function AreaDeAnexo({
  id, rotulo, titulo, descricao, dica, accept, multiple = false, maxBytes, disabled = false, ocupado = false,
  textoOcupado = 'Enviando…', validar, onArquivos, valor, onRemover, compacto = false, icone, className,
}: {
  /** id do botão da área (o rótulo aponta para ele). */
  id: string
  /** Rótulo acima da área ("Anexo (opcional)"). */
  rotulo?: React.ReactNode
  /** Ação em destaque dentro da área ("Enviar lista de medicações"). */
  titulo?: string
  /** Tipos e limite, ligados por aria-describedby ("PDF até 10 MB"). */
  descricao?: string
  /** Texto de ajuda ao passar o mouse. */
  dica?: string
  /** Como no input: "application/pdf,image/*", ".xlsx,.pdf". */
  accept?: string
  multiple?: boolean
  maxBytes?: number
  disabled?: boolean
  /** Enviando: a área fica parada e mostra `textoOcupado`. */
  ocupado?: boolean
  textoOcupado?: string
  /** Regra da tela, com a frase dela (ex.: erroLaudo). */
  validar?: (arquivo: File) => string | null
  /** Os arquivos que passaram na conferência (no modo de um, só um). */
  onArquivos: (arquivos: File[]) => void
  /** O que já foi escolhido, quando a tela guarda antes de enviar. */
  valor?: File | null | readonly File[]
  /** Tirar o escolhido de índice `indice` (no modo de um, sempre 0). */
  onRemover?: (indice: number) => void
  /** Uma linha só, para o topo de uma tela densa (o `titulo` e a instrução curta). */
  compacto?: boolean
  /** Ícone da área (padrão: Upload). */
  icone?: LucideIcon
  className?: string
}) {
  const raiz = React.useRef<HTMLDivElement>(null)
  const entrada = React.useRef<HTMLInputElement>(null)
  const [arrastando, setArrastando] = React.useState(false)
  const [erro, setErro] = React.useState<string | null>(null)
  const parado = disabled || ocupado
  const escolhidos: readonly File[] = valor == null ? [] : Array.isArray(valor) ? valor : [valor as File]
  const umEscolhido = !multiple && escolhidos.length > 0 ? escolhidos[0] : null

  const receber = (arquivos: File[]) => {
    if (parado || arquivos.length === 0) return
    const { aceitos, erros } = triarArquivos(arquivos, { accept, maxBytes, multiple, validar })
    setErro(erros.length ? erros.join(' ') : null)
    if (aceitos.length) onArquivos(aceitos)
  }

  const abrirSeletor = () => {
    if (!parado) entrada.current?.click()
  }

  const arquivosColados = (dados: DataTransfer | null): File[] => {
    if (!dados) return []
    const brutos = dados.files.length
      ? Array.from(dados.files)
      : Array.from(dados.items).filter((i) => i.kind === 'file').map((i) => i.getAsFile()).filter((f): f is File => !!f)
    const agora = new Date()
    return brutos.map((f, i) => (ehNomeDeColagem(f.name)
      ? new File([f], nomeDeColado(f.type, agora, i, f.name), { type: f.type, lastModified: f.lastModified })
      : f))
  }

  const colar = (e: ClipboardEvent | React.ClipboardEvent) => {
    if (parado || e.defaultPrevented) return
    const arquivos = arquivosColados(e.clipboardData)
    if (arquivos.length === 0) return
    e.preventDefault()
    receber(arquivos)
  }

  // Dentro de uma janela, o Ctrl+V vale em qualquer ponto dela que não seja
  // campo de texto. O foco na própria área é tratado pelo onPaste da raiz.
  const colarNaJanela = React.useEffectEvent((e: ClipboardEvent) => {
    const alvo = e.target instanceof Element ? e.target : null
    const zona = raiz.current
    if (!alvo || !zona || zona.contains(alvo)) return
    const janela = zona.closest('[role="dialog"]')
    if (!janela || !janela.contains(alvo)) return
    if (alvo.closest('input, textarea, select, [contenteditable=""], [contenteditable="true"]')) return
    colar(e)
  })
  React.useEffect(() => {
    const ouvir = (e: ClipboardEvent) => colarNaJanela(e)
    document.addEventListener('paste', ouvir)
    return () => document.removeEventListener('paste', ouvir)
  }, [])

  // Arquivo solto fora da área (ex.: no campo de texto ao lado) não pode abrir
  // na aba e perder o que foi digitado (achado do RT, 10/11/2026). Dentro da
  // mesma janela ou do mesmo bloco da área, o arquivo vem para ela.
  const soltarFora = React.useEffectEvent((e: DragEvent) => {
    if (!e.dataTransfer || !Array.from(e.dataTransfer.types).includes('Files')) return
    const alvo = e.target instanceof Element ? e.target : null
    const zona = raiz.current
    if (!zona || (alvo && zona.contains(alvo))) return
    e.preventDefault()
    const escopo = zona.closest('[role="dialog"]') ?? zona.parentElement?.parentElement ?? null
    if (e.type === 'dragover') {
      e.dataTransfer.dropEffect = escopo && alvo && escopo.contains(alvo) && !parado ? 'copy' : 'none'
      return
    }
    if (escopo && alvo && escopo.contains(alvo) && !parado) receber(Array.from(e.dataTransfer.files))
  })
  React.useEffect(() => {
    const ouvir = (e: DragEvent) => soltarFora(e)
    document.addEventListener('dragover', ouvir)
    document.addEventListener('drop', ouvir)
    return () => {
      document.removeEventListener('dragover', ouvir)
      document.removeEventListener('drop', ouvir)
    }
  }, [])

  const comArquivos = (e: React.DragEvent) => Array.from(e.dataTransfer.types).includes('Files')
  const sobre = (e: React.DragEvent) => {
    if (!comArquivos(e)) return
    // sempre segura o padrão: soltar o arquivo aqui não pode abrir o arquivo na aba
    e.preventDefault()
    e.dataTransfer.dropEffect = parado ? 'none' : 'copy'
    if (!parado) setArrastando(true)
  }
  const saiu = (e: React.DragEvent) => {
    if (!raiz.current?.contains(e.relatedTarget as Node | null)) setArrastando(false)
  }
  const soltou = (e: React.DragEvent) => {
    if (!comArquivos(e)) return
    e.preventDefault()
    setArrastando(false)
    receber(Array.from(e.dataTransfer.files))
  }

  const idRotulo = `${id}-rotulo`
  const idTexto = `${id}-texto`
  const idDescricao = `${id}-descricao`
  const idErro = `${id}-erro`
  const descrito = [descricao ? idDescricao : null, erro ? idErro : null].filter(Boolean).join(' ') || undefined
  const nomeado = [rotulo ? idRotulo : null, idTexto].filter(Boolean).join(' ')
  // no celular só o toque vale: o "ou arraste" some (pointer-coarse)
  const alternativa = compacto ? 'ou arraste ou cole' : `ou arraste ${multiple ? 'os arquivos' : 'o arquivo'} aqui, ou cole com Ctrl+V`
  const acaoEscolher = multiple ? 'Escolher arquivos' : 'Escolher arquivo'
  const Icone = ocupado ? Loader2 : (icone ?? Upload)

  return (
    <div
      ref={raiz}
      className={cn('flex min-w-0 flex-col gap-1.5', className)}
      onPaste={colar}
      onDragEnter={sobre}
      onDragOver={sobre}
      onDragLeave={saiu}
      onDrop={soltou}
    >
      {rotulo && <Label id={idRotulo} htmlFor={id}>{rotulo}</Label>}
      <input
        ref={entrada}
        type="file"
        hidden
        tabIndex={-1}
        accept={accept}
        multiple={multiple}
        disabled={parado}
        onChange={(e) => {
          const lista = Array.from(e.target.files ?? [])
          e.target.value = ''
          receber(lista)
        }}
      />

      {umEscolhido ? (
        <div
          className={cn(
            'flex flex-wrap items-center gap-2 rounded-container border border-fio bg-superficie px-3 py-2 transition-colors',
            arrastando && 'border-acao bg-alerta-marca',
          )}
        >
          <Paperclip className="size-4 shrink-0 text-acao" aria-hidden />
          <span className="flex min-w-0 flex-1 flex-col">
            <span id={idTexto} className="text-apoio text-tinta [overflow-wrap:anywhere]">{umEscolhido.name}</span>
            <span className="text-rotulo text-tinta-sussurro">{tamanhoLegivel(umEscolhido.size)}</span>
            {descricao && <span id={idDescricao} className="sr-only">{descricao}</span>}
          </span>
          <Button id={id} size="xs" variant="outline" disabled={parado} aria-describedby={descrito} onClick={abrirSeletor}>
            {ocupado ? <Loader2 className="animate-spin" aria-hidden /> : null}Trocar
          </Button>
          {onRemover && (
            <Button size="xs" variant="ghost" disabled={parado} aria-label={`Remover ${umEscolhido.name}`} onClick={() => { setErro(null); onRemover(0) }}>
              <X aria-hidden /> Remover
            </Button>
          )}
        </div>
      ) : (
        <button
          type="button"
          id={id}
          title={dica}
          // enviando, a área continua com o foco (aria-disabled), para o teclado não se perder
          disabled={disabled}
          aria-disabled={ocupado || undefined}
          aria-labelledby={nomeado}
          aria-describedby={descrito}
          aria-busy={ocupado || undefined}
          onClick={abrirSeletor}
          className={cn(
            'group/anexo flex items-center rounded-container border border-dashed border-fio-forte bg-campo text-left transition-colors',
            'hover:border-acao hover:bg-alerta-marca disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:border-fio-forte disabled:hover:bg-campo',
            'aria-disabled:cursor-progress aria-disabled:hover:border-fio-forte aria-disabled:hover:bg-campo',
            compacto ? 'gap-justo px-2.5 py-1.5' : 'w-full gap-proximo px-base py-proximo',
            arrastando && 'border-acao bg-alerta-marca',
          )}
        >
          <Icone className={cn('shrink-0 text-acao', compacto ? 'size-3.5' : 'size-5', ocupado && 'animate-spin')} aria-hidden />
          <span className={cn('flex min-w-0 flex-col', compacto ? 'gap-0' : 'gap-0.5')}>
            <span id={idTexto} className={cn('flex text-tinta', compacto ? 'flex-wrap gap-x-1.5 text-rotulo' : 'flex-col text-apoio')}>
              {titulo && !ocupado && <span className="font-medium">{titulo}</span>}
              {ocupado ? (
                <span>{textoOcupado}</span>
              ) : arrastando ? (
                <span className="text-acao">{multiple ? 'Solte os arquivos para anexar' : 'Solte o arquivo para anexar'}</span>
              ) : (
                <span className={cn('flex flex-wrap items-baseline gap-x-1.5', titulo && 'text-tinta-apoio')}>
                  <span
                    className={cn(
                      'text-acao transition-colors',
                      compacto
                        ? 'underline underline-offset-2'
                        : 'rounded-controle border border-acao bg-superficie px-2 py-0.5 group-hover/anexo:bg-acao group-hover/anexo:text-sobre-acao',
                    )}
                  >
                    {acaoEscolher}
                  </span>
                  <span className="pointer-coarse:hidden">{alternativa}</span>
                </span>
              )}
            </span>
            {descricao && (
              <span id={idDescricao} className={cn('text-rotulo text-tinta-sussurro', compacto && 'sr-only')}>{descricao}</span>
            )}
          </span>
        </button>
      )}

      {multiple && escolhidos.length > 0 && (
        <ul className="flex flex-col gap-1" aria-label="Arquivos escolhidos">
          {escolhidos.map((a, i) => (
            <li key={`${a.name}-${a.size}-${i}`} className="flex items-center gap-2">
              <Paperclip className="size-3.5 shrink-0 text-tinta-sussurro" aria-hidden />
              <span className="min-w-0 text-apoio text-tinta [overflow-wrap:anywhere]">{a.name}</span>
              <span className="shrink-0 text-rotulo text-tinta-sussurro">{tamanhoLegivel(a.size)}</span>
              {onRemover && (
                <Button size="icon-xs" variant="ghost" disabled={parado} aria-label={`Remover ${a.name}`} onClick={() => onRemover(i)}>
                  <X aria-hidden />
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}

      <MensagemErro formato="linha" id={idErro} texto={erro} className="mt-0" />
    </div>
  )
}
