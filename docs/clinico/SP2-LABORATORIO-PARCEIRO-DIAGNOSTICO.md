# SP2: laboratório do parceiro para a sepse (diagnóstico, 18/11/2026)

Trilha "Sepse com evidência", item SP2 (P1). **Decisões do RT: pendentes** (L1–L5). Este documento não muda código nem banco.

**Pergunta:** o que falta para que lactato, leucócitos, plaquetas, creatinina, bilirrubina, PCR, gasometria e hemocultura do laboratório do parceiro cheguem sozinhos ao prontuário? Com eles, o SOFA do SP1 deixa de depender de digitação.

## Como está hoje

**A porta já existe.** Na Fase 5C (tarefa 1, decisões do RT de 18 e 19/10/2026) foi feita uma porta FHIR R4 para o laboratório (`docs/api/README.md`, seção "Laboratório (LIS)"):
- o laboratório lê os pedidos (`ServiceRequest`), devolve a coleta (`Specimen`) e o laudo (`DiagnosticReport`, com os analitos e o PDF);
- o laudo corrigido vira versão nova, o reenvio não duplica e o resultado crítico vira aviso;
- tudo passa por uma chave de API da unidade, com registro de cada chamada;
- o simulador `scripts/lis-simulador.mjs` faz o papel do laboratório na homologação.

**O que falta para a sepse:**

| Ponto | Situação |
|---|---|
| Parceiro e contrato | **Não há.** Produção com 0 chaves de laboratório e 0 laudos |
| Catálogo da unidade com LOINC | **Vazio na produção** (0 exames configurados). Pela decisão 1a da Fase 5C, o sistema não deduz o LOINC: a implantação preenche. Sem LOINC, o SOFA do SP1 acha o analito só pelo nome |
| Hora do exame no SOFA | O SP1 usa a hora em que o laudo foi liberado. O que vale clinicamente é a hora da **coleta**, que pode vir horas antes |
| Valor numérico | O número só é lido se vier simples ("150" ou "1,2"). "150.000", "1.234,5" e "<0,5" ficam só como texto, e o SOFA não os vê |
| Unidade de medida | Gravada como texto livre. O SP1 converte µmol/L e kPa pelo texto da unidade |
| Laudo sem pedido no sistema | **Recusado** (decisão 5a). Exame feito sem pedido no Chefe Coruja não entra |
| Laboratório que não fala FHIR | Muitos sistemas de laboratório no Brasil usam HL7 v2 ou formato próprio. Hoje só há a porta FHIR |

## Decisões para o RT

**L1. Por onde o laboratório entra**
- **A (recomendada):** a porta FHIR R4 que já existe é a padrão. Se o parceiro não falar FHIR, um tradutor de HL7 v2 (pedido ORM, resultado ORU) entra como item próprio, decidido com o fornecedor do laboratório. Nada se constrói antes de saber o que ele usa.
- **B:** fazer o tradutor de HL7 v2 já, sem parceiro.

**L2. LOINC dos exames da sepse**
- **A (recomendada):** uma tabela de referência com os exames da sepse e o LOINC de cada analito, conferida no LOINC oficial (Regenstrief) antes de entrar: hemograma (plaquetas, leucócitos), creatinina, bilirrubina total, gasometria arterial (PaO₂), lactato, PCR e hemocultura.
  - Na implantação, o gestor aplica a tabela ao catálogo da unidade com um clique e confere.
  - O sistema continua sem deduzir LOINC sozinho (1a da Fase 5C): a tabela é sugestão conferida, não dedução.
- **B:** cada implantação preenche à mão.

**L3. Qualidade do número e da hora**
- **A (recomendada):**
  - Ler o número como o laboratório manda: separador de milhar, vírgula decimal e o sinal ("<" e ">") guardado à parte. Usar a unidade codificada (UCUM) quando vier no FHIR.
  - O SOFA do SP1 passa a usar a hora da coleta (do `Specimen` ou da marcação da enfermagem) e, sem ela, a da liberação.
  - Fica um teste com laudos de exemplo de cada formato.
- **B:** manter como está.

**L4. Laudo sem pedido**
- **A (recomendada):** continuar recusando (5a). O painel de integrações passa a mostrar quantos laudos foram recusados por falta de pedido, por semana. Se o número for alto no parceiro, a decisão volta.
- **B:** aceitar como "exame externo" (como o U12 da UBS), ligado ao atendimento aberto do paciente.

**L5. Kit de integração para o fornecedor do laboratório**
- **A (recomendada):** um documento para o fornecedor, com:
  - a porta e a chave de teste;
  - exemplos em JSON de cada mensagem (pedido, coleta, laudo final, corrigido e cancelado, crítico, com PDF);
  - a lista dos exames da sepse com o LOINC;
  - um roteiro de homologação na nossa homologação, em que cada item vira uma evidência, antes da chave de produção.
  - O simulador já cobre o nosso lado.
- **B:** fazer o kit só quando houver parceiro.

## Plano depois das decisões (com L1–L5 = A)

1. **Banco** (migration expand, com rollback):
   - tabela de referência LOINC dos exames da sepse e a função que a aplica ao catálogo da unidade (gestor);
   - leitura do número com milhar, vírgula e sinal;
   - contagem de laudos recusados por falta de pedido;
   - SOFA do SP1 com a hora da coleta;
   - teste em `supabase/tests`.
2. **Tela:**
   - botão "Aplicar exames da sepse" no catálogo de exames do gestor;
   - recusas por falta de pedido em Integrações.
3. **Documentos:**
   - kit de integração do laboratório (`docs/api/LIS-KIT-INTEGRACAO.md`) com os exemplos e o roteiro de homologação;
   - tabela LOINC com a fonte e a data da conferência.
4. CI, homologação (com o simulador) e o seu "ok produção".

**Riscos:**
- **LOINC errado** leva ao analito errado no SOFA. Por isso a tabela é conferida na fonte, e o gestor confere ao aplicar.
- **O parceiro pode não ter FHIR nem HL7 v2.** Nesse caso, o custo do tradutor vai para a proposta comercial do parceiro.
- **Contrato e acesso ao laboratório são seus.** O tradutor HL7, se for preciso, só começa depois.
