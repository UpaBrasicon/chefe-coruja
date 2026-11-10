# Lacuna 9: "atrasado" registrado na checagem (diagnóstico, 10/11/2026)

Trilha "Lacunas do Portão de 11/10/2026", item 9 (P2). O RT liberou esta
lacuna em paralelo com a lacuna 8. Origem: relatório do teste de ponta a ponta
de 11/10/2026, passo `9.atrasado`. Lá se viu que a checagem aceita feito, não
feito e recusado, e que o atraso só é calculado na fila, sem ficar registrado.

## 1. Fontes (conferidas em 10/11/2026)

- **Protocolo de segurança na prescrição, uso e administração de
  medicamentos** (Anexo 03 da Portaria MS 2.095/2013):
  - **Item IV, "hora certa":** antecipar ou atrasar a dose só com o
    consentimento do enfermeiro e do prescritor.
  - **Item VI, "registro certo":** registrar o horário da administração e as
    ocorrências, como adiamento, cancelamento, desabastecimento e recusa.
  - **Item 7.2:** registrar a omissão de dose e comunicá-la ao enfermeiro.
  - **Item 7.3.1:** traz um indicador, a taxa de erro de omissão.
  - **O protocolo não fixa tolerância em minutos.**
- **Resolução COFEN 514/2016, guia de registros, item 9.3:** quando o
  medicamento não for administrado, apontar o motivo.
- **Referências estrangeiras, sem força de norma no Brasil:** CMS S&C-12-05
  (2011) e ISMP (2011).
  - **Janelas:** ±30 min para medicamento tempo-crítico; ±1 h a ±2 h para os
    outros.
  - **Motivo:** registrar o motivo do atraso.
  - **Alerta:** avisar quando a dose passa do horário.
- **Conclusão:** nenhuma norma brasileira fixa a janela. Ela é uma decisão da
  unidade.
  - **Regra atual da unidade (RT, 30/09/2026):** 2 h de tolerância, numa
    janela de 12 h.
- Os textos extraídos estão no scratchpad da sessão (`atrasado-fontes.txt`).

## 2. Estado atual (master em 10/11/2026)

- **`checar`:** grava o "feito" sem olhar a hora. Não calcula atraso nem pede
  motivo; o motivo só é exigido no "não feito" e no "recusado".
- **Hora da administração:** é a hora do registro (`registrado_em`).
- **Três cálculos diferentes de "atrasado":** nenhum deles fica gravado.
  - O painel da enfermagem conta o horário vencido há mais de 2 h e há menos
    de 12 h.
  - O painel da porta marca atraso assim que o horário passa, sem nenhuma
    tolerância.
  - A grade do gestor conta a partir da prescrição, contra um alvo.
- **Onde o atraso fica gravado:** só como foto, na passagem de plantão da
  enfermagem.
- **O que não existe:** indicador, aviso ou registro de omissão.
- **Precedente:** a revisão da contenção (lacuna 4) já tem prazo calculado no
  servidor e aviso ao enfermeiro.

## 3. Pontos para o RT decidir (recomendação em A)

### A1. Janela de tolerância
- **A:** mantém a regra da unidade, 2 h para todos os medicamentos.
  - O painel da porta passa a usar a mesma janela.
  - **Item com intervalo menor que 2 h:** a janela é o próprio intervalo,
    para não engolir a dose seguinte.
- **B:** separar medicamento tempo-crítico (±30 min) dos outros, com
  marcação no catálogo.

### A2. Como a dose atrasada fica registrada
- **A:** continua "feito".
  - O servidor grava o atraso em minutos (hora do registro menos o horário
    previsto).
  - A dose fica marcada como "atrasada" quando passa da janela.
- **B:** uma situação nova, "feito com atraso".

### A3. Motivo do atraso
- **A:** é obrigatório quando a dose está atrasada. A pessoa escolhe numa
  lista, e "Outro" pede texto de 5 letras ou mais:
  - paciente fora do setor ou em exame;
  - falta do medicamento;
  - sem acesso venoso;
  - jejum ou procedimento;
  - aguardando a farmácia;
  - intercorrência;
  - outro.
- **B:** texto livre.

### A4. Dose não checada (omissão)
- **A:** o horário que passa de 12 h sem nenhuma checagem vira registro de
  omissão, gravado por um job.
  - O enfermeiro do setor recebe aviso, conforme o Anexo 03, item 7.2.
- **B:** continua só calculado.

### A5. Ciência do enfermeiro
- **A:** quem checou fica registrado.
  - O enfermeiro do setor recebe aviso de cada dose atrasada e dá ciência com
    um botão, o que atende ao consentimento do enfermeiro do Anexo 03, item
    IV.
  - O médico é avisado só das omissões.
- **B:** sem ciência.

### A6. Onde aparece
- **A:**
  - **Checagem:** selo "atrasado há X" no horário pendente e na dose feita
    com atraso.
  - **Painel da enfermagem:** a contagem já existe e passa a usar a regra
    nova.
  - **Gestor:** indicador com a taxa de doses atrasadas e a taxa de omissão
    (Anexo 03, 7.3.1), por mês e por setor.

### A7. Alertas
- **A:** aviso ao enfermeiro do setor quando a dose passa da janela sem
  checagem, um por horário, por um job a cada 15 min.

### A8. Cruzamento com as outras regras
- **A:**
  - item vencido (lacuna 6) continua só com "não feito";
  - a dupla checagem da alta vigilância continua valendo por 2 h;
  - a dose atrasada não empurra os próximos horários.

### A9. Exceções
- **A:** ficam de fora "Agora", "Se necessário", "Contínuo", infusão e
  contenção (que tem regra própria).

## 4. Fora do escopo
- Dose adiantada além das 2 h antes do horário: a checagem já não aceita.
- Classificar o que é medicamento tempo-crítico (ver A1, opção B).

## 5. Decisão do RT (10/11/2026)

"Sim": A em A1 a A9.
