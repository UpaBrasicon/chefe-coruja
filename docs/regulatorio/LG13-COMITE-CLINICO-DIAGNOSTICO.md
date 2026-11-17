# LG13: comitê clínico e revisão dupla das doses (diagnóstico, 17/11/2026)

Trilha de obrigatórios legais e regulatórios, item LG13 (P1). Base: boa prática de gestão de risco (ISO 14971), o caminho do SaMD (LG11) e o diagnóstico do caminho 1, que aponta "hoje é um aprovador só".

Este documento não muda código nem banco.

**Decisão do RT, 17/11/2026: "Todas A"** (K1–K6). Regimento em `LG13-REGIMENTO-COMITE.md`.

## Como está hoje

**Quem aprova:**
- Só o responsável técnico médico nomeado decide uma versão de ficha (`public.decidir_versao_ferramenta`). Ele aprova, ou reprova com a correção escrita.
- A tabela `responsaveis_tecnicos` já aceita farmacêutico (CRF), mas a decisão não usa esse tipo. Enfermeiro (COREN) não existe na tabela.
- Na produção, hoje: **1 responsável técnico ativo (médico) e 1 aprovador** em toda a história. 332 fichas aprovadas; **256 delas nos últimos 7 dias**, boa parte pela aprovação em lote; 1 reprovada.

**O que já protege:**
- Cada ficha cita a fonte, com versão e data de revisão.
- Testes automáticos por ficha, com casos da fonte.
- Desde o LG10, uma versão nova só vai ao ar aprovada; até lá, vale a anterior.
- As regras clínicas escritas (dose só de fonte citada, nada do adulto para a criança, pediatria até 13a 11m 29d).
- O mapa do LG11 diz o que é SaMD provável. Cerca de 230 fichas ficam em arquivos que calculam dose, volume ou infusão: 191 do adulto e 40 da pediatria. A contagem é pelo código; a lista exata por ficha sai no plano.

**O risco:**
- Um aprovador só, com centenas de fichas por semana, é o ponto fraco que o consultor e a ANVISA vão olhar primeiro.
- Erro de dose é o dano mais grave possível nas ferramentas. Hoje a dose não passa por um farmacêutico.
- As fichas de enfermagem e de triagem são aprovadas por médico.

## Decisões para o RT

**K1. Composição do comitê**
- **A (recomendada):** médico (o RT), farmacêutico e enfermeiro. Cada um aprova a parte da sua profissão.
- **B:** só médico e farmacêutico.

**K2. Regra de aprovação**
- **A (recomendada):**
  - ficha com dose, volume ou infusão: médico **e** farmacêutico, os dois;
  - ficha de enfermagem e de classificação de risco: médico **e** enfermeiro;
  - as outras (escores sem dose, notas de referência): médico.
  - A versão só fica "aprovada", e só vai ao ar pelo gate do LG10, quando todas as revisões pedidas estiverem feitas.
- **B:** os dois revisores em tudo.

**K3. Quem são o farmacêutico e o enfermeiro**
- **A (recomendada):** profissionais de fora, contratados por hora como revisores, sem vínculo com cliente. Ficam nomeados no sistema com CRF ou COREN e assinam cada decisão com o login deles.
- **B:** farmacêutico e enfermeiro de um cliente piloto. É mais barato, mas tem conflito de interesse e depende do contrato com o cliente.

**K4. Fichas já aprovadas**
- **A (recomendada):** revisão retroativa das fichas com dose pelo farmacêutico, por prioridade, sem tirar nada do ar. Ordem: pediatria, depois infusões e alta vigilância, depois o resto. Achado grave segue o caminho de sempre: versão nova corrigida, aprovada pelos dois.
- **B:** a regra nova vale só para versões novas.

**K5. Onde fica o registro**
- **A (recomendada):** no sistema.
  - `responsaveis_tecnicos` ganha o tipo enfermeiro (COREN).
  - Uma tabela nova, só de inclusão, guarda cada revisão: quem, conselho e registro, data, decisão e nota.
  - A Revisão Clínica mostra a cada revisor só o que é da profissão dele.
  - O mapa do LG11 diz que revisões cada grupo pede.
  - Tudo em migration expand/contract, testada na homologação.
- **B:** planilha e ata fora do sistema.

**K6. Aprovação em lote**
- **A (recomendada):** fica só para fichas sem dose e notas de referência. Ficha com dose é aprovada uma a uma, com a tela aberta.
- **B:** como hoje, lote para tudo.

## Plano depois das decisões

1. **Regimento do comitê** (`docs/regulatorio/LG13-REGIMENTO-COMITE.md`): composição, conflito de interesse, critérios de revisão por profissão (lista de conferência da dose: unidade, dose máxima, faixa de peso, fonte pediátrica, diluição e via), registro e frequência. Passa pelo seu ok e pelo consultor do LG11.
2. **Banco e tela** (com K5 = A): migration com rollback, testada na homologação; Revisão Clínica por profissão; o gate do LG10 continua lendo só o status final. Cada passo com CI e "ok produção".
3. **Busca dos revisores** (com K3 = A): o perfil e a carga de horas estimada (cerca de 230 fichas com dose para a revisão retroativa). A contratação é sua.
4. **Revisão retroativa** (com K4 = A): fila por prioridade na Revisão Clínica, com a contagem do que falta.

**Dependência:** sem farmacêutico e enfermeiro nomeados, os passos 2 e 4 ficam prontos, mas desligados. Até alguém ser nomeado, a ficha com dose continua aprovada só pelo médico, e a tela mostra que falta a revisão do farmacêutico.
