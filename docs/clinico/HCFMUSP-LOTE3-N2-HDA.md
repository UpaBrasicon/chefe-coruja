# Revisão do HCFMUSP, lote 3, N2: cap. 50, hemorragia digestiva alta (ESGE 2026 e Baveno VIII)

Decisão do RT de 14/11/2026 (N2 = A). O diagnóstico está em `HCFMUSP-LOTE3-DIAGNOSTICO.md`.

## Fontes

- **Úlcera péptica:** Gralnek IM, Morris J, Laursen SB, et al. Endoscopic diagnosis and management of peptic ulcer bleeding: ESGE Guideline – Update 2026. Endoscopy 2026;58(8):899–924 (PMID 42127996).
  - Li o texto integral no site da Thieme, pelo Chrome do RT.
  - São 40 recomendações, cada uma com força (forte ou condicional) e qualidade da evidência.
  - O update não repete a dose da eritromicina, então ela não entrou pela ESGE.
- **Varizes:** Baveno VIII – Advancing consensus in portal hypertension. J Hepatol 2026;85(5):993–1018 (PMID 42624290).
  - Li o texto integral no site do J Hepatol, pelo Chrome. A página passou sozinha pela verificação de acesso; não interagi com ela.
  - Usei os Painéis 3 (prevenção da descompensação), 4 (prevenção de nova descompensação) e 5 (sangramento por hipertensão portal), com nível de evidência (NE) e força.

O lado do manual foi conferido no PDF do livro (cap. 50, p. 697–704).

## O que mudou na Central

- **Ficha `adulto-hemorragia-digestiva` 2026-11-14.1:**
  - fonte nova `BAVENO_VIII_2026`; a citação da ESGE passa a dizer que o texto integral foi lido;
  - `DIRETRIZ_HDA`: 24 temas (10 da ESGE, 14 do Baveno VIII), com grau, fonte e página do manual;
  - `DIFERENCAS_HDA`: 7 frases;
  - a tela de hemorragia digestiva ganha a tabela "ESGE 2026 e Baveno VIII — ao lado do manual".
- As doses das diretrizes aparecem ao lado do manual, com a fonte: omeprazol 80 mg e 8 mg/h e eritromicina 250 mg dose única. As doses e contas do manual não mudam.
- **Nota `nota-hcfmusp-cap50-hda`:** 24 itens.
- **Migration** `20270414000007`. A ficha e a nota aguardam a aprovação do RT.

## Diferenças principais

| Tema | Diretriz | Manual de 2022 |
|---|---|---|
| Hb | úlcera: alvo 7–9 sem doença cardiovascular, ≥ 10 com ela (ESGE); varizes: 7–8 (Baveno) | 7–9 para todos (p. 697, 702) |
| Tempo da EDA | varizes: até 12 h (Baveno); úlcera: até 24 h, não antes de 12 h salvo instabilidade (ESGE) | < 24 h para todos (p. 697) |
| Coagulopatia nas varizes | sem plasma, plaquetas, fibrinogênio ou fator VIIa de rotina (Baveno) | plasma com INR > 1,5; plaquetas < 50.000; fator VII com INR > 2 (p. 697, 703) |
| Eritromicina | 250 mg EV dose única, 30–90 min antes (Baveno, fraca) | 3 mg/kg, 20–120 min antes (p. 697) |
| Vasoativo | 2–5 dias ou até o TIPS; até 24 h se iniciar betabloqueador depois da hemostasia (Baveno) | sem duração, exceto somatostatina até 5 dias (p. 703) |
| TIPS | precoce, em até 72 h, nos de alto risco (Baveno) | depois da falha da endoscopia (p. 703) |
| Profilaxia | carvedilol preferido; secundária com betabloqueador e ligadura (Baveno) | também betabloqueador com nitrato (p. 704) |

## Antes e depois (14/11/2026)

| Pergunta | Produção, antes | Homologação, depois |
|---|---|---|
| alvo de Hb nas varizes | "só a estratégia geral do manual" | Baveno: 7–8, com o manual como diferença |
| plasma e plaquetas nas varizes | plasma 15 mL/kg no hepatopata com sangramento, de outros materiais | Baveno: não de rotina; o manual como diferença |
| duração da terlipressina | "o capítulo não informa" | Baveno: 2–5 dias ou até o TIPS |
| tempo da EDA nas varizes | < 24 h (manual, sem separar varizes) | Baveno: até 12 h |
| TIPS precoce | "não encontrei no material" | Baveno: critérios e prazo de 72 h |
| Glasgow-Blatchford e alta | escore 0, com a contradição do livro | ESGE: ≤ 1, com a contradição do livro como diferença |

As seis respostas passam a abrir pela diretriz.

**Achado para o RT (fora desta tarefa):** na produção, antes, a resposta do plasma citava 15 mL/kg no hepatopata com sangramento. O trecho vem de outros materiais da biblioteca (fichas da Central e artigos abertos), não do cap. 50. O Baveno VIII não recomenda plasma de rotina no sangramento varicoso. Na homologação, a nota passou a abrir a resposta. Esses materiais não foram alterados; fica registrado para decisão.

## Homologação

- Migration aplicada.
- `adulto-hemorragia-digestiva.md` (24 trechos) e `nota-hcfmusp-cap50-hda.md` (25 trechos) ingeridos. API reiniciada.
- Branch `homolog` publicada depois de `test:clinico` (1.230, sem falha) e typecheck limpos na árvore da homologação.
- A tela não foi vista com login.

## Produção, com o "ok produção"

1. Aplicar a migration `20270414000007`.
2. Copiar e ingerir `adulto-hemorragia-digestiva.md` e `nota-hcfmusp-cap50-hda.md`.
3. Reiniciar a API.
4. Refazer as perguntas.
5. Mesclar.
