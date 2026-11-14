# Revisão do HCFMUSP, lote 4, O2: cap. 23, endocardite infecciosa

O RT decidiu O1 a O4 = A em 14/11/2026. Ele liberou a produção do resto do lote 4 desde que cada capítulo passe antes pela homologação e pelo CI verde.

## Fonte

- **Diretriz:** Delgado V, Ajmone Marsan N, de Waha S, et al. 2023 ESC Guidelines for the management of endocarditis. Eur Heart J 2023;44(39):3948–4042 (PMID 37622656).
- **Leitura:** li o texto no site da revista, pelo Chrome do RT. As tabelas de recomendação são imagens; li uma a uma. Foram lidas:
  - tabela 5, ecocardiograma;
  - tabela 10, antibiótico empírico;
  - tabela 11, antibiótico ambulatorial e oral;
  - tabela 12, indicações de cirurgia;
  - tabela 22, antitrombótico;
  - o texto das hemoculturas (seção 5.3.1).
- **O que ficou de fora:**
  - o *scientific statement* da AHA de 2026 (PMID 42708190): não é diretriz graduada e não foi lido;
  - profilaxia, dispositivos, endocardite direita e complicações neurológicas: fora do pronto-socorro ou fora das tabelas lidas.
- **Manual:** conferi no PDF do manual as páginas usadas na coluna do manual (cap. 23, p. 324, 326, 327 e 329–330). Antes, a ferramenta só trazia os critérios de Duke.

## O que mudou na Central

- **Escore `adulto-duke-modificado` 2026-11-14.1:**
  - fonte `ESC_EI_2023`;
  - `DIRETRIZ_EI`: 14 temas;
  - `DIFERENCAS_EI`: 5 frases;
  - a tela do escore ganha a tabela ao lado do manual. Para isso, `EscoreTela` passou a aceitar conteúdo extra no fim da página.
- **Critérios:** os critérios de Duke-ISCVID 2023 não mudam.
- **Nota `nota-hcfmusp-cap23-endocardite`:** 14 itens.
- **Migration:** `20270414000021`.

## Diferenças principais

| Tema | ESC 2023 | Manual de 2022 |
|---|---|---|
| Antibiótico empírico, comunitária | ampicilina com ceftriaxona ou (flu)cloxacilina, e gentamicina (IIa, C) | ampicilina 2 g 4/4 h + oxacilina 2 g 4/4 h + gentamicina, pela ESC 2015 (Tabela 3, p. 327) |
| Prótese precoce ou hospitalar | vancomicina ou daptomicina, com gentamicina e rifampicina (IIb, C) | vancomicina + gentamicina (Tabela 3, p. 327) |
| Cirurgia urgente | em 3–5 dias | em 1–2 dias (p. 329–330) |
| Vegetação > 3 cm | não está na tabela de cirurgia | indicação urgente (p. 329–330) |
| Eco transesofágico | em quase toda suspeita, mesmo com transtorácico positivo | se o transtorácico for negativo com suspeita, imagem ruim, prótese ou dispositivo (p. 324) |
| Via oral | depois de 10 dias de EV no paciente estável (IIa, A) | não traz |

## Antes e depois (14/11/2026)

| Pergunta | Produção, antes | Homologação, depois |
|---|---|---|
| hemoculturas | Duke-ISCVID e manual | ESC: 3 sets com 30 min; manual ao lado |
| eco transesofágico | manual | ESC: classes I, B e C |
| antibiótico empírico | manual (ESC 2015) | ESC 2023 (IIa, C) |
| cirurgia de emergência | manual | ESC: em 24 h (I, B) |
| vegetação de 10 mm com embolia | manual: > 1 cm com embolia | ESC: cirurgia urgente (I, B) |
| via oral | "não encontrei" | ESC: depois de 10 dias de EV (IIa, A) |
| Duke possível (controle) | Duke-ISCVID | Duke-ISCVID, igual |

Seis respostas passam a abrir pela diretriz. A pergunta de controle ficou igual.

## Homologação

- Migration aplicada.
- 2 arquivos ingeridos e API reiniciada.
- Branch `homolog` publicada depois de `test:clinico` (1.244, sem falha) e typecheck limpos.
- A tela não foi vista com login.
