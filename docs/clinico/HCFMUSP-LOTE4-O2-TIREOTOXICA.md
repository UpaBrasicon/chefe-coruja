# Revisão do HCFMUSP, lote 4, O2: cap. 70, crise tireotóxica

O RT decidiu O1 a O4 = A em 14/11/2026. O diagnóstico está em `HCFMUSP-LOTE4-DIAGNOSTICO.md`.

## Fonte

- Taylor P, Okosieme O, Effraimidis G, et al. Management of thyroid emergencies: joint consensus statement on management of thyroid storm. Eur Thyroid J 2026;15(4) (PMID 42554462; PMC13506520).
- É um consenso conjunto de quatro sociedades: European Thyroid Association, British Thyroid Association, Society for Endocrinology e Welsh Endocrine and Diabetes Society.
- Li o texto integral no PMC, pelo Chrome do RT.
- O painel não fez GRADE; o próprio texto diz isso. Por isso as linhas da tabela vêm marcadas "consenso, sem graduação".

O lado do manual vem da ficha da Central, já conferida no PDF (cap. 70, p. 947–956).

## O que mudou na Central

- **Ficha `adulto-crise-tireotoxica` 2026-11-14.1:**
  - antes só tinha o manual;
  - fonte `ETA_TEMPESTADE_2026`;
  - `DIRETRIZ_TT`: 11 temas;
  - `DIFERENCAS_TT`: 7 frases;
  - a tela ganha a tabela "ETA/BTA/SfE 2026 — ao lado do manual".
- **Doses:** as do consenso aparecem ao lado do manual, com a fonte. As doses e contas do manual não mudam. O escore de Burch-Wartofsky da Central também não muda.
- **Nota `nota-hcfmusp-cap70-tireotoxica`:** 11 itens.
- **Migration:** `20270414000016`.

## Diferenças principais

| Tema | Consenso ETA/BTA/SfE 2026 | Manual de 2022 |
|---|---|---|
| Metimazol | 60–80 mg/dia, equivalente ao PTU; preferido com o fígado alterado | 80–120 mg/dia (p. 953) |
| PTU | 500–1.000 mg e 250 mg de 4/4 h | 600–1.000 mg e 200–300 mg de 6/6 a 4/4 h (p. 953) |
| Iodo | 1 h depois do antitireoidiano; Lugol 8 gotas ou iodeto saturado 5 gotas de 6/6 h | 2 h depois (Figura 1); iodeto 4–8 gotas (p. 954, 956) |
| Hidrocortisona | 100 mg e depois 50 mg de 6/6 h | 100 mg de 6/6 h (p. 954) |
| Esmolol | até 200 µg/kg/min | até 1,0 mg/kg/min (p. 954) |
| Ácido iopanoico | só em centro especializado | agente iodado de escolha (p. 953) |
| Burch-Wartofsky | faixas de temperatura de 37,2 a ≥ 40,0 °C; corte ≥ 45 | faixas impressas diferentes; corte > 45 (p. 951–952) |

## Antes e depois (14/11/2026)

| Pergunta | Produção, antes | Homologação, depois |
|---|---|---|
| metimazol ou PTU | doses do manual | consenso: metimazol 60–80 mg/dia, equivalente; o manual como diferença |
| tempo até o iodo | 2 h (errata do manual) | consenso: 1 h |
| betabloqueador com insuficiência cardíaca | "os trechos não trazem" | consenso: cautela, esmolol preferido, eco cedo |
| hidrocortisona na tempestade | **dose da crise adrenal** (50–100 mg de 6/6 h, desmame em 48–72 h) | consenso: 100 mg e 50 mg de 6/6 h |
| ácido iopanoico | manual: agente de escolha | consenso: só em centro especializado; o manual como diferença |
| tempestade refratária | plasmaférese; tireoidectomia "não há menção" | consenso: plasmaférese, tireoidectomia e ECMO |

As seis respostas passam a abrir pela diretriz. A pergunta da crise adrenal continua respondendo pela nota do cap. 72.

**Achado:** antes, a busca misturava a hidrocortisona da tempestade tireoidiana com a da crise adrenal, porque o módulo endócrino entra junto no corpus. A nota corrige a resposta.

## Homologação

- Migration aplicada.
- 6 arquivos do corpus ingeridos e API reiniciada.
- Branch `homolog` publicada depois de `test:clinico` (1.239, sem falha) e typecheck limpos.
- A tela não foi vista com login.

## Produção, com o "ok produção"

1. Aplicar a migration `20270414000016`.
2. Copiar e ingerir os 6 arquivos.
3. Reiniciar a API.
4. Refazer as perguntas.
5. Mesclar.

## Produção (14/11/2026, com o "ok produção" do RT)

- A migration `20270414000016` foi aplicada antes do merge. O #688 foi mesclado com o CI verde.
- O corpus foi gerado do master e os 6 arquivos foram ingeridos. A API foi reiniciada.
- Refiz as perguntas na produção. As seis abrem pelo consenso, e a da crise adrenal continua certa.
