import { useState, useRef } from 'react'
import mammoth from 'mammoth'
import { supabase } from '../lib/supabase'
import { Button } from './ui/button'

// ── Parsers ───────────────────────────────────────────────────────────────────
function detectarSep(linha) {
  if ((linha.match(/\t/g) ?? []).length >= 2) return '\t'
  if ((linha.match(/;/g) ?? []).length >= 2)  return ';'
  return ','
}

function splitCSV(l, sep) {
  if (sep !== ',') return l.split(sep).map(v => v.replace(/^"|"$/g, '').trim())
  const cols = []; let cur = '', quot = false
  for (let i = 0; i < l.length; i++) {
    const c = l[i]
    if (c === '"') { quot = !quot; continue }
    if (c === ',' && !quot) { cols.push(cur.trim()); cur = '' }
    else cur += c
  }
  cols.push(cur.trim())
  return cols
}

const ALIAS = { nomecompleto:'nome', crm:'crm', email:'email',
                telefone:'telefone', celular:'telefone',
                especialidade:'especialidade', especialidades:'especialidade' }

function normKey(h) {
  return h.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '')
}

function parseTexto(text) {
  const linhas = text.trim().split(/\r?\n/).filter(l => l.trim())
  if (linhas.length < 2) return []
  const sep = detectarSep(linhas[0])
  const cols = splitCSV(linhas[0], sep).map(h => ALIAS[normKey(h)] ?? normKey(h))
  return linhas.slice(1).map(l => {
    const vals = splitCSV(l, sep)
    const obj = {}
    cols.forEach((c, i) => { obj[c] = vals[i] ?? '' })
    return obj
  }).filter(r => r.nome?.trim())
}

function parseHTML(html) {
  const div = document.createElement('div')
  div.innerHTML = html
  const tabelas = div.querySelectorAll('table')
  if (tabelas.length > 0) {
    const rows = Array.from(tabelas[0].querySelectorAll('tr'))
    if (rows.length < 2) return []
    const cols = Array.from(rows[0].querySelectorAll('td,th'))
      .map(td => ALIAS[normKey(td.textContent.trim())] ?? normKey(td.textContent.trim()))
    return rows.slice(1).map(row => {
      const vals = Array.from(row.querySelectorAll('td')).map(td => td.textContent.trim())
      const obj = {}
      cols.forEach((c, i) => { obj[c] = vals[i] ?? '' })
      return obj
    }).filter(r => r.nome?.trim())
  }
  return parseTexto(div.textContent)
}

// ── Download modelo CSV ───────────────────────────────────────────────────────
function baixarModelo() {
  const linhas = [
    ['nome', 'crm', 'email', 'telefone', 'especialidade'],
    ['Dr Coruja', '12345', 'drcoruja@chefecoruja.com.br', '(62) 99999-0000', 'Clínica Geral'],
  ]
  const csv = linhas.map(r => r.map(v => `"${v}"`).join(',')).join('\n')
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' }))
  a.download = 'modelo_profissionais.csv'
  a.click()
}

// ── Modal ─────────────────────────────────────────────────────────────────────
export default function ModalImportarEditor({ aberto, onFechar, onImportado }) {
  const [preview,    setPreview]    = useState(null)
  const [importando, setImportando] = useState(false)
  const [resultado,  setResultado]  = useState(null)
  const [erro,       setErro]       = useState('')
  const [nomeArq,    setNomeArq]    = useState('')
  const fileRef = useRef()

  function resetar() {
    setPreview(null); setResultado(null); setErro(''); setNomeArq('')
    if (fileRef.current) fileRef.current.value = ''
  }

  function fechar() { resetar(); onFechar() }

  async function handleFile(e) {
    const file = e.target.files[0]; if (!file) return
    setErro(''); setPreview(null); setResultado(null)
    setNomeArq(file.name)
    const ext = file.name.split('.').pop().toLowerCase()
    try {
      if (ext === 'docx') {
        const buf = await file.arrayBuffer()
        const { value: html } = await mammoth.convertToHtml({ arrayBuffer: buf })
        const rows = parseHTML(html)
        if (!rows.length) { setErro('Tabela não encontrada no Word. Verifique os cabeçalhos: nome, crm, email, telefone, especialidade.'); return }
        setPreview(rows)
      } else {
        const rows = parseTexto(await file.text())
        if (!rows.length) { setErro('Nenhuma linha válida. Verifique se a primeira linha contém os cabeçalhos.'); return }
        setPreview(rows)
      }
    } catch (err) {
      setErro('Erro ao ler o arquivo: ' + err.message)
    }
  }

  async function handleImportar() {
    if (!preview?.length) return
    setImportando(true); setErro('')

    const registros = preview.map(r => ({
      nome:            (r.nome || '').trim(),
      crm:             (r.crm  || '').trim() || null,
      email:           r.email?.trim()    || null,
      telefone:        r.telefone?.trim() || null,
      especialidades:  r.especialidade?.trim() ? [r.especialidade.trim()] : [],
      role:            'medico',
      status_aprovacao:'aprovado',
      ativo:            true,
    })).filter(r => r.nome)

    let ok = 0; const erros = []
    for (const reg of registros) {
      const { error } = await supabase.from('profissionais').insert(reg)
      if (error) {
        if (error.message.includes('duplicate') || error.message.includes('unique')) {
          ok++ // já existe — conta como sucesso silencioso
        } else {
          erros.push(`${reg.nome}: ${error.message}`)
        }
      } else ok++
    }

    setImportando(false)
    setResultado({ ok, erros })
    setPreview(null)
    if (fileRef.current) fileRef.current.value = ''
    if (ok > 0) onImportado() // dispara recarga de profissionais no editor
  }

  if (!aberto) return null

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div className="rounded-2xl w-full max-w-lg flex flex-col" style={{ background: '#0c1445', border: '1px solid rgba(255,255,255,0.2)', maxHeight: '90vh' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
          <div>
            <h2 className="text-base font-bold text-white">Importar Profissionais</h2>
            <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.4)' }}>CSV · TXT · DOCX — profissionais ficam disponíveis no editor imediatamente</p>
          </div>
          <button onClick={fechar} style={{ color: 'rgba(255,255,255,0.4)', fontSize: 20, lineHeight: 1 }}>×</button>
        </div>

        <div className="overflow-y-auto px-6 py-4 space-y-4">

          {/* Baixar modelo */}
          <div className="flex items-center justify-between rounded-xl px-4 py-3" style={{ background: 'rgba(13,148,136,0.1)', border: '1px solid rgba(13,148,136,0.3)' }}>
            <div>
              <p className="text-xs font-semibold text-white">Não tem o arquivo?</p>
              <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.45)' }}>Baixe o modelo CSV com as colunas e um exemplo preenchido</p>
            </div>
            <button onClick={baixarModelo}
              className="text-xs font-semibold px-3 py-2 rounded-lg whitespace-nowrap transition-all hover:opacity-80"
              style={{ background: '#0d9488', color: '#fff' }}>
              ⬇ Baixar modelo
            </button>
          </div>

          {/* Upload */}
          <label className="flex flex-col items-center justify-center gap-2 rounded-xl cursor-pointer transition-all hover:bg-white/5"
            style={{ border: '2px dashed rgba(255,255,255,0.2)', padding: '28px 16px', textAlign: 'center' }}>
            <span style={{ fontSize: 32 }}>📂</span>
            <span className="text-sm font-medium text-white">
              {nomeArq || 'Clique para selecionar o arquivo'}
            </span>
            <span className="text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>.csv · .txt · .docx</span>
            <input ref={fileRef} type="file" accept=".csv,.txt,.tsv,.docx" className="hidden" onChange={handleFile} />
          </label>

          {/* Erro de leitura */}
          {erro && (
            <p className="text-xs px-3 py-2 rounded-lg" style={{ color: '#fca5a5', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)' }}>
              {erro}
            </p>
          )}

          {/* Preview */}
          {preview && preview.length > 0 && (
            <div className="space-y-3">
              <p className="text-xs font-semibold text-white">
                {preview.length} profissional(is) encontrado(s) — revise antes de confirmar
              </p>
              <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.1)', maxHeight: 240, overflowY: 'auto' }}>
                <table className="w-full text-xs" style={{ borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: 'rgba(255,255,255,0.06)' }}>
                      {['Nome', 'CRM', 'E-mail'].map(h => (
                        <th key={h} className="text-left px-3 py-2 font-semibold"
                          style={{ color: 'rgba(255,255,255,0.5)', borderBottom: '1px solid rgba(255,255,255,0.08)', whiteSpace: 'nowrap' }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.map((r, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                        <td className="px-3 py-1.5 font-medium" style={{ color: '#e2e8f0' }}>{r.nome || '—'}</td>
                        <td className="px-3 py-1.5" style={{ color: 'rgba(255,255,255,0.45)' }}>{r.crm || '—'}</td>
                        <td className="px-3 py-1.5" style={{ color: 'rgba(255,255,255,0.45)' }}>{r.email || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex gap-2">
                <Button onClick={handleImportar} disabled={importando}
                  style={{ background: '#0d9488', color: '#fff', flex: 1 }}>
                  {importando ? 'Importando…' : `Confirmar (${preview.length})`}
                </Button>
                <Button variant="outline" onClick={resetar}
                  style={{ borderColor: 'rgba(255,255,255,0.5)', color: '#fff', background: 'rgba(255,255,255,0.08)' }}>
                  Cancelar
                </Button>
              </div>
            </div>
          )}

          {/* Resultado */}
          {resultado && (
            <div className="rounded-xl p-4 space-y-2"
              style={{ background: resultado.erros.length === 0 ? 'rgba(22,163,74,0.15)' : 'rgba(234,179,8,0.1)',
                       border: `1px solid ${resultado.erros.length === 0 ? 'rgba(22,163,74,0.4)' : 'rgba(234,179,8,0.3)'}` }}>
              <p className="text-sm font-semibold" style={{ color: resultado.erros.length === 0 ? '#4ade80' : '#fde047' }}>
                {resultado.ok} importado(s){resultado.erros.length > 0 ? ` · ${resultado.erros.length} com erro` : ' — disponíveis no editor ✓'}
              </p>
              {resultado.erros.slice(0, 5).map((e, i) => (
                <p key={i} className="text-xs" style={{ color: '#fca5a5' }}>• {e}</p>
              ))}
              <button onClick={fechar}
                className="text-xs underline mt-1"
                style={{ color: 'rgba(255,255,255,0.4)' }}>
                Fechar
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
