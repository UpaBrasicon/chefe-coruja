import { useEffect, useRef, useState, type FormEvent } from 'react'

import { useTurnstile } from '@/components/seguranca/Turnstile'

import { CAMPOS_VAZIOS, lerResposta, validarDemonstracao, type CamposDemonstracao, type ErrosDemonstracao } from './demonstracao'

// "Agendar demonstração" (pedido 8, J3; decisões F1–F3 do RT, 12/11/2026): o
// botão abre uma janela na própria página. O pedido vai à função
// pedir-demonstracao, que confere o Turnstile, o campo-isca e o limite de 3 por
// hora e envia o e-mail para contato@. Nada fica gravado no banco.
const URL_FUNCAO = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/pedir-demonstracao`

export function AgendarDemonstracao({ className }: { className: string }) {
  const [aberto, setAberto] = useState(false)
  const janela = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const d = janela.current
    if (!d) return
    if (aberto && !d.open) d.showModal()
    if (!aberto && d.open) d.close()
  }, [aberto])

  return (
    <>
      {/* padrao-ok: botão da página pública (desenho de marca, landing.css) */}
      <button type="button" className={className} onClick={() => setAberto(true)}>
        Agendar demonstração
      </button>
      <dialog ref={janela} className="demo-janela" aria-labelledby="demo-titulo" onClose={() => setAberto(false)}>
        {aberto && <Formulario fechar={() => setAberto(false)} />}
      </dialog>
    </>
  )
}

function Formulario({ fechar }: { fechar: () => void }) {
  const [campos, setCampos] = useState<CamposDemonstracao>(CAMPOS_VAZIOS)
  const [isca, setIsca] = useState('')
  const [erros, setErros] = useState<ErrosDemonstracao>({})
  const [aviso, setAviso] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [enviado, setEnviado] = useState(false)
  const turnstile = useTurnstile()

  const mudar = (campo: keyof CamposDemonstracao) => (valor: string) => {
    setCampos((c) => ({ ...c, [campo]: valor }))
    if (campo in erros) setErros((e) => ({ ...e, [campo]: undefined }))
  }

  async function enviar(ev: FormEvent) {
    ev.preventDefault()
    const encontrados = validarDemonstracao(campos)
    setErros(encontrados)
    setAviso(null)
    if (Object.keys(encontrados).length > 0) return
    if (!turnstile.pronto) {
      setAviso('Aguarde a verificação anti-robô terminar e envie de novo.')
      return
    }
    setEnviando(true)
    try {
      const r = await fetch(URL_FUNCAO, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: import.meta.env.VITE_SUPABASE_ANON_KEY },
        body: JSON.stringify({ ...campos, website: isca, token: turnstile.captchaToken ?? '' }),
      })
      const corpo = (await r.json().catch(() => null)) as { campo?: string; erro?: string } | null
      const resultado = lerResposta(r.status, corpo)
      if (resultado.tipo === 'ok') setEnviado(true)
      else if (resultado.tipo === 'campo') setErros(resultado.erros)
      else setAviso(resultado.mensagem)
    } catch {
      setAviso('Sem conexão. Confira a internet e tente de novo.')
    } finally {
      setEnviando(false)
      turnstile.resetar()
    }
  }

  if (enviado) {
    return (
      <div className="demo-corpo" role="status">
        {/* padrao-ok: título da página pública (desenho de marca, landing.css) */}
        <h2 id="demo-titulo">Pedido enviado.</h2>
        <p className="demo-texto">A equipe do Chefe Coruja responde pelo e-mail ou pelo telefone que você informou.</p>
        <div className="demo-acoes">
          {/* padrao-ok: botão da página pública (desenho de marca, landing.css) */}
          <button type="button" className="btn btn-primario" onClick={fechar} autoFocus>Fechar</button>
        </div>
      </div>
    )
  }

  return (
    <form className="demo-corpo" onSubmit={enviar} noValidate>
      {/* padrao-ok: título da página pública (desenho de marca, landing.css) */}
      <h2 id="demo-titulo">Agendar demonstração</h2>
      <p className="demo-texto">Mostramos o sistema numa unidade de demonstração, no horário que for melhor para você.</p>

      <Campo id="demo-nome" rotulo="Nome" valor={campos.nome} mudar={mudar('nome')} erro={erros.nome} autoComplete="name" autoFocus />
      <Campo id="demo-email" rotulo="E-mail" tipo="email" valor={campos.email} mudar={mudar('email')} erro={erros.email} autoComplete="email" />
      <Campo id="demo-telefone" rotulo="Telefone com DDD" tipo="tel" valor={campos.telefone} mudar={mudar('telefone')} erro={erros.telefone} autoComplete="tel" />
      <Campo id="demo-unidade" rotulo="Unidade e cargo (opcional)" valor={campos.unidade} mudar={mudar('unidade')} autoComplete="organization" />
      <div className="demo-campo">
        <label htmlFor="demo-mensagem">Mensagem (opcional)</label>
        <textarea id="demo-mensagem" rows={3} maxLength={4000} value={campos.mensagem} onChange={(e) => mudar('mensagem')(e.target.value)} />
      </div>

      {/* campo-isca: escondido de quem usa a tela e do leitor de tela */}
      <div className="demo-isca" aria-hidden="true">
        <label htmlFor="demo-website">Site</label>
        <input id="demo-website" name="website" tabIndex={-1} autoComplete="off" value={isca} onChange={(e) => setIsca(e.target.value)} />
      </div>

      {turnstile.widget}
      {(aviso || turnstile.falha) && <p className="demo-aviso" role="alert">{aviso ?? turnstile.falha}</p>}

      <div className="demo-acoes">
        {/* padrao-ok: botão da página pública (desenho de marca, landing.css) */}
        <button type="submit" className="btn btn-primario" disabled={enviando}>{enviando ? 'Enviando…' : 'Enviar pedido'}</button>
        {/* padrao-ok: botão da página pública (desenho de marca, landing.css) */}
        <button type="button" className="btn btn-secundario" onClick={fechar}>Cancelar</button>
      </div>
    </form>
  )
}

function Campo({ id, rotulo, valor, mudar, erro, tipo = 'text', autoComplete, autoFocus }: {
  id: string
  rotulo: string
  valor: string
  mudar: (v: string) => void
  erro?: string
  tipo?: string
  autoComplete?: string
  autoFocus?: boolean
}) {
  return (
    <div className="demo-campo">
      <label htmlFor={id}>{rotulo}</label>
      <input
        id={id}
        type={tipo}
        value={valor}
        onChange={(e) => mudar(e.target.value)}
        autoComplete={autoComplete}
        autoFocus={autoFocus}
        aria-invalid={!!erro}
        aria-describedby={erro ? `${id}-erro` : undefined}
      />
      {erro && <span className="demo-erro" id={`${id}-erro`}>{erro}</span>}
    </div>
  )
}
