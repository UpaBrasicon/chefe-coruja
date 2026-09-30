// Busca de CID-10 e de procedimento SIGTAP no desenho do protótipo: o campo é
// de texto e a lista aparece embaixo enquanto se escreve. Escolher da lista
// confirma (cidOk); escrever de novo desconfirma. Tabelas do banco
// (terminologia_buscar e procedimentos_do_cid).
import { useQuery } from '@tanstack/react-query'
import * as React from 'react'

import { supabase } from '@/lib/supabase'
import { useTerminologia } from '@/hooks/useTerminologia'
import { Sugestoes, Texto, type Largura } from './ui'

export function BuscaCid({ id, rotulo, valor, confirmado, onDigitar, onEscolher, dica = 'Digite o CID ou o nome da doença', largura = 'cheio', ajuda }: {
  id: string; rotulo: string; valor: string; confirmado?: boolean
  onDigitar: (v: string) => void; onEscolher: (codigo: string, nome: string) => void
  dica?: string; largura?: Largura; ajuda?: React.ReactNode
}) {
  const [foco, setFoco] = React.useState(false)
  const termo = valor.split(' — ')[0].trim()
  const r = useTerminologia('cid10', confirmado || !foco ? '' : termo, 8)
  const itens = (r.data ?? []).filter((x) => !(x.codigo === termo && (r.data ?? []).length === 1))
  return (
    <Texto id={id} rotulo={rotulo} valor={valor} onChange={onDigitar} dica={dica} largura={largura} ajuda={ajuda}
      onFocus={() => setFoco(true)} onBlur={() => setFoco(false)}>
      {foco && !confirmado && (
        <Sugestoes itens={itens.map((x) => ({ chave: x.codigo, codigo: x.codigo, nome: x.descricao }))}
          aoEscolher={(i) => { onEscolher(itens[i].codigo, itens[i].descricao); setFoco(false) }} />
      )}
    </Texto>
  )
}

type Procedimento = { codigo: string; nome: string; compativel: boolean; como_principal: boolean }

/** 0303140151 → 03.03.14.015-1 (como no SIGTAP) */
// eslint-disable-next-line react-refresh/only-export-components
export const formatarSigtap = (c: string) => c.replace(/\D/g, '').replace(/^(\d{2})(\d{2})(\d{2})(\d{3})(\d)$/, '$1.$2.$3.$4-$5')

export function BuscaProcedimento({ id, rotulo = 'Procedimento (SIGTAP)', cid, cidOk, procDesc, procCod, onDigitar, onEscolher, largura = 'cheio' }: {
  id: string; rotulo?: string; cid: string; cidOk?: boolean; procDesc: string; procCod: string
  onDigitar: (v: string) => void; onEscolher: (codigo: string, nome: string) => void; largura?: Largura
}) {
  const [foco, setFoco] = React.useState(false)
  const [escolhido, setEscolhido] = React.useState(!!procCod)
  const digitado = procDesc.trim()
  const cidCod = cid.split(' — ')[0].trim()
  // Com o CID escolhido e nada escrito, a lista mostra o que o SIGTAP liga a ele.
  const ativo = !escolhido && (digitado.length >= 3 || (!!cidOk && !!cidCod && !digitado))
  const lista = useQuery({
    queryKey: ['procedimentos-do-cid', digitado ? '' : cidCod, digitado],
    enabled: ativo,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('procedimentos_do_cid', { p_cid: digitado ? '' : cidCod, p_termo: digitado || undefined, p_limite: 20 })
      if (error) throw error
      return (data ?? []) as Procedimento[]
    },
  })
  const itens = ativo ? lista.data ?? [] : []
  const semCompativel = !!cidOk && !!cidCod && !digitado && !escolhido && lista.isSuccess && itens.length === 0
  return (
    <Texto id={id} rotulo={rotulo} valor={procDesc} largura={largura} dica="Digite o nome ou o código"
      onChange={(v) => { setEscolhido(false); onDigitar(v) }} onFocus={() => setFoco(true)} onBlur={() => setFoco(false)}
      ajuda={!digitado && cidOk && itens.length ? 'Compatível com o CID principal (SIGTAP)'
        : semCompativel ? 'Nenhum procedimento com esse CID na tabela SIGTAP carregada. Nem todo procedimento tem CID vinculado: busque pelo nome.'
        : procCod ? `Código ${procCod}` : undefined}>
      {(foco || (!digitado && cidOk)) && (
        <Sugestoes itens={itens.map((p) => ({ chave: p.codigo, codigo: formatarSigtap(p.codigo), nome: p.nome }))}
          aoEscolher={(i) => { setEscolhido(true); onEscolher(formatarSigtap(itens[i].codigo), itens[i].nome); setFoco(false) }} />
      )}
    </Texto>
  )
}

/** Lista fixa com filtro (especialidade, procedência): abre ao clicar ou ao escrever. */
export function BuscaLista({ id, rotulo, valor, opcoes, onDigitar, onEscolher, dica, largura = 'cheio' }: {
  id: string; rotulo: string; valor: string; opcoes: string[]; onDigitar: (v: string) => void; onEscolher: (v: string) => void
  dica?: string; largura?: Largura
}) {
  const [foco, setFoco] = React.useState(false)
  const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  const q = norm(valor.trim())
  const itens = foco && !opcoes.includes(valor) ? opcoes.filter((o) => !q || norm(o).includes(q)) : []
  return (
    <Texto id={id} rotulo={rotulo} valor={valor} onChange={onDigitar} dica={dica} largura={largura}
      onFocus={() => setFoco(true)} onBlur={() => setFoco(false)}>
      <Sugestoes itens={itens.map((o) => ({ chave: o, nome: o }))} aoEscolher={(i) => { onEscolher(itens[i]); setFoco(false) }} />
    </Texto>
  )
}
