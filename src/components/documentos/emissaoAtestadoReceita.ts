// Emissão do atestado e da receita para casa, comum à porta (aba "Atestado e
// receita") e ao leito ("Alta e documentos", pontos 14 e 16 do plantonista).
// A folha tem os mesmos campos das telas avulsas; o documento é emitido pelo
// rascunho do banco (abrirImpressao → salvar_rascunho → emitir_rascunho), que
// liga à internação ativa do paciente quando ela existe.
import { useQuery } from '@tanstack/react-query'
import * as React from 'react'

import { supabase } from '@/lib/supabase'
import { abrirImpressao } from '@/lib/prontuario'
import { idadeLegivel } from '@/lib/cadastroPaciente'
import { ativas, useAlergias } from '@/components/paciente/useAlergias'
import { dataIso } from '@/lib/formato'
import type { EstadoDocs } from '@/lib/documentosAlta'

type Opcoes = {
  pacienteId: string; nome: string; nascimento: string | null
  /** O leito e o diagnóstico vão na folha quando conhecidos (o leito os tem; a porta não). */
  leito?: string; diagnostico?: string
  /** Onde preencher o CID quando ele falta (o texto do aviso). */
  ondePreencherCid: string
  estado: EstadoDocs; setEstado: (f: (s: EstadoDocs) => EstadoDocs) => void
  aoEmitir?: () => void
}

export function useEmissaoAtestadoReceita({ pacienteId, nome, nascimento, leito = '', diagnostico = '', ondePreencherCid, estado, setEstado, aoEmitir }: Opcoes) {
  const [erro, setErro] = React.useState<string | null>(null)
  const alergias = useAlergias(pacienteId)
  // mesma chave e forma de AbaPrescricao / PrescricaoEstruturada (cache comum)
  const peso = useQuery({
    queryKey: ['peso-atual', pacienteId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('observacao').select('valor_num, aferido_em, conceito!inner(nome)')
        .eq('paciente_id', pacienteId).eq('conceito.nome', 'peso').order('aferido_em', { ascending: false }).limit(1)
      if (error) throw error
      return (data?.[0] ?? null) as { valor_num: number; aferido_em: string } | null
    },
  })

  // folha: mesmos campos das telas avulsas (src/pages/plantao/shared/rascunho.ts)
  const pacienteFolha = () => ({
    nome, nascimento: nascimento ? nascimento.split('-').reverse().join('/') : '', dataAtual: dataIso(),
    // idade (na data da folha) e peso aferido quando conhecidos (a folha acrescenta "kg"); sem dado, em branco
    idade: nascimento ? idadeLegivel(nascimento) : '',
    peso: peso.data?.valor_num != null ? String(peso.data.valor_num).replace('.', ',') : '',
    alergias: !alergias.data ? 'NÃO VERIFICADA'
      : alergias.data.estado === 'tem' ? ativas(alergias.data).map((a) => a.substancia).join(', ')
      : alergias.data.estado === 'nega' ? 'NEGA' : 'NÃO REGISTRADA',
    dieta: '', leito, diagnostico, paciente_id: pacienteId,
  })
  async function emitir(tipo: 'atestado' | 'receita', conteudo: unknown) {
    const impressao = await abrirImpressao({ pacienteId, internacaoId: null, tipo: tipo === 'atestado' ? 'Atestado' : 'Receituário', documento: { tipo, conteudo: JSON.stringify(conteudo) } })
    if (!impressao) return false
    impressao.janela.focus()
    window.setTimeout(() => impressao.janela.print(), 300)
    aoEmitir?.()
    return true
  }

  async function emitirAtestado(cid: string) {
    if (estado.atTipo === 'afastamento' && !(Number(estado.atDias) > 0)) return setErro('Informe os dias de afastamento.')
    if (estado.atCid && !cid.trim()) return setErro(`Para incluir o CID, ${ondePreencherCid}.`)
    setErro(null)
    const ok = await emitir('atestado', {
      paciente: pacienteFolha(),
      atestado: { tipo: estado.atTipo, dias: estado.atTipo === 'afastamento' ? estado.atDias : '', cid: estado.atCid ? cid.trim() : '', texto: '' },
    })
    if (ok) setEstado((s) => ({ ...s, atEmitidoEm: new Date().toISOString() }))
  }
  async function emitirReceita() {
    if (!estado.receita.length) return setErro('A receita não tem itens.')
    setErro(null)
    const ok = await emitir('receita', {
      paciente: pacienteFolha(),
      receita: { tipo: 'branca', obs: '', itens: estado.receita.map((i) => ({ id: i.id, medicamento: i.medicamento, dose: '', posologia: i.posologia, quantidade: i.quantidade })) },
    })
    if (ok) setEstado((s) => ({ ...s, rxEmitidaEm: new Date().toISOString() }))
  }
  return { erro, emitirAtestado, emitirReceita }
}
