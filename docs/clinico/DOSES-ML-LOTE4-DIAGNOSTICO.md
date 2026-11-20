# Dose em mL, lote 4 (anafilaxia, asma e crupe): diagnóstico

Data: 20/11/2026. Situação: só diagnóstico, nenhum código mudou. Faz parte do pedido do RT de 19/11/2026 (dose em mL em todas as medicações) e segue as decisões ML1–ML11 de `DOSES-ML-PEDIATRIA-DIAGNOSTICO.md` e a decisão do RT de 20/11/2026 que pôs a CMED como fonte ao lado da bula.

## Como foi feito

- Lista de preços da CMED (PMC) de 09/11/2026, baixada da página pública da CMED com `scripts/anvisa/lista-cmed.mjs --atualizar` (26.694 apresentações) e filtrada com `--injetaveis`. Conta só o que está à venda ("comercializado: Sim").
- O Bulário Eletrônico recusou o acesso a partir da nuvem: a proteção do site da ANVISA devolve 403 para o IP da sessão. Por isso as bulas deste lote seguem como nos lotes 1 a 3: o RT baixa e a sessão lê.
- O livro do ICr não está nesta máquina. As páginas citadas abaixo são as que já estão no código e no diagnóstico de 19/11/2026.

## O que o lote cobre

| Princípio | Itens (chave da tela) | Hoje |
|---|---|---|
| Difenidramina | `anafilaxia:difenidramina-tabela`, `anafilaxia:difenidramina-texto`, `bolus:difenidramina`, `fita:fita-difenidramina` | sem mL |
| Dexametasona | `asma:dexametasona`, `bolus:dexametasona-crupe`, `fita:fita-dexametasona-crupe`; crupe em `viasAereasSuperiores.ts` (`crupe-dexa`) | sem mL |
| Sulfato de magnésio | `asma:magnesio-tabela`, `asma:magnesio-texto` (sem mL); `bolus:magnesio-asma`, `fita:fita-magnesio-asma`, `bolus:magnesio-torsades` e `fita:fita-magnesio-torsades` (mL fixo em 50%) | ver achado 1 |
| Epinefrina IM | dose fixa por idade (`epinefrinaDoseFixa`, tela da anafilaxia) | sem mL; as doses por peso já mostram mL em 1 mg/mL |
| Azul de metileno | `anafilaxia:azul-metileno` (sem mL); `bolus:azul-metileno-anafilaxia` e `bolus:azul-metileno` (mL fixo em 1%) | ver achado 3 |

Ficam fora, como o diagnóstico de 19/11 já previa: metilprednisolona, hidrocortisona e glucagon (pó), prednisolona (VO), salbutamol e ipratrópio (inalatórios; o ipratrópio já sai em gotas) e as infusões contínuas (epinefrina e norepinefrina).

## O que a CMED mostra à venda

| Princípio | Concentrações à venda | Laboratórios (registro) | Fora de venda |
|---|---|---|---|
| Cloridrato de difenidramina | **50 mg/mL**, ampola de 1 mL | Cristália (1029801700020) | — |
| Fosfato dissódico de dexametasona | **2 mg/mL** (ampola de 1 mL) e **4 mg/mL** (ampola ou frasco de 2,5 mL) | 2 mg/mL: Hypofarma, União Química, Aché, Farmace, Hipolabor. 4 mg/mL: Eurofarma, Teuto, Hypofarma, União Química, Aché, Farmace, Hipolabor | Fresenius 4 mg/mL; algumas caixas de 100 da Hypofarma |
| Sulfato de magnésio | **100 mg/mL (10%)** e **500 mg/mL (50%)**, ampola de 10 mL | Samtec e Halex | Blau e Vasconcelos (inclusive frasco de 50 mL a 10%) |
| Epinefrina | **1 mg/mL**, ampola de 1 mL | Hypofarma, Hipolabor, Blau (hemitartarato) | 0,1 mg/mL da Hipolabor (sem venda; o adulto já tirou pelo mesmo motivo) |
| Azul de metileno (cloreto de metiltionínio) | **nenhum injetável** na CMED | — | — |

## Achados

1. **Magnésio a 50% com mL fixo e sem aviso de diluir.** No Bolus, no guia da fita e no torsades, a tela já mostra o mL em 500 mg/mL, como se a única ampola fosse a de 50%. A ampola de 10% também está à venda, e o adulto já oferece as duas (`adulto-ampolas` 2026-11-20.1). Pela ML2, as duas viram opção e nenhuma vem marcada. Falta conferir na bula se a de 50% precisa ser diluída antes de entrar na veia da criança. Se a bula mandar diluir, a de 50% recebe "aspirar e diluir" (ML5). Hoje a tela não traz esse aviso.
2. **Dexametasona: sal ou base.** A CMED registra "fosfato dissódico de dexametasona 2 mg/mL e 4 mg/mL". A dose do livro está em mg de dexametasona. As bulas brasileiras podem declarar a concentração como fosfato dissódico, como fosfato de dexametasona ou como dexametasona base, e a diferença chega a cerca de 20%. Pela ML6, o mL só entra depois que a bula disser a quanto de dexametasona corresponde cada mL. Duas concentrações à venda (2 e 4 mg/mL) dão erro de 2× se o médico pegar a ampola errada. Por isso a escolha da ampola é obrigatória.
3. **Azul de metileno sem produto na CMED.** O livro cita 1% = 10 mg/mL (p. 102), e as listas locais citam 20 mg/mL. Nenhum injetável aparece na CMED. Isso não prova que não haja registro, porque a CMED só lista o que tem preço regulado. A ML8 manda conferir no Bulário neste lote.
4. **Difenidramina tem uma concentração só (50 mg/mL).** Não há risco de troca de ampola. Falta só confirmar na bula se o uso IV é direto, lento, ou se pede diluição.
5. **Epinefrina IM por idade.** A dose fixa (0,1 a 0,15 mg; 0,15 mg; 0,3 mg; 0,5 mg) pode ganhar o mL em 1 mg/mL (0,1 a 0,15 mL; 0,15 mL; 0,3 mL; 0,5 mL). A concentração é a citada no livro (p. 98, 101 e 895) e a única à venda na CMED. Sem escolha de ampola.
6. **Crupe na tela de vias aéreas superiores.** `crupe-dexa` usa o tipo `DoseLivro`, e a linha desse tipo (`LinhaDoseLivro`) ainda não mostra a escolha da ampola. Dá para ligar só esta linha agora, ou deixar para o lote 6, que trata o `DoseLivro` inteiro.

## Bulas que o RT precisa baixar do Bulário Eletrônico

Bula do profissional, uma de cada, de qualquer laboratório com o produto à venda:

1. **Fosfato dissódico de dexametasona 2 mg/mL** e **4 mg/mL** (Hypofarma, Hipolabor, Aché ou União Química têm as duas). O que vou ler: a quanto de dexametasona corresponde cada mL e se o uso IV é direto.
2. **Sulfato de magnésio 10% e 50%** (Samtec ou Halex). O que vou ler: se a de 50% precisa ser diluída para uso IV e até que concentração.
3. **Cloridrato de difenidramina 50 mg/mL** (Cristália). O que vou ler: o modo de uso IV e IM.
4. **Azul de metileno** (buscar também por "cloreto de metiltionínio"). Se não houver nenhum registro, o item fica com o 1% do livro e o aviso "solução a 1%" (ML8).

A epinefrina não precisa de bula nova: a concentração vem do livro e a CMED só confirma.

## Decisões para o RT

**L4-1. Magnésio (achado 1)**
- **A (recomendada):** 10% e 50% viram opções, sem nenhuma marcada, em todos os itens de magnésio da criança (asma, Bolus, guia da fita e torsades). O mL fixo em 50% sai, e as fichas de dose sobem de versão. Se a bula mandar diluir, a de 50% ganha "aspirar e diluir".
- **B:** manter o mL fixo em 50% e só acrescentar o aviso da bula.

**L4-2. Dexametasona (achado 2)**
- **A (recomendada):** 2 e 4 mg/mL viram opções, sem nenhuma marcada, só depois da bula lida. Se a bula declarar o mL em fosfato e não em base, a tela usa o equivalente em dexametasona que a própria bula escrever. Se a bula não escrever esse equivalente, a dexametasona fica sem mL.
- **B:** usar 2 e 4 mg/mL como dexametasona sem esperar a bula.

**L4-3. Azul de metileno (achado 3)**
- **A (recomendada):** usar a bula que o RT achar. Se não houver registro, manter o 1% do livro com o aviso "solução a 1%" ao lado do volume, também na tela da anafilaxia, que hoje não tem mL.
- **B:** tirar o mL do azul de metileno em todas as telas até haver produto registrado.

**L4-4. Epinefrina IM por idade (achado 5)**
- **A (recomendada):** mostrar o mL ao lado de cada dose fixa, em 1 mg/mL.
- **B:** deixar como está.

**L4-5. Crupe (achado 6)**
- **A (recomendada):** ligar só a linha `crupe-dexa` agora (escolha da ampola na `LinhaDoseLivro`, sem mudar o resto do tipo). Os outros itens de `DoseLivro` seguem para o lote 6.
- **B:** a dexametasona do crupe nessa tela vai para o lote 6. O Bolus e o guia da fita ganham o mL agora.

**L4-6. Difenidramina (achado 4)**
- **A (recomendada):** 50 mg/mL como ampola única, com a fonte "CMED + bula". O texto do modo de uso vem da bula.
- **B:** só a CMED, sem esperar a bula, como foi feito com a atropina.

## Depois das decisões

1. Ler as bulas e fechar a tabela de ampolas para o ok do RT.
2. Código em PR próprio: `src/clinico/pediatria/ampolas.ts` (princípios `difenidramina`, `dexametasona`, `magnesio`, `azul-metileno`), as chaves `anafilaxia:` e `asma:` em `ITENS_COM_AMPOLA` e no padrão de `problemasDasAmpolas`, e o `ampola=` nas linhas de `AnafilaxiaPediatrica.tsx` e `AsmaPediatrica.tsx`. Se L4-1 = A, sai o `porMl` fixo dos itens de magnésio em `bolus.ts` e `dosesDaFita.ts`.
3. Ficha `ped-ampolas` na versão nova e, se L4-1 = A, as fichas de dose que perdem o mL fixo. Migration da ficha com volta testada na homologação, como no lote 3.
4. Testes: `ampolas.test.ts` (cadastro sem problemas, mL de cada concentração, nenhuma ampola marcada) e as telas da anafilaxia e da asma.
5. Homologação, depois o "ok produção" do RT.
