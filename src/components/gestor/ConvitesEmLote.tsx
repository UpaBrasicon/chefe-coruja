// Convites em lote (Fase 1, item 16b; CA2 = A do RT em 23/11/2026). O gestor
// cola a lista, uma pessoa por linha ("Nome" ou "Nome; papel"), e a tela gera
// um convite por pessoa pela mesma gerar_convite de sempre, uma de cada vez.
// No fim, baixa um CSV com nome, papel, código e validade para entregar.
import * as React from 'react'
import { Download, Users } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { LIMITE_LOTE, csvConvitesLote, lerLista, type ConviteGerado } from '@/domain/convitesLote'
import { useGerarConvite } from '@/hooks/useConvites'
import { PAPEL_LABEL } from '@/lib/constants'
import { baixarCsv, nomeArquivoCsv } from '@/lib/csv'
import { dataHora, dataIso } from '@/lib/formato'
import { formatarDiaHora } from '@/lib/primeiroAcesso'
import type { Papel } from '@/types/database'

const VALIDADES: Record<string, string> = { '2': '2 dias', '7': '7 dias', '14': '14 dias', '30': '30 dias' }

export function ConvitesEmLote({ unidadeId, unidadeNome, papeis, aberto, onFechar }: {
  unidadeId: string; unidadeNome: string; papeis: readonly Papel[]; aberto: boolean; onFechar: () => void
}) {
  const gerar = useGerarConvite(unidadeId)
  const [papelPadrao, setPapelPadrao] = React.useState<Papel | null>(null)
  const [validade, setValidade] = React.useState('7')
  const [texto, setTexto] = React.useState('')
  const [rodando, setRodando] = React.useState(false)
  const [gerados, setGerados] = React.useState<ConviteGerado[]>([])
  const [falhas, setFalhas] = React.useState<string[]>([])

  const opcoes = papeis.map((p) => ({ papel: p, rotulo: PAPEL_LABEL[p] }))
  const linhas = lerLista(texto, papelPadrao, opcoes)
  const comErro = linhas.filter((l) => l.erro)
  const demais = linhas.length > LIMITE_LOTE
  const pode = linhas.length > 0 && comErro.length === 0 && !demais && !rodando
  const terminou = gerados.length > 0 || falhas.length > 0

  function fechar() {
    if (rodando) return
    setTexto(''); setGerados([]); setFalhas([]); setPapelPadrao(null); setValidade('7')
    onFechar()
  }

  async function gerarTodos() {
    setRodando(true); setGerados([]); setFalhas([])
    for (const l of linhas) {
      try {
        const r = await gerar.mutateAsync({ papel: l.papel as Papel, paraQuem: l.paraQuem, validadeDias: Number(validade) })
        setGerados((g) => [...g, { paraQuem: l.paraQuem, papelRotulo: PAPEL_LABEL[l.papel as Papel], codigo: r.codigo, expiraEm: r.expira_em }])
      } catch (e) {
        setFalhas((f) => [...f, `${l.paraQuem}: ${e instanceof Error ? e.message : 'não gerou'}`])
      }
    }
    setRodando(false)
  }

  function baixar() {
    baixarCsv(nomeArquivoCsv(`convites ${unidadeNome}`, dataIso()), csvConvitesLote(gerados, unidadeNome, dataHora(Date.now()), formatarDiaHora))
  }

  const itensPapel = { nenhum: 'Sem padrão (cada linha diz o papel)', ...Object.fromEntries(papeis.map((p) => [p, PAPEL_LABEL[p]])) }

  return (
    <Dialog open={aberto} onOpenChange={(o) => { if (!o) fechar() }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Convites em lote</DialogTitle>
          <DialogDescription>
            Para {unidadeNome}. Um convite por pessoa, com as mesmas regras do convite único; nenhuma conta é criada aqui.
          </DialogDescription>
        </DialogHeader>

        {!terminou ? (
          <div className="flex flex-col gap-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label>Papel padrão</Label>
                <Select items={itensPapel} value={papelPadrao ?? 'nenhum'} onValueChange={(v) => setPapelPadrao(!v || v === 'nenhum' ? null : (v as Papel))}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(itensPapel).map(([v, r]) => <SelectItem key={v} value={v}>{r}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Validade</Label>
                <Select items={VALIDADES} value={validade} onValueChange={(v) => setValidade((v as string) ?? '7')}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(VALIDADES).map(([v, r]) => <SelectItem key={v} value={v}>{r}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="cv-lote">Pessoas <span className="font-normal text-tinta-sussurro">(uma por linha; "Nome" ou "Nome; papel"; até {LIMITE_LOTE})</span></Label>
              <Textarea id="cv-lote" rows={8} value={texto} onChange={(e) => setTexto(e.target.value)}
                placeholder={'Dra. Helena Barros; Médico\nJoão Lima; Técnico de enfermagem\nAna Souza'} />
              <span className="text-rotulo text-tinta-sussurro">{linhas.length} {linhas.length === 1 ? 'pessoa' : 'pessoas'}</span>
            </div>
            {demais && <p role="alert" className="text-apoio text-critico">Mais de {LIMITE_LOTE} pessoas: divida em dois lotes.</p>}
            {comErro.length > 0 && (
              <ul role="alert" className="flex flex-col gap-0.5 text-apoio text-critico">
                {comErro.slice(0, 8).map((l) => <li key={l.linha}>Linha {l.linha}: {l.erro}</li>)}
                {comErro.length > 8 && <li>e mais {comErro.length - 8}.</li>}
              </ul>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={fechar}>Voltar</Button>
              <Button disabled={!pode} onClick={() => void gerarTodos()}>
                <Users /> {rodando ? `Gerando ${gerados.length + falhas.length + 1} de ${linhas.length}…` : `Gerar ${linhas.length || ''} convites`}
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <p role="status" className="text-apoio text-tinta">
              {rodando ? `Gerando ${gerados.length + falhas.length} de ${linhas.length}…` : `${gerados.length} ${gerados.length === 1 ? 'convite gerado' : 'convites gerados'}${falhas.length ? `, ${falhas.length} com erro` : ''}.`}
            </p>
            {falhas.length > 0 && (
              <ul className="flex flex-col gap-0.5 text-apoio text-critico">{falhas.map((f) => <li key={f}>{f}</li>)}</ul>
            )}
            <ul className="max-h-60 overflow-y-auto rounded-container border border-fio">
              {gerados.map((g) => (
                <li key={g.codigo} className="flex flex-wrap items-center gap-x-3 border-b border-trilha px-3 py-1.5 text-apoio last:border-0">
                  <span className="min-w-0 flex-1 text-tinta">{g.paraQuem} <span className="text-tinta-sussurro">· {g.papelRotulo}</span></span>
                  <span className="tabular font-semibold tracking-[0.12em] text-acao-pressionada">{g.codigo}</span>
                </li>
              ))}
            </ul>
            <p className="text-rotulo text-tinta-sussurro">Os códigos também ficam na lista de convites da unidade. Cada um abre um acesso só.</p>
            <DialogFooter>
              <Button variant="outline" disabled={rodando || gerados.length === 0} onClick={baixar}><Download /> Baixar lista (CSV)</Button>
              <Button disabled={rodando} onClick={fechar}>Pronto</Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
