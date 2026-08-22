import { Navigate, useLocation, useParams } from 'react-router-dom'

/**
 * Redireciona uma rota legada para o novo destino agrupado, **preservando a
 * query string original**.
 *
 * O reagrupamento das abas não pode quebrar links salvos, notificações push,
 * QR codes impressos nem o histórico do navegador dos plantonistas — por isso
 * toda rota antiga continua existindo e cai na aba certa.
 *
 * `para` aceita `:param` (ex.: `/plantao/:secao/:tool`).
 */
export function Redirecionar({ para }: { para: string }) {
  const { search } = useLocation()
  const params = useParams()

  const [caminho, queryDoDestino = ''] = para.split('?')

  const resolvido = caminho.replace(/:([A-Za-z0-9_]+)/g, (todo, nome: string) => {
    const valor = params[nome]
    return valor ? encodeURIComponent(valor) : todo
  })

  const juntas = new URLSearchParams(queryDoDestino)
  new URLSearchParams(search).forEach((valor, chave) => {
    if (!juntas.has(chave)) juntas.append(chave, valor)
  })

  const qs = juntas.toString()
  return <Navigate to={qs ? `${resolvido}?${qs}` : resolvido} replace />
}
