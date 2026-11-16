# Revisão do HCFMUSP, lote 2, M2: cap. 3, manejo da via aérea (DAS 2025)

Decisão do RT de 13/11/2026 (M2 = A): ler a diretriz nova, atualizar a ficha e só depois fazer a nota. O diagnóstico do lote 2 está em `HCFMUSP-LOTE2-DIAGNOSTICO.md`.

## Fonte

Difficult Airway Society 2025 guidelines for management of unanticipated difficult tracheal intubation in adults. Br J Anaesth 2026;136(1):283–307 (PMID 41203471).

- Em 14/11/2026, o texto integral abriu no site da BJA (acesso aberto) pelo Chrome do RT. A verificação do site passou sozinha.
- Os cookies não essenciais foram recusados.
- São recomendações de consenso (Delphi), sem classe nem nível.
- A diretriz foi escrita para anestesia. Os planos A a D valem para o DE, mas parte do cenário não se aplica, como o centro cirúrgico e acordar o paciente.

O lado do manual foi conferido no PDF do livro (cap. 3, p. 54–65).

## O que mudou na Central

- **Ficha `adulto-isr` 2026-11-14.1:**
  - fonte `DAS_2025`;
  - `DIRETRIZ_DAS_2025`: 14 temas com a seção da DAS e a página do manual;
  - `DIFERENCAS_DAS_2025`: 7 frases;
  - a tela da ISR ganha o bloco "DAS 2025 — ao lado do manual".
- **Doses e volumes do Anexo 1 não mudam.** Rocurônio (1,2 mg/kg) e succinilcolina (1,5 mg/kg) são iguais nas duas fontes.
- **Nota `nota-hcfmusp-cap3-via-aerea`:** 14 itens.
- **Migration** `20270414000003`. A ficha e a nota aguardam a aprovação do RT.

## Diferenças principais

| Tema | DAS 2025 | Manual de 2022 |
|---|---|---|
| Tentativas | 3 + 1, a última por colega mais experiente | no máximo 3 (p. 58 e 62) |
| Pressão cricoide | pode ser usada no alto risco de aspiração; retirar se atrapalhar | contraindicada (p. 58) |
| Cricotireoidostomia | bisturi, bougie e tubo 6,0; incisão vertical na pele como padrão | incisão laterolateral, bougie e tubo de 6 mm (Tabela 14, p. 62–63) |
| Pré-oxigenação | em todos, com pressão positiva (CNAF, VNI ou CPAP) e cabeceira elevada | máscara com reservatório; VNI só se SpO2 < 93% (Tabela 2, p. 57) |
| Oxigenação apneica | com CNAF no risco de via aérea difícil | "ainda sem grandes evidências" (p. 57) |
| Confirmação do tubo | capnografia e tubo visto passando pelas cordas | capnografia obrigatória (p. 58) |

## Antes e depois (14/11/2026)

Perguntas direto à API da biblioteca (`conflito_va.py`). "Antes" é a produção. "Depois" é a homologação.

| Pergunta | Produção, antes | Homologação, depois |
|---|---|---|
| tentativas antes de declarar falha | 3 (manual) | 3 + 1 (DAS 2025), com o manual como diferença |
| Sellick | contraindicada (manual) | pode ser usada no alto risco de aspiração (DAS 2025), com o manual como diferença |
| cricotireoidostomia com bisturi | incisão laterolateral (manual) | incisão vertical, bisturi 10, bougie e tubo 6,0 (DAS 2025) |
| pré-oxigenação | ATS 2026 e manual | DAS 2025: pressão positiva e cabeceira elevada; oxigenação apneica com CNAF |
| confirmar a posição do tubo | "não encontrei" | checagem em dois pontos (DAS 2025) |
| dose de rocurônio | 1,2 mg/kg (manual) | 1,2 mg/kg (DAS 2025 e manual) |

As seis respostas passam a abrir pela DAS 2025.

## Produção, com o "ok produção"

1. Aplicar a migration `20270414000003`.
2. Copiar e ingerir `adulto-isr.md` e `nota-hcfmusp-cap3-via-aerea.md`.
3. Reiniciar a API.
4. Refazer as perguntas.
5. Mesclar.

## Produção (14/11/2026, com o "ok produção" do RT)

- A migration `20270414000003` foi aplicada antes do merge. A ficha `adulto-isr` e a nota do cap. 3 estão na versão 2026-11-14.1.
- O corpus foi gerado do master e ingerido. A API foi reiniciada.
- Refiz as perguntas na produção. As seis abrem pela DAS 2025.
