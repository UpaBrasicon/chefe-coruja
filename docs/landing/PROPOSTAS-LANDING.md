# Landing: o que podemos mudar

**Pedido.** Pedido 8 do RT, P2, em 11/11/2026: "vai me passando o que podemos mudar, salvamos e mudamos depois se aprovado".

**Escopo.** Este documento só registra propostas. Nada muda no código até o RT aprovar cada item na coluna "Decisão do RT".

**Base:**
- o audit da landing com a Hallmark (v2.0.0, em 11/11/2026), que está no item 8 do `BACKLOG.md`;
- o código no `master`, depois do polimento do #619;
- os tokens do app (`src/index.css`) e a marca (`public/favicon.svg`).

**Regras que valem para todos os itens:**
- **Nenhum fato inventado.** Número, depoimento, logo de cliente e afirmação só entram se o RT der. As sugestões de texto abaixo usam só o que a página já diz.
- **Telas reais.** Imagem do produto só se for captura real do app, tirada da homologação com pacientes de teste, nunca desenho.
- **Referências.** As opções visuais saem de referências reais do Refero (skill refero-design) antes de o RT escolher, como no restante do projeto.

---

## A. Texto (sem mudar o visual)

| # | O que | Hoje | Proposta | Por quê |
|---|---|---|---|---|
| A1 | Título do topo | "Prontuário e gestão de plantão feitos por um médico coordenador de UPA" (12 palavras) | Título curto, de até 7 palavras, e o "feito por um médico coordenador de UPA" vai para a frase de baixo. Sugestões a escolher: "Prontuário e plantão num sistema só", "O plantão inteiro num sistema só" | A Hallmark pede até 7 palavras no título do topo (gate 58). Hoje o título ocupa 4 linhas no celular |
| A2 | Frase do topo | "Prontuário eletrônico, gestão de leitos, prescrição e escala médica no mesmo sistema, para hospitais, UPAs e clínicas." (17 palavras) | Até 12 palavras. Sugestão, com o fato que sai do título: "Feito por um médico coordenador de UPA, para hospitais, UPAs e clínicas." | Mesmo gate 58: uma frase só, curta |
| A3 | Pílula acima do título | "Segue as normas do CFM e a LGPD", numa pílula verde | A frase continua (confirmada pelo RT em 11/11), mas sai da pílula. Vai para a faixa logo abaixo do topo, que já fala de CFM e LGPD | Rótulo acima do título é o vício mais reconhecível de página feita por IA (gate 54) |
| A4 | Frases de abertura de "Preços" e da página 404 | 15 palavras cada | Até 12 palavras, com o mesmo conteúdo | Gate 58 |

## B. Visual (a página passa a parecer o produto)

| # | O que | Hoje | Proposta | Por quê |
|---|---|---|---|---|
| B1 | Cor principal | `#0e7490`, um ciano-petróleo mais claro que o do app. O favicon do app usa `#0F766E` | Usar a cor de ação do app, `--cc-acao` `#155E75`, a mesma que o médico vê no sistema. Junto, conferir com o RT qual petróleo é o da marca, porque o app e o favicon também diferem | A landing é a porta do produto: a mesma cor dá continuidade. Hoje são três tons de petróleo diferentes |
| B2 | Cores de apoio | Cinzas e verdes padrão do Tailwind (`slate-*`, `emerald-*`) | Os tokens do app: tinta `#1E293B`, campo `#F8FAFC`, fio e sussurro, declarados uma vez no `tailwind.config.ts` da landing | Gate 74 (cores padrão em vez das próprias) e gate 48 (toda cor por token) |
| B3 | Fonte | Inter | Geist, a fonte do app (`--font-sans`) | O app usa Geist. Inter como fonte de título é um dos sinais que a Hallmark marca |
| B4 | Faixa "CFM · LGPD · Por papel" | Três palavras grandes em azul, com uma legenda cada | Com A3, a faixa vira uma linha só, sem os números grandes. Exemplo: "Segue as normas do CFM e a LGPD. Cada perfil vê só a sua tela." | Três palavras grandes em colunas imitam números de resultado sem ser números (gate 82) |
| B5 | Seção "Onde estamos" com mapa | Mapa do Google de Aparecida de Goiânia | Trocar o mapa por uma linha de contato (cidade, e-mail e horário), que já está no rodapé, ou manter só se o RT quiser destacar a sede | Para um sistema vendido para todo o Brasil, o mapa ocupa uma tela inteira sem levar à ação (gate 85: a página deve seguir o que o visitante veio fazer) |

## C. Conteúdo (precisa de material)

| # | O que | Proposta | Precisa de |
|---|---|---|---|
| C1 | Topo mostrando o produto | No lugar da imagem que saiu no #619, uma captura real do app grande, ao lado do título no computador e abaixo dele no celular | 1 captura: porta ou painel de leitos, da homologação, com paciente de teste |
| C2 | Seção "um plantão no Chefe Coruja" | Três telas reais em sequência: a porta (classificação e atendimento), o leito (prescrição e evolução) e a escala (check-in). Cada uma com uma frase curta | 3 capturas da homologação |
| C3 | "Quem somos" | Hoje tem duas frases. Proposta: o nome e a foto do médico coordenador que criou o sistema, se o RT quiser aparecer | Nome, foto e o texto que o RT aprovar. Nada inventado |
| C4 | Prova | Só se houver: número real de unidades em uso, depoimento com nome de quem disse ou logo de unidade com autorização | Material dado pelo RT. Sem ele, a página continua sem prova, como hoje |

## D. Ordem sugerida

1. **A e B juntos,** num PR: só texto, cor e fonte, sem material novo. Passa pela conferência na tela antes de publicar.
2. **C1 e C2** quando as capturas estiverem prontas. Posso tirá-las da homologação com o login do RT.
3. **C3 e C4** só com material do RT.

## Decisão do RT

| # | Recomendação | Decisão do RT |
|---|---|---|
| A1 | Título curto; o RT escolhe a frase | |
| A2 | Frase de até 12 palavras | |
| A3 | Tirar a pílula; a frase vai para a faixa | |
| A4 | Encurtar | |
| B1 | Cor de ação do app; confirmar o petróleo da marca | |
| B2 | Tokens do app | |
| B3 | Geist | |
| B4 | Faixa vira uma linha | |
| B5 | Tirar o mapa (ou manter) | |
| C1 | Captura real no topo | |
| C2 | Seção com 3 telas reais | |
| C3 | Quem somos com nome e foto (opcional) | |
| C4 | Prova, só com material real | |

---

## Caminho C: juntar as duas páginas (decisão do RT, 11/11/2026)

O que está no ar em www.chefecoruja.com.br é a página de entrada do app (`src/pages/landing/`), e não a `landing/`. A `landing/` só existe em chefe-coruja-landing.vercel.app, sem domínio próprio.

O audit da Hallmark de 11/11/2026 deu este resultado para a página do app:
- nenhuma falha do piso;
- números reais, mas desatualizados: "200 ferramentas" e "34 arquivos de teste", contados em 29/09/2026. Hoje são 232 e 265;
- nenhum caminho para quem quer comprar.

O RT escolheu juntar as duas. A página do app continua sendo a porta da marca e recebe o que só a `landing/` tem.

| # | O que | Detalhe | Precisa de |
|---|---|---|---|
| J1 | Números atualizados | "Números do próprio app" com a contagem e a data do dia | nada |
| J2 | Acabamento do audit | estado de clique, aspas tipográficas, `overflow-x: clip` | nada |
| J3 | "Agendar demonstração" | ao lado de "Entrar", no topo e no fim da página | decisão D1 |
| J4 | Seção com as telas do app | a seção "Um plantão" da demo, com a tela parada que troca pela rolagem | decisão D2 |
| J5 | Preços e contato | link no topo e no rodapé | decisão D3 |

### Decisões do RT

| # | Pergunta | Opções | Recomendação | Decisão do RT |
|---|---|---|---|---|
| D1 | Para onde vai "Agendar demonstração" | a) e-mail `contato@chefecoruja.com.br`, que já funciona; b) o formulário da `landing/` trazido para o app, que precisa de uma função no servidor e passa pela homologação; c) a `landing/` num subdomínio, como `site.chefecoruja.com.br` (DNS no Cloudflare, feito pelo RT) | c, ou a) enquanto o subdomínio não existe | b) formulário no app (RT, 11/11/2026) |
| D2 | Telas da seção J4 | a) as capturas de teste de hoje, com nomes "F5"; b) uma unidade de demonstração na homologação, com nomes realistas e números coerentes, capturada de novo | b | b) unidade de demonstração (RT, 11/11/2026) |
| D3 | Futuro da `landing/` | a) fica só com Preços, Contato e Privacidade, no subdomínio de D1 c; b) desativada, com Preços e Contato levados para o app | a | a) Preços, Contato e Privacidade num subdomínio (RT, 11/11/2026) |
