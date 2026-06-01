import { useState, useRef } from 'react'
import mammoth from 'mammoth'
import { supabase } from '../../lib/supabase'
import { Button } from '../ui/button'

// ── Modelo CSV ────────────────────────────────────────────────────────────────
const CAMPOS  = ['nome', 'crm', 'email', 'telefone', 'especialidade']
const EXEMPLO = [
  ['João da Silva',  '12345', 'joao@email.com',  '62999990001', 'Clínica Geral'],
  ['Maria Santos',   '67890', 'maria@email.com', '62999990002', 'Pediatria'],
]

function baixarModelo() {
  const csv = [CAMPOS.join(','), ...EXEMPLO.map(r => r.map(v => `"${v}"`).join(','))].join('\n')
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' }))
  a.download = 'modelo_profissionais.csv'
  a.click()
}

// ── Detecta separador ─────────────────────────────────────────────────────────
function detectarSep(linha) {
  if ((linha.match(/\t/g) ?? []).length >= 2) return '\t'
  if ((linha.match(/;/g) ?? []).length >= 2)  return ';'
  return ','
}

// ── Parser de texto plano (CSV / TSV / semicolons) ────────────────────────────
function parseTexto(text) {
  const linhas = text.trim().split(/\r?\n/).filter(l => l.trim())
  if (linhas.length < 2) return []
  const sep = detectarSep(linhas[0])

  function splitLinha(l) {
    if (sep === ',') {
      const cols = []
      let cur = '', quot = false
      for (let i = 0; i < l.length; i++) {
        const c = l[i]
        if (c === '"') { quot = !quot; continue }
        if (c === ',' && !quot) { cols.push(cur.trim()); cur = '' }
        else cur += c
      }
      cols.push(cur.trim())
      return cols
    }
    return l.split(sep).map(v => v.replace(/^"|"$/g, '').trim())
  }

  const header = splitLinha(linhas[0]).map(h =>
    h.toLowerCase()
     .normalize('NFD').replace(/[̀-ͯ]/g, '')
     .replace(/[^a-z0-9]/g, '')
  )

  // Aliases de coluna
  const alias = { nomecompleto: 'nome', crm: 'crm', email: 'email',
                  telefone: 'telefone', celular: 'telefone',
                  especialidade: 'especialidade', especialidades: 'especialidade' }

  const cols = header.map(h => alias[h] ?? h)

  return linhas.slice(1).map(l => {
    const vals = splitLinha(l)
    const obj  = {}
    cols.forEach((c, i) => { obj[c] = vals[i] ?? '' })
    return obj
  }).filter(r => r.nome?.trim())
}

// ── Parser de HTML extraído do DOCX ──────────────────────────────────────────
function parseHTML(html) {
  const div = document.createElement('div')
  div.innerHTML = html

  // Tenta tabela primeiro
  const tabelas = div.querySelectorAll('table')
  if (tabelas.length > 0) {
    const rows = Array.from(tabelas[0].querySelectorAll('tr'))
    if (rows.length < 2) return []

    const header = Array.from(rows[0].querySelectorAll('td,th'))
      .map(td => td.textContent.trim().toLowerCase()
        .normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, ''))
    const alias = { nomecompleto:'nome', crm:'crm', email:'email',
                    telefone:'telefone', celular:'telefone',
                    especialidade:'especialidade', especialidades:'especialidade' }
    const cols = header.map(h => alias[h] ?? h)

    return rows.slice(1).map(row => {
      const vals = Array.from(row.querySelectorAll('td')).map(td => td.textContent.trim())
      const obj  = {}
      cols.forEach((c, i) => { obj[c] = vals[i] ?? '' })
      return obj
    }).filter(r => r.nome?.trim())
  }

  // Fallback: parágrafos separados por | ou ;
  const texto = div.textContent
  return parseTexto(texto)
}

// ── Componente ────────────────────────────────────────────────────────────────
export default function TabImportarProfissionais() {
  const [preview,    setPreview]    = useState(null)
  const [importando, setImportando] = useState(false)
  const [resultado,  setResultado]  = useState(null)
  const [erro,       setErro]       = useState('')
  const [nomeArq,    setNomeArq]    = useState('')
  const fileRef = useRef()

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
        if (!rows.length) { setErro('Não encontrei tabela com cabeçalho no Word. Certifique-se de que o arquivo tem uma tabela com as colunas: nome, crm, email, telefone, especialidade.'); return }
        setPreview(rows)
      } else {
        // CSV, TXT, TSV
        const text = await file.text()
        const rows = parseTexto(text)
        if (!rows.length) { setErro('Nenhuma linha válida encontrada. Verifique o formato e se a primeira linha contém os cabeçalhos.'); return }
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
      nome:          (r.nome || '').trim(),
      crm:           (r.crm  || '').trim(),
      email:         r.email?.trim()     || null,
      telefone:      r.telefone?.trim()  || null,
      especialidades: r.especialidade?.trim() ? [r.especialidade.trim()] : [],
      role:            'medico',
      status_aprovacao:'aprovado',
      ativo:           false,
    })).filter(r => r.nome)

    let ok = 0; const erros = []
    for (const reg of registros) {
      const { error } = await supabase.from('profissionais').insert(reg)
      if (error) erros.push(`${reg.nome}: ${error.message}`)
      else ok++
    }

    setImportando(false); setResultado({ ok, erros })
    setPreview(null)
    if (fileRef.current) fileRef.current.value = ''
  }

  return (
    <div className="space-y-5">

      {/* ── Passo 1: Baixar modelo ── */}
      <div className="rounded-xl p-4 space-y-3" style={{ background: 'var(--cor-superficie)', border: '1px solid var(--cor-borda)' }}>
        <p className="font-semibold text-sm" style={{ color: 'var(--cor-texto)' }}>1. Baixe o modelo CSV</p>
        <p className="text-xs" style={{ color: 'var(--cor-texto-suave)' }}>
          Preencha com os dados dos profissionais e envie para eles conferirem — ou preencha você mesmo. O arquivo pode ser editado no Excel, Google Sheets ou Word.
        </p>
        <Button onClick={baixarModelo} variant="outline"
          style={{ borderColor: 'var(--cor-primaria)', color: 'var(--cor-primaria)' }}>
          ⬇ Baixar modelo_profissionais.csv
        </Button>

        <div className="rounded-lg p-3 text-xs" style={{ background: '#FEF9C3', border: '1px solid #CA8A04' }}>
          <p style={{ color: '#92400E' }}>
            <strong>Formatos aceitos:</strong> <code>.csv</code> · <code>.txt</code> (vírgula, ponto-e-vírgula ou tab) · <code>.docx</code> (Word com tabela).<br/>
            Profissionais importados ficam <strong>aprovados</strong> e aparecem no autocomplete do Editor de Escala. Eles precisarão criar uma conta com o mesmo e-mail para acessar a plataforma.
          </p>
        </div>
      </div>

      {/* ── Passo 2: Upload ── */}
      <div className="rounded-xl p-4 space-y-3" style={{ background: 'var(--cor-superficie)', border: '1px solid var(--cor-borda)' }}>
        <p className="font-semibold text-sm" style={{ color: 'var(--cor-texto)' }}>2. Envie o arquivo preenchido</p>

        <label className="flex flex-col items-center justify-center gap-2 rounded-xl cursor-pointer transition-colors hover:bg-gray-50"
          style={{ border: '2px dashed var(--cor-borda)', padding: '24px 16px', textAlign: 'center' }}>
          <span style={{ fontSize: 28 }}>📂</span>
          <span className="text-sm font-medium" style={{ color: 'var(--cor-texto)' }}>
            {nomeArq ? nomeArq : 'Clique para selecionar'}
          </span>
          <span className="text-xs" style={{ color: 'var(--cor-texto-suave)' }}>
            .csv · .txt · .docx
          </span>
          <input ref={fileRef} type="file" accept=".csv,.txt,.tsv,.docx"
            className="hidden" onChange={handleFile} />
        </label>

        {erro && (
          <div className="rounded-lg p-3 text-sm" style={{ color: 'var(--cor-vago)', background: '#FEF2F2', border: '1px solid #FECACA' }}>
            {erro}
          </div>
        )}
      </div>

      {/* ── Passo 3: Preview ── */}
      {preview && preview.length > 0 && (
        <div className="rounded-xl p-4 space-y-3" style={{ background: 'var(--cor-superficie)', border: '1px solid var(--cor-borda)' }}>
          <p className="font-semibold text-sm" style={{ color: 'var(--cor-texto)' }}>
            3. Revisar — <strong>{preview.length}</strong> profissional(is) encontrado(s)
          </p>
          <div className="overflow-x-auto rounded-lg" style={{ border: '1px solid var(--cor-borda)', maxHeight: 320, overflowY: 'auto' }}>
            <table className="w-full text-xs" style={{ borderCollapse: 'collapse' }}>
              <thead style={{ position: 'sticky', top: 0 }}>
                <tr style={{ background: 'var(--cor-fundo)' }}>
                  {['#', 'Nome', 'CRM', 'E-mail', 'Telefone', 'Especialidade'].map(h => (
                    <th key={h} className="text-left px-3 py-2 font-semibold whitespace-nowrap"
                      style={{ color: 'var(--cor-texto-suave)', borderBottom: '1px solid var(--cor-borda)' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.map((r, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid var(--cor-borda)' }}
                    className={i % 2 === 0 ? '' : 'bg-gray-50/40'}>
                    <td className="px-3 py-1.5 text-center" style={{ color: 'var(--cor-texto-suave)' }}>{i + 1}</td>
                    <td className="px-3 py-1.5 font-medium" style={{ color: 'var(--cor-texto)' }}>{r.nome || '—'}</td>
                    <td className="px-3 py-1.5" style={{ color: 'var(--cor-texto-suave)' }}>{r.crm || '—'}</td>
                    <td className="px-3 py-1.5" style={{ color: 'var(--cor-texto-suave)' }}>{r.email || '—'}</td>
                    <td className="px-3 py-1.5" style={{ color: 'var(--cor-texto-suave)' }}>{r.telefone || '—'}</td>
                    <td className="px-3 py-1.5" style={{ color: 'var(--cor-texto-suave)' }}>{r.especialidade || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex gap-3 items-center">
            <Button onClick={handleImportar} disabled={importando}
              style={{ background: 'var(--cor-primaria)', color: '#fff' }}>
              {importando ? 'Importando…' : `Confirmar importação (${preview.length})`}
            </Button>
            <button onClick={() => { setPreview(null); setNomeArq(''); if (fileRef.current) fileRef.current.value = '' }}
              className="text-xs underline" style={{ color: 'var(--cor-texto-suave)' }}>
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* ── Resultado ── */}
      {resultado && (
        <div className="rounded-xl p-4 space-y-2"
          style={{ background: resultado.erros.length === 0 ? '#DCFCE7' : '#FEF9C3',
                   border: `1px solid ${resultado.erros.length === 0 ? '#16A34A' : '#CA8A04'}` }}>
          <p className="font-semibold text-sm"
            style={{ color: resultado.erros.length === 0 ? '#166534' : '#92400E' }}>
            {resultado.ok} importado(s) com sucesso{resultado.erros.length > 0 ? ` · ${resultado.erros.length} com erro` : ' ✓'}
          </p>
          {resultado.erros.slice(0, 10).map((e, i) => (
            <p key={i} className="text-xs" style={{ color: '#991B1B' }}>• {e}</p>
          ))}
          {resultado.erros.length > 10 && (
            <p className="text-xs" style={{ color: '#92400E' }}>…e mais {resultado.erros.length - 10} erros.</p>
          )}
          {resultado.erros.length > 0 && (
            <p className="text-xs mt-1" style={{ color: '#92400E' }}>
              Erros comuns: e-mail duplicado ou CRM já cadastrado. Corrija o arquivo e reimporte apenas os que falharam.
            </p>
          )}
        </div>
      )}
    </div>
  )
}
