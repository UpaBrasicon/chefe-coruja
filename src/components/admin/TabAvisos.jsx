import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { Plus, Pencil, Trash2, ToggleLeft, ToggleRight, Bell, Send } from 'lucide-react'
import { Button } from '../ui/button'

const TIPOS_PRESET = [
  { value: 'fechamento_ponto', label: '📋 Fechamento do ponto' },
  { value: 'contracheque',     label: '💰 Contracheque disponível' },
  { value: 'reuniao',          label: '📅 Reunião da equipe' },
  { value: 'aviso_geral',      label: '🔔 Aviso geral' },
]

const FORM_VAZIO = { tipo: 'fechamento_ponto', titulo: '', mensagem: '', link: '', dia_do_mes: 1 }

function TagDia({ dia }) {
  return (
    <span className="inline-flex items-center justify-center rounded-full font-bold text-xs"
      style={{ width: 28, height: 28, background: 'rgba(13,148,136,0.12)', color: '#0d9488' }}>
      {dia}
    </span>
  )
}

export default function TabAvisos() {
  const [configs, setConfigs]       = useState([])
  const [carregando, setCarregando] = useState(true)
  const [editando, setEditando]     = useState(null)   // null | 'novo' | id
  const [form, setForm]             = useState(FORM_VAZIO)
  const [salvando, setSalvando]     = useState(false)
  const [disparando, setDisparando] = useState(false)
  const [msgDisparo, setMsgDisparo] = useState('')
  const [erroForm, setErroForm]     = useState('')

  useEffect(() => { carregar() }, [])

  async function carregar() {
    setCarregando(true)
    const { data } = await supabase
      .from('config_datas_fixas')
      .select('*')
      .order('dia_do_mes')
    setConfigs(data ?? [])
    setCarregando(false)
  }

  function abrirNovo() {
    setForm({ ...FORM_VAZIO, titulo: '', mensagem: '' })
    setEditando('novo')
    setErroForm('')
  }

  function abrirEditar(cfg) {
    setForm({
      tipo:       cfg.tipo,
      titulo:     cfg.titulo,
      mensagem:   cfg.mensagem ?? '',
      link:       cfg.link ?? '',
      dia_do_mes: cfg.dia_do_mes,
    })
    setEditando(cfg.id)
    setErroForm('')
  }

  function fecharForm() {
    setEditando(null)
    setForm(FORM_VAZIO)
    setErroForm('')
  }

  async function salvar() {
    if (!form.titulo.trim()) { setErroForm('Informe o título.'); return }
    if (!form.dia_do_mes || form.dia_do_mes < 1 || form.dia_do_mes > 28) {
      setErroForm('Dia deve ser entre 1 e 28.'); return
    }
    setSalvando(true)
    const payload = {
      tipo:       form.tipo,
      titulo:     form.titulo.trim(),
      mensagem:   form.mensagem.trim() || null,
      link:       form.link.trim() || null,
      dia_do_mes: Number(form.dia_do_mes),
    }
    if (editando === 'novo') {
      const { error } = await supabase.from('config_datas_fixas').insert(payload)
      if (error) { setErroForm(error.message); setSalvando(false); return }
    } else {
      const { error } = await supabase.from('config_datas_fixas').update(payload).eq('id', editando)
      if (error) { setErroForm(error.message); setSalvando(false); return }
    }
    setSalvando(false)
    fecharForm()
    carregar()
  }

  async function toggleAtivo(cfg) {
    await supabase.from('config_datas_fixas').update({ ativo: !cfg.ativo }).eq('id', cfg.id)
    setConfigs(prev => prev.map(c => c.id === cfg.id ? { ...c, ativo: !c.ativo } : c))
  }

  async function excluir(id) {
    if (!confirm('Excluir esta configuração?')) return
    await supabase.from('config_datas_fixas').delete().eq('id', id)
    setConfigs(prev => prev.filter(c => c.id !== id))
  }

  async function dispararHoje() {
    setDisparando(true)
    setMsgDisparo('')
    const { data, error } = await supabase.rpc('fn_processar_datas_fixas')
    setDisparando(false)
    if (error) {
      setMsgDisparo('Erro: ' + error.message)
    } else {
      const total = data ?? 0
      setMsgDisparo(total === 0
        ? 'Nenhuma data configurada para hoje, ou avisos já foram enviados.'
        : `✅ ${total} aviso${total !== 1 ? 's' : ''} criado${total !== 1 ? 's' : ''}!`)
    }
  }

  const tipoLabel = (tipo) =>
    TIPOS_PRESET.find(t => t.value === tipo)?.label ?? ('🔔 ' + tipo)

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">

      {/* Cabeçalho */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold" style={{ color: 'var(--cor-texto)' }}>
            Datas fixas de aviso
          </h2>
          <p className="text-xs mt-0.5" style={{ color: 'var(--cor-texto-suave)' }}>
            Os avisos são enviados automaticamente a todos os médicos ativos no dia configurado.
          </p>
        </div>
        <Button size="sm" onClick={abrirNovo}
          style={{ background: 'var(--cor-primaria)', color: '#fff', gap: '6px' }}>
          <Plus size={14} /> Nova data
        </Button>
      </div>

      {/* Formulário inline */}
      {editando !== null && (
        <div className="rounded-2xl p-5 space-y-4"
          style={{ background: 'var(--cor-superficie)', border: '1.5px solid var(--cor-primaria)', boxShadow: '0 4px 20px rgba(13,148,136,0.10)' }}>
          <h3 className="font-semibold text-sm" style={{ color: 'var(--cor-texto)' }}>
            {editando === 'novo' ? 'Nova data fixa' : 'Editar data fixa'}
          </h3>

          <div className="grid grid-cols-2 gap-3">
            {/* Tipo */}
            <div className="col-span-2 space-y-1">
              <label className="text-xs font-medium" style={{ color: 'var(--cor-texto-suave)' }}>Tipo</label>
              <select
                value={form.tipo}
                onChange={e => setForm(f => ({ ...f, tipo: e.target.value }))}
                className="w-full rounded-lg px-3 py-2 text-sm border"
                style={{ background: 'var(--cor-fundo)', border: '1px solid var(--cor-borda)', color: 'var(--cor-texto)' }}
              >
                {TIPOS_PRESET.map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>

            {/* Título */}
            <div className="col-span-2 space-y-1">
              <label className="text-xs font-medium" style={{ color: 'var(--cor-texto-suave)' }}>Título *</label>
              <input
                value={form.titulo}
                onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))}
                placeholder="Ex: Fechamento do ponto hoje!"
                className="w-full rounded-lg px-3 py-2 text-sm border"
                style={{ background: 'var(--cor-fundo)', border: '1px solid var(--cor-borda)', color: 'var(--cor-texto)' }}
              />
            </div>

            {/* Mensagem */}
            <div className="col-span-2 space-y-1">
              <label className="text-xs font-medium" style={{ color: 'var(--cor-texto-suave)' }}>Mensagem (opcional)</label>
              <textarea
                value={form.mensagem}
                onChange={e => setForm(f => ({ ...f, mensagem: e.target.value }))}
                placeholder="Detalhes que aparecerão na notificação..."
                rows={2}
                className="w-full rounded-lg px-3 py-2 text-sm border resize-none"
                style={{ background: 'var(--cor-fundo)', border: '1px solid var(--cor-borda)', color: 'var(--cor-texto)' }}
              />
            </div>

            {/* Dia do mês */}
            <div className="space-y-1">
              <label className="text-xs font-medium" style={{ color: 'var(--cor-texto-suave)' }}>Dia do mês (1–28) *</label>
              <input
                type="number"
                min={1}
                max={28}
                value={form.dia_do_mes}
                onChange={e => setForm(f => ({ ...f, dia_do_mes: e.target.value }))}
                className="w-full rounded-lg px-3 py-2 text-sm border"
                style={{ background: 'var(--cor-fundo)', border: '1px solid var(--cor-borda)', color: 'var(--cor-texto)' }}
              />
            </div>

            {/* Link */}
            <div className="space-y-1">
              <label className="text-xs font-medium" style={{ color: 'var(--cor-texto-suave)' }}>Link (opcional)</label>
              <input
                value={form.link}
                onChange={e => setForm(f => ({ ...f, link: e.target.value }))}
                placeholder="/escala"
                className="w-full rounded-lg px-3 py-2 text-sm border"
                style={{ background: 'var(--cor-fundo)', border: '1px solid var(--cor-borda)', color: 'var(--cor-texto)' }}
              />
            </div>
          </div>

          {erroForm && (
            <p className="text-xs rounded-lg px-3 py-2"
              style={{ color: '#dc2626', background: 'rgba(220,38,38,0.07)', border: '1px solid rgba(220,38,38,0.2)' }}>
              {erroForm}
            </p>
          )}

          <div className="flex gap-2 justify-end">
            <Button variant="ghost" size="sm" onClick={fecharForm}>Cancelar</Button>
            <Button size="sm" onClick={salvar} disabled={salvando}
              style={{ background: 'var(--cor-primaria)', color: '#fff' }}>
              {salvando ? 'Salvando...' : 'Salvar'}
            </Button>
          </div>
        </div>
      )}

      {/* Lista de configs */}
      {carregando ? (
        <p className="text-sm text-center py-8" style={{ color: 'var(--cor-texto-suave)' }}>Carregando...</p>
      ) : configs.length === 0 ? (
        <div className="text-center py-10 rounded-2xl" style={{ background: 'var(--cor-superficie)', border: '1px solid var(--cor-borda)' }}>
          <Bell size={32} className="mx-auto mb-2" style={{ color: 'var(--cor-texto-suave)', opacity: 0.4 }} />
          <p className="text-sm font-medium" style={{ color: 'var(--cor-texto-suave)' }}>Nenhuma data configurada</p>
          <p className="text-xs mt-1" style={{ color: 'var(--cor-texto-suave)', opacity: 0.7 }}>
            Clique em "Nova data" para começar
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {configs.map(cfg => (
            <div key={cfg.id}
              className="flex items-center gap-3 rounded-xl px-4 py-3 transition-all"
              style={{
                background: 'var(--cor-superficie)',
                border: '1px solid var(--cor-borda)',
                opacity: cfg.ativo ? 1 : 0.55,
              }}
            >
              <TagDia dia={cfg.dia_do_mes} />

              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate" style={{ color: 'var(--cor-texto)' }}>
                  {cfg.titulo}
                </p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-xs" style={{ color: 'var(--cor-texto-suave)' }}>
                    {tipoLabel(cfg.tipo)}
                  </span>
                  {cfg.mensagem && (
                    <span className="text-xs truncate" style={{ color: 'var(--cor-texto-suave)', opacity: 0.65 }}>
                      · {cfg.mensagem}
                    </span>
                  )}
                </div>
              </div>

              {/* Ações */}
              <div className="flex items-center gap-1 shrink-0">
                <button onClick={() => toggleAtivo(cfg)} title={cfg.ativo ? 'Desativar' : 'Ativar'}>
                  {cfg.ativo
                    ? <ToggleRight size={22} style={{ color: '#0d9488' }} />
                    : <ToggleLeft  size={22} style={{ color: '#9ca3af' }} />}
                </button>
                <button
                  onClick={() => abrirEditar(cfg)}
                  className="p-1.5 rounded-lg transition-colors hover:bg-gray-100"
                  style={{ color: '#6b7280' }}
                  title="Editar"
                >
                  <Pencil size={14} />
                </button>
                <button
                  onClick={() => excluir(cfg.id)}
                  className="p-1.5 rounded-lg transition-colors hover:bg-red-50"
                  style={{ color: '#d1d5db' }}
                  title="Excluir"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Disparar manualmente */}
      <div className="rounded-2xl p-5 space-y-3"
        style={{ background: 'var(--cor-superficie)', border: '1px solid var(--cor-borda)' }}>
        <div>
          <h3 className="text-sm font-semibold" style={{ color: 'var(--cor-texto)' }}>
            Processar avisos do dia
          </h3>
          <p className="text-xs mt-0.5" style={{ color: 'var(--cor-texto-suave)' }}>
            Executa manualmente a regra do dia de hoje. Os avisos são criados automaticamente no
            primeiro acesso do dia, mas você pode forçar o processamento agora.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button size="sm" onClick={dispararHoje} disabled={disparando}
            style={{ background: 'var(--cor-secundaria)', color: '#fff', gap: '6px' }}>
            <Send size={13} />
            {disparando ? 'Processando...' : 'Processar agora'}
          </Button>
          {msgDisparo && (
            <p className="text-xs" style={{ color: msgDisparo.startsWith('✅') ? '#16a34a' : '#dc2626' }}>
              {msgDisparo}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
