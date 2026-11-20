# Dose em mL, lote 4: anafilaxia, asma e crupe (plano)

Data: 20/11/2026. Situação: decisões L4-1 a L4-5 = A (RT, 20/11/2026, "Todas A"); primeira parte implementada na branch `fase-ml/lote4-anafilaxia-asma` (seção 6). Base: `docs/clinico/DOSES-ML-PEDIATRIA-DIAGNOSTICO.md` (seção 4, lote 4) e as decisões ML1 a ML11 de 19/11/2026, com a CMED como fonte da concentração ao lado da bula (decisão do RT de 20/11/2026, lote 3).

Lista da CMED usada: planilha PMC de 09/11/2026, baixada nesta sessão com `scripts/anvisa/lista-cmed.mjs --atualizar` (26.694 apresentações) e filtrada com `--injetaveis`. Só entram apresentações com "comercializado: Sim".

## 1. Princípios e itens do lote

| Princípio | Itens (chave "lista:id") | Hoje | CMED 09/11/2026, à venda | Proposta |
|---|---|---|---|---|
| Difenidramina | `anafilaxia:difenidramina-tabela`, `anafilaxia:difenidramina-texto`, `bolus:difenidramina`, `fita:fita-difenidramina` | sem mL | cloridrato de difenidramina 50 mg/mL, ampola de 1 mL: Cristália (1029801700020) | uma ampola, 50 mg/mL. "Diluir" só se a bula mandar |
| Dexametasona | `asma:dexametasona`, `bolus:dexametasona-crupe`, `fita:fita-dexametasona-crupe` | sem mL | fosfato dissódico de dexametasona 2 mg/mL (Hypofarma, União Química, Aché, Farmace, Hipolabor) e 4 mg/mL (Eurofarma, Teuto, Hypofarma, União Química, Aché, Farmace, Hipolabor) | duas ampolas, nenhuma marcada, **depois da bula** (ver L4-2). mL só para IM/IV |
| Sulfato de magnésio | `asma:magnesio-tabela`, `asma:magnesio-texto`, `bolus:magnesio-asma`, `fita:fita-magnesio-asma` | `bolus` e `fita` mostram mL fixo pela 50% (500 mg/mL) | 100 mg/mL (10%) e 500 mg/mL (50%), ampolas de 10 mL: Samtec e Halex | duas ampolas, nenhuma marcada; o mL fixo de 50% sai. Livro: 50% = 500 mg/mL (p. 32). Dose e concentração no sal (MgSO₄) |
| Azul de metileno | `anafilaxia:azul-metileno`, `bolus:azul-metileno-anafilaxia`, `bolus:azul-metileno` (metemoglobinemia) | mL pela solução a 1% do livro (p. 102) | **nenhum injetável na CMED** (só associações orais) | depende do Bulário (ver L4-4) |
| Epinefrina IM por idade | `epinefrinaDoseFixa` (anafilaxia) | dose em mg, sem mL | epinefrina 1 mg/mL: Hypofarma, Hipolabor e Blau (hemitartarato). A 0,1 mg/mL da Hipolabor está sem venda | mL pela 1 mg/mL (livro, p. 87 e 895): 0,1 a 0,15 mL; 0,15 mL; 0,3 mL; 0,5 mL |

Ficam fora, como no diagnóstico: metilprednisolona, hidrocortisona e glucagon (pó), prednisolona (VO), salbutamol (inalatório), epinefrina e norepinefrina em infusão e o salbutamol contínuo. A epinefrina IM por peso, a IV 1:10.000 e a nebulização já mostram mL e não mudam.

Achado para o lote 5: terbutalina 0,5 mg/mL à venda (Fresenius, União Química, Hipolabor).

## 2. Decisões para o RT (A recomendada)

- **L4-1. Bulas.** A: o RT baixa no Bulário (Chrome, com a verificação "sou humano") as bulas do profissional de difenidramina (Cristália), dexametasona 2 e 4 mg/mL (um fabricante de cada), sulfato de magnésio (Samtec ou Halex) e azul de metileno injetável, se houver. A sessão lê e anota produto, empresa, expediente e data, se manda diluir e em quê. B: só CMED, sem bula; então nenhum item ganha "aspirar e diluir".
- **L4-2. Dexametasona: sal ou base.** A CMED dá o nome do sal (fosfato dissódico). A: o mL só entra depois que a bula disser se os 2 e 4 mg/mL são de dexametasona ou do fosfato (regra ML6, mesma base). Se não bater com a dose do livro, a dexametasona sai do lote. B: tirar a dexametasona do lote já.
- **L4-3. Magnésio.** A: as duas ampolas (10% e 50%) sem marcação na asma, e o mesmo nos itens de torsades (`bolus:magnesio-torsades`, `fita:fita-magnesio-torsades`), que hoje também mostram mL fixo pela 50%. B: só a asma; torsades fica como está.
- **L4-4. Azul de metileno.** A: o RT procura o injetável no Bulário. Se houver, as concentrações com registro viram opções (ML2, ML8). Se não houver, fica a solução a 1% do livro (p. 102) com o aviso "confira a concentração do frasco". B: tirar o mL do azul de metileno até haver bula.
- **L4-5. Volume abaixo de 0,1 mL.** Ex.: difenidramina 0,5 mg/kg num lactente de 3 kg dá 0,03 mL da ampola de 50 mg/mL. A: a tela avisa "volume abaixo de 0,1 mL: use seringa de 1 mL"; diluição só quando a bula mandar. B: sem aviso.

## 3. Execução (depois das decisões)

1. Branch `fase-ml/lote4-anafilaxia-asma`, PR próprio.
2. `src/clinico/pediatria/ampolas.ts`: princípios novos (`difenidramina`, `dexametasona`, `magnesio`, `azul-metileno`), fontes (CMED e bulas lidas) e as chaves da tabela 1 em `ITENS_COM_AMPOLA`.
3. `bolus.ts` e `dosesDaFita.ts`: o magnésio deixa o `porMl` fixo e passa pela escolha da ampola (o guia de parada só mostra a escolha quando não há volume fixo).
4. Telas: anafilaxia e asma passam `ampola={"anafilaxia:<id>"}` e `ampola={"asma:<id>"}` na `LinhaDose`; a epinefrina por idade mostra o mL ao lado da dose; aviso de L4-5, se aprovado.
5. Ficha `ped-ampolas` em versão nova, aprovada pelo RT na Revisão Clínica (gate LG10); migration da ficha na homologação, com o rollback testado.
6. Testes: `problemasDasAmpolas()` vazio; nenhuma ampola marcada; volume = dose ÷ concentração em cada apresentação; magnésio sem mL antes da escolha; dexametasona só com a base conferida.
7. Homologação → conferência do RT → produção com o ok do RT → registro no `BACKLOG.md`.

## 4. Critérios de aceite (com evidência)

- Testes de tela verdes e `problemasDasAmpolas()` vazio (saída do teste no PR).
- Nenhum item do lote mostra mL sem ampola escolhida, exceto a epinefrina 1 mg/mL, que tem uma só apresentação à venda e a do livro.
- Cada ampola com fonte: CMED (laboratório e registro) e bula (expediente e data) quando lida.
- Ficha aprovada pelo RT; homologação conferida pelo RT antes da produção.

## 5. Riscos

- Dexametasona: confusão entre o sal (fosfato dissódico) e a dexametasona base pode dar erro de até cerca de 25% (por isso L4-2).
- Magnésio: 10% e 50% diferem 5×; tirar o mL fixo de 50% muda o que o médico vê hoje no guia de parada e na fita.
- Volumes muito pequenos em lactentes (L4-5).

## 6. Decisões do RT (20/11/2026) e andamento

Todas A ("Todas a"). Primeira parte feita na branch `fase-ml/lote4-anafilaxia-asma`, sem depender de bula:

- **Magnésio (L4-3):** `magnesio` em `ampolas.ts` com 10% (100 mg/mL) e 50% (500 mg/mL), base sal, fonte CMED 09/11/2026 e livro p. 32; chaves `asma:magnesio-tabela`, `asma:magnesio-texto`, `bolus:magnesio-asma`, `bolus:magnesio-torsades`, `fita:fita-magnesio-asma` e `fita:fita-magnesio-torsades`. O mL fixo de 50% saiu de `bolus.ts` e `dosesDaFita.ts`. A `rcp:magnesio` fica como está: a Tabela 2 do livro (p. 31–32) nomeia a solução a 50%.
- **Epinefrina IM por idade:** `epinefrinaDoseFixa` devolve também o volume da solução 1:1.000 (1 mg/mL), a mesma da dose por peso.
- **L4-5:** aviso "Volume abaixo de 0,1 mL: use seringa de 1 mL." na escolha da ampola, na `LinhaDose` e na linha do bolus, quando algum volume da faixa fica abaixo de 0,1 mL.
- **Telas:** anafilaxia e asma passam `anafilaxia:<id>` e `asma:<id>` na `LinhaDose`.
- **Fichas:** `ped-ampolas` 2026-11-20.3, `ped-bolus` 2026-11-20.1, `ped-doses-fita` 2026-11-20.1 e `ped-anafilaxia-icr` 2026-11-20.1; migration `20270416000016_fichas_ampolas_lote4.sql`, aplicada na homologação em 20/11/2026 (fontes das 4 fichas conferidas por md5 contra o arquivo; volta testada em transação desfeita, 4 linhas). Na primeira tentativa a sessão aplicou por engano um comando vazio com o nome `fichas_ampolas_lote4` (não mudou dado); a aplicação certa ficou como `fichas_ampolas_lote4_conteudo` no histórico da homologação.
- **Evidência local (20/11/2026):** `npm run test:clinico` com 1.388 testes, 0 falhas; `npm run typecheck` e `eslint` sem erro; `lista-cmed.mjs --conferir` sem concentração nova.

Falta, pela ordem:

1. Bulas do Bulário baixadas pelo RT (L4-1): difenidramina (Cristália), dexametasona 2 e 4 mg/mL, sulfato de magnésio (Samtec ou Halex) e azul de metileno injetável, se houver.
2. Com as bulas: diluição do magnésio; difenidramina; dexametasona, se a base bater (L4-2); azul de metileno (L4-4).
3. Feito em 20/11/2026, depois do merge dos guias de bolso (#1015): o `cartaoDaDose` do `GuiaDeBolso.tsx` passa `anafilaxia:<id>` além de `crise:<id>`, e o cartão com volume fixo mostra o aviso de 0,1 mL (L4-5).
4. Conferência do RT na homologação e produção com o ok do RT (PR #1017).

A produção espera pelo menos a bula do magnésio: a escolha 10% ou 50% vai sem o aviso de diluição até a bula ser lida.

**Correção de 20/11/2026 (guarda do LG10):** a tela da asma mudou (escolha da ampola do magnésio) e a ficha `ped-asma-icr` não tinha subido. Subiu para 2026-11-20.1, migration `20270416000018_ficha_asma_lote4.sql`, aplicada na homologação (fontes conferidas por md5; volta testada). O lote 4 fica com 5 fichas para o RT aprovar.
