# Revisão do HCFMUSP, lote 5, P3: cap. 83 (plaquetopenia), 24 (oclusão arterial aguda) e 34 (pneumotórax)

O RT decidiu P1 a P4 = A em 14/11/2026 e liberou a produção do lote 5 inteiro. Pela P3, os três capítulos ganham só a nota, ligada ao capítulo do manual, porque não há ficha de adulto na Central. Nenhuma ferramenta nova.

## Fontes

- **Cap. 83, todas abertas no PMC (li os resumos e conferi os PMID):**
  - McMaster 2026, sangramento crítico na PTI: Blood Adv 2026;10(16):5558–5575 (PMID 41637560).
  - ASH 2026 de PTI: Blood Adv 2026;10(20):7076–7097 (PMID 42617047).
  - ISTH 2025, atualização focada de PTT: J Thromb Haemost 2025;23(11):3711–3732 (PMID 40533296).
  - ASH 2018 de TIH: Blood Adv 2018;2(22):3360–3392 (PMID 30482768).
- **Cap. 24:** ACC/AHA 2024 de doença arterial periférica, Circulation 2024;149(24):e1313–e1410 (PMID 38743805). Li no PMC a seção de isquemia aguda de membro. O texto traz a classe, sem o nível.
- **Cap. 34:** ERS/EACTS/ESTS 2024 de pneumotórax espontâneo, Eur Respir J 2024;63(5):2300797 (PMID 38806203). Li o texto integral no site da revista, pelo Chrome do RT.
- **Manual:** conferi no PDF as páginas da coluna do manual (cap. 83, p. 1087–1093; cap. 24, p. 333 e 340–343; cap. 34, p. 468–472).

## O que mudou na Central

- **Notas:**
  - `nota-hcfmusp-cap83-plaquetopenia`: 5 itens;
  - `nota-hcfmusp-cap24-oclusao-arterial`: 5 itens;
  - `nota-hcfmusp-cap34-pneumotorax`: 7 itens.
  - Todas com `fichaCentral` vazio, como as notas 22 e 45 do lote 4.
- **Ajuste do afogamento (cap. 100):** na produção do #709, "quanto tempo observar antes da alta?" passou a cair na dengue da criança, e a resposta virou "não há referência pediátrica". A linha da lista mudou de tema, de "Alta" para "Observação e alta do afogado". O escore `adulto-szpilman` e a nota do cap. 100 passam para 2026-11-14.3.
- **Migration:** `20270414000033`.

## Antes e depois (14/11/2026)

| Pergunta | Produção, antes | Homologação, depois |
|---|---|---|
| PTI com sangramento intracraniano | "o material não traz" | McMaster 2026: tratamento combinado (forte) |
| PTI, tratamento inicial | "o material não traz" | ASH 2026: corticoide com rituximabe ou agonista de trombopoetina |
| TIH | escore 4T (outra ficha) | ASH 2018: 4Ts e anticoagulante não heparínico |
| heparina na isquemia aguda de membro | "não encontrei" | ACC/AHA 2024: heparina não fracionada no diagnóstico (classe 1) |
| fasciotomia | manual | ACC/AHA 2024, com o manual ao lado |
| aspiração ou dreno no pneumotórax primário | manual, sem o termo | ERS 2024: aspiração antes do dreno (forte) |
| conservador no pneumotórax pequeno | manual | ERS 2024: conservador qualquer que seja o tamanho |
| observação antes da alta no afogamento | "não há referência pediátrica" | WMS 2024: 4–6 h |

As oito respostas passam a abrir pela diretriz.

## Homologação

- Migration aplicada.
- 6 arquivos ingeridos e API reiniciada.
- `test:clinico` (1.253, sem falha), typecheck e padrão do frontend limpos.

## Produção do #709 (ajuste do afogamento), 14/11/2026

- A migration `20270414000032` foi aplicada antes do merge. O #709 foi mesclado com o CI verde.
- Os arquivos foram ingeridos e a API foi reiniciada. O Vercel publicou o master.
- O grau III e a tabela de Szpilman voltaram a trazer a sobrevida. A pergunta da alta caiu na dengue da criança e é corrigida neste PR.

## Produção do #710, 14/11/2026

- A migration `20270414000033` foi aplicada antes do merge. O #710 foi mesclado com o CI verde.
- Os 6 arquivos foram ingeridos e a API foi reiniciada. O Vercel publicou o master.
- Sete das oito respostas saíram como na homologação. A da alta do afogamento, perguntada sem a palavra "adulto", ainda cai na dengue da criança na produção e responde "não há referência pediátrica"; com "adulto afogado", responde 4–6 h pela WMS 2024. Na homologação as duas formas acertam. Fica registrado como limitação da busca, não do conteúdo.
