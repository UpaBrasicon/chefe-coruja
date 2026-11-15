# One-page do Chefe Coruja

Backlog comercial, item 2, atualizado em 15/11/2026 com O1 a O5 = A (`docs/comercial/ONE-PAGE-DIAGNOSTICO.md`). Substitui a one-page de 08/10/2026 (`produto/docs/comercial/`, fora do git).

- `one-page.html`: a página A4, com o mesmo texto do pitch deck (`docs/comercial/pitch/slides.md`).
- `porta.jpg`: recorte da tela Porta da rede de demonstração (pacientes e equipe fictícios).
- `gerar-pdf.mjs`: gera o PDF e uma imagem de conferência, e avisa se o conteúdo passar de uma página. O mascote é copiado de `public/landing/coruja.webp`.

```bash
node docs/comercial/one-page/gerar-pdf.mjs tmp/comercial/chefe-coruja-one-page.pdf
```

O PDF, a imagem de conferência e a cópia do mascote não vão para o git.
