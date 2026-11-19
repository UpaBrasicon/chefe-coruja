# Dose em mL nas ferramentas pediátricas: diagnóstico

Data: 19/11/2026. Situação: diagnóstico, nenhum código mudou. Pedido do RT de 19/11/2026: mostrar a dose em mL em todas as medicações; começar pela pediatria.

Regras que valem para tudo o que está abaixo (decisões do RT de 19/11/2026):

- A concentração vem primeiro da apresentação citada no livro do ICr (Pronto-Socorro Pediatria ICr-HCFMUSP, 4ª ed., 2023). Se o livro não citar, vem da bula do Bulário Eletrônico da ANVISA, com link.
- Quando há mais de uma apresentação, o médico escolhe a ampola na tela. Nenhuma vem marcada.
- Dose só de fonte citada, nunca adaptada do adulto, e nenhuma concentração inventada.

## Resumo

As ferramentas pediátricas têm 491 itens de dose em listas exportadas. Tirando 26 que são o mesmo objeto reaproveitado de `BOLUS` (antídotos e reversores da intoxicação, sedativos da sedação para procedimento e a hidralazina da crise hipertensiva), sobram 465 itens únicos. Desses, 52 já mostram mL (têm `porMl`, `mlPorKg` ou a dose já é em mL) e **413 saem sem mL**. Os números do pedido conferem: 62 de 81 em `bolus.ts`, 7 de 15 na RCP e 12 de 12 na intubação.

Dos 413:

- **42** têm a apresentação citada no livro (página no código ou achada no texto do livro);
- **304** só têm candidata nas listas locais, que não são fonte e precisam ser conferidas na bula da ANVISA;
- **67** não têm apresentação em lugar nenhum do projeto.

Pela forma do item, só 103 podem ganhar mL direto, depois de confirmada a concentração. Outros 65 podem ganhar mL, mas só com escolha da ampola e alerta, porque têm mais de uma concentração, confusão entre sal e elemento ou listas que se contradizem. Em 28 o mL é só o volume a aspirar da ampola antes de diluir. Nos 217 restantes, o mL não faz sentido neste ciclo: via oral, pó para reconstituir, infusão contínua, dose do dia inteiro, via retal ou inalatória e hemoderivados.

O livro quase não cita a concentração das ampolas. O apêndice (p. 894–910) dá dose, máximo e às vezes a concentração máxima da diluição, mas não diz quantos mg há por mL na ampola de midazolam, fentanil, amiodarona, atropina, adenosina, lidocaína, naloxona e outras. Para quase todo o lote de emergência a concentração terá de vir da bula da ANVISA.

O Bulário Eletrônico não pôde ser lido de forma automática: o portal pede uma verificação de "humano" (captcha da Cloudflare) antes de buscar. Os detalhes estão na seção "Bulário Eletrônico da ANVISA".

## Como foi feito

1. Um script (fora do repositório, na pasta temporária da sessão) importou cada arquivo `.ts` de `src/clinico/pediatria/` e percorreu tudo o que é exportado, pegando todo objeto com `id`, `nome`, `unidade` e uma dose por peso ou fixa (`porKg`, `porKgDia`, `porKgDose`, `fixo` ou `faixa`). Assim entram os tipos `Bolus` (`bolus.ts`, `dosesDaFita.ts`), `DosePeso` (`fonteP2.ts`), `DoseLivro` (`fonteP4.ts`) e `Dose` (`eletrolitosPed.ts`). Item "com mL" é o que tem `porMl`, `mlPorKg` ou unidade `mL`; o resto conta como "sem mL".
2. Cada item sem mL foi casado pelo nome do princípio ativo com três fontes: o que o código já cita do livro, o texto extraído do PDF do livro (busca por "mg/mL", "mEq/mL", "Amp.", "xarope" e afins, com a página do PDF) e as listas locais `data/padronizacao.csv` e `data/diluicao.csv`.
3. A via, a unidade e a forma (pó, solução, comprimido) decidiram se o mL faz sentido. As regras do casamento estão no script; o resultado item a item está na tabela da seção 1. O casamento é por nome e pode errar em algum item isolado. Antes de cada lote, a lista do lote tem de ser relida item a item.
4. O corpus (`biblioteca/corpus/`, só no checkout principal, ignorado pelo git) foi lido. Os resumos `ped-*.md` são gerados a partir do próprio código e repetem as apresentações que o código já cita (cetamina, epinefrina, magnésio, bicarbonato, gluconato, manitol, azul de metileno, aminas, digoxina, KCl, NaCl 20%, NaCl 3%, insulina diluída, SAAr). Não trazem nenhuma apresentação do livro que o código não tenha.

## Origem das listas locais

Nenhuma das três listas é fonte final. Todas foram montadas em agosto de 2026 por uma sessão automatizada do próprio projeto (commits do usuário `UpaBrasicon`), não pela farmácia de uma unidade.

- **`data/padronizacao.csv`** (200 itens). Commit `64b6ee03` de 16/08/2026: "Fase 0: esqueleto de padronização (200 itens RENAME + 51 alta vigilância ISMP) — aguardando confirmação do usuário". O `FONTES.md` diz que a base foi a RENAME (Ministério da Saúde) e a lista de alta vigilância do ISMP Brasil. Não é a padronização de uma unidade real, e a confirmação pedida no commit não aparece registrada. Tem erros visíveis: adenosina "6 mg/mL" num frasco de 2 mL (a outra lista dá 3 mg/mL), dobutamina "5 mg/mL" (o livro dá 12,5 mg/mL, p. 87 e 253), ácido tranexâmico "100 mg/mL" (a outra lista dá 50 mg/mL) e salbutamol "0,5 mg/mL, frasco 20 mL", sem dizer se é injetável ou solução para nebulização.
- **`data/medicamento.csv`** (200 itens). É a mesma lista, casada por script (`scripts/etl/02_mapear_canonico.cjs`, 17/08/2026) com o RxNorm e com os dados abertos de registro da ANVISA. O casamento tem erros conhecidos: a noradrenalina aparece com o registro da epinefrina (112080053, "LQFEX- EPINEFRINA", inativo). As colunas de concentração e apresentação são as mesmas da padronização; a parte da ANVISA traz registro, empresa e situação, nunca concentração. O arquivo de dados abertos (`data/cache/anvisa_medicamentos.csv`) também não tem coluna de concentração.
- **`data/diluicao.csv`** (125 registros). Commit `7f06e365` de 17/08/2026: parser automático do PDF "Manual de injetáveis padronizados para adultos" do HU-UFGD/EBSERH (v3, 12/2025), com todos os registros em `status = rascunho` e sem `revisor_crf`. É protocolo de adulto. O parser cortou e misturou colunas em vários itens ("Bicarbonato de 250mL) 1mEq/mL", "Cloreto de (ampola 10mL)", "Lidocaína" só com itens de vasoconstritor e tubete). O `FONTES.md` marca a fonte como de uso não comercial (NC), só para validação.

Na tabela, "P:" é a padronização (igual à `medicamento.csv`) e "D:" é a lista de diluição.

## O que o livro cita de apresentação

Citadas no código, com página:

- epinefrina 1 mg/mL (p. 87, 895; Adrenalina®) e a solução 1:10.000 preparada, 0,1 mg/mL (p. 31);
- norepinefrina 1 mg/mL (Norepine®, p. 88); dopamina 5 mg/mL (p. 87; ampola de 10 mL = 50 mg, p. 253); dobutamina 12,5 mg/mL (Dobutrex®, p. 87; p. 253); milrinona 1 mg/mL (ampola de 20 mL = 20 mg, p. 253);
- cetamina: Ketamin S® 50 mg/mL (p. 88);
- bicarbonato de sódio 8,4% = 1 mEq/mL (p. 32; Tabela 11, p. 558);
- sulfato de magnésio 50% = 500 mg/mL (p. 32);
- gluconato de cálcio 10% = 100 mg/mL (p. 896) e 9 mg de cálcio elementar/mL (Tabela 11, p. 558); cloreto de cálcio 10% = 27 mg de cálcio elementar/mL (Tabela 11, p. 559);
- manitol 20% = 0,2 g/mL (p. 720; p. 179); glicose 25% (p. 32); azul de metileno 1% = 10 mg/mL (p. 102);
- KCl 19,1% = 2,5 mEq/mL, NaCl 20% = 3,4 mEq/mL e NaCl 3% = 0,5 mEq/mL (Tabela 11, p. 558); fósforo orgânico 31 mg P/mL = 1 mmol/mL (p. 559);
- digoxina elixir 50 µg/mL e comprimido 0,25 mg (p. 240); insulina regular diluída a 0,1 UI/mL (50 UI em 500 mL, p. 521); soro antiaracnídico, 1 ampola = 5 mL (p. 212).

Achadas só no texto extraído do PDF, ainda não usadas no código (marcadas com * na tabela; conferir no PDF antes de usar): bicarbonato de sódio 3% = 0,35 mEq/mL e sulfato de magnésio 10% = 0,8 mEq/mL e 20% = 1,6 mEq/mL (Tabela 11, p. 558); magnésio "10% = 0,81 mEq/mL ou 50% = 4 mEq/mL" (p. 908); KCl xarope 10% = 1,3 mEq/mL (p. 558); azitromicina xarope 40 mg/mL (p. 503); ipratrópio para nebulização 250 µg/mL (p. 119). A p. 322 diz que no Brasil não há oseltamivir em xarope.

O livro não cita a concentração da ampola de: adenosina, amiodarona, atropina, lidocaína, fentanil, morfina, midazolam, diazepam, lorazepam, etomidato, propofol, rocurônio, succinilcolina, vecurônio, tiopental, dexmedetomidina, neostigmina, sugamadex, naloxona, flumazenil, fenitoína, fenobarbital, valproato, levetiracetam, hidralazina, esmolol, octreotida, terbutalina, difenidramina, dexametasona, vitamina K, acetilcisteína, furosemida, ondansetrona e dos antibióticos. A busca foi feita no texto extraído; tabelas do PDF podem ter saído quebradas na extração, então essa ausência precisa de uma última conferência no PDF, página a página, nos capítulos de cada lote.

## Bulário Eletrônico da ANVISA (teste com midazolam, fentanil e amiodarona)

Não foi possível ler a concentração de nenhuma das três.

- A API do portal (`consultas.anvisa.gov.br/api/consulta/bulario`) respondeu com uma página "Bloqueado" (firewall com Ray ID) para as três buscas, por linha de comando.
- A busca pelo navegador embutido abriu a página, mas o formulário só carrega depois de uma verificação "Confirme que é humano" da Cloudflare. Esse tipo de verificação não é contornado por automação; a página ficou em "Nenhum registro encontrado".
- Os dados abertos de registro da ANVISA, já baixados em `data/cache/anvisa_medicamentos.csv`, não têm concentração.

Links de busca que uma pessoa pode abrir (resolvendo a verificação à mão):

- midazolam: https://consultas.anvisa.gov.br/#/bulario/q/?nomeProduto=midazolam
- fentanil (o nome no registro costuma ser "fentanila"): https://consultas.anvisa.gov.br/#/bulario/q/?nomeProduto=fentanila
- amiodarona: https://consultas.anvisa.gov.br/#/bulario/q/?nomeProduto=amiodarona

Na tela de resultado o portal lista os produtos, cada um com a bula do profissional em PDF; a concentração fica na seção de apresentações da bula. Não deu para confirmar se o link do PDF que o portal gera é permanente. Por isso a proposta (pergunta 1) é guardar, além do link de busca, o nome do produto, a empresa, o número do expediente e a data da bula.

## 1. Tabela por medicação

Colunas:

- **unidade da dose**: como o código guarda a dose (por kg, por kg por dia, por kg por dose ou fixa).
- **apresentação no livro**: o que o código ou o texto do livro citam, com a página. Com * vem só do texto extraído do PDF.
- **candidatas nas listas locais**: P = `data/padronizacao.csv`; D = `data/diluicao.csv` (HU-UFGD, adulto, rascunho).
- **situação**: "livro cita", "só lista local, falta conferir na bula ANVISA" ou "sem apresentação encontrada". Item VO cuja única candidata é injetável conta como "sem apresentação encontrada".
- **mL na tela**: "sim" = cabe mL direto depois de confirmar a concentração; "com alerta" = cabe, mas com escolha da ampola e aviso (ver seção 2); "aspirar e diluir" = o mL é só o volume tirado da ampola antes de diluir; "não" = não neste ciclo.
- **motivo**: códigos da seção 2.

As listas que só reaproveitam objetos de `BOLUS` (`ANTIDOTOS_APENDICE` em `intoxicacaoPed.ts`, `SEDATIVOS_APENDICE` e `REVERSORES_APENDICE` em `sedacaoProcedimento.ts`, `HIDRALAZINA_IV` em `criseHipertensivaPed.ts`) não se repetem na tabela: ganham mL junto com a linha de `bolus.ts`. O mesmo vale para `src/clinico/hiperpotassemia.ts`, que mostra itens de `BOLUS`, `eletrolitosPed.ts`, `injuriaRenalPed.ts` e `oncologiaPed.ts`.

### `bolus.ts` (BOLUS): 62 itens

| id | nome | unidade da dose | apresentação no livro | candidatas nas listas locais | situação | mL na tela | motivo (seção 2) |
|---|---|---|---|---|---|---|---|
| `adenosina-1` | Adenosina — 1ª dose | mg/kg | — | P: frasco 2 mL, "6 mg/mL"; D: 3 mg/mL, amp. 2 mL | só lista local, falta conferir na bula ANVISA | com alerta | CONF |
| `adenosina-2` | Adenosina — 2ª dose | mg/kg | — | P: frasco 2 mL, "6 mg/mL"; D: 3 mg/mL, amp. 2 mL | só lista local, falta conferir na bula ANVISA | com alerta | CONF |
| `adenosina-50-1` | Adenosina — 1ª dose | mg (dose fixa) | — | P: frasco 2 mL, "6 mg/mL"; D: 3 mg/mL, amp. 2 mL | só lista local, falta conferir na bula ANVISA | com alerta | CONF |
| `adenosina-50-2` | Adenosina — 2ª dose | mg (dose fixa) | — | P: frasco 2 mL, "6 mg/mL"; D: 3 mg/mL, amp. 2 mL | só lista local, falta conferir na bula ANVISA | com alerta | CONF |
| `amiodarona-fvtv` | Amiodarona — FV/TV sem pulso | mg/kg | — | P: 50 mg/mL, amp. 3 mL | só lista local, falta conferir na bula ANVISA | sim | — |
| `amiodarona-iv` | Amiodarona — IV em 60 minutos | mg/kg | — | P: 50 mg/mL, amp. 3 mL | só lista local, falta conferir na bula ANVISA | sim | — |
| `atropina-bradicardia` | Atropina — bradicardia | mg/kg | — | P: 0,25 mg/mL, amp. 1 mL | só lista local, falta conferir na bula ANVISA | sim | — |
| `lidocaina-iv` | Lidocaína — IV (arritmia) | mg/kg | — | P: 20 mg/mL, amp. 20 mL; D: só itens com vasoconstritor ou tubete | só lista local, falta conferir na bula ANVISA | com alerta | VASO |
| `atropina-pre` | Atropina — pré-anestésica | mg/kg | — | P: 0,25 mg/mL, amp. 1 mL | só lista local, falta conferir na bula ANVISA | sim | — |
| `lidocaina-sri` | Lidocaína — pré-medicação na SRI | mg/kg | — | P: 20 mg/mL, amp. 20 mL; D: só itens com vasoconstritor ou tubete | só lista local, falta conferir na bula ANVISA | com alerta | VASO |
| `fentanil` | Fentanil | µg/kg | — | P: 50 µg/mL, amp. 2 mL; D: frasco-ampola 2 e 5 mL (concentração não lida) | só lista local, falta conferir na bula ANVISA | sim | — |
| `morfina-menor6m` | Morfina — IV | mg/kg | — | P: 10 mg/mL e 1 mg/mL ("dose pediátrica"), amp. 1 mL; D: 1 mg/mL, amp. 2 mL | só lista local, falta conferir na bula ANVISA | com alerta | MULT |
| `morfina-maior6m` | Morfina — IV/IM | mg/kg | — | P: 10 mg/mL e 1 mg/mL ("dose pediátrica"), amp. 1 mL; D: 1 mg/mL, amp. 2 mL | só lista local, falta conferir na bula ANVISA | com alerta | MULT |
| `dexmedetomidina-proc` | Dexmedetomidina — sedação para procedimento | µg/kg | — | D: 100 µg/mL, frasco 2 mL | só lista local, falta conferir na bula ANVISA | aspirar e diluir | DIL |
| `dexmedetomidina-ataque` | Dexmedetomidina — ataque da sedação contínua | µg/kg | — | D: 100 µg/mL, frasco 2 mL | só lista local, falta conferir na bula ANVISA | não | INF, DIL |
| `etomidato` | Etomidato | mg/kg | — | P e D: 2 mg/mL, amp. 10 mL | só lista local, falta conferir na bula ANVISA | sim | — |
| `midazolam-im` | Midazolam — IM | mg/kg | — | P: 5 mg/mL, amp. 3 mL; D: 1 mg/mL (5 mL) e 5 mg/mL (3 e 10 mL) | só lista local, falta conferir na bula ANVISA | com alerta | MULT |
| `midazolam-iv-menor5` | Midazolam — IV | mg/kg | — | P: 5 mg/mL, amp. 3 mL; D: 1 mg/mL (5 mL) e 5 mg/mL (3 e 10 mL) | só lista local, falta conferir na bula ANVISA | com alerta | MULT |
| `midazolam-iv-maior5` | Midazolam — IV | mg/kg | — | P: 5 mg/mL, amp. 3 mL; D: 1 mg/mL (5 mL) e 5 mg/mL (3 e 10 mL) | só lista local, falta conferir na bula ANVISA | com alerta | MULT |
| `midazolam-in` | Midazolam — intranasal | mg/kg | — | P: 5 mg/mL, amp. 3 mL; D: 1 mg/mL (5 mL) e 5 mg/mL (3 e 10 mL) | só lista local, falta conferir na bula ANVISA | com alerta | MULT |
| `propofol` | Propofol — SRI | mg/kg | — | P: 10 mg/mL, amp. 20 mL; D: 10 mg/mL (10, 20 e 50 mL) | só lista local, falta conferir na bula ANVISA | sim | — |
| `tiopental` | Tiopental | mg/kg | — | D: 500 mg, pó | só lista local, falta conferir na bula ANVISA | não | PO |
| `rocuronio` | Rocurônio — SRI | mg/kg | — | P e D: 10 mg/mL, 5 mL | só lista local, falta conferir na bula ANVISA | sim | — |
| `succinilcolina-iv` | Succinilcolina — IV | mg/kg | — | P: "20 mg/mL", frasco 5 mL; D: suxametônio 100 mg, pó | só lista local, falta conferir na bula ANVISA | com alerta | CONF |
| `succinilcolina-im` | Succinilcolina — IM | mg/kg | — | P: "20 mg/mL", frasco 5 mL; D: suxametônio 100 mg, pó | só lista local, falta conferir na bula ANVISA | com alerta | CONF |
| `vecuronio` | Vecurônio | mg/kg | — | P: 10 mg, pó | só lista local, falta conferir na bula ANVISA | não | PO |
| `sugamadex` | Sugamadex | mg/kg | — | D: "100 mg (frasco-ampola 2 mL)" | só lista local, falta conferir na bula ANVISA | com alerta | CONF |
| `neostigmina-0a2` | Neostigmina — reversão de BNM não despolarizante | mg/kg | — | — | sem apresentação encontrada | sim | — |
| `neostigmina-maior2` | Neostigmina — reversão de BNM não despolarizante | mg/kg | — | — | sem apresentação encontrada | sim | — |
| `glucagon-anafilaxia` | Glucagon — hipotensão persistente (betabloqueado) | µg/kg | — | P: 1 mg, pó | só lista local, falta conferir na bula ANVISA | não | PO |
| `hidrocortisona-asma` | Hidrocortisona — asma (ataque) | mg/kg | — | P: 100 mg, pó | só lista local, falta conferir na bula ANVISA | não | PO |
| `dexametasona-crupe` | Dexametasona — crupe | mg/kg | — | P: 4 mg/mL, amp. 1 mL | só lista local, falta conferir na bula ANVISA | sim | — |
| `diazepam-iv-menor5` | Diazepam — IV | mg/kg | — | P: 5 mg/mL, amp. 2 mL; comprimido 10 mg | só lista local, falta conferir na bula ANVISA | sim | — |
| `diazepam-iv-maior5` | Diazepam — IV | mg/kg | — | P: 5 mg/mL, amp. 2 mL; comprimido 10 mg | só lista local, falta conferir na bula ANVISA | sim | — |
| `diazepam-vr-2a5` | Diazepam — retal | mg/kg | — | P: 5 mg/mL, amp. 2 mL; comprimido 10 mg | só lista local, falta conferir na bula ANVISA | não | VR |
| `diazepam-vr-6a11` | Diazepam — retal | mg/kg | — | P: 5 mg/mL, amp. 2 mL; comprimido 10 mg | só lista local, falta conferir na bula ANVISA | não | VR |
| `diazepam-vr-12` | Diazepam — retal | mg/kg | — | P: 5 mg/mL, amp. 2 mL; comprimido 10 mg | só lista local, falta conferir na bula ANVISA | não | VR |
| `fenitoina` | Fenitoína — ataque | mg/kg | — | P: 50 mg/mL, amp. 5 mL; comprimido 100 mg | só lista local, falta conferir na bula ANVISA | aspirar e diluir | DIL |
| `fenobarbital` | Fenobarbital — ataque | mg/kg | — | P e D: 100 mg/mL, amp. 2 mL | só lista local, falta conferir na bula ANVISA | sim | — |
| `polarizante-insulina` | Solução polarizante — insulina regular | UI/kg | só a solução já diluída, 0,1 UI/mL (p. 521) | P: 100 UI/mL, frasco 10 mL | livro cita | com alerta | MULT, DIL |
| `glucagon-menor20` | Glucagon — hipoglicemia | mg (dose fixa) | — | P: 1 mg, pó | só lista local, falta conferir na bula ANVISA | não | PO |
| `glucagon-maior20` | Glucagon — hipoglicemia | mg (dose fixa) | — | P: 1 mg, pó | só lista local, falta conferir na bula ANVISA | não | PO |
| `hidrocortisona-adrenal` | Hidrocortisona — insuficiência adrenal aguda (inicial) | mg/kg | — | P: 100 mg, pó | só lista local, falta conferir na bula ANVISA | não | PO |
| `esmolol-bolus` | Esmolol — bolus | µg/kg | — | P: 10 mg/mL, amp. 10 mL | só lista local, falta conferir na bula ANVISA | sim | — |
| `hidralazina` | Hidralazina — hipertensão aguda grave | mg/kg | — | P: 20 mg/mL, amp. 1 mL | só lista local, falta conferir na bula ANVISA | sim | — |
| `milrinona-ataque` | Milrinona — ataque | µg/kg | 1 mg/mL (amp. 20 mL = 20 mg, p. 253) | P e D: 1 mg/mL, amp. 10 mL | livro cita | sim | — |
| `octreotida-ataque` | Octreotida — ataque | µg/kg | — | P: 0,1 mg/mL (100 µg/mL), amp. 1 mL; D: amp. 1 mL sem concentração | só lista local, falta conferir na bula ANVISA | sim | — |
| `somatostatina-ataque` | Somatostatina — ataque | µg/kg | — | — | sem apresentação encontrada | não | PO |
| `terbutalina-ataque` | Terbutalina — ataque | µg/kg | — | — | sem apresentação encontrada | sim | — |
| `terlipressina-ataque` | Terlipressina — ataque | µg/kg | — | — | sem apresentação encontrada | não | PO |
| `acetilcisteina-1` | Acetilcisteína IV — 1ª etapa (paracetamol) | mg/kg | — | P: 100 mg/mL, amp. 3 mL | só lista local, falta conferir na bula ANVISA | aspirar e diluir | DIL |
| `acetilcisteina-2` | Acetilcisteína IV — 2ª etapa | mg/kg | — | P: 100 mg/mL, amp. 3 mL | só lista local, falta conferir na bula ANVISA | aspirar e diluir | DIL |
| `acetilcisteina-3` | Acetilcisteína IV — 3ª etapa | mg/kg | — | P: 100 mg/mL, amp. 3 mL | só lista local, falta conferir na bula ANVISA | aspirar e diluir | DIL |
| `atropina-organofosforado` | Atropina — organofosforados | mg/kg | — | P: 0,25 mg/mL, amp. 1 mL | só lista local, falta conferir na bula ANVISA | sim | — |
| `pralidoxima` | Pralidoxima — organofosforados (com atropina) | mg/kg | — | — | sem apresentação encontrada | sim | — |
| `carvao` | Carvão ativado | g/kg | — | P: suspensão, frasco 120 mL (sem concentração) | só lista local, falta conferir na bula ANVISA | não | VO |
| `flumazenil` | Flumazenil | mg/kg | — | P: 0,1 mg/mL, amp. 5 mL; D: amp. 5 mL | só lista local, falta conferir na bula ANVISA | sim | — |
| `naloxona-menor` | Naloxona | mg/kg | — | P: 0,4 mg/mL, amp. 1 mL; D: amp. 1 mL | só lista local, falta conferir na bula ANVISA | sim | — |
| `naloxona-maior` | Naloxona | mg (dose fixa) | — | P: 0,4 mg/mL, amp. 1 mL; D: amp. 1 mL | só lista local, falta conferir na bula ANVISA | sim | — |
| `dose-baixa-naloxona` | Naloxona — dose baixa (opioide terapêutico) | µg/kg | — | P: 0,4 mg/mL, amp. 1 mL; D: amp. 1 mL | só lista local, falta conferir na bula ANVISA | sim | — |
| `vitamina-k` | Vitamina K (fitomenadiona) — anticoagulantes | mg/kg | — | P: 10 mg/mL, amp. 1 mL | só lista local, falta conferir na bula ANVISA | sim | — |
| `difenidramina` | Difenidramina | mg/kg | — | D: amp. 1 mL, sem concentração | só lista local, falta conferir na bula ANVISA | sim | — |

### `rcp.ts` (DROGAS_RCP): 7 itens

| id | nome | unidade da dose | apresentação no livro | candidatas nas listas locais | situação | mL na tela | motivo (seção 2) |
|---|---|---|---|---|---|---|---|
| `amiodarona` | Amiodarona | mg/kg | — | P: 50 mg/mL, amp. 3 mL | só lista local, falta conferir na bula ANVISA | sim | — |
| `lidocaina-iv` | Lidocaína IV/IO | mg/kg | — | P: 20 mg/mL, amp. 20 mL; D: só itens com vasoconstritor ou tubete | só lista local, falta conferir na bula ANVISA | com alerta | VASO |
| `lidocaina-et` | Lidocaína traqueal | mg/kg | — | P: 20 mg/mL, amp. 20 mL; D: só itens com vasoconstritor ou tubete | só lista local, falta conferir na bula ANVISA | com alerta | VASO |
| `calcio` | Cálcio elementar | mg/kg | gluconato 10% = 9 mg Ca/mL; cloreto 10% = 27 mg Ca/mL (Tabela 11, p. 558–559) | P: gluconato e cloreto 10%, 100 mg/mL (do sal) | livro cita | com alerta | ELEM |
| `atropina` | Atropina | mg/kg | — | P: 0,25 mg/mL, amp. 1 mL | só lista local, falta conferir na bula ANVISA | sim | — |
| `adenosina-1` | Adenosina — 1ª dose | mg/kg | — | P: frasco 2 mL, "6 mg/mL"; D: 3 mg/mL, amp. 2 mL | só lista local, falta conferir na bula ANVISA | com alerta | CONF |
| `adenosina-2` | Adenosina — 2ª dose (dobrada) | mg/kg | — | P: frasco 2 mL, "6 mg/mL"; D: 3 mg/mL, amp. 2 mL | só lista local, falta conferir na bula ANVISA | com alerta | CONF |

### `viaAerea.ts` (DOSES_SRI): 12 itens

| id | nome | unidade da dose | apresentação no livro | candidatas nas listas locais | situação | mL na tela | motivo (seção 2) |
|---|---|---|---|---|---|---|---|
| `atropina` | Atropina | mg/kg | — | P: 0,25 mg/mL, amp. 1 mL | só lista local, falta conferir na bula ANVISA | sim | — |
| `fentanil` | Fentanil | µg/kg | — | P: 50 µg/mL, amp. 2 mL; D: frasco-ampola 2 e 5 mL (concentração não lida) | só lista local, falta conferir na bula ANVISA | sim | — |
| `tiopental` | Tiopental | mg/kg | — | D: 500 mg, pó | só lista local, falta conferir na bula ANVISA | não | PO |
| `quetamina` | Quetamina | mg/kg | Ketamin S® 50 mg/mL (p. 88) | P: 50 mg/mL, amp. 10 mL; D: escetamina 50 mg/mL, amp. 2 mL | livro cita | sim | — |
| `diazepam` | Diazepam | mg/kg | — | P: 5 mg/mL, amp. 2 mL; comprimido 10 mg | só lista local, falta conferir na bula ANVISA | sim | — |
| `midazolam` | Midazolam | mg/kg | — | P: 5 mg/mL, amp. 3 mL; D: 1 mg/mL (5 mL) e 5 mg/mL (3 e 10 mL) | só lista local, falta conferir na bula ANVISA | com alerta | MULT |
| `etomidato` | Etomidato | mg/kg | — | P e D: 2 mg/mL, amp. 10 mL | só lista local, falta conferir na bula ANVISA | sim | — |
| `propofol` | Propofol | mg/kg | — | P: 10 mg/mL, amp. 20 mL; D: 10 mg/mL (10, 20 e 50 mL) | só lista local, falta conferir na bula ANVISA | sim | — |
| `rocuronio` | Rocurônio | mg/kg | — | P e D: 10 mg/mL, 5 mL | só lista local, falta conferir na bula ANVISA | sim | — |
| `vecuronio` | Vecurônio | mg/kg | — | P: 10 mg, pó | só lista local, falta conferir na bula ANVISA | não | PO |
| `succinilcolina-menor10` | Succinilcolina — menos de 10 kg | mg/kg | — | P: "20 mg/mL", frasco 5 mL; D: suxametônio 100 mg, pó | só lista local, falta conferir na bula ANVISA | com alerta | CONF |
| `succinilcolina-maior10` | Succinilcolina — mais de 10 kg | mg/kg | — | P: "20 mg/mL", frasco 5 mL; D: suxametônio 100 mg, pó | só lista local, falta conferir na bula ANVISA | com alerta | CONF |

### `dosesDaFita.ts` (DOSES_DA_FITA): 32 itens

| id | nome | unidade da dose | apresentação no livro | candidatas nas listas locais | situação | mL na tela | motivo (seção 2) |
|---|---|---|---|---|---|---|---|
| `fita-amiodarona` | Amiodarona | mg/kg | — | P: 50 mg/mL, amp. 3 mL | só lista local, falta conferir na bula ANVISA | sim | — |
| `fita-lidocaina` | Lidocaína | mg/kg | — | P: 20 mg/mL, amp. 20 mL; D: só itens com vasoconstritor ou tubete | só lista local, falta conferir na bula ANVISA | com alerta | VASO |
| `fita-adenosina-1` | Adenosina — 1ª dose | mg/kg | — | P: frasco 2 mL, "6 mg/mL"; D: 3 mg/mL, amp. 2 mL | só lista local, falta conferir na bula ANVISA | com alerta | CONF |
| `fita-adenosina-2` | Adenosina — 2ª dose | mg/kg | — | P: frasco 2 mL, "6 mg/mL"; D: 3 mg/mL, amp. 2 mL | só lista local, falta conferir na bula ANVISA | com alerta | CONF |
| `fita-atropina` | Atropina — bradicardia | mg/kg | — | P: 0,25 mg/mL, amp. 1 mL | só lista local, falta conferir na bula ANVISA | sim | — |
| `fita-atropina-iot` | Atropina — pré-medicação | mg/kg | — | P: 0,25 mg/mL, amp. 1 mL | só lista local, falta conferir na bula ANVISA | sim | — |
| `fita-etomidato` | Etomidato | mg/kg | — | P e D: 2 mg/mL, amp. 10 mL | só lista local, falta conferir na bula ANVISA | sim | — |
| `fita-propofol` | Propofol | mg/kg | — | P: 10 mg/mL, amp. 20 mL; D: 10 mg/mL (10, 20 e 50 mL) | só lista local, falta conferir na bula ANVISA | sim | — |
| `fita-succinilcolina-lactente` | Succinilcolina — IV, lactente | mg/kg | — | P: "20 mg/mL", frasco 5 mL; D: suxametônio 100 mg, pó | só lista local, falta conferir na bula ANVISA | com alerta | CONF |
| `fita-succinilcolina-crianca` | Succinilcolina — IV, criança | mg/kg | — | P: "20 mg/mL", frasco 5 mL; D: suxametônio 100 mg, pó | só lista local, falta conferir na bula ANVISA | com alerta | CONF |
| `fita-succinilcolina-im-lactente` | Succinilcolina — IM, lactente | mg/kg | — | P: "20 mg/mL", frasco 5 mL; D: suxametônio 100 mg, pó | só lista local, falta conferir na bula ANVISA | com alerta | CONF |
| `fita-succinilcolina-im-crianca` | Succinilcolina — IM, criança | mg/kg | — | P: "20 mg/mL", frasco 5 mL; D: suxametônio 100 mg, pó | só lista local, falta conferir na bula ANVISA | com alerta | CONF |
| `fita-rocuronio` | Rocurônio | mg/kg | — | P e D: 10 mg/mL, 5 mL | só lista local, falta conferir na bula ANVISA | sim | — |
| `fita-difenidramina` | Difenidramina | mg/kg | — | D: amp. 1 mL, sem concentração | só lista local, falta conferir na bula ANVISA | sim | — |
| `fita-dexametasona-crupe` | Dexametasona — crupe | mg/kg | — | P: 4 mg/mL, amp. 1 mL | só lista local, falta conferir na bula ANVISA | sim | — |
| `fita-salbutamol-nebulizacao` | Salbutamol — nebulização (asma grave) | mg (dose fixa) | — | P: "0,5 mg/mL, frasco 20 mL" (não diz se é injetável ou para nebulização) | só lista local, falta conferir na bula ANVISA | não | INAL, MULT |
| `fita-ondansetrona-iv` | Ondansetrona IV — vômitos | mg/kg | — | P: 2 mg/mL, amp. 4 mL; comprimido 8 mg; D: 2 mg/mL (2 e 4 mL) | só lista local, falta conferir na bula ANVISA | sim | — |
| `fita-ondansetrona-vo-8a15` | Ondansetrona VO — vômitos | mg (dose fixa) | — | P: 2 mg/mL, amp. 4 mL; comprimido 8 mg; D: 2 mg/mL (2 e 4 mL) | só lista local, falta conferir na bula ANVISA | não | VO |
| `fita-ondansetrona-vo-15a30` | Ondansetrona VO — vômitos | mg (dose fixa) | — | P: 2 mg/mL, amp. 4 mL; comprimido 8 mg; D: 2 mg/mL (2 e 4 mL) | só lista local, falta conferir na bula ANVISA | não | VO |
| `fita-ondansetrona-vo-maior30` | Ondansetrona VO — vômitos | mg (dose fixa) | — | P: 2 mg/mL, amp. 4 mL; comprimido 8 mg; D: 2 mg/mL (2 e 4 mL) | só lista local, falta conferir na bula ANVISA | não | VO |
| `fita-glucagon-menor20` | Glucagon — hipoglicemia | mg (dose fixa) | — | P: 1 mg, pó | só lista local, falta conferir na bula ANVISA | não | PO |
| `fita-glucagon-maior20` | Glucagon — hipoglicemia | mg (dose fixa) | — | P: 1 mg, pó | só lista local, falta conferir na bula ANVISA | não | PO |
| `fita-diazepam-iv` | Diazepam IV — crise epiléptica | mg/kg | — | P: 5 mg/mL, amp. 2 mL; comprimido 10 mg | só lista local, falta conferir na bula ANVISA | sim | — |
| `fita-morfina-iv` | Morfina IV — analgesia | mg/kg | — | P: 10 mg/mL e 1 mg/mL ("dose pediátrica"), amp. 1 mL; D: 1 mg/mL, amp. 2 mL | só lista local, falta conferir na bula ANVISA | com alerta | MULT |
| `fita-fentanil-menor6` | Fentanil IV — analgesia | µg/kg | — | P: 50 µg/mL, amp. 2 mL; D: frasco-ampola 2 e 5 mL (concentração não lida) | só lista local, falta conferir na bula ANVISA | sim | — |
| `fita-fentanil-maior6` | Fentanil IV — analgesia | µg/kg | — | P: 50 µg/mL, amp. 2 mL; D: frasco-ampola 2 e 5 mL (concentração não lida) | só lista local, falta conferir na bula ANVISA | sim | — |
| `fita-naloxona` | Naloxona — intoxicação por opioide | mg/kg | — | P: 0,4 mg/mL, amp. 1 mL; D: amp. 1 mL | só lista local, falta conferir na bula ANVISA | sim | — |
| `fita-naloxona-maior` | Naloxona — intoxicação por opioide | mg (dose fixa) | — | P: 0,4 mg/mL, amp. 1 mL; D: amp. 1 mL | só lista local, falta conferir na bula ANVISA | sim | — |
| `fita-naloxona-baixa` | Naloxona — dose baixa (opioide terapêutico) | µg/kg | — | P: 0,4 mg/mL, amp. 1 mL; D: amp. 1 mL | só lista local, falta conferir na bula ANVISA | sim | — |
| `fita-carvao` | Carvão ativado | g/kg | — | P: suspensão, frasco 120 mL (sem concentração) | só lista local, falta conferir na bula ANVISA | não | VO |
| `fita-paracetamol` | Paracetamol | mg/kg | — | P: 10 mg/mL, frasco 100 mL e amp. 2 mL (IV); sem forma oral | sem apresentação encontrada | não | VO |
| `fita-ibuprofeno` | Ibuprofeno | mg/kg | — | — | sem apresentação encontrada | não | VO |

### `criseEpileptica.ts` (DOSES_CRISE): 15 itens

| id | nome | unidade da dose | apresentação no livro | candidatas nas listas locais | situação | mL na tela | motivo (seção 2) |
|---|---|---|---|---|---|---|---|
| `lorazepam` | Lorazepam IV ou IM | mg/kg | — | P: 4 mg/mL, amp. 1 mL | só lista local, falta conferir na bula ANVISA | sim | — |
| `diazepam-iv` | Diazepam IV | mg/kg | — | P: 5 mg/mL, amp. 2 mL; comprimido 10 mg | só lista local, falta conferir na bula ANVISA | sim | — |
| `diazepam-vr` | Diazepam retal | mg/kg | — | P: 5 mg/mL, amp. 2 mL; comprimido 10 mg | só lista local, falta conferir na bula ANVISA | não | VR |
| `midazolam-iv` | Midazolam IV | mg/kg | — | P: 5 mg/mL, amp. 3 mL; D: 1 mg/mL (5 mL) e 5 mg/mL (3 e 10 mL) | só lista local, falta conferir na bula ANVISA | com alerta | MULT |
| `midazolam-im` | Midazolam IM | mg/kg | — | P: 5 mg/mL, amp. 3 mL; D: 1 mg/mL (5 mL) e 5 mg/mL (3 e 10 mL) | só lista local, falta conferir na bula ANVISA | com alerta | MULT |
| `midazolam-in` | Midazolam intranasal ou bucal | mg/kg | — | P: 5 mg/mL, amp. 3 mL; D: 1 mg/mL (5 mL) e 5 mg/mL (3 e 10 mL) | só lista local, falta conferir na bula ANVISA | com alerta | MULT |
| `fenitoina` | Fenitoína — ataque | mg/kg | — | P: 50 mg/mL, amp. 5 mL; comprimido 100 mg | só lista local, falta conferir na bula ANVISA | aspirar e diluir | DIL |
| `fenitoina-cronico` | Fenitoína — ataque em uso crônico | mg/kg | — | P: 50 mg/mL, amp. 5 mL; comprimido 100 mg | só lista local, falta conferir na bula ANVISA | aspirar e diluir | DIL |
| `valproato` | Ácido valproico | mg/kg | — | P: 100 mg/mL, amp. 3 mL | só lista local, falta conferir na bula ANVISA | aspirar e diluir | DIL |
| `levetiracetam` | Levetiracetam | mg/kg | — | P: 100 mg/mL, frasco 5 mL | só lista local, falta conferir na bula ANVISA | aspirar e diluir | DIL |
| `fenobarbital` | Fenobarbital — ataque | mg/kg | — | P e D: 100 mg/mL, amp. 2 mL | só lista local, falta conferir na bula ANVISA | sim | — |
| `midazolam-continuo` | Midazolam — infusão contínua | µg/kg/min | — | P: 5 mg/mL, amp. 3 mL; D: 1 mg/mL (5 mL) e 5 mg/mL (3 e 10 mL) | só lista local, falta conferir na bula ANVISA | não | INF, MULT |
| `tiopental-bolus` | Tiopental — bolus | mg/kg | — | D: 500 mg, pó | só lista local, falta conferir na bula ANVISA | não | PO |
| `tiopental-continuo` | Tiopental — contínuo | mg/kg/h | — | D: 500 mg, pó | só lista local, falta conferir na bula ANVISA | não | INF, PO |
| `propofol` | Propofol | mg/kg/h | — | P: 10 mg/mL, amp. 20 mL; D: 10 mg/mL (10, 20 e 50 mL) | só lista local, falta conferir na bula ANVISA | não | INF |

### `anafilaxia.ts` (DOSES_ANAFILAXIA): 7 itens

| id | nome | unidade da dose | apresentação no livro | candidatas nas listas locais | situação | mL na tela | motivo (seção 2) |
|---|---|---|---|---|---|---|---|
| `difenidramina-tabela` | Difenidramina — Tabela 3 | mg/kg | — | D: amp. 1 mL, sem concentração | só lista local, falta conferir na bula ANVISA | sim | — |
| `difenidramina-texto` | Difenidramina — texto | mg/kg | — | D: amp. 1 mL, sem concentração | só lista local, falta conferir na bula ANVISA | sim | — |
| `metilprednisolona` | Metilprednisolona | mg/kg | — | P e D: 125 mg, pó | só lista local, falta conferir na bula ANVISA | não | PO |
| `epinefrina-infusao` | Epinefrina — infusão contínua | µg/kg/min | 1 mg/mL (p. 87, 895); 1:10.000 = 0,1 mg/mL preparada (p. 31) | P: 1 mg/mL, amp. 1 mL | livro cita | não | INF, MULT |
| `norepinefrina` | Norepinefrina | µg/kg/min | Norepine® 1 mg/mL (p. 88) | P: 1 mg/mL, amp. 4 mL; D: "2 mg/mL", amp. 4 mL | livro cita | não | INF, CONF |
| `glucagon` | Glucagon (em uso de betabloqueador) | µg/kg | — | P: 1 mg, pó | só lista local, falta conferir na bula ANVISA | não | PO |
| `azul-metileno` | Azul de metileno 1% | mg/kg | 1% = 10 mg/mL (p. 102) | D: 20 mg/mL, amp. 2 mL | livro cita | com alerta | MULT |

### `asma.ts` (DOSES_ASMA): 7 itens

| id | nome | unidade da dose | apresentação no livro | candidatas nas listas locais | situação | mL na tela | motivo (seção 2) |
|---|---|---|---|---|---|---|---|
| `prednisolona` | Prednisona ou prednisolona | mg/kg | — | — | sem apresentação encontrada | não | VO |
| `dexametasona` | Dexametasona | mg/kg | — | P: 4 mg/mL, amp. 1 mL | só lista local, falta conferir na bula ANVISA | sim | — |
| `metilprednisolona` | Metilprednisolona | mg/kg | — | P e D: 125 mg, pó | só lista local, falta conferir na bula ANVISA | não | PO |
| `hidrocortisona` | Hidrocortisona | mg/kg | — | P: 100 mg, pó | só lista local, falta conferir na bula ANVISA | não | PO |
| `magnesio-tabela` | Sulfato de magnésio — Tabela 3 | mg/kg | MgSO₄ 50% = 500 mg/mL (p. 32); 10% = 0,8 mEq/mL (Tabela 11, p. 558; p. 908) | P: 50%, 500 mg/mL, amp. 10 mL; D: 100 mg/mL, amp. 10 mL | livro cita | com alerta | MULT |
| `magnesio-texto` | Sulfato de magnésio — texto | mg/kg | MgSO₄ 50% = 500 mg/mL (p. 32); 10% = 0,8 mEq/mL (Tabela 11, p. 558; p. 908) | P: 50%, 500 mg/mL, amp. 10 mL; D: 100 mg/mL, amp. 10 mL | livro cita | com alerta | MULT |
| `salbutamol-continuo` | Salbutamol — nebulização contínua | mg/kg/h | — | P: "0,5 mg/mL, frasco 20 mL" (não diz se é injetável ou para nebulização) | só lista local, falta conferir na bula ANVISA | não | INAL, INF, MULT |

### `choque.ts` (VASOATIVAS): 3 itens

| id | nome | unidade da dose | apresentação no livro | candidatas nas listas locais | situação | mL na tela | motivo (seção 2) |
|---|---|---|---|---|---|---|---|
| `epinefrina` | Epinefrina (Adrenalina® 1 mg/mL) | µg/kg/min | 1 mg/mL (p. 87, 895); 1:10.000 = 0,1 mg/mL preparada (p. 31) | P: 1 mg/mL, amp. 1 mL | livro cita | não | INF, MULT |
| `dopamina` | Dopamina (5 mg/mL) | µg/kg/min | 5 mg/mL (p. 87; amp. 10 mL = 50 mg, p. 253) | P: 5 mg/mL, amp. 5 mL | livro cita | não | INF |
| `dobutamina` | Dobutamina (Dobutrex® 12,5 mg/mL) | µg/kg/min | Dobutrex® 12,5 mg/mL (p. 87; p. 253) | P: "5 mg/mL", amp. 20 mL | livro cita | não | INF, CONF |

### `tceDecisao.ts` (DOSES_TCE): 1 item

| id | nome | unidade da dose | apresentação no livro | candidatas nas listas locais | situação | mL na tela | motivo (seção 2) |
|---|---|---|---|---|---|---|---|
| `nacl3-continuo` | NaCl 3% — infusão contínua | mL/kg/h | — | — | sem apresentação encontrada | não | INF |

### `choqueToxicoPartesMolesPed.ts` (DOSES_PELE, DOSES_SCT): 15 itens

| id | nome | unidade da dose | apresentação no livro | candidatas nas listas locais | situação | mL na tela | motivo (seção 2) |
|---|---|---|---|---|---|---|---|
| `cefalexina` | Cefalexina VO (cefalosporina de 1ª geração) | mg/kg/dia | — | P: comprimido 500 mg | só lista local, falta conferir na bula ANVISA | não | VO |
| `clinda-vo` | Clindamicina VO | mg/kg/dia | — | P: 150 mg/mL, amp. 4 mL; D: 300 mg/2 mL | só lista local, falta conferir na bula ANVISA | não | VO |
| `clinda-iv` | Clindamicina IV | mg/kg/dia | — | P: 150 mg/mL, amp. 4 mL; D: 300 mg/2 mL | só lista local, falta conferir na bula ANVISA | aspirar e diluir | DIL |
| `amoxclav` | Amoxicilina-clavulanato 7:1 VO | mg/kg/dia | — | P: só IV, 1 g + 200 mg, pó (sem forma oral) | sem apresentação encontrada | não | VO |
| `smxtmp` | Sulfametoxazol-trimetoprima — infecção moderada | mg/kg/dia | — | P: amp. 5 mL com 400 mg + 80 mg | só lista local, falta conferir na bula ANVISA | aspirar e diluir | DIL |
| `doxi` | Doxiciclina (> 8 anos) | mg/kg/dia | — | P: comprimido 100 mg | só lista local, falta conferir na bula ANVISA | sim | — |
| `oxacilina` | Oxacilina IV | mg/kg/dia | — | P: 500 mg, pó | só lista local, falta conferir na bula ANVISA | não | PO |
| `ceftriaxona` | Ceftriaxona (cefalosporina de 3ª geração) | mg/kg/dia | — | P: 1 g, pó; D: 500 mg e 1 g | só lista local, falta conferir na bula ANVISA | não | PO |
| `vancomicina` | Vancomicina | mg/kg/dose | — | P: 500 mg, pó | só lista local, falta conferir na bula ANVISA | não | PO |
| `linezolida` | Linezolida (< 12 anos) | mg/kg/dose | — | P e D: 2 mg/mL, bolsa 300 mL | só lista local, falta conferir na bula ANVISA | sim | — |
| `piptazo` | Piperacilina-tazobactam | mg/kg/dia | — | P: 4,5 g, pó; D: 2,25 g e 4,5 g | só lista local, falta conferir na bula ANVISA | não | PO |
| `metronidazol` | Metronidazol IV | mg/kg/dia | — | P: 5 mg/mL, frasco 100 mL; comprimido 250 mg | só lista local, falta conferir na bula ANVISA | sim | — |
| `penicilina` | Penicilina cristalina | UI/kg/dia | — | — | sem apresentação encontrada | não | PO |
| `clindamicina` | Clindamicina (associação obrigatória; reduz a síntese de toxinas) | mg/kg/dia | — | P: 150 mg/mL, amp. 4 mL; D: 300 mg/2 mL | só lista local, falta conferir na bula ANVISA | aspirar e diluir | DIL |
| `igiv-unica` | Imunoglobulina IV — dose única (adjuvante, sem recomendação formal) | g/kg/dose | — | D: IgG humana 50 mg/mL, frasco 100 mL | só lista local, falta conferir na bula ANVISA | não | HEMO |

### `comaHicPed.ts` (DOSES_COMA): 2 itens

| id | nome | unidade da dose | apresentação no livro | candidatas nas listas locais | situação | mL na tela | motivo (seção 2) |
|---|---|---|---|---|---|---|---|
| `midazolam` | Midazolam — estado de mal epiléptico (algoritmo do coma) | mg/kg/dose | — | P: 5 mg/mL, amp. 3 mL; D: 1 mg/mL (5 mL) e 5 mg/mL (3 e 10 mL) | só lista local, falta conferir na bula ANVISA | com alerta | MULT |
| `dexa-hic` | Dexametasona — edema vasogênico (tumores, abscessos) | mg/kg/dose | — | P: 4 mg/mL, amp. 1 mL | só lista local, falta conferir na bula ANVISA | sim | — |

### `criseHipertensivaPed.ts` (DOSES_CRISE_HA): 3 itens

| id | nome | unidade da dose | apresentação no livro | candidatas nas listas locais | situação | mL na tela | motivo (seção 2) |
|---|---|---|---|---|---|---|---|
| `hidralazina-vo` | Hidralazina VO (sintomas menos significativos) | mg/kg/dose | — | P: 20 mg/mL, amp. 1 mL | só lista local, falta conferir na bula ANVISA | não | VO |
| `isradipina` | Isradipina | mg/kg/dose | — | — | sem apresentação encontrada | não | VO |
| `minoxidil` | Minoxidil | mg/kg/dose | — | — | sem apresentação encontrada | não | VO |

### `digestivoHepaticoPed.ts` (DOSES_HDA): 2 itens

| id | nome | unidade da dose | apresentação no livro | candidatas nas listas locais | situação | mL na tela | motivo (seção 2) |
|---|---|---|---|---|---|---|---|
| `octreotida-bolus` | Octreotida — bolus (HDA varicosa) | µg/kg/dose | — | P: 0,1 mg/mL (100 µg/mL), amp. 1 mL; D: amp. 1 mL sem concentração | só lista local, falta conferir na bula ANVISA | sim | — |
| `omeprazol-iv` | Omeprazol IV — HDA não varicosa (lesão péptica) | mg/kg/dia | — | P: 40 mg, pó | só lista local, falta conferir na bula ANVISA | não | PO |

### `eletrolitosPed.ts` (FOSFORO, HIPERCALCEMIA, HIPERCALEMIA, HIPERMAGNESEMIA, HIPOCALCEMIA, HIPOMAGNESEMIA, K_IV, K_VO): 20 itens

| id | nome | unidade da dose | apresentação no livro | candidatas nas listas locais | situação | mL na tela | motivo (seção 2) |
|---|---|---|---|---|---|---|---|
| `p-vo` | Fósforo VO | mmol/kg/dia | — | — | sem apresentação encontrada | não | VO, DIA |
| `p-ev` | Fósforo EV (hipofosfatemia grave) | mmol/kg | fósforo orgânico: 31 mg P/mL = 1 mmol/mL (Tabela 11, p. 559) | P: fosfato de potássio 2 mEq/mL (outro sal) | livro cita | com alerta | CONF |
| `furosemida-ca` | Furosemida | mg/kg | — | P: 10 mg/mL, amp. 2 mL | só lista local, falta conferir na bula ANVISA | sim | — |
| `hidrocortisona-ca` | Hidrocortisona | mg/kg/dia | — | P: 100 mg, pó | só lista local, falta conferir na bula ANVISA | não | DIA, PO |
| `prednisona-ca` | Prednisona | mg/kg/dia | — | P: comprimido 20 mg | só lista local, falta conferir na bula ANVISA | não | VO, DIA |
| `calcitonina` | Calcitonina | UI/kg | — | — | sem apresentação encontrada | sim | — |
| `bic` | Bicarbonato de sódio | mEq/kg | 8,4% = 1 mEq/mL (p. 32; Tabela 11, p. 558) | P: 8,4%, amp. 10 mL; D: 1 mEq/mL, 250 mL | livro cita | com alerta | MULT |
| `insulina` | Solução polarizante — insulina | UI/kg | só a solução já diluída, 0,1 UI/mL (p. 521) | P: 100 UI/mL, frasco 10 mL | livro cita | com alerta | MULT, DIL |
| `glicose-polarizante` | Solução polarizante — glicose | g/kg | glicose 25% (p. 32) | P: 10%, 25% e 50% | livro cita | com alerta | MULT |
| `sorcal` | Sorcal | g/kg | — | — | sem apresentação encontrada | não | VO |
| `kayexalate` | Kayexalate | g/kg | — | — | sem apresentação encontrada | não | VO |
| `furosemida-k` | Furosemida | mg/kg | — | P: 10 mg/mL, amp. 2 mL | só lista local, falta conferir na bula ANVISA | sim | — |
| `cloreto-ca-mg` | Cloreto de cálcio | mg/kg | cloreto 10% = 27 mg Ca elementar/mL (Tabela 11, p. 559) | P: 10%, 100 mg/mL (do sal), amp. 10 mL | livro cita | com alerta | ELEM |
| `gluconato-ca-mg` | Gluconato de cálcio | mg/kg | 10% = 100 mg/mL (p. 896); 9 mg Ca elementar/mL (Tabela 11, p. 558) | P: 10%, 100 mg/mL, amp. 10 mL | livro cita | com alerta | ELEM |
| `gluconato-lento` | Gluconato de cálcio 10% — correção lenta | mL/kg/dia | 10% = 100 mg/mL (p. 896); 9 mg Ca elementar/mL (Tabela 11, p. 558) | P: 10%, 100 mg/mL, amp. 10 mL | livro cita | não | DIA, ELEM |
| `mg-grave` | Sulfato de magnésio EV (grave ou sintomática) | mg/kg | MgSO₄ 50% = 500 mg/mL (p. 32); 10% = 0,8 mEq/mL (Tabela 11, p. 558; p. 908) | P: 50%, 500 mg/mL, amp. 10 mL; D: 100 mg/mL, amp. 10 mL | livro cita | com alerta | MULT |
| `mg-moderada` | Magnésio EV (moderada) | mEq/kg/dia | MgSO₄ 50% = 500 mg/mL (p. 32); 10% = 0,8 mEq/mL (Tabela 11, p. 558; p. 908) | P: 50%, 500 mg/mL, amp. 10 mL; D: 100 mg/mL, amp. 10 mL | livro cita | não | DIA, MULT |
| `mg-leve` | Magnésio enteral (leve) | mg/kg/dose | — | — | sem apresentação encontrada | não | VO |
| `k-iv` | Potássio EV (hipocalemia grave) | mEq/kg/h | KCl 19,1% = 2,5 mEq/mL; xarope KCl 10% = 1,3 mEq/mL (Tabela 11, p. 558) | P: KCl 10% e 19,1% | livro cita | não | INF |
| `k-vo` | Potássio por via enteral (casos leves) | mEq/kg/dia | KCl 19,1% = 2,5 mEq/mL; xarope KCl 10% = 1,3 mEq/mL (Tabela 11, p. 558) | P: KCl 10% e 19,1% | livro cita | não | VO, DIA |

### `falciformePed.ts` (DOSES_CRISE_ALGICA): 5 itens

| id | nome | unidade da dose | apresentação no livro | candidatas nas listas locais | situação | mL na tela | motivo (seção 2) |
|---|---|---|---|---|---|---|---|
| `morfina-figura` | Morfina EV — Figura 1 | mg/kg/dose | — | P: 10 mg/mL e 1 mg/mL ("dose pediátrica"), amp. 1 mL; D: 1 mg/mL, amp. 2 mL | só lista local, falta conferir na bula ANVISA | com alerta | MULT |
| `morfina-texto` | Morfina parenteral — texto (crianças) | mg/kg/dose | — | P: 10 mg/mL e 1 mg/mL ("dose pediátrica"), amp. 1 mL; D: 1 mg/mL, amp. 2 mL | só lista local, falta conferir na bula ANVISA | com alerta | MULT |
| `dipirona` | Dipirona (dose do Apêndice) | mg/kg/dose | — | P: 500 mg/mL, amp. 2 mL; gotas 500 mg/mL | só lista local, falta conferir na bula ANVISA | sim | — |
| `paracetamol` | Paracetamol (dose do Apêndice) | mg/kg/dose | — | P: 10 mg/mL, frasco 100 mL e amp. 2 mL (IV); sem forma oral | sem apresentação encontrada | não | VO |
| `ibuprofeno` | Ibuprofeno (dose do Apêndice) | mg/kg/dose | — | — | sem apresentação encontrada | não | VO |

### `febreSemSinaisPed.ts` (DOSES_FSSL): 5 itens

| id | nome | unidade da dose | apresentação no livro | candidatas nas listas locais | situação | mL na tela | motivo (seção 2) |
|---|---|---|---|---|---|---|---|
| `amoxicilina` | Amoxicilina — hemograma alterado, vacinação pneumocócica incompleta | mg/kg/dia | — | P: comprimido 500 mg | só lista local, falta conferir na bula ANVISA | não | VO |
| `cefuroxima-vo` | Cefuroxima VO — ITU provável | mg/kg/dia | — | P: 750 mg, pó (IV) (sem forma oral) | sem apresentação encontrada | não | VO |
| `amoxclav-7` | Amoxicilina-clavulanato 7:1 — ITU provável | mg/kg/dia | — | P: só IV, 1 g + 200 mg, pó (sem forma oral) | sem apresentação encontrada | não | VO |
| `ceftriaxona` | Ceftriaxona EV/IM — fora do período neonatal | mg/kg/dia | — | P: 1 g, pó; D: 500 mg e 1 g | só lista local, falta conferir na bula ANVISA | não | PO |
| `cefotaxima` | Cefotaxima EV — fora do período neonatal | mg/kg/dia | — | — | sem apresentação encontrada | não | PO |

### `glomerulopatiasPed.ts` (DOSES_NEFRITICA, DOSES_NEFROTICA, DOSES_SHU): 8 itens

| id | nome | unidade da dose | apresentação no livro | candidatas nas listas locais | situação | mL na tela | motivo (seção 2) |
|---|---|---|---|---|---|---|---|
| `furo-gnpe` | Furosemida — GNPE com congestão e HAS | mg/kg/dia | — | P: 10 mg/mL, amp. 2 mL | só lista local, falta conferir na bula ANVISA | sim | — |
| `mp-pulso` | Metilprednisolona — pulso na GNRP | mg/kg/dose | — | P e D: 125 mg, pó | só lista local, falta conferir na bula ANVISA | não | PO |
| `prednisona` | Prednisona — após os pulsos | mg/kg/dia | — | P: comprimido 20 mg | só lista local, falta conferir na bula ANVISA | não | VO |
| `furo-albumina` | Furosemida — durante a albumina (hipovolemia com repercussão e PA elevada) | mg/kg/dose | — | P: 10 mg/mL, amp. 2 mL | só lista local, falta conferir na bula ANVISA | sim | — |
| `furo-hiper` | Furosemida — hipervolemia | mg/kg/dose | — | P: 10 mg/mL, amp. 2 mL | só lista local, falta conferir na bula ANVISA | sim | — |
| `hctz` | Hidroclorotiazida — hipervolemia | mg/kg/dia | — | P: comprimido 25 mg | só lista local, falta conferir na bula ANVISA | não | VO |
| `espiro` | Espironolactona — hipervolemia (se injúria renal ou hipocalemia) | mg/kg/dia | — | P: comprimido 25 mg | só lista local, falta conferir na bula ANVISA | não | VO |
| `furo-shu` | Furosemida — tentativa de induzir diurese (sobrecarga cardiopulmonar) | mg/kg/dose | — | P: 10 mg/mL, amp. 2 mL | só lista local, falta conferir na bula ANVISA | sim | — |

### `hemostasiaTromboPed.ts` (DOSES_HEMOSTASIA, DOSES_PTI): 12 itens

| id | nome | unidade da dose | apresentação no livro | candidatas nas listas locais | situação | mL na tela | motivo (seção 2) |
|---|---|---|---|---|---|---|---|
| `ddavp` | Desmopressina (DDAVP) — hemofilia A leve/moderada; DVW tipos 1 e 2A responsivos | µg/kg/dose | — | P e D: 4 µg/mL, 1 mL | só lista local, falta conferir na bula ANVISA | aspirar e diluir | DIL |
| `atx-iv` | Ácido tranexâmico IV — hemofilia | mg/kg/dose | — | P: 100 mg/mL, amp. 5 mL; D: 50 mg/mL, amp. 5 mL | só lista local, falta conferir na bula ANVISA | com alerta | CONF |
| `atx-vo` | Ácido tranexâmico VO — hemofilia | mg/kg/dose | — | P: 100 mg/mL, amp. 5 mL; D: 50 mg/mL, amp. 5 mL | só lista local, falta conferir na bula ANVISA | não | VO, CONF |
| `atx-dvw` | Ácido tranexâmico — doença de von Willebrand | mg/kg/dose | — | P: 100 mg/mL, amp. 5 mL; D: 50 mg/mL, amp. 5 mL | só lista local, falta conferir na bula ANVISA | com alerta | CONF |
| `ccpa` | CCPa — inibidor (Quadro 3) | UI/kg/dose | — | — | sem apresentação encontrada | não | HEMO |
| `rfviia` | Fator VII recombinante ativado — inibidor (Quadro 3) | µg/kg/dose | — | — | sem apresentação encontrada | não | HEMO |
| `mp-pti` | Metilprednisolona IV | mg/kg/dia | — | P e D: 125 mg, pó | só lista local, falta conferir na bula ANVISA | não | PO |
| `pred-pti` | Prednisona oral — esquema longo | mg/kg/dia | — | P: comprimido 20 mg | só lista local, falta conferir na bula ANVISA | não | VO |
| `pred-pti-curto` | Prednisona oral — esquema curto | mg/kg/dia | — | P: comprimido 20 mg | só lista local, falta conferir na bula ANVISA | não | VO |
| `prednisolona-ash` | Prednisolona — sangramento mucoso sem risco de morte (ASH 2019) | mg/kg/dia | — | — | sem apresentação encontrada | não | VO |
| `igiv-pti` | Imunoglobulina humana IV | g/kg/dose | — | D: IgG humana 50 mg/mL, frasco 100 mL | só lista local, falta conferir na bula ANVISA | não | HEMO |
| `anti-d` | Imunoglobulina anti-D — dose única | µg/kg/dose | — | D: IgG humana 50 mg/mL, frasco 100 mL | só lista local, falta conferir na bula ANVISA | não | HEMO |

### `imunodeprimidoPed.ts` (DOSES_IMUNODEPRIMIDO): 13 itens

| id | nome | unidade da dose | apresentação no livro | candidatas nas listas locais | situação | mL na tela | motivo (seção 2) |
|---|---|---|---|---|---|---|---|
| `aciclovir` | Aciclovir — HSV, CMV, EBV, VZV | mg/kg/dia | — | P: 250 mg, pó; comprimido 200 mg | só lista local, falta conferir na bula ANVISA | não | PO |
| `anfotericina` | Anfotericina B — antifúngico e antiprotozoário | mg/kg/dia | — | P: desoxicolato 50 mg pó e lipossomal 50 mg pó; D: complexo lipídico 5 mg/mL | só lista local, falta conferir na bula ANVISA | não | PO, MULT |
| `ampicilina` | Ampicilina — Listeria, pneumococo, meningococo, H. influenzae | mg/kg/dia | — | P: 1 g, pó | só lista local, falta conferir na bula ANVISA | não | PO |
| `azitromicina` | Azitromicina — MAC, Legionella, Cryptosporidium | mg/kg/dia | só VO: xarope 40 mg/mL (p. 503)* | P: comprimido 500 mg; D: 500 mg pó (IV) | só lista local, falta conferir na bula ANVISA | não | PO |
| `cefepima` | Cefepima — E. coli, Klebsiella | mg/kg/dia | — | P: 1 g, pó | só lista local, falta conferir na bula ANVISA | não | PO |
| `cefotaxima` | Cefotaxima | mg/kg/dia | — | — | sem apresentação encontrada | não | PO |
| `ceftazidima` | Ceftazidima — P. aeruginosa | mg/kg/dia | — | P: 1 g, pó | só lista local, falta conferir na bula ANVISA | não | PO |
| `ceftriaxona` | Ceftriaxona | mg/kg/dia | — | P: 1 g, pó; D: 500 mg e 1 g | só lista local, falta conferir na bula ANVISA | não | PO |
| `fluconazol` | Fluconazol — C. albicans, Cryptococcus | mg/kg/dia | — | P: 2 mg/mL, frasco 100 mL; comprimido 150 mg | só lista local, falta conferir na bula ANVISA | sim | — |
| `cipro` | Ciprofloxacino | mg/kg/dia | — | P: 2 mg/mL, frasco 100 mL; comprimido 500 mg | só lista local, falta conferir na bula ANVISA | sim | — |
| `gentamicina` | Gentamicina — P. aeruginosa, Serratia, Staphylococcus | mg/kg/dia | — | P: 40 mg/mL, amp. 2 mL | só lista local, falta conferir na bula ANVISA | aspirar e diluir | DIL |
| `tmp` | TMP/SMX — P. jirovecii, Nocardia, Listeria e outros | mg/kg/dia | — | P: amp. 5 mL com 400 mg + 80 mg | só lista local, falta conferir na bula ANVISA | aspirar e diluir | DIL |
| `vancomicina` | Vancomicina — MRSA | mg/kg/dia | — | P: 500 mg, pó | só lista local, falta conferir na bula ANVISA | não | PO |

### `injuriaRenalPed.ts` (DOSES_IRA, DOSES_TABELA8): 12 itens

| id | nome | unidade da dose | apresentação no livro | candidatas nas listas locais | situação | mL na tela | motivo (seção 2) |
|---|---|---|---|---|---|---|---|
| `furosemida` | Furosemida — hipervolemia na IRA | mg/kg/dose | — | P: 10 mg/mL, amp. 2 mL | só lista local, falta conferir na bula ANVISA | sim | — |
| `nac-contraste` | N-acetilcisteína — profilaxia do contraste (> 30 dias de vida) | mg/kg/dose | — | P: 100 mg/mL, amp. 3 mL | só lista local, falta conferir na bula ANVISA | aspirar e diluir | DIL |
| `cacl` | Cloreto de cálcio 10% — K > 7 ou alteração de ECG; hipocalcemia sintomática | mg/kg/dose | cloreto 10% = 27 mg Ca elementar/mL (Tabela 11, p. 559) | P: 10%, 100 mg/mL (do sal), amp. 10 mL | livro cita | com alerta | ELEM |
| `gluconato` | Gluconato de cálcio 10% — K > 7 ou alteração de ECG; hipocalcemia sintomática | mg/kg/dose | 10% = 100 mg/mL (p. 896); 9 mg Ca elementar/mL (Tabela 11, p. 558) | P: 10%, 100 mg/mL, amp. 10 mL | livro cita | com alerta | ELEM |
| `bic` | Bicarbonato de sódio 8,4% — hipercalemia | mEq/kg/dose | 8,4% = 1 mEq/mL (p. 32; Tabela 11, p. 558) | P: 8,4%, amp. 10 mL; D: 1 mEq/mL, 250 mL | livro cita | com alerta | MULT |
| `insulina` | Solução polarizante — insulina regular | UI/kg/dose | só a solução já diluída, 0,1 UI/mL (p. 521) | P: 100 UI/mL, frasco 10 mL | livro cita | com alerta | MULT, DIL |
| `glicose` | Solução polarizante — glicose | g/kg/dose | glicose 25% (p. 32) | P: 10%, 25% e 50% | livro cita | com alerta | MULT |
| `beta2` | Beta-2 agonista EV — hipercalemia | µg/kg/dose | — | P: "0,5 mg/mL, frasco 20 mL" (não diz se é injetável ou para nebulização) | só lista local, falta conferir na bula ANVISA | com alerta | MULT |
| `furo-k` | Furosemida — hipercalemia | mg/kg/dose | — | P: 10 mg/mL, amp. 2 mL | só lista local, falta conferir na bula ANVISA | sim | — |
| `sorcal` | Poliestirenossulfonato de cálcio (Sorcal) | g/kg/dose | — | — | sem apresentação encontrada | não | VO |
| `gluconato-assint` | Gluconato de cálcio 10% — hipocalcemia assintomática | mg/kg/dia | 10% = 100 mg/mL (p. 896); 9 mg Ca elementar/mL (Tabela 11, p. 558) | P: 10%, 100 mg/mL, amp. 10 mL | livro cita | com alerta | ELEM |
| `mg` | Magnésio elementar — sintomático ou < 1,2 mg/dL | mg/kg/dose | só do sal: MgSO₄ 50% = 500 mg/mL (p. 32) | P: 50%, 500 mg/mL; D: 100 mg/mL | livro cita | com alerta | ELEM, MULT |

### `insuficienciaCardiacaPed.ts` (DOSES_IC_ORAIS): 10 itens

| id | nome | unidade da dose | apresentação no livro | candidatas nas listas locais | situação | mL na tela | motivo (seção 2) |
|---|---|---|---|---|---|---|---|
| `furosemida` | Furosemida | mg/kg/dose | — | P: 10 mg/mL, amp. 2 mL | só lista local, falta conferir na bula ANVISA | sim | — |
| `hctz` | Hidroclorotiazida | mg/kg/dia | — | P: comprimido 25 mg | só lista local, falta conferir na bula ANVISA | não | VO |
| `espironolactona` | Espironolactona | mg/kg/dia | — | P: comprimido 25 mg | só lista local, falta conferir na bula ANVISA | não | VO |
| `captopril-lactente` | Captopril — lactentes | mg/kg/dia | — | P: comprimido 25 mg | só lista local, falta conferir na bula ANVISA | não | VO |
| `captopril-crianca` | Captopril — crianças | mg/kg/dia | — | P: comprimido 25 mg | só lista local, falta conferir na bula ANVISA | não | VO |
| `enalapril` | Enalapril | mg/kg/dia | — | P: comprimido 10 mg | só lista local, falta conferir na bula ANVISA | não | VO |
| `carvedilol` | Carvedilol | mg/kg/dia | — | P: comprimido 6,25 mg | só lista local, falta conferir na bula ANVISA | não | VO |
| `metoprolol` | Metoprolol | mg/kg/dia | — | P: só a ampola IV, 1 mg/mL | sem apresentação encontrada | não | VO |
| `digoxina-menor2` | Digoxina — < 2 anos | µg/kg/dia | elixir 50 µg/mL; comprimido 0,25 mg (p. 240) | P: comprimido 0,25 mg; amp. 0,25 mg/mL | livro cita | não | VO |
| `digoxina-maior2` | Digoxina — > 2 anos | µg/kg/dia | elixir 50 µg/mL; comprimido 0,25 mg (p. 240) | P: comprimido 0,25 mg; amp. 0,25 mg/mL | livro cita | não | VO |

### `intoxicacaoPed.ts` (DOSES_CAPITULO_INTOX): 9 itens

| id | nome | unidade da dose | apresentação no livro | candidatas nas listas locais | situação | mL na tela | motivo (seção 2) |
|---|---|---|---|---|---|---|---|
| `carvao-cap` | Carvão ativado (texto do capítulo) | g/kg/dose | — | P: suspensão, frasco 120 mL (sem concentração) | só lista local, falta conferir na bula ANVISA | não | VO |
| `furosemida-vo` | Furosemida — diurese forçada, VO | mg/kg/dose | — | P: 10 mg/mL, amp. 2 mL | só lista local, falta conferir na bula ANVISA | não | VO |
| `furosemida-iv` | Furosemida — diurese forçada, EV | mg/kg/dose | — | P: 10 mg/mL, amp. 2 mL | só lista local, falta conferir na bula ANVISA | sim | — |
| `bicarbonato-alcalina` | Bicarbonato de sódio — diurese alcalina | mEq/kg/dose | 8,4% = 1 mEq/mL (p. 32; Tabela 11, p. 558) | P: 8,4%, amp. 10 mL; D: 1 mEq/mL, 250 mL | livro cita | com alerta | MULT |
| `acetilcisteina-vo-ataque` | Acetilcisteína VO — ataque (acetaminofeno) | mg/kg/dose | — | P: 100 mg/mL, amp. 3 mL | só lista local, falta conferir na bula ANVISA | não | VO |
| `acetilcisteina-vo-manut` | Acetilcisteína VO — manutenção | mg/kg/dose | — | P: 100 mg/mL, amp. 3 mL | só lista local, falta conferir na bula ANVISA | não | VO |
| `atropina-cap` | Atropina — organofosforados e carbamatos (capítulo) | mg/kg/dose | — | P: 0,25 mg/mL, amp. 1 mL | só lista local, falta conferir na bula ANVISA | sim | — |
| `pralidoxima-im` | Pralidoxima — IM | mg/kg/dose | — | — | sem apresentação encontrada | sim | — |
| `vitk-sc` | Vitamina K1 — SC, sem sangramento ativo | mg (dose fixa) | — | P: 10 mg/mL, amp. 1 mL | só lista local, falta conferir na bula ANVISA | sim | — |

### `ituPed.ts` (DOSES_ITU_ORAL, DOSES_ITU_PARENTERAL): 19 itens

| id | nome | unidade da dose | apresentação no livro | candidatas nas listas locais | situação | mL na tela | motivo (seção 2) |
|---|---|---|---|---|---|---|---|
| `amoxicilina` | Amoxicilina | mg/kg/dia | — | P: comprimido 500 mg | só lista local, falta conferir na bula ANVISA | não | VO |
| `amoxclav` | Amoxicilina-clavulanato | mg/kg/dia | — | P: só IV, 1 g + 200 mg, pó (sem forma oral) | sem apresentação encontrada | não | VO |
| `cefalexina` | Cefalexina | mg/kg/dia | — | P: comprimido 500 mg | só lista local, falta conferir na bula ANVISA | não | VO |
| `cefadroxila` | Cefadroxila | mg/kg/dia | — | — | sem apresentação encontrada | não | VO |
| `cefuroxima` | Cefuroxima | mg/kg/dia | — | P: 750 mg, pó (IV) (sem forma oral) | sem apresentação encontrada | não | VO |
| `smx-tmp` | Sulfametoxazol + trimetoprima (dose em TMP) | mg/kg/dia | — | P: amp. 5 mL com 400 mg + 80 mg | só lista local, falta conferir na bula ANVISA | não | VO |
| `cipro-vo` | Ciprofloxacina VO | mg/kg/dia | — | P: 2 mg/mL, frasco 100 mL; comprimido 500 mg | só lista local, falta conferir na bula ANVISA | não | VO |
| `nitrofurantoina` | Nitrofurantoína | mg/kg/dia | — | P: comprimido 100 mg | só lista local, falta conferir na bula ANVISA | não | VO |
| `ampicilina` | Ampicilina | mg/kg/dia | — | P: 1 g, pó | só lista local, falta conferir na bula ANVISA | não | PO |
| `amicacina` | Amicacina | mg/kg/dia | — | P: 250 mg/mL, amp. 2 mL | só lista local, falta conferir na bula ANVISA | aspirar e diluir | DIL |
| `gentamicina` | Gentamicina | mg/kg/dia | — | P: 40 mg/mL, amp. 2 mL | só lista local, falta conferir na bula ANVISA | aspirar e diluir | DIL |
| `tobramicina` | Tobramicina | mg/kg/dia | — | — | sem apresentação encontrada | sim | — |
| `cefazolina` | Cefazolina | mg/kg/dia | — | P: 1 g, pó | só lista local, falta conferir na bula ANVISA | não | PO |
| `cefotaxima` | Cefotaxima | mg/kg/dia | — | — | sem apresentação encontrada | não | PO |
| `ceftriaxona` | Ceftriaxona | mg/kg/dia | — | P: 1 g, pó; D: 500 mg e 1 g | só lista local, falta conferir na bula ANVISA | não | PO |
| `cefepima` | Cefepima | mg/kg/dia | — | P: 1 g, pó | só lista local, falta conferir na bula ANVISA | não | PO |
| `ceftazidima` | Ceftazidima | mg/kg/dia | — | P: 1 g, pó | só lista local, falta conferir na bula ANVISA | não | PO |
| `ticarcilina` | Ticarcilina | mg/kg/dia | — | — | sem apresentação encontrada | sim | — |
| `cipro-iv` | Ciprofloxacina IV | mg/kg/dia | — | P: 2 mg/mL, frasco 100 mL; comprimido 500 mg | só lista local, falta conferir na bula ANVISA | sim | — |

### `kawasaki.ts` (DOSES_AHA_2024, DOSES_KAWASAKI): 11 itens

| id | nome | unidade da dose | apresentação no livro | candidatas nas listas locais | situação | mL na tela | motivo (seção 2) |
|---|---|---|---|---|---|---|---|
| `aha-ivig` | Imunoglobulina EV | g/kg/dose | — | D: IgG humana 50 mg/mL, frasco 100 mL | só lista local, falta conferir na bula ANVISA | não | HEMO |
| `aha-aas` | AAS — fase aguda | mg/kg/dia | — | P: comprimido 100 mg | só lista local, falta conferir na bula ANVISA | não | VO |
| `aha-prednisolona` | Prednisolona (esquema RAISE) | mg/kg/dia | — | — | sem apresentação encontrada | sim | — |
| `aha-metilpred` | Metilprednisolona (esquema norte-americano) | mg/kg/dia | — | P e D: 125 mg, pó | só lista local, falta conferir na bula ANVISA | não | PO |
| `aha-infliximabe` | Infliximabe | mg/kg/dose | — | — | sem apresentação encontrada | não | PO |
| `ivig` | Imunoglobulina EV | g/kg/dose | — | D: IgG humana 50 mg/mL, frasco 100 mL | só lista local, falta conferir na bula ANVISA | não | HEMO |
| `aas-alta` | AAS — fase aguda | mg/kg/dia | — | P: comprimido 100 mg | só lista local, falta conferir na bula ANVISA | não | VO |
| `aas-baixa` | AAS — antiagregante | mg/kg/dia | — | P: comprimido 100 mg | só lista local, falta conferir na bula ANVISA | não | VO |
| `metilpred-pulso` | Metilprednisolona — pulso | mg/kg/dose | — | P e D: 125 mg, pó | só lista local, falta conferir na bula ANVISA | não | PO |
| `metilpred-dia` | Metilprednisolona — dose alta diária | mg/kg/dia | — | P e D: 125 mg, pó | só lista local, falta conferir na bula ANVISA | não | PO |
| `infliximabe` | Infliximabe (refratário, 2ª opção) | mg/kg/dose | — | — | sem apresentação encontrada | não | PO |

### `meningitePed.ts` (DOSES_MENINGITE, DOSES_PROFILAXIA): 13 itens

| id | nome | unidade da dose | apresentação no livro | candidatas nas listas locais | situação | mL na tela | motivo (seção 2) |
|---|---|---|---|---|---|---|---|
| `ampicilina-neo` | Ampicilina — período neonatal (com aminoglicosídeo) | mg/kg/dia | — | P: 1 g, pó | só lista local, falta conferir na bula ANVISA | não | PO |
| `cefotaxima-neo` | Cefotaxima — período neonatal (suspeita de resistente, + ampicilina) | mg/kg/dia | — | — | sem apresentação encontrada | não | PO |
| `aciclovir-neo` | Aciclovir — período neonatal (herpes) | mg/kg/dia | — | P: 250 mg, pó; comprimido 200 mg | só lista local, falta conferir na bula ANVISA | não | PO |
| `ceftriaxona` | Ceftriaxona — pós-neonatal | mg/kg/dia | — | P: 1 g, pó; D: 500 mg e 1 g | só lista local, falta conferir na bula ANVISA | não | PO |
| `cefotaxima` | Cefotaxima — pós-neonatal | mg/kg/dia | — | — | sem apresentação encontrada | não | PO |
| `vancomicina` | Vancomicina — associada (risco de pneumococo resistente) | mg/kg/dia | — | P: 500 mg, pó | só lista local, falta conferir na bula ANVISA | não | PO |
| `aciclovir` | Aciclovir — meningoencefalite herpética | mg/kg/dose | — | P: 250 mg, pó; comprimido 200 mg | só lista local, falta conferir na bula ANVISA | não | PO |
| `dexametasona` | Dexametasona adjuvante (decisão individualizada) | mg/kg/dose | — | P: 4 mg/mL, amp. 1 mL | só lista local, falta conferir na bula ANVISA | sim | — |
| `rifampicina-mening` | Rifampicina — meningococo | mg/kg/dia | — | — | sem apresentação encontrada | não | VO |
| `rifampicina-mening-neo` | Rifampicina — meningococo, período neonatal (metade da dose) | mg/kg/dia | — | — | sem apresentação encontrada | não | VO |
| `ceftriaxona-mening` | Ceftriaxona — meningococo (< 15 anos) | mg (dose fixa) | — | P: 1 g, pó; D: 500 mg e 1 g | só lista local, falta conferir na bula ANVISA | não | PO |
| `cipro-mening` | Ciprofloxacino — meningococo | mg/kg/dose | — | P: 2 mg/mL, frasco 100 mL; comprimido 500 mg | só lista local, falta conferir na bula ANVISA | sim | — |
| `rifampicina-hib` | Rifampicina — Hib | mg/kg/dia | — | — | sem apresentação encontrada | não | VO |

### `oncologiaPed.ts` (DOSES_COMPRESSIVAS, DOSES_HEMATO_ONCO, DOSES_NEUTROPENIA, DOSES_SLT): 41 itens

| id | nome | unidade da dose | apresentação no livro | candidatas nas listas locais | situação | mL na tela | motivo (seção 2) |
|---|---|---|---|---|---|---|---|
| `dexa-sms` | Dexametasona — mediastino superior / veia cava superior | mg/kg/dia | — | P: 4 mg/mL, amp. 1 mL | só lista local, falta conferir na bula ANVISA | sim | — |
| `enoxa-svcs` | Enoxaparina — trombose na SVCS | mg/kg/dose | — | P: seringa 60 mg/0,6 mL; D: seringas de 20, 40, 60 e 80 mg | só lista local, falta conferir na bula ANVISA | sim | — |
| `dexa-cce-ataque` | Dexametasona — compressão do cordão, ataque | mg/kg/dose | — | P: 4 mg/mL, amp. 1 mL | só lista local, falta conferir na bula ANVISA | sim | — |
| `dexa-cce-man` | Dexametasona — compressão do cordão, manutenção | mg/kg/dose | — | P: 4 mg/mL, amp. 1 mL | só lista local, falta conferir na bula ANVISA | sim | — |
| `manitol` | Manitol 20% — HIC por tumor | g/kg/dose | manitol 20% = 0,2 g/mL (p. 720; p. 179) | — | livro cita | sim | — |
| `dexa-hic-ataque` | Dexametasona — HIC por tumor, ataque | mg/kg/dose | — | P: 4 mg/mL, amp. 1 mL | só lista local, falta conferir na bula ANVISA | sim | — |
| `dexa-hic-man` | Dexametasona — HIC por tumor, manutenção | mg/kg/dia | — | P: 4 mg/mL, amp. 1 mL | só lista local, falta conferir na bula ANVISA | sim | — |
| `fenitoina-ataque` | Fenitoína — tumor com convulsão, ataque | mg/kg/dose | — | P: 50 mg/mL, amp. 5 mL; comprimido 100 mg | só lista local, falta conferir na bula ANVISA | aspirar e diluir | DIL |
| `fenitoina-man` | Fenitoína — manutenção | mg/kg/dia | — | P: 50 mg/mL, amp. 5 mL; comprimido 100 mg | só lista local, falta conferir na bula ANVISA | aspirar e diluir | DIL |
| `fenitoina-prof` | Fenitoína — profilática (só se o especialista recomendar) | mg/kg/dose | — | P: 50 mg/mL, amp. 5 mL; comprimido 100 mg | só lista local, falta conferir na bula ANVISA | aspirar e diluir | DIL |
| `midaz-iv` | Midazolam IV — crise estabelecida | mg/kg/dose | — | P: 5 mg/mL, amp. 3 mL; D: 1 mg/mL (5 mL) e 5 mg/mL (3 e 10 mL) | só lista local, falta conferir na bula ANVISA | com alerta | MULT |
| `midaz-im` | Midazolam IM | mg/kg/dose | — | P: 5 mg/mL, amp. 3 mL; D: 1 mg/mL (5 mL) e 5 mg/mL (3 e 10 mL) | só lista local, falta conferir na bula ANVISA | com alerta | MULT |
| `midaz-in` | Midazolam IN | mg/kg/dose | — | P: 5 mg/mL, amp. 3 mL; D: 1 mg/mL (5 mL) e 5 mg/mL (3 e 10 mL) | só lista local, falta conferir na bula ANVISA | com alerta | MULT |
| `hidroxiureia` | Hidroxiureia — hiperviscosidade/citorredução | mg/kg/dia | — | P: comprimido 500 mg | só lista local, falta conferir na bula ANVISA | não | VO |
| `cefepima` | Cefepima | mg/kg/dia | — | P: 1 g, pó | só lista local, falta conferir na bula ANVISA | não | PO |
| `meropenem` | Meropenem | mg/kg/dia | — | P: 1 g, pó; D: 500 mg e 1 g | só lista local, falta conferir na bula ANVISA | não | PO |
| `piptazo-menor6m` | Piperacilina-tazobactam — < 6 meses | mg/kg/dia | — | P: 4,5 g, pó; D: 2,25 g e 4,5 g | só lista local, falta conferir na bula ANVISA | não | PO |
| `piptazo-maior6m` | Piperacilina-tazobactam — > 6 meses | mg/kg/dia | — | P: 4,5 g, pó; D: 2,25 g e 4,5 g | só lista local, falta conferir na bula ANVISA | não | PO |
| `vancomicina` | Vancomicina | mg/kg/dia | — | P: 500 mg, pó | só lista local, falta conferir na bula ANVISA | não | PO |
| `teicoplanina` | Teicoplanina | mg/kg/dia | — | P: 400 mg, pó; D: 200 e 400 mg | só lista local, falta conferir na bula ANVISA | não | PO |
| `linezolida` | Linezolida | mg/kg/dia | — | P e D: 2 mg/mL, bolsa 300 mL | só lista local, falta conferir na bula ANVISA | sim | — |
| `metronidazol` | Metronidazol | mg/kg/dia | — | P: 5 mg/mL, frasco 100 mL; comprimido 250 mg | só lista local, falta conferir na bula ANVISA | sim | — |
| `cipro-iv` | Ciprofloxacina IV | mg/kg/dia | — | P: 2 mg/mL, frasco 100 mL; comprimido 500 mg | só lista local, falta conferir na bula ANVISA | sim | — |
| `cipro-vo` | Ciprofloxacina VO — tratamento domiciliar | mg/kg/dia | — | P: 2 mg/mL, frasco 100 mL; comprimido 500 mg | só lista local, falta conferir na bula ANVISA | não | VO |
| `levo` | Levofloxacina | mg/kg/dia | — | P: 5 mg/mL, frasco 100 mL; comprimido 500 mg | só lista local, falta conferir na bula ANVISA | sim | — |
| `tmp` | Trimetoprim-sulfametoxazol — P. jirovecii | mg/kg/dia | — | P: amp. 5 mL com 400 mg + 80 mg | só lista local, falta conferir na bula ANVISA | aspirar e diluir | DIL |
| `anfo-lipo` | Anfotericina lipossomal | mg/kg/dia | — | P: desoxicolato 50 mg pó e lipossomal 50 mg pó; D: complexo lipídico 5 mg/mL | só lista local, falta conferir na bula ANVISA | não | PO, MULT |
| `vori-ataque` | Voriconazol — ataque (indicado > 12 anos) | mg/kg/dose | — | P e D: 200 mg, pó | só lista local, falta conferir na bula ANVISA | não | PO |
| `vori-man` | Voriconazol — manutenção (indicado > 12 anos) | mg/kg/dose | — | P e D: 200 mg, pó | só lista local, falta conferir na bula ANVISA | não | PO |
| `aciclovir` | Aciclovir | mg/kg/dia | — | P: 250 mg, pó; comprimido 200 mg | só lista local, falta conferir na bula ANVISA | não | PO |
| `ganciclovir` | Ganciclovir | mg/kg/dia | — | P: 500 mg, pó; D: 1 mg/mL, bolsa | só lista local, falta conferir na bula ANVISA | não | PO |
| `amicacina` | Amicacina | mg/kg/dia | — | P: 250 mg/mL, amp. 2 mL | só lista local, falta conferir na bula ANVISA | aspirar e diluir | DIL |
| `alopurinol` | Alopurinol (ácido úrico < 8 mg/dL antes da QT) | mg/kg/dia | — | — | sem apresentação encontrada | não | VO |
| `rasburicase` | Rasburicase (ácido úrico ≥ 8 mg/dL ou alto risco) | mg/kg/dose | — | — | sem apresentação encontrada | não | PO |
| `insulina` | Insulina regular — hipercalemia | UI/kg/dose | só a solução já diluída, 0,1 UI/mL (p. 521) | P: 100 UI/mL, frasco 10 mL | livro cita | com alerta | MULT, DIL |
| `gluconato` | Gluconato de cálcio 10% — arritmia/alteração de ECG ou hipocalcemia sintomática | mg/kg/dose | 10% = 100 mg/mL (p. 896); 9 mg Ca elementar/mL (Tabela 11, p. 558) | P: 10%, 100 mg/mL, amp. 10 mL | livro cita | com alerta | ELEM |
| `bic3` | Bicarbonato de sódio 3% — se acidose | mEq/kg/dose | Bic Na 3% = 0,35 mEq/mL (Tabela 11, p. 558)* | P: só 8,4% | livro cita | com alerta | MULT |
| `sorcal` | Poliestireno sulfonato de cálcio (Sorcal) | g/kg/dose | — | — | sem apresentação encontrada | não | VO |
| `furo` | Furosemida | mg/kg/dose | — | P: 10 mg/mL, amp. 2 mL | só lista local, falta conferir na bula ANVISA | sim | — |
| `aloh` | Hidróxido de alumínio — hiperfosfatemia moderada | mg/kg/dia | — | — | sem apresentação encontrada | não | VO |
| `caco3` | Carbonato de cálcio — hiperfosfatemia | mg/kg/dose | — | — | sem apresentação encontrada | não | VO |

### `osteoarticularPed.ts` (TABELA3): 6 itens

| id | nome | unidade da dose | apresentação no livro | candidatas nas listas locais | situação | mL na tela | motivo (seção 2) |
|---|---|---|---|---|---|---|---|
| `cefalo1` | Cefalosporina de 1ª geração | mg/kg/dia | — | P: cefazolina 1 g, pó; cefalexina comprimido 500 mg | só lista local, falta conferir na bula ANVISA | não | PO |
| `oxacilina` | Oxacilina | mg/kg/dia | — | P: 500 mg, pó | só lista local, falta conferir na bula ANVISA | não | PO |
| `clindamicina` | Clindamicina | mg/kg/dia | — | P: 150 mg/mL, amp. 4 mL; D: 300 mg/2 mL | só lista local, falta conferir na bula ANVISA | aspirar e diluir | DIL |
| `vancomicina` | Vancomicina | mg/kg/dia | — | P: 500 mg, pó | só lista local, falta conferir na bula ANVISA | não | PO |
| `tmpsmx` | TMP-SMX | mg/kg/dia | — | P: amp. 5 mL com 400 mg + 80 mg | só lista local, falta conferir na bula ANVISA | aspirar e diluir | DIL |
| `linezolida` | Linezolida | mg/kg/dia | — | P e D: 2 mg/mL, bolsa 300 mL | só lista local, falta conferir na bula ANVISA | sim | — |

### `pneumoniaPed.ts` (DOMICILIAR, DOSES_SBP_2024, ESPECIAIS, HOSPITALAR): 35 itens

| id | nome | unidade da dose | apresentação no livro | candidatas nas listas locais | situação | mL na tela | motivo (seção 2) |
|---|---|---|---|---|---|---|---|
| `amox` | Amoxicilina | mg/kg/dia | — | P: comprimido 500 mg | só lista local, falta conferir na bula ANVISA | não | VO |
| `amoxclav` | Amoxicilina + clavulanato (falha) | mg/kg/dia | — | P: só IV, 1 g + 200 mg, pó (sem forma oral) | sem apresentação encontrada | não | VO |
| `cefur-vo` | Axetil-cefuroxima (falha) | mg/kg/dia | — | P: 750 mg, pó (IV) (sem forma oral) | sem apresentação encontrada | não | VO |
| `claritro` | Claritromicina | mg/kg/dia | — | P: comprimido 500 mg; D: 500 mg pó (IV) | só lista local, falta conferir na bula ANVISA | não | VO |
| `azitro` | Azitromicina | mg/kg/dia | só VO: xarope 40 mg/mL (p. 503)* | P: comprimido 500 mg; D: 500 mg pó (IV) | livro cita | não | VO |
| `sbp-ampi` | Ampicilina | mg/kg/dia | — | P: 1 g, pó | só lista local, falta conferir na bula ANVISA | não | PO |
| `sbp-ampi-sulb` | Ampicilina-sulbactam (dose de ampicilina) | mg/kg/dia | — | P: 1,5 g, pó | só lista local, falta conferir na bula ANVISA | não | PO |
| `sbp-pen` | Penicilina cristalina | UI/kg/dia | — | — | sem apresentação encontrada | não | PO |
| `sbp-oxa` | Oxacilina | mg/kg/dia | — | P: 500 mg, pó | só lista local, falta conferir na bula ANVISA | não | PO |
| `sbp-ceftri` | Ceftriaxona | mg/kg/dia | — | P: 1 g, pó; D: 500 mg e 1 g | só lista local, falta conferir na bula ANVISA | não | PO |
| `sbp-cefotax` | Cefotaxima | mg/kg/dia | — | — | sem apresentação encontrada | não | PO |
| `sbp-vanco` | Vancomicina (MRSA comunitário prevalente) | mg/kg/dia | — | P: 500 mg, pó | só lista local, falta conferir na bula ANVISA | não | PO |
| `sbp-amoxclav` | Amoxicilina-clavulanato (dose de amoxicilina) | mg/kg/dia | — | P: só IV, 1 g + 200 mg, pó (sem forma oral) | só lista local, falta conferir na bula ANVISA | não | PO |
| `sbp-linez` | Linezolida — < 12 anos | mg/kg/dia | — | P e D: 2 mg/mL, bolsa 300 mL | só lista local, falta conferir na bula ANVISA | sim | — |
| `sbp-levo-menor5` | Levofloxacino — 6 meses a < 5 anos | mg/kg/dia | — | P: 5 mg/mL, frasco 100 mL; comprimido 500 mg | só lista local, falta conferir na bula ANVISA | sim | — |
| `sbp-levo-maior5` | Levofloxacino — 5 a < 16 anos | mg/kg/dia | — | P: 5 mg/mL, frasco 100 mL; comprimido 500 mg | só lista local, falta conferir na bula ANVISA | sim | — |
| `sbp-azitro` | Azitromicina (dias 1 e 2; depois 5 mg/kg/dia) | mg/kg/dia | só VO: xarope 40 mg/mL (p. 503)* | P: comprimido 500 mg; D: 500 mg pó (IV) | só lista local, falta conferir na bula ANVISA | não | PO |
| `sbp-metro` | Metronidazol | mg/kg/dia | — | P: 5 mg/mL, frasco 100 mL; comprimido 250 mg | só lista local, falta conferir na bula ANVISA | sim | — |
| `sbp-amica` | Amicacina | mg/kg/dia | — | P: 250 mg/mL, amp. 2 mL | só lista local, falta conferir na bula ANVISA | aspirar e diluir | DIL |
| `eritro-ct` | Eritromicina | mg/kg/dia | — | — | sem apresentação encontrada | não | VO |
| `claritro-ct` | Claritromicina | mg/kg/dia | — | P: comprimido 500 mg; D: 500 mg pó (IV) | só lista local, falta conferir na bula ANVISA | não | VO |
| `eritro-bp` | Eritromicina | mg/kg/dia | — | — | sem apresentação encontrada | não | VO |
| `claritro-bp` | Claritromicina | mg/kg/dia | — | P: comprimido 500 mg; D: 500 mg pó (IV) | só lista local, falta conferir na bula ANVISA | não | VO |
| `claritro-af` | Claritromicina | mg/kg/dia | — | P: comprimido 500 mg; D: 500 mg pó (IV) | só lista local, falta conferir na bula ANVISA | não | VO |
| `azitro-af` | Azitromicina | mg/kg/dia | só VO: xarope 40 mg/mL (p. 503)* | P: comprimido 500 mg; D: 500 mg pó (IV) | livro cita | não | VO |
| `ampi` | Ampicilina | mg/kg/dia | — | P: 1 g, pó | só lista local, falta conferir na bula ANVISA | não | PO |
| `amicacina` | Amicacina (com a ampicilina) | mg/kg/dia | — | P: 250 mg/mL, amp. 2 mL | só lista local, falta conferir na bula ANVISA | aspirar e diluir | DIL |
| `genta` | Gentamicina (alternativa à amicacina) | mg/kg/dia | — | P: 40 mg/mL, amp. 2 mL | só lista local, falta conferir na bula ANVISA | aspirar e diluir | DIL |
| `cefotax` | Cefotaxima (falha) | mg/kg/dia | — | — | sem apresentação encontrada | não | PO |
| `ceftri` | Ceftriaxona (falha) | mg/kg/dia | — | P: 1 g, pó; D: 500 mg e 1 g | só lista local, falta conferir na bula ANVISA | não | PO |
| `pen-crist` | Penicilina cristalina | UI/kg/dia | — | — | sem apresentação encontrada | não | PO |
| `ampi` | Ampicilina | mg/kg/dia | — | P: 1 g, pó | só lista local, falta conferir na bula ANVISA | não | PO |
| `cefur-iv` | Cefuroxima (falha) | mg/kg/dia | — | P: 750 mg, pó (IV) (sem forma oral) | só lista local, falta conferir na bula ANVISA | não | PO |
| `ceftri` | Ceftriaxona (falha) | mg/kg/dia | — | P: 1 g, pó; D: 500 mg e 1 g | só lista local, falta conferir na bula ANVISA | não | PO |
| `claritro-h` | Claritromicina (associada, falha) | mg/kg/dia | — | P: comprimido 500 mg; D: 500 mg pó (IV) | só lista local, falta conferir na bula ANVISA | não | PO |

### `viasAereasSuperiores.ts` (DOSES_CRUPE, DOSES_FARINGITE, DOSES_OMA, DOSES_SINUSITE): 26 itens

| id | nome | unidade da dose | apresentação no livro | candidatas nas listas locais | situação | mL na tela | motivo (seção 2) |
|---|---|---|---|---|---|---|---|
| `crupe-dexa` | Dexametasona | mg/kg/dose | — | P: 4 mg/mL, amp. 1 mL | só lista local, falta conferir na bula ANVISA | sim | — |
| `crupe-prednisolona` | Prednisolona | mg/kg/dose | — | — | sem apresentação encontrada | não | VO |
| `crupe-budesonida` | Budesonida inalatória | mg (dose fixa) | — | — | sem apresentação encontrada | não | INAL |
| `far-penv` | Penicilina V oral — crianças | mg (dose fixa) | — | — | sem apresentação encontrada | não | VO |
| `far-amox-1x` | Amoxicilina — 1 vez ao dia | mg/kg/dose | — | P: comprimido 500 mg | só lista local, falta conferir na bula ANVISA | não | VO |
| `far-amox-2x` | Amoxicilina — 12/12 h | mg/kg/dose | — | P: comprimido 500 mg | só lista local, falta conferir na bula ANVISA | não | VO |
| `far-cefalexina` | Cefalexina (alérgico, sem anafilaxia prévia) | mg/kg/dose | — | P: comprimido 500 mg | só lista local, falta conferir na bula ANVISA | não | VO |
| `far-cefadroxila` | Cefadroxila (alérgico, sem anafilaxia prévia) | mg/kg/dose | — | — | sem apresentação encontrada | não | VO |
| `far-clinda` | Clindamicina (alérgico) | mg/kg/dose | — | P: 150 mg/mL, amp. 4 mL; D: 300 mg/2 mL | só lista local, falta conferir na bula ANVISA | não | VO |
| `far-azitro` | Azitromicina (alérgico) | mg/kg/dose | só VO: xarope 40 mg/mL (p. 503)* | P: comprimido 500 mg; D: 500 mg pó (IV) | livro cita | não | VO |
| `far-claritro` | Claritromicina (alérgico) | mg/kg/dose | — | P: comprimido 500 mg; D: 500 mg pó (IV) | só lista local, falta conferir na bula ANVISA | não | VO |
| `oma-amox` | Amoxicilina (1ª escolha) | mg/kg/dia | — | P: comprimido 500 mg | só lista local, falta conferir na bula ANVISA | não | VO |
| `oma-amox-alta` | Amoxicilina em alta dose (falha ou uso nos últimos 30 dias) | mg/kg/dia | — | P: comprimido 500 mg | só lista local, falta conferir na bula ANVISA | não | VO |
| `oma-amoxclav` | Amoxicilina + clavulanato (alta dose) | mg/kg/dia | — | P: só IV, 1 g + 200 mg, pó (sem forma oral) | sem apresentação encontrada | não | VO |
| `oma-cefuroxima` | Axetilcefuroxima | mg/kg/dia | — | P: 750 mg, pó (IV) (sem forma oral) | sem apresentação encontrada | não | VO |
| `oma-ceftriaxona` | Ceftriaxona | mg/kg/dose | — | P: 1 g, pó; D: 500 mg e 1 g | só lista local, falta conferir na bula ANVISA | não | PO |
| `oma-clinda` | Clindamicina (alergia grave à penicilina) | mg/kg/dia | — | P: 150 mg/mL, amp. 4 mL; D: 300 mg/2 mL | só lista local, falta conferir na bula ANVISA | não | VO |
| `oma-eritro` | Eritromicina (alergia grave à penicilina) | mg/kg/dia | — | — | sem apresentação encontrada | não | VO |
| `oma-claritro` | Claritromicina (alergia grave à penicilina) | mg/kg/dia | — | P: comprimido 500 mg; D: 500 mg pó (IV) | só lista local, falta conferir na bula ANVISA | não | VO |
| `sin-amox` | Amoxicilina | mg/kg/dia | — | P: comprimido 500 mg | só lista local, falta conferir na bula ANVISA | não | VO |
| `sin-amoxclav` | Amoxicilina + clavulanato | mg/kg/dia | — | P: só IV, 1 g + 200 mg, pó (sem forma oral) | sem apresentação encontrada | não | VO |
| `sin-ceftriaxona` | Ceftriaxona | mg/kg/dose | — | P: 1 g, pó; D: 500 mg e 1 g | só lista local, falta conferir na bula ANVISA | não | PO |
| `sin-cefuroxima` | Cefuroxima (alergia sem hipersensibilidade tipo I) | mg/kg/dia | — | P: 750 mg, pó (IV) (sem forma oral) | sem apresentação encontrada | não | VO |
| `sin-claritro` | Claritromicina (hipersensibilidade tipo I) | mg/kg/dia | — | P: comprimido 500 mg; D: 500 mg pó (IV) | só lista local, falta conferir na bula ANVISA | não | VO |
| `sin-azitro-d1` | Azitromicina — 1º dia (hipersensibilidade tipo I) | mg/kg/dia | só VO: xarope 40 mg/mL (p. 503)* | P: comprimido 500 mg; D: 500 mg pó (IV) | livro cita | não | VO |
| `sin-azitro-d2` | Azitromicina — 2º ao 5º dia | mg/kg/dia | só VO: xarope 40 mg/mL (p. 503)* | P: comprimido 500 mg; D: 500 mg pó (IV) | livro cita | não | VO |

### Doses calculadas por funções, fora das listas

Algumas ferramentas calculam a dose numa função e não numa lista de itens. Ficam fora das contagens acima e entram aqui por inteiro.

| arquivo | função ou constante | o que calcula | mL hoje | mL faz sentido? |
|---|---|---|---|---|
| `sedacaoProcedimento.ts` | `cetaminaTerapeuticaMg` | cetamina 1 a 1,5 mg/kg | não | sim; o livro cita 50 mg/mL (p. 88) |
| `sedacaoProcedimento.ts` | `dexmedetomidina` | ataque 1 µg/kg e manutenção 0,5 a 1 µg/kg/h | não | ataque: aspirar e diluir; manutenção: infusão |
| `diarreia.ts` | `ondansetronaMg` | ondansetrona IV 0,15 mg/kg, máx. 8 mg | não | sim, depois da bula (P: 2 mg/mL) |
| `diarreia.ts` | `ondansetronaVoMg`, `zincoMgDia`, `racecadotrilaMgDose` | doses VO | não | não (VO) |
| `denguePed.ts` | `analgesicosMs2024` | dipirona e paracetamol 10 mg/kg | não | não neste ciclo (a via não é dita; VO na prática) |
| `hipoglicemiaPed.ts` | `glucagonMg` | glucagon 0,5 ou 1 mg | não | não (pó) |
| `insuficienciaAdrenalPed.ts` | `hidrocortisonaBolusMg`, `hidrocortisonaManutencao`, `hidrocortisonaReducao`; `FLUDROCORTISONA_UG` | hidrocortisona por m²; fludrocortisona VO | não | não (pó; VO) |
| `peconhentosPed.ts` | `prednisonaLoxoscelesMgDia`; `TABELA_SORO`, `volumeSaarMl` | prednisona VO; soros em ampolas | só o SAAr (5 mL por ampola, p. 212) | prednisona não (VO); os outros soros são dados em ampolas, sem mL do livro |
| `tetanoRaivaPed.ts` | `penicilinaTetanoPed`; `SEDATIVOS_TETANO_PED` | penicilina cristalina UI; sedativos só em texto | não | não (pó; sem cálculo) |
| `viasAereasSuperiores.ts` | `benzatinaFaringiteU` | penicilina benzatina 600.000 ou 1.200.000 U | não | não (pó para suspensão) |
| `falciformePed.ts` | `antibioticoFebre`, `cetaminaMgH`, `hidroxiureiaMgDia`, `paracetamolTetoDiaMg` | penicilina e ceftriaxona por dia; cetamina por hora; VO | não | não (pó; infusão; VO) |
| `cadPed.ts` | `bicarbonatoCad`, `edemaCerebral`, `magnesioEhh`, `insulinaScIcr`, `nphIcr`, `insulinaEhhUiH`; `insulinaEv` | bicarbonato mEq; manitol g e NaCl 3% mL; magnésio mg; insulina SC e EV | NaCl 3% e insulina EV (mL/h, 0,1 UI/mL) já têm | manitol: sim (20%, livro); bicarbonato e magnésio: com alerta (8,4% x 3%; 50% x 10%); insulina SC: não (seringa de insulina, em UI) |
| `hemostasiaTromboPed.ts` | `hnfAtaqueUI`, `varfarinaDia1Mg`, `rtpaMgH` | heparina 75 UI/kg EV; varfarina VO; alteplase por hora | não | heparina: sim depois da bula (P: 5.000 UI/mL); varfarina não (VO); alteplase não (infusão, pó) |
| `hemoterapiaPed.ts` | `fatorVIIIUI`, `fatorIXUI`, `crioUnidades`, `albumina`; `ANTI_D_MCG_POR_UNIDADE` | fatores em UI; crio em unidades; albumina em frascos | albumina e hemocomponentes já em mL | não (hemoderivados) |
| `oncologiaPed.ts` | `caspofungina`, `oseltamivirMg`; `crioOncoU` | caspofungina por m²; oseltamivir VO | não | não (pó; VO) |
| `glomerulopatiasPed.ts` | `prednisolonaKdigo` | prednisolona VO | não | não (VO) |
| `anafilaxia.ts` | `epinefrinaDoseFixa`, `fenoterolGotas` | epinefrina IM por idade; fenoterol em gotas | fenoterol em gotas | epinefrina: sim, 1 mg/mL (livro, p. 98 e 101) |
| `asma.ts` | `ipratropioNebulizacao` | ipratrópio µg e gotas | gotas (250 µg/mL, p. 119) | já resolvido em gotas |
| `reanimacaoNeonatal.ts` | `dosesReanimacao` | adrenalina e expansor no RN | já em mL | — |
| `infusoes.ts` | `INFUSOES_PED`, `velocidadePed` | infusões contínuas | já em mL/h, com a concentração digitada pelo médico | fora deste pedido |
| `acidobasePed.ts`, `eletrolitosPed.ts`, `sodioPed.ts`, `manutencao.ts`, `queimadura.ts`, `choque.ts` (`volumesChoque`), `denguePed.ts` (hidratação) | `mlBic14`, `mlHcl`, `mlKcl191`, `mlSulfMg10`, `bolusNaCl3Ml` e volumes | bicarbonato 1,4%, HCl, KCl, MgSO₄ 10%, NaCl 3%, soros | já em mL | — |

## 2. Itens em que o mL não faz sentido ou é perigoso

Os códigos abaixo aparecem na última coluna da tabela. Um item pode ter mais de um.

### Não faz sentido neste ciclo (o item fica sem mL)

- **VO (via oral), 99 itens.** Comprimido não tem mL. Para líquido oral (suspensão, gotas, xarope) a concentração muda muito de um produto para outro (paracetamol em gotas e em suspensão, amoxicilina com mais de uma concentração), e as listas locais só têm comprimidos de adulto. O livro só cita dois líquidos orais: digoxina elixir 50 µg/mL (p. 240) e azitromicina xarope 40 mg/mL (p. 503). Proposta: lote próprio depois dos injetáveis (pergunta 3).
- **PO (pó para reconstituir), 92 itens.** Antibióticos em frasco-ampola, hidrocortisona, metilprednisolona, glucagon, vecurônio, tiopental, omeprazol, aciclovir e outros. A concentração depende do volume de diluente que se usa, e esse volume vem da bula de cada produto. Mostrar mL exigiria fixar uma reconstituição; fica para decisão do RT (pergunta 4).
- **INF (infusão contínua ou dose por tempo), 12 itens.** Aminas, midazolam e tiopental contínuos, propofol em mg/kg/h, salbutamol contínuo, potássio por hora. A ferramenta de infusões já calcula mL/h com a concentração da solução preparada; repetir aqui duplicaria a conta.
- **DIA (dose total do dia sem dose por tomada), 6 itens** em `eletrolitosPed.ts` (hidrocortisona e prednisona na hipercalcemia, gluconato de cálcio lento, magnésio moderado, potássio e fósforo VO). O volume do dia não é volume de uma administração.
- **VR (retal), 4 itens.** Diazepam retal: a forma (gel, solução retal ou ampola IV usada por via retal) não está definida no livro.
- **INAL (inalatória), 3 itens.** Salbutamol em nebulização e budesonida. A solução para nebulização e a injetável têm concentrações diferentes; o salbutamol da padronização ("0,5 mg/mL, frasco 20 mL") nem diz qual é.
- **HEMO (hemoderivado ou imunobiológico), 7 itens.** Imunoglobulina, anti-D, CCPa e fator VII ativado: vêm em frascos com dose variável por lote e são preparados pelo banco de sangue ou pela farmácia.

### Faz sentido, mas é perigoso sem cuidado (mL só com escolha da ampola e alerta)

- **MULT (mais de uma concentração), 41 itens.**
  - Morfina: 10 mg/mL e 1 mg/mL na mesma lista local. **Erro possível de 10×.**
  - Insulina regular: 100 UI/mL no frasco e 0,1 UI/mL diluída (p. 521). **Erro possível de 1.000×.** Na solução polarizante, 0,1 UI/kg de um frasco de 100 UI/mL dá 0,001 mL/kg, volume que não se mede com segurança. Proposta: nunca mostrar mL do frasco (pergunta 7).
  - Salbutamol: injetável e solução para nebulização, sem saber qual está na lista. **Erro possível de 10×.**
  - Midazolam: 1 mg/mL e 5 mg/mL na lista do HU-UFGD (5×).
  - Sulfato de magnésio: 50% (500 mg/mL, p. 32) e 10% (100 mg/mL, Tabela 11, p. 558) (5×).
  - Bicarbonato de sódio: 8,4% (1 mEq/mL, p. 32) e 3% (0,35 mEq/mL, Tabela 11, p. 558) no livro, e 1,4% (0,17 mEq/mL) em `acidobasePed.ts` (até 6×).
  - Glicose: 10%, 25% e 50%. O livro cita 25% (p. 32).
  - Azul de metileno: o livro cita 1% (10 mg/mL, p. 102) e a lista do HU-UFGD tem 2% (20 mg/mL). `bolus.ts` **já mostra mL** com 1%; se a unidade tiver só a ampola a 2%, o volume da tela dá o dobro da dose. Este item já está no ar e merece a atenção do RT antes dos lotes (pergunta 8).
  - Anfotericina: desoxicolato, lipossomal e complexo lipídico têm doses diferentes; não é só a concentração.
- **ELEM (dose em elemento x dose em sal), 9 itens.** A dose de cálcio aparece de dois jeitos: em mg do sal (gluconato 60 a 100 mg/kg) e em mg de cálcio elementar (5 a 7 mg/kg na RCP). O gluconato a 10% tem 100 mg do sal por mL, mas só 9 mg de cálcio elementar por mL. Usar a concentração errada dá **erro de cerca de 11×** no gluconato e de cerca de 3,7× no cloreto (100 mg do sal e 27 mg de cálcio por mL). O mesmo vale para o magnésio: `injuriaRenalPed.ts` (`mg`) dá a dose em mg de **magnésio elementar**, e o MgSO₄ 50% tem 500 mg do sal por mL. Usar 500 mg/mL nesse item dá **erro perto de 10×**. Neste ciclo, mL só quando a dose e a concentração estiverem na mesma base, com o rótulo dizendo qual (pergunta 6).
- **CONF (listas locais que se contradizem), 23 itens.** Adenosina (3 mg/mL na lista do HU-UFGD; "6 mg/mL" num frasco de 2 mL na padronização, provável confusão entre 6 mg por frasco e 6 mg/mL: 2×), ácido tranexâmico (50 x 100 mg/mL: 2×), noradrenalina (1 x 2 mg/mL), dobutamina (12,5 mg/mL no livro x "5 mg/mL" na padronização), succinilcolina (solução de 20 mg/mL na padronização x pó de 100 mg na lista do HU-UFGD), sugamadex ("100 mg em 2 mL", ambíguo) e fósforo (o livro usa fósforo orgânico, 1 mmol/mL; a padronização tem fosfato de potássio, outro sal). Só a bula resolve.
- **VASO (há apresentação com vasoconstritor), 5 itens.** Lidocaína: a lista do HU-UFGD só tem itens com vasoconstritor ou em tubete odontológico. Lidocaína com vasoconstritor não é para uso IV. A tela deve listar só a lidocaína sem vasoconstritor.

### Faz sentido como volume a aspirar, não como volume a infundir

- **DIL (diluir antes), 33 itens** (28 com "aspirar e diluir" na tabela; nos outros 5 vale outro motivo antes). Fenitoína (em SF, com velocidade máxima), valproato, levetiracetam, acetilcisteína IV (etapas de 1, 4 e 16 h), dexmedetomidina, desmopressina (em 50 mL de SF), amicacina, gentamicina, clindamicina e SMX-TMP IV. O volume da ampola pode ser mostrado, mas com o rótulo "volume a aspirar da ampola" e o aviso "diluir antes de administrar", nunca como volume a infundir (pergunta 5).

### Lista dos ids por motivo

**VO** (99)

- `asma.ts`: `prednisolona`
- `bolus.ts`: `carvao`
- `choqueToxicoPartesMolesPed.ts`: `cefalexina`, `clinda-vo`, `amoxclav`
- `criseHipertensivaPed.ts`: `hidralazina-vo`, `isradipina`, `minoxidil`
- `dosesDaFita.ts`: `fita-ondansetrona-vo-8a15`, `fita-ondansetrona-vo-15a30`, `fita-ondansetrona-vo-maior30`, `fita-carvao`, `fita-paracetamol`, `fita-ibuprofeno`
- `eletrolitosPed.ts`: `p-vo`, `prednisona-ca`, `sorcal`, `kayexalate`, `mg-leve`, `k-vo`
- `falciformePed.ts`: `paracetamol`, `ibuprofeno`
- `febreSemSinaisPed.ts`: `amoxicilina`, `cefuroxima-vo`, `amoxclav-7`
- `glomerulopatiasPed.ts`: `prednisona`, `hctz`, `espiro`
- `hemostasiaTromboPed.ts`: `atx-vo`, `pred-pti`, `pred-pti-curto`, `prednisolona-ash`
- `injuriaRenalPed.ts`: `sorcal`
- `insuficienciaCardiacaPed.ts`: `hctz`, `espironolactona`, `captopril-lactente`, `captopril-crianca`, `enalapril`, `carvedilol`, `metoprolol`, `digoxina-menor2`, `digoxina-maior2`
- `intoxicacaoPed.ts`: `carvao-cap`, `furosemida-vo`, `acetilcisteina-vo-ataque`, `acetilcisteina-vo-manut`
- `ituPed.ts`: `amoxicilina`, `amoxclav`, `cefalexina`, `cefadroxila`, `cefuroxima`, `smx-tmp`, `cipro-vo`, `nitrofurantoina`
- `kawasaki.ts`: `aha-aas`, `aas-alta`, `aas-baixa`
- `meningitePed.ts`: `rifampicina-mening`, `rifampicina-mening-neo`, `rifampicina-hib`
- `oncologiaPed.ts`: `hidroxiureia`, `cipro-vo`, `alopurinol`, `sorcal`, `aloh`, `caco3`
- `pneumoniaPed.ts`: `amox`, `amoxclav`, `cefur-vo`, `claritro`, `azitro`, `eritro-ct`, `claritro-ct`, `eritro-bp`, `claritro-bp`, `claritro-af`, `azitro-af`
- `viasAereasSuperiores.ts`: `crupe-prednisolona`, `far-penv`, `far-amox-1x`, `far-amox-2x`, `far-cefalexina`, `far-cefadroxila`, `far-clinda`, `far-azitro`, `far-claritro`, `oma-amox`, `oma-amox-alta`, `oma-amoxclav`, `oma-cefuroxima`, `oma-clinda`, `oma-eritro`, `oma-claritro`, `sin-amox`, `sin-amoxclav`, `sin-cefuroxima`, `sin-claritro`, `sin-azitro-d1`, `sin-azitro-d2`

**PO** (92)

- `anafilaxia.ts`: `metilprednisolona`, `glucagon`
- `asma.ts`: `metilprednisolona`, `hidrocortisona`
- `bolus.ts`: `tiopental`, `vecuronio`, `glucagon-anafilaxia`, `hidrocortisona-asma`, `glucagon-menor20`, `glucagon-maior20`, `hidrocortisona-adrenal`, `somatostatina-ataque`, `terlipressina-ataque`
- `choqueToxicoPartesMolesPed.ts`: `oxacilina`, `ceftriaxona`, `vancomicina`, `piptazo`, `penicilina`
- `criseEpileptica.ts`: `tiopental-bolus`, `tiopental-continuo`
- `digestivoHepaticoPed.ts`: `omeprazol-iv`
- `dosesDaFita.ts`: `fita-glucagon-menor20`, `fita-glucagon-maior20`
- `eletrolitosPed.ts`: `hidrocortisona-ca`
- `febreSemSinaisPed.ts`: `ceftriaxona`, `cefotaxima`
- `glomerulopatiasPed.ts`: `mp-pulso`
- `hemostasiaTromboPed.ts`: `mp-pti`
- `imunodeprimidoPed.ts`: `aciclovir`, `anfotericina`, `ampicilina`, `azitromicina`, `cefepima`, `cefotaxima`, `ceftazidima`, `ceftriaxona`, `vancomicina`
- `ituPed.ts`: `ampicilina`, `cefazolina`, `cefotaxima`, `ceftriaxona`, `cefepima`, `ceftazidima`
- `kawasaki.ts`: `aha-metilpred`, `aha-infliximabe`, `metilpred-pulso`, `metilpred-dia`, `infliximabe`
- `meningitePed.ts`: `ampicilina-neo`, `cefotaxima-neo`, `aciclovir-neo`, `ceftriaxona`, `cefotaxima`, `vancomicina`, `aciclovir`, `ceftriaxona-mening`
- `oncologiaPed.ts`: `cefepima`, `meropenem`, `piptazo-menor6m`, `piptazo-maior6m`, `vancomicina`, `teicoplanina`, `anfo-lipo`, `vori-ataque`, `vori-man`, `aciclovir`, `ganciclovir`, `rasburicase`
- `osteoarticularPed.ts`: `cefalo1`, `oxacilina`, `vancomicina`
- `pneumoniaPed.ts`: `sbp-ampi`, `sbp-ampi-sulb`, `sbp-pen`, `sbp-oxa`, `sbp-ceftri`, `sbp-cefotax`, `sbp-vanco`, `sbp-amoxclav`, `sbp-azitro`, `ampi`, `cefotax`, `ceftri`, `pen-crist`, `ampi`, `cefur-iv`, `ceftri`, `claritro-h`
- `viaAerea.ts`: `tiopental`, `vecuronio`
- `viasAereasSuperiores.ts`: `oma-ceftriaxona`, `sin-ceftriaxona`

**INF** (12)

- `anafilaxia.ts`: `epinefrina-infusao`, `norepinefrina`
- `asma.ts`: `salbutamol-continuo`
- `bolus.ts`: `dexmedetomidina-ataque`
- `choque.ts`: `epinefrina`, `dopamina`, `dobutamina`
- `criseEpileptica.ts`: `midazolam-continuo`, `tiopental-continuo`, `propofol`
- `eletrolitosPed.ts`: `k-iv`
- `tceDecisao.ts`: `nacl3-continuo`

**DIA** (6)

- `eletrolitosPed.ts`: `p-vo`, `hidrocortisona-ca`, `prednisona-ca`, `gluconato-lento`, `mg-moderada`, `k-vo`

**VR** (4)

- `bolus.ts`: `diazepam-vr-2a5`, `diazepam-vr-6a11`, `diazepam-vr-12`
- `criseEpileptica.ts`: `diazepam-vr`

**INAL** (3)

- `asma.ts`: `salbutamol-continuo`
- `dosesDaFita.ts`: `fita-salbutamol-nebulizacao`
- `viasAereasSuperiores.ts`: `crupe-budesonida`

**HEMO** (7)

- `choqueToxicoPartesMolesPed.ts`: `igiv-unica`
- `hemostasiaTromboPed.ts`: `ccpa`, `rfviia`, `igiv-pti`, `anti-d`
- `kawasaki.ts`: `aha-ivig`, `ivig`

**MULT** (41)

- `anafilaxia.ts`: `epinefrina-infusao`, `azul-metileno`
- `asma.ts`: `magnesio-tabela`, `magnesio-texto`, `salbutamol-continuo`
- `bolus.ts`: `morfina-menor6m`, `morfina-maior6m`, `midazolam-im`, `midazolam-iv-menor5`, `midazolam-iv-maior5`, `midazolam-in`, `polarizante-insulina`
- `choque.ts`: `epinefrina`
- `comaHicPed.ts`: `midazolam`
- `criseEpileptica.ts`: `midazolam-iv`, `midazolam-im`, `midazolam-in`, `midazolam-continuo`
- `dosesDaFita.ts`: `fita-salbutamol-nebulizacao`, `fita-morfina-iv`
- `eletrolitosPed.ts`: `bic`, `insulina`, `glicose-polarizante`, `mg-grave`, `mg-moderada`
- `falciformePed.ts`: `morfina-figura`, `morfina-texto`
- `imunodeprimidoPed.ts`: `anfotericina`
- `injuriaRenalPed.ts`: `bic`, `insulina`, `glicose`, `beta2`, `mg`
- `intoxicacaoPed.ts`: `bicarbonato-alcalina`
- `oncologiaPed.ts`: `midaz-iv`, `midaz-im`, `midaz-in`, `anfo-lipo`, `insulina`, `bic3`
- `viaAerea.ts`: `midazolam`

**ELEM** (9)

- `eletrolitosPed.ts`: `cloreto-ca-mg`, `gluconato-ca-mg`, `gluconato-lento`
- `injuriaRenalPed.ts`: `cacl`, `gluconato`, `gluconato-assint`, `mg`
- `oncologiaPed.ts`: `gluconato`
- `rcp.ts`: `calcio`

**CONF** (23)

- `anafilaxia.ts`: `norepinefrina`
- `bolus.ts`: `adenosina-1`, `adenosina-2`, `adenosina-50-1`, `adenosina-50-2`, `succinilcolina-iv`, `succinilcolina-im`, `sugamadex`
- `choque.ts`: `dobutamina`
- `dosesDaFita.ts`: `fita-adenosina-1`, `fita-adenosina-2`, `fita-succinilcolina-lactente`, `fita-succinilcolina-crianca`, `fita-succinilcolina-im-lactente`, `fita-succinilcolina-im-crianca`
- `eletrolitosPed.ts`: `p-ev`
- `hemostasiaTromboPed.ts`: `atx-iv`, `atx-vo`, `atx-dvw`
- `rcp.ts`: `adenosina-1`, `adenosina-2`
- `viaAerea.ts`: `succinilcolina-menor10`, `succinilcolina-maior10`

**VASO** (5)

- `bolus.ts`: `lidocaina-iv`, `lidocaina-sri`
- `dosesDaFita.ts`: `fita-lidocaina`
- `rcp.ts`: `lidocaina-iv`, `lidocaina-et`

**DIL** (33)

- `bolus.ts`: `dexmedetomidina-proc`, `dexmedetomidina-ataque`, `fenitoina`, `polarizante-insulina`, `acetilcisteina-1`, `acetilcisteina-2`, `acetilcisteina-3`
- `choqueToxicoPartesMolesPed.ts`: `clinda-iv`, `smxtmp`, `clindamicina`
- `criseEpileptica.ts`: `fenitoina`, `fenitoina-cronico`, `valproato`, `levetiracetam`
- `eletrolitosPed.ts`: `insulina`
- `hemostasiaTromboPed.ts`: `ddavp`
- `imunodeprimidoPed.ts`: `gentamicina`, `tmp`
- `injuriaRenalPed.ts`: `nac-contraste`, `insulina`
- `ituPed.ts`: `amicacina`, `gentamicina`
- `oncologiaPed.ts`: `fenitoina-ataque`, `fenitoina-man`, `fenitoina-prof`, `tmp`, `amicacina`, `insulina`
- `osteoarticularPed.ts`: `clindamicina`, `tmpsmx`
- `pneumoniaPed.ts`: `sbp-amica`, `amicacina`, `genta`

## 3. Contagens

Base: 465 itens únicos de dose pediátrica em listas (491 menos 26 reaproveitados de `BOLUS`). Já mostram mL: 52. Sem mL: **413**.

Por situação da apresentação:

| situação | itens | mL direto | com alerta | aspirar e diluir | não neste ciclo |
|---|---|---|---|---|---|
| livro cita | 42 | 3 | 23 | 0 | 16 |
| só lista local, falta conferir na bula ANVISA | 304 | 91 | 42 | 28 | 143 |
| sem apresentação encontrada | 67 | 9 | 0 | 0 | 58 |
| **total** | **413** | **103** | **65** | **28** | **217** |

Os 217 "não neste ciclo", pelo motivo principal: 96 VO, 90 pó para reconstituir, 12 infusão contínua, 7 hemoderivados, 6 dose do dia, 4 retal e 2 inalatória.

Por ferramenta de emergência (sem mL / total de itens do arquivo):

| arquivo | sem mL | mL direto | com alerta | aspirar e diluir | não |
|---|---|---|---|---|---|
| `bolus.ts` | 62 / 81 | 27 | 16 | 5 | 14 |
| `rcp.ts` | 7 / 15 | 2 | 5 | 0 | 0 |
| `viaAerea.ts` | 12 / 12 | 7 | 3 | 0 | 2 |
| `dosesDaFita.ts` | 32 / 42 | 15 | 8 | 0 | 9 |
| `criseEpileptica.ts` | 15 / 16 | 3 | 3 | 4 | 5 |
| `anafilaxia.ts` | 7 / 10 | 2 | 1 | 0 | 4 |
| `asma.ts` | 7 / 7 | 1 | 2 | 0 | 4 |
| `choque.ts` | 3 / 3 | 0 | 0 | 0 | 3 |
| `tceDecisao.ts` | 1 / 3 | 0 | 0 | 0 | 1 |
| **emergência, soma** | **146** | **57** | **38** | **9** | **42** |
| outros 20 arquivos (`DoseLivro` e `eletrolitosPed.ts`) | 267 | 46 | 27 | 19 | 175 |

Itens que já podem ganhar mL só com o livro, sem bula e sem alerta: 3 (`viaAerea.ts` `quetamina`, 50 mg/mL, p. 88; `bolus.ts` `milrinona-ataque`, 1 mg/mL, p. 253; `oncologiaPed.ts` `manitol`, 20%, p. 720). Todo o resto depende da bula ou de uma decisão do RT.

Para o que pode ganhar mL (196 itens), são cerca de 60 princípios ativos diferentes a conferir no Bulário. Os lotes 1 a 5 abaixo somam cerca de 40.

## 4. Proposta de lotes

Cada lote vai em branch e PR próprios (prefixo no padrão do `BACKLOG.md`), passa pela homologação antes da produção e só mescla com a versão aprovada pelo RT (gate LG10). Nenhuma concentração entra sem citação: página do livro, ou link do Bulário com produto, empresa, expediente e data da bula.

**Lote 0: preparo (sem mudar dose).**
- Modelo de dados: um campo novo de apresentações por item, com rótulo, concentração na mesma unidade da dose, base (sal ou elemento, quando couber) e fonte (página do livro ou bula da ANVISA). Vale para `Bolus`, `DosePeso` e `DoseLivro`; o `porMl` de hoje vira uma das apresentações, sem perder a citação.
- Tela: seletor de ampola sem opção marcada. Sem ampola escolhida, nenhum mL aparece. A concentração fica escrita ao lado de cada volume.
- Testes: nenhum mL sem ampola escolhida; dose e concentração sempre na mesma base; o volume calculado bate com dose ÷ concentração para cada apresentação.
- Conferência no Bulário dos princípios dos lotes 1 e 2, feita por uma pessoa (pergunta 1).

**Lote 1: RCP e arritmias (20 itens; 5 princípios).** Adenosina, amiodarona, atropina, lidocaína (só sem vasoconstritor) e cálcio. Arquivos: `rcp.ts`, `bolus.ts` (grupo `pcr`), `dosesDaFita.ts` (seção reanimação). Itens: `rcp.ts` `amiodarona`, `lidocaina-iv`, `lidocaina-et`, `calcio`, `atropina`, `adenosina-1`, `adenosina-2`; `bolus.ts` `adenosina-1`, `adenosina-2`, `adenosina-50-1`, `adenosina-50-2`, `amiodarona-fvtv`, `amiodarona-iv`, `atropina-bradicardia`, `lidocaina-iv`; `dosesDaFita.ts` `fita-amiodarona`, `fita-lidocaina`, `fita-adenosina-1`, `fita-adenosina-2`, `fita-atropina`. O cálcio elementar (`rcp.ts` `calcio`) usa as concentrações elementares do livro (Tabela 11, p. 558–559), com rótulo "mg de cálcio elementar".

**Lote 2: intubação, sedação e analgesia (37 itens com mL possível; 15 princípios).** Atropina, lidocaína, fentanil, morfina, cetamina, etomidato, midazolam, propofol, rocurônio, succinilcolina, diazepam, dexmedetomidina (aspirar e diluir), neostigmina, sugamadex e naloxona em dose baixa. Arquivos: `viaAerea.ts`, `bolus.ts` (grupo `isr`), `dosesDaFita.ts` (seção intubação). Ficam sem mL: vecurônio e tiopental (pó) e o ataque da dexmedetomidina (infusão). A `quetamina` de `viaAerea.ts` pode entrar já, com o livro (50 mg/mL, p. 88).

**Lote 3: crise epiléptica (15 itens com mL possível; 7 princípios).** Diazepam IV, midazolam IV, IM e intranasal, lorazepam, fenobarbital, e fenitoína, valproato e levetiracetam como "aspirar e diluir". Arquivos: `criseEpileptica.ts`, `bolus.ts` (grupo `neuro`), `dosesDaFita.ts` (`fita-diazepam-iv`). O midazolam usado na crise em `comaHicPed.ts` e `oncologiaPed.ts` entra junto, pelo mesmo princípio. Diazepam retal fica fora (VR).

**Lote 4: anafilaxia, asma e crupe (8 itens com mL possível; 4 princípios).** Difenidramina, dexametasona, sulfato de magnésio (50% do livro, com o 10% como outra ampola) e a decisão sobre o azul de metileno 1% x 2%. Arquivos: `anafilaxia.ts`, `asma.ts`, `bolus.ts` (grupos `anafilaxia` e `respiratorio`), `dosesDaFita.ts` (seção gerais). A dose fixa de epinefrina IM por idade (`epinefrinaDoseFixa`) também pode ganhar mL com 1 mg/mL (livro, p. 98 e 101). Ficam fora: metilprednisolona, hidrocortisona e glucagon (pó), prednisolona (VO), salbutamol (inalatório) e as infusões.

**Lote 5: antídotos, metabólico e cardiovascular de `bolus.ts` e da fita (24 itens com mL possível).** Naloxona, flumazenil, vitamina K, atropina e pralidoxima nos organofosforados, acetilcisteína IV (aspirar e diluir), hidralazina, esmolol, milrinona (livro), octreotida, terbutalina, ondansetrona IV, morfina e fentanil da fita. A insulina da solução polarizante depende da pergunta 7.

**Lote 6: demais capítulos (`DoseLivro` e `eletrolitosPed.ts`, 92 itens com mL possível).** Furosemida, dexametasona, cálcio, bicarbonato, manitol e antibióticos em solução pronta (metronidazol, ciprofloxacino, levofloxacino, linezolida, fluconazol) ou em ampola para diluir (amicacina, gentamicina, clindamicina, SMX-TMP). O tipo `DoseLivro` não tem nenhum campo de volume hoje; o lote 0 resolve isso para todos.

**Depois, se o RT quiser:** líquidos orais (pergunta 3) e pós com reconstituição da bula (pergunta 4).

## 5. Perguntas para o RT

Cada pergunta tem a opção A recomendada.

1. **Como registrar a concentração da bula, se o Bulário exige verificação de "humano"?**
   A (recomendada): uma pessoa da equipe (o RT ou um farmacêutico) abre o link de busca, lê a bula do profissional e anota produto, empresa, expediente, data da bula e concentração; a ferramenta cita o link de busca e esses dados. B: usar as listas locais como fonte provisória. Não recomendo: foram montadas por script e têm erros de 2× a 10×.

2. **Quais apresentações entram na escolha de ampola?**
   A (recomendada): cada concentração diferente com registro ativo na bula da ANVISA, agrupada por concentração e não por marca. B: só o que a farmácia da unidade tem, o que pede a lista real da farmácia (hoje não existe no projeto).

3. **Itens de via oral (99) ganham mL?**
   A (recomendada): não neste ciclo. mL só para injetáveis; líquidos orais num lote próprio depois, começando pelos dois que o livro cita (digoxina elixir 50 µg/mL, p. 240; azitromicina xarope 40 mg/mL, p. 503). B: incluir já as suspensões pela bula.

4. **Pós para reconstituir (92) ganham mL?**
   A (recomendada): não neste ciclo; a tela mostra a dose em mg e a nota "reconstituir conforme a bula". B: mL depois da reconstituição padrão da bula, com o volume de diluente escrito.

5. **Medicamentos que precisam ser diluídos antes (fenitoína, acetilcisteína IV, aminoglicosídeos e outros)?**
   A (recomendada): mostrar "volume a aspirar da ampola" com o aviso fixo "diluir antes de administrar", sem nunca chamar de volume a infundir. B: não mostrar mL nesses itens.

6. **Cálcio e magnésio, quando a dose é em elemento e a ampola é dada em sal?**
   A (recomendada): mL só quando a dose e a concentração estão na mesma base. A dose em cálcio elementar usa a concentração elementar do livro (Tabela 11: gluconato 10% = 9 mg/mL; cloreto 10% = 27 mg/mL); a dose em mg do sal usa 100 mg/mL; o rótulo diz qual base é. O magnésio elementar de `injuriaRenalPed.ts` fica sem mL até haver concentração elementar citada. B: não mostrar mL em nenhum item de cálcio ou magnésio.

7. **Insulina regular na solução polarizante e na hipercalemia?**
   A (recomendada): nunca mostrar mL do frasco de 100 UI/mL (o volume fica abaixo de 0,1 mL e o erro pode chegar a 1.000×); mostrar só o preparo diluído do livro (0,1 UI/mL, p. 521), se o RT aprovar esse preparo para o bolo. B: mostrar mL do frasco de 100 UI/mL.

8. **Azul de metileno, que já mostra mL com a solução a 1% do livro, enquanto a lista do HU-UFGD tem a ampola a 2%?**
   A (recomendada): no lote 4, conferir na bula as concentrações com registro; se houver 2%, as duas viram opções de ampola sem marcação, e até lá a tela escreve "solução a 1%" ao lado do volume. B: manter como está.

9. **As listas locais entram como opção de ampola?**
   A (recomendada): não. Servem só de pista para a busca na bula; os conflitos achados (adenosina, ácido tranexâmico, noradrenalina, dobutamina, succinilcolina, sugamadex, fósforo) só se resolvem na bula. B: usar como opção marcada "a conferir".

10. **Cetamina: o livro cita Ketamin S® 50 mg/mL (p. 88), que é escetamina, e a padronização lista "cetamina 50 mg/mL"?**
    A (recomendada): o mL não muda (mesma concentração); o rótulo da ampola diz o nome do produto da bula, e o RT confirma se a dose do livro vale para os dois produtos. B: manter só "cetamina 50 mg/mL".

11. **Ordem dos lotes?**
    A (recomendada): lote 0, depois 1 (RCP), 2 (intubação), 3 (crise), 4 (anafilaxia e asma), 5 (antídotos e cardio) e 6 (demais capítulos), um PR por lote, homologação antes da produção. B: fazer os lotes 1 e 2 juntos, porque compartilham atropina, lidocaína e fentanil.

## Arquivos que calculam dose pediátrica

Em `src/clinico/pediatria/`:

- **`Bolus`**: `bolus.ts` (`BOLUS`, 81) e `dosesDaFita.ts` (`DOSES_DA_FITA`, 42, mesmo tipo e mesma conta `calcularBolus`). Reaproveitam objetos de `BOLUS`: `intoxicacaoPed.ts`, `sedacaoProcedimento.ts`, `criseHipertensivaPed.ts` e, fora da pasta, `src/clinico/hiperpotassemia.ts`.
- **`DosePeso`** (`fonteP2.ts`, `calcularDose`, com `porMl`, `mlPorKg` e `solucao`): `rcp.ts`, `viaAerea.ts`, `criseEpileptica.ts`, `anafilaxia.ts`, `asma.ts`, `choque.ts`, `tceDecisao.ts`.
- **`DoseLivro`** (`fonteP4.ts`, `calcularDoseLivro`, sem campo de volume): `choqueToxicoPartesMolesPed.ts`, `comaHicPed.ts`, `criseHipertensivaPed.ts`, `digestivoHepaticoPed.ts`, `falciformePed.ts`, `febreSemSinaisPed.ts`, `glomerulopatiasPed.ts`, `hemostasiaTromboPed.ts`, `imunodeprimidoPed.ts`, `injuriaRenalPed.ts`, `insuficienciaCardiacaPed.ts`, `intoxicacaoPed.ts`, `ituPed.ts`, `kawasaki.ts`, `meningitePed.ts`, `oncologiaPed.ts`, `osteoarticularPed.ts`, `pneumoniaPed.ts`, `viasAereasSuperiores.ts`.
- **`Dose`** própria, sem volume (com funções de mL à parte para KCl 19,1% e MgSO₄ 10%): `eletrolitosPed.ts`.
- **`InfusaoPed`** (mL/h com a concentração digitada): `infusoes.ts`.
- **Funções de dose** (tabela da seção 1): `acidobasePed.ts`, `anafilaxia.ts`, `asma.ts`, `cadPed.ts`, `denguePed.ts`, `diarreia.ts`, `falciformePed.ts`, `glomerulopatiasPed.ts`, `hemostasiaTromboPed.ts`, `hemoterapiaPed.ts`, `hipoglicemiaPed.ts`, `insuficienciaAdrenalPed.ts`, `oncologiaPed.ts`, `peconhentosPed.ts`, `reanimacaoNeonatal.ts`, `sedacaoProcedimento.ts`, `tetanoRaivaPed.ts`, `viasAereasSuperiores.ts`.
- **Só volumes de soro ou hemocomponente** (já em mL): `manutencao.ts`, `queimadura.ts`, `sodioPed.ts`, `choque.ts` (`volumesChoque`), `denguePed.ts`, `hemoterapiaPed.ts`.
