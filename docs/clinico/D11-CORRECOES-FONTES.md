# Lote D11 — correções nas telas que já estão na produção

Este lote reúne as diferenças entre as ferramentas que já estão na produção e as fontes abertas conferidas no PubMed. Elas apareceram em três momentos:
- na conferência das doses da fita: [DOSES-FITA-CONFERENCIA-PUBMED.md](DOSES-FITA-CONFERENCIA-PUBMED.md), incluindo a rodada D10;
- no cronômetro da parada: [CRONOMETRO-PARADA.md](CRONOMETRO-PARADA.md);
- na conferência das lacunas: [CRONOMETRO-PARADA-LACUNAS.md](CRONOMETRO-PARADA-LACUNAS.md).

O RT decidiu em 17/11/2026 que essas correções viriam num lote separado (D11 = A). O pedido para seguir com o lote veio em 19/11/2026.

Os valores de "hoje" foram conferidos no código do master em 19/11/2026. Em toda correção, a fonte nova entra na ficha e o valor antigo do livro continua como nota de divergência. Nada some sem registro.

## Itens

| # | Ferramenta (arquivo) | Hoje | Fonte conferida | Proposta A |
|---|---|---|---|---|
| 1 | RCP pediátrica (`pediatria/rcp.ts`), atropina | 0,02 mg/kg, sem máximo | AHA 2025, Part 8, Figura 6; Coreia 2025: máx. 0,5 mg | máximo de 0,5 mg |
| 2 | Via aérea pediátrica (`pediatria/viaAerea.ts`), atropina | máx. 1 mg (livro, p. 71; a SBA 2024 também dá 1 mg) | AHA 2025 e Coreia 2025: máx. 0,5 mg | máximo de 0,5 mg, com nota de que o livro e a SBA dão 1 mg |
| 3 | Doses por peso (`pediatria/bolus.ts`), epinefrina na PCR | sem teto | AHA 2025, Figura 2: máx. 1 mg | teto de 1 mg (como em `rcp.ts`) |
| 4 | RCP pediátrica, cloreto de cálcio 10% | 0,2 mL/kg, sem teto | Coreia 2025, Tabela 2: máx. 2 g | teto de 20 mL (2 g) |
| 5 | RCP pediátrica, magnésio | 25 a 50 mg/kg, sem teto | Coreia 2025: máx. 2 g | teto de 2000 mg |
| 6 | RCP pediátrica, cardioversão (2ª tentativa) | 1 a 2 J/kg (livro) | AHA 2025 e Coreia 2025: 2 J/kg | 2 J/kg |
| 7 | Crise epiléptica (`pediatria/criseEpileptica.ts`), diazepam IV | 0,2 a 0,4 mg/kg (livro, p. 127) | AES 2016: 0,15 a 0,2 mg/kg, máx. 10 mg, repetir 1 vez | 0,15 a 0,2 mg/kg, máx. 10 mg |
| 8 | Doses por peso, diazepam IV abaixo de 5 anos | máx. 5 mg | AES 2016: máx. 10 mg por dose | máximo de 10 mg |
| 9 | Doses por peso, glucagon abaixo de 20 kg | 0,02 a 0,03 mg/kg (máx. 0,5) | ISPAD 2022: 0,5 mg fixo | 0,5 mg fixo |
| 10 | Anafilaxia pediátrica (`pediatria/anafilaxia.ts`), difenidramina pelo texto do livro | 1 a 2 mg/kg (p. 100) | diretriz chinesa 2020: 1 mg/kg, máx. 50 mg | 1 mg/kg, máx. 50 mg |
| 11 | Doses por peso, epinefrina IM | "a cada 20 min" | WAO 2020: a cada 5 a 15 min (`anafilaxia.ts` já diz) | a cada 5 a 15 min |
| 12 | Doses por peso, naloxona | só 0,1 mg/kg | Coreia 2025: dose baixa de 1 a 5 µg/kg no opioide terapêutico | acrescentar a dose baixa |
| 13 | Diarreia (`pediatria/diarreia.ts`), ondansetrona | 0,1 mg/kg, sem teto (p. 331) | Rerksuppaphol 2010: IV 0,15 mg/kg, máx. 8 mg; Sociedade Canadense de Pediatria 2011: VO por faixa de peso | 0,15 mg/kg IV (máx. 8 mg) e VO por faixa |
| 14 | Asma pediátrica (`pediatria/asma.ts`), salbutamol | só contínuo e spray | Sociedade Italiana de Pediatria 2018: nebulização de 2,5 a 5 mg | acrescentar a nebulização intermitente |
| 15 | Via aérea e doses por peso, propofol | 1 a 2 mg/kg | SBA 2024: 2 mg/kg (até 3 mg/kg em criança pequena) | nota "até 3 mg/kg em criança pequena" |
| 16 | Gluconato de cálcio, em 6 arquivos | tetos diferentes (nenhum, 20 mL, 3 g) | única fonte aberta: AHA 2025, Part 10, na intoxicação (até a dose de adulto) | sem mudança, só registro (a fonte não vale para a parada nem para a hipercalemia) |
| 17 | PCR do adulto (`adulto/pcr.ts`), glicose com insulina | 25 g + 10 U (manual, p. 51) | AHA 2025, Part 10, Tabela 3: 50 g com 10 U | nota de divergência (manual 25 g; AHA 50 g), sem trocar o número |
| 18 | PCR do adulto, KCl | manutenção com errata (sem unidade de tempo) | Coreia 2025, Part 5: 10 mmol em 5 a 10 min, depois de 2 mmol/min por 10 min | trocar a manutenção pela da Coreia |
| 19 | PCR do adulto, drogas da hipercalemia e naloxona na parada | sem a força da recomendação | AHA 2025, Part 10: 2b (benefício não estabelecido) | nota "2b, benefício na parada não estabelecido" |
| 20 | Trauma do adulto (`adulto/trauma.ts`), punção do pneumotórax | 5º EIC, linha axilar média (p. 644) | ERC 2021: 4º ou 5º EIC, linha axilar anterior (menor falha) | linha axilar anterior, com nota do livro |
| 21 | PCR do adulto, emulsão lipídica | sem teto | ERC 2021: até 2 bolus a mais e máx. 12 mL/kg | acrescentar os bolus extras e o teto |

Cada item muda uma ficha, então a ficha ganha versão nova, que passa pelo gate LG10 e pela aprovação do RT. As fichas afetadas são:
- `ped-rcp-icr`
- via aérea pediátrica
- `ped-bolus`
- crise epiléptica pediátrica
- anafilaxia pediátrica
- diarreia
- asma pediátrica
- `adulto-pcr`
- trauma do adulto

## Como entrou (19/11/2026)

O RT decidiu todas A. As 9 fichas do lote foram para a versão 2026-11-19.1.

**Mais 6 versões novas, só pela regra do gate.** A regra 1b do gate LG10 pede versão nova para toda ficha cujo arquivo mudou, mesmo sem mudança de conteúdo. Por isso também sobem:
- `adulto-bradicardia` e `adulto-taquiarritmias`, que ficam em `pcr.ts`;
- `adulto-mgap`, `adulto-nexus`, `adulto-regra-canadense-coluna` e `adulto-triage-rts`, que ficam em `trauma.ts`.

**Fontes novas da PCR do adulto.** A AHA 2025 Part 10, a Coreia 2025 Part 5 e a ERC 2021 ficam citadas no texto de cada item, e não na lista de fontes da ficha. A nota de atualização do HCFMUSP (cap. 2) monta as fontes dela a partir dessa lista. Mexer na lista obrigaria a subir todas as notas do HCFMUSP.

**Fontes comuns.** As fontes que as fichas do lote usam foram copiadas para `src/clinico/fontesPubmed.ts`. Assim `bolus.ts` não importa `dosesDaFita.ts` e não cria ciclo. As definições originais em `dosesDaFita.ts` e `cronometroParada.ts` não mudaram.

**Migration** `20270416000008_fichas_lote_d11.sql`: registra as 15 versões. A volta foi testada na homologação (FIM ok) e a migration já foi aplicada na homologação.
