import { Command as CommandPrimitive } from 'cmdk'
import { FolderSearch, Search, ShieldAlert } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { useUnidade } from '@/contexts/UnidadeContext'

import { GRUPO_TELAS, buscarNaPaleta, fontesEstaticas, pareceNome, type EntradaPaleta } from './fontesPaleta'
import type { ItemNav } from './navegacao'
import { useFontesDoBanco } from './useFontesDoBanco'

// Paleta de busca (09-comum-casca §4; protótipo .cc-paleta): Ctrl+K, "/" fora
// de campo, ou a lupa da topbar. Indexa telas, ferramentas e o que o papel
// alcança no banco (pacientes do acesso, setores, farmácia, unidades), com
// ranking tolerante a acento. Setas e Enter vêm do cmdk.
//
// "Fora do seu acesso": quando o termo parece nome de pessoa e nenhum paciente
// do acesso casa, a paleta explica por que não mostra e oferece o pedido de
// acesso ao prontuário. Ela NÃO consulta paciente fora do acesso — a linha é
// genérica e não confirma nem nega que o nome exista na unidade.

const GRUPO_FORA = 'Fora do seu acesso'
const CLASSE_GRUPO =
  '[&_[cmdk-group-heading]]:block [&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:pt-[9px] [&_[cmdk-group-heading]]:pb-[5px] [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:tracking-[0.07em] [&_[cmdk-group-heading]]:text-tinta-sussurro [&_[cmdk-group-heading]]:uppercase'
const CLASSE_ITEM =
  'group flex cursor-pointer items-center gap-2.5 rounded-controle px-3 py-[9px] text-tinta data-[selected=true]:bg-marca/10 data-[selected=true]:text-acao'

export function Paleta({
  aberta, onAbertaChange, telas, comFerramentas, comPlantao,
}: {
  aberta: boolean
  onAbertaChange: (v: boolean) => void
  telas: ItemNav[]
  comFerramentas: boolean
  comPlantao: boolean
}) {
  const navigate = useNavigate()
  const { papeisDaUnidade } = useUnidade()
  const [termo, setTermo] = useState('')
  const banco = useFontesDoBanco(aberta)

  // Ordem da amostra sem termo: telas, depois o que vem do banco, depois ferramentas.
  const indice = useMemo<EntradaPaleta[]>(() => {
    const est = fontesEstaticas({ telas, comFerramentas, comPlantao })
    return [...est.filter((x) => x.grupo === GRUPO_TELAS), ...banco.entradas, ...est.filter((x) => x.grupo !== GRUPO_TELAS)]
  }, [telas, comFerramentas, comPlantao, banco.entradas])

  const busca = useMemo(() => buscarNaPaleta(indice, termo), [indice, termo])

  const grupos = useMemo(() => {
    const m = new Map<string, EntradaPaleta[]>()
    for (const r of busca.itens) m.set(r.grupo, [...(m.get(r.grupo) ?? []), r])
    return [...m.entries()]
  }, [busca.itens])

  // Só quando a fonte de pacientes respondeu (sem ela não dá para dizer "fora"),
  // o termo parece nome e nada casou pelo nome — "dopa" acha a Dopamina e não
  // precisa de aviso.
  const mostrarFora = banco.pacientesProntos && pareceNome(termo) && !busca.algumPaciente && !busca.algumPeloNome

  const dica = papeisDaUnidade.includes('plantonista')
    ? 'Buscar ferramenta, paciente, leito, tela…'
    : papeisDaUnidade.includes('farmaceutico')
      ? 'Buscar diluição, falta, tela…'
      : papeisDaUnidade.includes('gestor')
        ? 'Buscar tela, setor, ferramenta…'
        : papeisDaUnidade.includes('admin')
          ? 'Buscar tela ou unidade…'
          : 'Buscar tela…'

  function fechar() {
    onAbertaChange(false)
    setTermo('')
  }

  function abrir(to: string) {
    fechar()
    navigate(to)
  }

  return (
    <Dialog open={aberta} onOpenChange={(v) => { onAbertaChange(v); if (!v) setTermo('') }}>
      <DialogContent
        showCloseButton={false}
        className="top-[84px] flex max-h-[calc(100dvh-96px)] w-full max-w-[calc(100%-24px)] translate-y-0 flex-col gap-0 overflow-hidden rounded-cartao border-0 p-0 shadow-paleta sm:max-w-[640px]"
      >
        <DialogTitle className="sr-only">Buscar no Chefe Coruja</DialogTitle>
        <CommandPrimitive shouldFilter={false} loop label="Buscar" className="flex min-h-0 flex-col">
          <div className="flex items-center gap-[11px] border-b border-trilha px-[18px] py-[15px]">
            <Search className="size-[18px] shrink-0 text-tinta-sussurro" aria-hidden />
            <CommandPrimitive.Input
              autoFocus
              value={termo}
              onValueChange={setTermo}
              placeholder={dica}
              aria-label="Buscar"
              className="min-w-0 flex-1 border-0 bg-transparent text-[16px] text-tinta outline-none placeholder:text-tinta-sussurro focus-visible:shadow-none"
            />
            <kbd className="cc-tecla">esc</kbd>
          </div>

          <CommandPrimitive.List aria-label="Resultados" className="max-h-[384px] min-h-0 overflow-y-auto p-1.5">
            <CommandPrimitive.Empty className="px-3.5 py-[26px] text-center text-apoio text-tinta-sussurro">
              Nada com esse nome no seu acesso.
            </CommandPrimitive.Empty>

            {grupos.map(([grupo, itens]) => (
              <CommandPrimitive.Group key={grupo} heading={grupo} className={CLASSE_GRUPO}>
                {itens.map((x) => {
                  const Icone = x.icone
                  return (
                    <CommandPrimitive.Item key={x.id} value={x.id} onSelect={() => abrir(x.to)} className={CLASSE_ITEM}>
                      {Icone && <Icone className="size-4 shrink-0" aria-hidden />}
                      <span className="max-w-[60%] shrink-0 truncate text-controle font-medium">{x.rotulo}</span>
                      <span className="min-w-0 flex-1 truncate text-apoio text-tinta-sussurro">{x.detalhe}</span>
                      <kbd className="cc-tecla invisible shrink-0 group-data-[selected=true]:visible">↵</kbd>
                    </CommandPrimitive.Item>
                  )
                })}
              </CommandPrimitive.Group>
            ))}

            {mostrarFora && (
              <CommandPrimitive.Group heading={GRUPO_FORA} className={CLASSE_GRUPO}>
                {/* Linha bloqueada: não é destino (disabled — setas pulam, Enter não fecha). */}
                <CommandPrimitive.Item
                  value="fora:motivo"
                  disabled
                  className="flex cursor-default items-start gap-2.5 rounded-controle px-3 py-[9px] text-tinta-sussurro"
                >
                  <ShieldAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="text-controle font-medium">Nenhum paciente com esse nome no seu acesso</span>
                    <span className="text-apoio leading-[1.45] text-pretty">
                      A busca só mostra pacientes dos setores em que você está na escala agora. Se o paciente existir em
                      outro setor, a leitura do prontuário é por pedido ao gestor: vale 24 h, só leitura.
                    </span>
                  </span>
                </CommandPrimitive.Item>
                <CommandPrimitive.Item value="fora:pedir" onSelect={() => abrir('/prontuarios')} className={CLASSE_ITEM}>
                  <FolderSearch className="size-4 shrink-0" aria-hidden />
                  <span className="min-w-0 flex-1 truncate text-controle font-medium">Pedir acesso ao prontuário</span>
                  <kbd className="cc-tecla invisible shrink-0 group-data-[selected=true]:visible">↵</kbd>
                </CommandPrimitive.Item>
              </CommandPrimitive.Group>
            )}
          </CommandPrimitive.List>

          <div className="flex flex-wrap items-center gap-3.5 border-t border-trilha bg-campo px-4 py-2.5 text-rotulo text-tinta-sussurro">
            <span className="flex items-center gap-[5px]"><kbd className="cc-tecla">↑</kbd><kbd className="cc-tecla">↓</kbd>navegar</span>
            <span className="flex items-center gap-[5px]"><kbd className="cc-tecla">↵</kbd>abrir</span>
            <span className="ml-auto flex items-center gap-[5px]">
              <kbd className="cc-tecla">ctrl</kbd><kbd className="cc-tecla">K</kbd>ou<kbd className="cc-tecla">/</kbd>de qualquer tela
            </span>
          </div>
        </CommandPrimitive>
      </DialogContent>
    </Dialog>
  )
}
