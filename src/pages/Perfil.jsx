import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Camera, Printer, Save, X, ChevronLeft, User, CreditCard } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import Layout from '../components/Layout'
import { Button } from '../components/ui/button'

/* ── Helpers ──────────────────────────────────────────────────────────────── */
function Avatar({ src, nome, size = 96 }) {
  const inicial = nome?.charAt(0)?.toUpperCase() ?? '?'
  if (src) return (
    <img src={src} alt={nome}
      className="rounded-full object-cover"
      style={{ width: size, height: size }} />
  )
  return (
    <div className="rounded-full flex items-center justify-center text-white font-bold select-none"
      style={{ width: size, height: size, fontSize: size * 0.38,
        background: 'linear-gradient(135deg, #0d9488 0%, #0c7470 100%)' }}>
      {inicial}
    </div>
  )
}

/* ── Seção card ───────────────────────────────────────────────────────────── */
function Secao({ icone: Icone, titulo, children }) {
  return (
    <div className="rounded-2xl overflow-hidden"
      style={{ background: 'var(--cor-superficie)', border: '1px solid var(--cor-borda)', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
      <div className="flex items-center gap-2 px-5 py-3.5"
        style={{ borderBottom: '1px solid var(--cor-borda)', background: '#fafbfc' }}>
        <Icone size={15} style={{ color: 'var(--cor-primaria)' }} />
        <span className="text-sm font-semibold" style={{ color: 'var(--cor-texto)' }}>{titulo}</span>
      </div>
      <div className="px-5 py-5">{children}</div>
    </div>
  )
}

/* ── Campo leitura ────────────────────────────────────────────────────────── */
function CampoLeitura({ label, valor }) {
  return (
    <div>
      <p className="text-xs font-medium mb-1" style={{ color: 'var(--cor-texto-suave)' }}>{label}</p>
      <p className="text-sm font-medium" style={{ color: 'var(--cor-texto)' }}>{valor || '—'}</p>
    </div>
  )
}

/* ── Campo editável ──────────────────────────────────────────────────────── */
function CampoInput({ label, value, onChange, placeholder, type = 'text' }) {
  return (
    <div>
      <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--cor-texto-suave)' }}>{label}</label>
      <input
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className="w-full rounded-xl px-3 py-2 text-sm transition-all"
        style={{
          background: 'var(--cor-fundo)', border: '1.5px solid var(--cor-borda)',
          color: 'var(--cor-texto)', outline: 'none',
        }}
        onFocus={e => e.target.style.borderColor = 'var(--cor-primaria)'}
        onBlur={e => e.target.style.borderColor = 'var(--cor-borda)'}
      />
    </div>
  )
}

/* ── Crachá visual ────────────────────────────────────────────────────────── */
function Cracha({ profissional }) {
  const specs = profissional?.especialidades ?? []
  const specsStr = Array.isArray(specs) ? specs.join(' · ') : specs

  return (
    <div id="cracha-elemento" className="mx-auto select-none"
      style={{
        width: 280, borderRadius: 16, overflow: 'hidden',
        boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
        fontFamily: "'Geist Variable', sans-serif",
        background: '#fff',
      }}>
      {/* Header teal */}
      <div style={{ background: 'linear-gradient(135deg, #0a5a56 0%, #0d9488 100%)', padding: '18px 16px 14px' }}>
        <div className="flex items-center gap-2">
          <img src="/logo.png" alt="" style={{ width: 32, height: 32, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.4)' }} />
          <div>
            <p style={{ color: '#fff', fontWeight: 800, fontSize: 13, letterSpacing: '0.04em', lineHeight: 1 }}>
              CHEFE CORUJA
            </p>
            <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: 9, letterSpacing: '0.08em', marginTop: 2 }}>
              SISTEMA DE GESTÃO MÉDICA
            </p>
          </div>
        </div>
      </div>

      {/* Corpo */}
      <div style={{ padding: '20px 16px 16px', textAlign: 'center' }}>
        {/* Foto */}
        <div className="mx-auto mb-3" style={{ width: 80, height: 80 }}>
          <Avatar src={profissional?.foto_url} nome={profissional?.nome} size={80} />
        </div>

        {/* Nome */}
        <p style={{ fontWeight: 800, fontSize: 15, color: '#1e293b', lineHeight: 1.2 }}>
          {profissional?.nome ?? '—'}
        </p>

        {/* Role */}
        <p style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.1em', color: '#0d9488', marginTop: 4, textTransform: 'uppercase' }}>
          {profissional?.role === 'admin' ? 'Administrador' : 'Médico Plantonista'}
        </p>

        {/* Divider */}
        <div style={{ width: 40, height: 2, background: '#0d9488', borderRadius: 2, margin: '10px auto' }} />

        {/* CRM */}
        <div style={{ background: '#f0fdfa', borderRadius: 8, padding: '6px 12px', display: 'inline-block', marginBottom: 8 }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: '#0d9488', letterSpacing: '0.06em' }}>
            CRM: {profissional?.crm ?? '—'}
          </p>
        </div>

        {/* Especialidades */}
        {specsStr && (
          <p style={{ fontSize: 10, color: '#64748b', marginTop: 4, lineHeight: 1.5, padding: '0 8px' }}>
            {specsStr}
          </p>
        )}

        {/* Unidade */}
        <p style={{ fontSize: 9, color: '#94a3b8', marginTop: 10, letterSpacing: '0.04em' }}>
          {profissional?.unidade ?? 'UPA Aparecida de Goiânia'}
        </p>
      </div>

      {/* Footer */}
      <div style={{ background: '#f8fafc', borderTop: '1px solid #e2e8f0', padding: '8px 16px' }}>
        <p style={{ fontSize: 8, color: '#94a3b8', textAlign: 'center', letterSpacing: '0.06em' }}>
          chefecoruja.com.br · {new Date().getFullYear()}
        </p>
      </div>
    </div>
  )
}

/* ── Página principal ─────────────────────────────────────────────────────── */
export default function Perfil() {
  const { profissional, user, carregarPerfil } = useAuth()
  const navigate = useNavigate()
  const fileRef = useRef(null)

  const [fotoPreview, setFotoPreview] = useState(null)
  const [fotoFile, setFotoFile]       = useState(null)
  const [uploadando, setUploadando]   = useState(false)

  const [telefone, setTelefone]         = useState(profissional?.telefone ?? '')
  const [especialidades, setEspec]      = useState(
    Array.isArray(profissional?.especialidades) ? profissional.especialidades.join(', ') : (profissional?.especialidades ?? '')
  )
  const [salvandoDados, setSalvandoDados] = useState(false)
  const [msgDados, setMsgDados]           = useState('')

  /* Foto ------------------------------------------------------------------- */
  function onSelecionarFoto(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setFotoFile(file)
    setFotoPreview(URL.createObjectURL(file))
  }

  async function salvarFoto() {
    if (!fotoFile || !user) return
    setUploadando(true)
    const ext  = fotoFile.name.split('.').pop()
    const path = `${user.id}/avatar.${ext}`

    const { error: upErr } = await supabase.storage
      .from('avatares')
      .upload(path, fotoFile, { upsert: true, cacheControl: '3600' })

    if (upErr) { alert('Erro ao enviar foto: ' + upErr.message); setUploadando(false); return }

    const { data: { publicUrl } } = supabase.storage.from('avatares').getPublicUrl(path)

    const { error: dbErr } = await supabase
      .from('profissionais')
      .update({ foto_url: publicUrl + '?t=' + Date.now() })
      .eq('id', profissional.id)

    if (dbErr) { alert('Erro ao salvar URL: ' + dbErr.message); setUploadando(false); return }

    await carregarPerfil(user)
    setFotoPreview(null)
    setFotoFile(null)
    setUploadando(false)
  }

  async function removerFoto() {
    if (!confirm('Remover foto de perfil?')) return
    await supabase.from('profissionais').update({ foto_url: null }).eq('id', profissional.id)
    await carregarPerfil(user)
    setFotoPreview(null)
    setFotoFile(null)
  }

  /* Dados ------------------------------------------------------------------ */
  async function salvarDados() {
    setSalvandoDados(true)
    setMsgDados('')
    const especArr = especialidades
      .split(',')
      .map(s => s.trim())
      .filter(Boolean)

    const { error } = await supabase
      .from('profissionais')
      .update({ telefone, especialidades: especArr })
      .eq('id', profissional.id)

    if (error) {
      setMsgDados('Erro: ' + error.message)
    } else {
      await carregarPerfil(user)
      setMsgDados('✅ Dados salvos!')
      setTimeout(() => setMsgDados(''), 3000)
    }
    setSalvandoDados(false)
  }

  /* Crachá ----------------------------------------------------------------- */
  function imprimirCracha() {
    const el = document.getElementById('cracha-elemento')
    if (!el) return
    const html = el.outerHTML
    const win = window.open('', '_blank', 'width=420,height=680')
    if (!win) { alert('Seu navegador bloqueou o popup. Libere popups para este site e tente novamente.'); return }
    win.document.write(`<!DOCTYPE html><html><head>
      <title>Crachá — ${profissional?.nome}</title>
      <link rel="preconnect" href="https://fonts.googleapis.com">
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #f1f5f9; display: flex; align-items: center; justify-content: center; min-height: 100vh; font-family: system-ui, sans-serif; }
        img { max-width: 100%; }
        @media print { body { background: white; } }
      </style>
    </head><body>${html}<script>window.onload=()=>{window.print();}<\/script></body></html>`)
    win.document.close()
  }

  const fotoAtual = fotoPreview ?? profissional?.foto_url

  return (
    <Layout style={{ background: 'var(--cor-fundo)', minHeight: '100vh' }}>
      <div className="max-w-2xl mx-auto px-5 py-7">

        {/* Topo */}
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => navigate(-1)}
            className="p-2 rounded-xl transition-colors hover:bg-white"
            style={{ color: 'var(--cor-texto-suave)', border: '1px solid var(--cor-borda)' }}>
            <ChevronLeft size={18} />
          </button>
          <h1 className="text-lg font-bold" style={{ color: 'var(--cor-texto)' }}>Meu perfil</h1>
        </div>

        <div className="space-y-4">

          {/* ── Foto de perfil ── */}
          <Secao icone={Camera} titulo="Foto de perfil">
            <div className="flex items-center gap-5">
              <div className="relative shrink-0">
                <Avatar src={fotoAtual} nome={profissional?.nome} size={88} />
                <button onClick={() => fileRef.current?.click()}
                  className="absolute -bottom-1 -right-1 rounded-full p-1.5 shadow transition-transform hover:scale-110"
                  style={{ background: 'var(--cor-primaria)', color: '#fff' }}
                  title="Alterar foto">
                  <Camera size={13} />
                </button>
              </div>

              <div className="flex-1 space-y-2">
                <p className="text-sm" style={{ color: 'var(--cor-texto-suave)' }}>
                  JPG, PNG ou WebP · máx. 5 MB
                </p>
                <div className="flex gap-2 flex-wrap">
                  <input ref={fileRef} type="file" accept="image/*" className="hidden"
                    onChange={onSelecionarFoto} />
                  <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()}>
                    Escolher foto
                  </Button>
                  {fotoFile && (
                    <Button size="sm" onClick={salvarFoto} disabled={uploadando}
                      style={{ background: 'var(--cor-primaria)', color: '#fff' }}>
                      {uploadando ? 'Enviando…' : 'Salvar foto'}
                    </Button>
                  )}
                  {fotoFile && (
                    <Button size="sm" variant="ghost"
                      onClick={() => { setFotoPreview(null); setFotoFile(null) }}>
                      <X size={14} />
                    </Button>
                  )}
                  {profissional?.foto_url && !fotoFile && (
                    <Button size="sm" variant="ghost" onClick={removerFoto}
                      style={{ color: '#dc2626' }}>
                      Remover
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </Secao>

          {/* ── Dados pessoais ── */}
          <Secao icone={User} titulo="Dados pessoais">
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="col-span-2">
                <CampoLeitura label="Nome completo" valor={profissional?.nome} />
              </div>
              <CampoLeitura label="CRM" valor={profissional?.crm} />
              <CampoLeitura label="E-mail" valor={profissional?.email} />
              <CampoLeitura label="Unidade" valor={profissional?.unidade ?? 'UPA Aparecida de Goiânia'} />
              <CampoLeitura label="Perfil" valor={profissional?.role === 'admin' ? 'Administrador' : 'Médico'} />
            </div>

            <div className="border-t pt-4 space-y-3" style={{ borderColor: 'var(--cor-borda)' }}>
              <p className="text-xs font-semibold uppercase tracking-widest"
                style={{ color: 'var(--cor-texto-suave)' }}>Editável</p>
              <div className="grid grid-cols-1 gap-3">
                <CampoInput
                  label="Telefone"
                  value={telefone}
                  onChange={e => setTelefone(e.target.value)}
                  placeholder="(62) 9 9999-9999"
                  type="tel"
                />
                <CampoInput
                  label="Especialidades (separadas por vírgula)"
                  value={especialidades}
                  onChange={e => setEspec(e.target.value)}
                  placeholder="Clínica Médica, Emergência"
                />
              </div>

              <div className="flex items-center gap-3 pt-1">
                <Button size="sm" onClick={salvarDados} disabled={salvandoDados}
                  style={{ background: 'var(--cor-primaria)', color: '#fff', gap: '6px' }}>
                  <Save size={13} /> {salvandoDados ? 'Salvando…' : 'Salvar dados'}
                </Button>
                {msgDados && (
                  <p className="text-sm" style={{ color: msgDados.startsWith('✅') ? '#16a34a' : '#dc2626' }}>
                    {msgDados}
                  </p>
                )}
              </div>
            </div>
          </Secao>

          {/* ── Crachá ── */}
          <Secao icone={CreditCard} titulo="Crachá de identificação">
            <div className="flex flex-col items-center gap-5">
              <Cracha profissional={profissional} />
              <Button onClick={imprimirCracha} variant="outline"
                className="gap-2 px-6" style={{ borderColor: 'var(--cor-primaria)', color: 'var(--cor-primaria)' }}>
                <Printer size={15} />
                Imprimir / Salvar PDF
              </Button>
            </div>
          </Secao>

        </div>
      </div>
    </Layout>
  )
}
