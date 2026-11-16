# J5: evidência de Preços, Contato e Privacidade

Pedido 8, caminho C, J5, com as decisões K1–K3 do RT de 12/11/2026 (`docs/landing/J5-PRECOS-CONTATO-DIAGNOSTICO.md`). Conferido em 12/11/2026, na produção.

## Subdomínio

- `planos.chefecoruja.com.br` está no projeto Vercel `chefe-coruja-landing`.
- O RT criou no Cloudflare o CNAME `planos` → `33aa1cea82d82f06.vercel-dns-017.com`, sem proxy.
- O certificado é do Let's Encrypt, para `planos.chefecoruja.com.br`, e vale até 10/02/2027. O Vercel renova sozinho.
- A variável `NEXT_PUBLIC_SITE_URL` do projeto passou a ser `https://planos.chefecoruja.com.br`.

## Páginas

| Endereço | Resultado |
|---|---|
| `/precos` | 200, canônico `https://planos.chefecoruja.com.br/precos` |
| `/contato` | 200 |
| `/privacidade` | 200 |
| `/obrigado` | 200 |
| `/` | 307 para `https://www.chefecoruja.com.br/` |
| `/funcionalidades` | 307 para `https://www.chefecoruja.com.br/#registro` |
| `/sitemap.xml` | só `/precos`, `/contato` e `/privacidade`, no subdomínio |

## Links na página do app

Conferido em www.chefecoruja.com.br, num Edge sem janela:

- em 1280 px, o menu do topo tem Telas, Como funciona, Segurança, Papéis e Preços;
- em 1280 px e em 375 px, o rodapé tem Preços, Contato e Privacidade, todos para `planos.chefecoruja.com.br`;
- em 375 px, o menu do topo some, como antes;
- nada passa da largura nos dois tamanhos.

## Formulário de contato

Teste enviado em 12/11/2026, com o ok do RT, pelo formulário de `planos.chefecoruja.com.br/contato`:

- nome "Teste J5 (Claude)", unidade "Teste do subdomínio planos";
- a função respondeu 200, e a página foi para `/obrigado`;
- o RT confirmou que o e-mail "Pedido de contato pelo site: Teste J5 (Claude)" chegou às 16:52 ao Gmail do contato, enviado por `nao-responda@chefecoruja.com.br`, com todos os campos.

## PRs

#629 (diagnóstico), #630 (`landing/`), #631 (links no app).
