# Matriz competitiva (uso interno)

Backlog comercial, item 7, atualizado em 15/11/2026 com M1 a M4 = A (`docs/comercial/MATRIZ-DIAGNOSTICO.md`). Substitui a matriz de 08/10/2026 (`produto/docs/comercial/`, fora do git).

**Uso interno: não enviar a cliente.** Material de cliente não cita marca de concorrente.

- `matriz.html`: três páginas A4 em paisagem (a matriz, "Como ler a matriz" e as fontes).
- `pesquisa-concorrentes.md`: a evidência célula a célula. A parte de 08/10/2026 segue igual; a seção "Atualização de 15/11/2026" traz os critérios novos, o e-SUS APS e a situação da SBIS.
- `gerar-pdf.mjs`: gera o PDF e uma imagem por página.

```bash
node docs/comercial/matriz/gerar-pdf.mjs tmp/comercial/matriz-competitiva-interna.pdf
```

"Não encontrado" não quer dizer "não tem". O PDF, as imagens e a cópia do mascote não vão para o git.

**Aprovação:** o RT aprovou a matriz em 15/11/2026 ("Aprovado").
