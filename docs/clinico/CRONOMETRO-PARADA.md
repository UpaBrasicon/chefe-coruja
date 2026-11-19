# Cronômetro da parada (G3)

Construído com o RT em 18/11/2026, a partir de um protótipo ajustado em várias rodadas. Vale para criança e adulto e abre pelo Guia rápido do celular. Na criança, abre pelo botão vermelho no alto da tela de parada. No adulto, abre pelo cartão "Parada e reanimação".

## Fluxo combinado com o RT

1. Botão vermelho grande "Iniciar parada". Ao tocar, o tempo total começa em segundo plano e o ciclo de 2 min fica em destaque.
2. Os 4 ritmos aparecem na tela, com tiras desenhadas por nós (esquema, não traçado real): TV sem pulso e FV (chocáveis), AESP e assistolia (não chocáveis), além de "Pulso presente — RCE".
3. Tocar no ritmo abre a conduta com **uma ação agora** e a lista **próximos**, com contagem regressiva:
   - ação agora: choque, epinefrina ou compressões;
   - próximos: próximo choque e quando, próxima epinefrina, amiodarona.

   O RT pediu "uma calculadora que até uma criança saiba usar".
4. No fim do ciclo: bipe, vibração e volta aos ritmos. A epinefrina dá bipe aos 3 e aos 5 min. A tela fica acesa enquanto o cronômetro corre.
5. Metrônomo das compressões (110/min), que liga e desliga a qualquer momento e não entra no registro.
6. Nada é gravado. O registro, com a hora de cada medicação e intervenção, é copiado pelo médico para o prontuário.

## Regras e fontes

Ficha `cronometro-parada`, com a lógica em `src/clinico/cronometroParada.ts`. Trechos e links das fontes em [CRONOMETRO-PARADA-FONTES.md](CRONOMETRO-PARADA-FONTES.md).

- **Ritmo a cada 2 min:** RCP logo depois do choque, por 2 min, sem checar o pulso (Coreia 2025, Part 4 e Part 8).
- **Epinefrina a cada 3 a 5 min:**
  - no ritmo não chocável, o mais cedo possível;
  - no chocável, depois do 2º choque (AHA 2025, Part 8 na criança; Figura 2 da Part 9 e manual do HCFMUSP p. 49 no adulto).
- **Amiodarona ou lidocaína:** depois do 3º choque. No adulto, a 2ª dose de amiodarona vem depois do 5º choque (manual p. 49).
- **Causas reversíveis:**
  - criança: 11 itens da AHA 2025, Part 8, Figura 2, com hipoglicemia;
  - adulto: 10 itens da Part 9, Figura 2.
- **Doses:**
  - criança: módulo `ped-doses-fita`, pelo peso digitado ou pela cor;
  - adulto: as mesmas da ferramenta PCR do adulto.

## Divergência registrada

A epinefrina no ritmo chocável do adulto não tem o mesmo momento em todas as fontes:
- AHA 2025 (Figura 2) e o app (`pcr.ts`): depois do 2º choque;
- ERC/RCUK 2025: depois do 3º choque;
- Coreia 2025: já no ciclo depois do 1º choque.

O cronômetro segue a AHA e o manual, como a ferramenta PCR do adulto.

## Causas reversíveis: identificar e tratar (versão .2)

O RT pediu em 18/11/2026 que cada causa tenha uma linha "identificar" e outra "tratar". As decisões foram CR1–CR4 = A:

- cada linha tem a fonte aberta embaixo;
- onde não há fonte aberta, a tela diz "sem fonte aberta";
- as doses são só as que já estão aprovadas no app.

Os trechos e os locais de cada fonte estão em [CRONOMETRO-PARADA-CAUSAS.md](CRONOMETRO-PARADA-CAUSAS.md).

**Sem fonte aberta:**
- trombose coronária na criança;
- reposição na hipocalemia da criança;
- dose de trombolítico na criança, que o app não tem;
- sinais clássicos do pneumotórax e do tamponamento, como desvio de traqueia e turgência jugular;
- volume em mL/kg durante a parada.

**Achados para o lote de correções D11, sem mudança no cronômetro:**
1. **Glicose na hipercalemia do adulto:** a ferramenta PCR do adulto usa 25 g de glicose com 10 U de insulina (`pcr.ts`, manual p. 51). A AHA 2025, Part 10, Tabela 3, dá 50 g. Por isso o cronômetro não mostra número de glicose (CR3).
2. **KCl no adulto:** a manutenção tem errata no app. A diretriz coreana 2025 (Part 5) dá 10 mmol em 5 a 10 min, depois de 2 mmol/min por 10 min.
3. **Força da recomendação:** na hipercalemia (cálcio, bicarbonato, glicose com insulina) e na naloxona durante a parada, a AHA 2025 classifica como 2b. A tela diz "benefício na parada não estabelecido".

## Lacunas buscadas no PubMed (versão 2026-11-19.1)

O RT pediu em 19/11/2026 que o que faltava fosse buscado no PubMed. As decisões foram CL1–CL4 = A:

- **CL1:** cada linha diz a fonte e o nível dela: diretriz, consenso ou revisão.
- **CL2:** as doses novas na criança entram com a fonte e o nível: KCl na hipocalemia peri-parada, alteplase no TEP e emulsão lipídica. O alteplase pediátrico vem marcado "protocolo de revisão, sem diretriz".
- **CL3:** a ERC 2021, na tradução alemã aberta no PMC, vale enquanto a 2025 não estiver aberta.
- **CL4:** a punção do adulto segue a ERC (4º ou 5º EIC, linha axilar anterior).

Trechos e locais de cada fonte em [CRONOMETRO-PARADA-LACUNAS.md](CRONOMETRO-PARADA-LACUNAS.md).

**Continua sem fonte aberta:**
- volume em mL/kg próprio da parada na criança, e volume em mL no adulto;
- calibre e comprimento da agulha na criança;
- trombose coronária como causa da parada na criança (o consenso de Kawasaki trata da síndrome coronária);
- capnografia como pista da causa na criança;
- potássio durante a parada em si;
- dose pediátrica de trombolítico em diretriz.

**Achados para o lote D11, sem mudança no cronômetro:**
4. **Punção do pneumotórax:** a ferramenta de trauma do adulto (`trauma.ts`) punciona no 5º EIC, linha axilar média. A ERC 2021 aponta a linha axilar anterior, no 4º ou 5º EIC, como a de menor falha.
5. **Emulsão lipídica:** a ferramenta PCR do adulto (`pcr.ts`) não traz o teto de 12 mL/kg nem os bolus extras.
