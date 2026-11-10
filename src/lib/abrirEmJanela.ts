// Abre um arquivo do storage (URL assinada) numa aba nova sem cair no
// bloqueador de pop-up. O Safari e o navegador do celular só deixam abrir uma
// janela no próprio clique: se o window.open vier depois de um await (RPC de
// liberação, URL assinada), a aba é barrada. Por isso a janela abre na hora,
// vazia, e recebe o endereço quando ele chega (achado da lacuna 11, 10/11/2026).
//
// `obter` devolve a URL; `null` quando não há o que abrir numa aba (ex.: o
// anexo da regulação que é documento e abre na própria tela). Em erro ou
// `null`, a janela vazia é fechada.
export async function abrirEmJanela(obter: () => Promise<string | null>): Promise<void> {
  const janela = window.open('', '_blank')
  try {
    const url = await obter()
    if (!url) {
      janela?.close()
      return
    }
    if (janela) {
      janela.opener = null
      janela.location.href = url
    } else {
      window.open(url, '_blank', 'noopener')
    }
  } catch (e) {
    janela?.close()
    throw e
  }
}
