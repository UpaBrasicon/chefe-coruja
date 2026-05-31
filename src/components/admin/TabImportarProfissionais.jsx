import { useState, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { Button } from '../ui/button'

const CAMPOS = ['nome', 'crm', 'email', 'telefone', 'especialidade']
const EXEMPLO = [
  ['João da Silva', '12345', 'joao@email.com', '62999990001', 'Clínica Geral'],
  ['Maria Santos', '67890', 'maria@email.com', '62999990002', 'Pediatria'],
]

function baixarModelo() {
  const header = CAMPOS.join(',')
  const linhas = EXEMPLO.map(r => r.map(v => `"${v}"`).join(','))
  const csv = [header, ...linhas].join('\n')
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a'); a.href = url; a.download = 'modelo_profissionais.csv'; a.click()
  URL.revokeObjectURL(url)
}

function parseCSV(text) {
  const linhas = text.trim().split('\n').filter(l => l.trim())
  if (linhas.length < 2) return []
  const header = linhas[0].split(',').map(h => h.trim().toLowerCase().replace(/[^a-záàâãéíóôõúç_]/gi, ''))
  return linhas.slice(1).map(linha => {
    const cols = linha.match(/("([^"]*)"|[^,]*)/g)?.map(v => v.replace(/^"|"$/g, '').trim()) ?? []
    const obj = {}
    header.forEach((h, i) => { obj[h] = cols[i] ?? '' })
    return obj
  }).filter(r => r.nome || r['nome completo'])
}

export default function TabImportarProfissionais() {
  const [preview, setPreview] = useState(null) // array of rows
  const [importando, setImportando] = useState(false)
  const [resultado, setResultado] = useState(null)
  const [erro, setErro] = useState('')
  const fileRef = useRef()

  function handleFile(e) {
    const file = e.target.files[0]; if (!file) return
    setErro(''); setPreview(null); setResultado(null)
    const reader = new FileReader()
    reader.onload = ev => {
      const rows = parseCSV(ev.target.result)
      if (rows.length === 0) { setErro('Nenhuma linha encontrada. Verifique o formato do arquivo.'); return }
      setPreview(rows)
    }
    reader.readAsText(file, 'UTF-8')
  }

  async function handleImportar() {
    if (!preview?.length) return
    setImportando(true); setErro('')

    const registros = preview.map(r => ({
      nome: r.nome || r['nome completo'] || '',
      crm: r.crm || '',
      email: r.email || null,
      telefone: r.telefone || null,
      especialidades: r.especialidade ? [r.especialidade] : [],
      role: 'medico',
      status_aprovacao: 'aprovado',
      ativo: true,
    })).filter(r => r.nome)

    let ok = 0, erros = []
    for (const reg of registros) {
      const { error } = await supabase.from('profissionais').insert(reg)
      if (error) erros.push(`${reg.nome}: ${error.message}`)
      else ok++
    }

    setImportando(false)
    setResultado({ ok, erros })
    setPreview(null)
    if (fileRef.current) fileRef.current.value = ''
  }

  return (
    <div className="space-y-5">

      {/* Download modelo */}
      <div className="rounded-xl p-4 space-y-3" style={{ background: 'var(--cor-superficie)', border: '1px solid var(--cor-borda)' }}>
        <div>
          <p className="font-semibold text-sm mb-1" style={{ color: 'var(--cor-texto)' }}>1. Baixe o modelo CSV</p>
          <p className="text-xs mb-3" style={{ color: 'var(--cor-texto-suave)' }}>
            Preencha o arquivo com os dados dos profissionais: nome, CRM, e-mail, telefone e especialidade.
            Distribua para os médicos conferirem os dados antes de importar, ou preencha você mesmo.
          </p>
          <Button onClick={baixarModelo} variant="outline"
            style={{ borderColor: 'var(--cor-primaria)', color: 'var(--cor-primaria)' }}>
            ⬇ Baixar modelo_profissionais.csv
          </Button>
        </div>

        <div className="rounded-lg p-3 text-xs" style={{ background: '#FEF9C3', border: '1px solid #CA8A04' }}>
          <p style={{ color: '#92400E' }}>
            <strong>Importante:</strong> Profissionais importados receberão status <strong>Aprovado</strong> direto.
            Eles ainda precisarão criar uma conta no sistema com o mesmo e-mail para acessar a plataforma.
            Use o template de escala normalmente enquanto isso — os nomes aparecem no autocomplete.
          </p>
        </div>
      </div>

      {/* Upload */}
      <div className="rounded-xl p-4 space-y-3" style={{ background: 'var(--cor-superficie)', border: '1px solid var(--cor-borda)' }}>
        <p className="font-semibold text-sm" style={{ color: 'var(--cor-texto)' }}>2. Faça o upload do CSV preenchido</p>
        <input
          ref={fileRef}
          type="file"
          accept=".csv,text/csv"
          onChange={handleFile}
          className="text-sm"
          style={{ color: 'var(--cor-texto)' }}
        />
        {erro && <p className="text-sm rounded-lg p-3" style={{ color: 'var(--cor-vago)', background: '#FEF2F2' }}>{erro}</p>}
      </div>

      {/* Preview */}
      {preview && preview.length > 0 && (
        <div className="rounded-xl p-4 space-y-3" style={{ background: 'var(--cor-superficie)', border: '1px solid var(--cor-borda)' }}>
          <p className="font-semibold text-sm" style={{ color: 'var(--cor-texto)' }}>
            3. Revisar — {preview.length} profissional(is) encontrado(s)
          </p>
          <div className="overflow-x-auto rounded-lg" style={{ border: '1px solid var(--cor-borda)' }}>
            <table className="w-full text-xs" style={{ borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--cor-fundo)' }}>
                  {['Nome', 'CRM', 'E-mail', 'Telefone', 'Especialidade'].map(h => (
                    <th key={h} className="text-left px-3 py-2 font-semibold"
                      style={{ color: 'var(--cor-texto-suave)', borderBottom: '1px solid var(--cor-borda)' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.map((r, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid var(--cor-borda)' }}>
                    <td className="px-3 py-1.5 font-medium" style={{ color: 'var(--cor-texto)' }}>{r.nome || r['nome completo'] || '—'}</td>
                    <td className="px-3 py-1.5" style={{ color: 'var(--cor-texto-suave)' }}>{r.crm || '—'}</td>
                    <td className="px-3 py-1.5" style={{ color: 'var(--cor-texto-suave)' }}>{r.email || '—'}</td>
                    <td className="px-3 py-1.5" style={{ color: 'var(--cor-texto-suave)' }}>{r.telefone || '—'}</td>
                    <td className="px-3 py-1.5" style={{ color: 'var(--cor-texto-suave)' }}>{r.especialidade || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Button onClick={handleImportar} disabled={importando}
            style={{ background: 'var(--cor-primaria)', color: '#fff' }}>
            {importando ? 'Importando…' : `Confirmar importação (${preview.length})`}
          </Button>
        </div>
      )}

      {/* Resultado */}
      {resultado && (
        <div className="rounded-xl p-4 space-y-2"
          style={{ background: resultado.erros.length === 0 ? '#DCFCE7' : '#FEF9C3', border: `1px solid ${resultado.erros.length === 0 ? '#16A34A' : '#CA8A04'}` }}>
          <p className="font-semibold text-sm" style={{ color: resultado.erros.length === 0 ? '#166534' : '#92400E' }}>
            {resultado.ok} importado(s) com sucesso{resultado.erros.length > 0 ? ` · ${resultado.erros.length} com erro` : ' ✓'}
          </p>
          {resultado.erros.map((e, i) => (
            <p key={i} className="text-xs" style={{ color: '#991B1B' }}>• {e}</p>
          ))}
          {resultado.erros.length > 0 && (
            <p className="text-xs" style={{ color: '#92400E' }}>
              Erros comuns: e-mail duplicado ou CRM já cadastrado. Verifique o arquivo e tente novamente.
            </p>
          )}
        </div>
      )}
    </div>
  )
}
