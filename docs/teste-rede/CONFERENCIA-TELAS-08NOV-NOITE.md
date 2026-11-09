# Conferência das telas dos itens 13, 16, 17 e 4 na homologação (08/11/2026, noite)

A conferência foi feita pelo Chrome do RT, em homolog.chefecoruja.com.br. O RT entrou em cada conta, e eu operei a tela. A branch `homolog` já estava publicada com o master de 08/11.

## Resultado
| Item | Tela | Conta | Resultado |
|---|---|---|---|
| 16 (#501) | Internação da enfermagem: leito reservado com "Paciente chegou" | `enfermeiro.hospital.f5` | **Ok.** Detalhes abaixo. |
| 17 (#502) | "Observações que você abriu", botão "Alergias" | `medico.upa.f5` | **Ok.** O painel abriu com "Alergia não registrada". Látex moderada, registrada pela tela, mostrou "Alergia a Látex registrada". No banco, o autor é `medico.upa.f5`. |
| 4 (#489) | "Observações que você abriu", "Reavaliar" | `medico.upa.f5` | **Ok.** A reavaliação ficou marcada para as 23:30. No banco, a pendência de reavaliação tem autor `medico.upa.f5`, para as 23:30 (02:30 UTC). |
| 13 (#498) | Aceite da regulação: lista de leitos | `medico.hospital.f5` | **Ok.** Na nº 197, a lista trouxe só UTI-03 e OB-01 a OB-03, sem os leitos EST da porta. O aceite não foi confirmado. |

**Item 16, passo a passo:**
- Na UTI Adulto apareceu "Reservado · chega Chegada Enfermagem Teste, 65a, da UPA Fase 5 24h (regulação nº 196) · ainda não saiu da origem".
- A origem encerrou a observação por transferência (item 5). Na leitura seguinte, a linha passou a "saiu às 21:45".
- A confirmação mostrou "Alergias informadas pela origem: Dipirona". "Confirmar e internar" moveu o paciente para a lista de internados no UTI-02.
- No banco, a regulação ficou realizada, com a chegada por `enfermeiro.hospital.f5`. A internação veio de outra unidade, e a Dipirona foi copiada com a fonte "Informada pela origem, regulação nº 196".

## O que não foi visto
- **Balão do aviso de saída (item 16):** dura uns 5 s, e a captura veio depois que ele sumiu. A leitura seguinte foi feita: a linha atualizou a hora da saída.
- **Durante a confirmação da chegada:** a linha reservada ficou uns 4 s na tela, com o botão apagado, até a lista recarregar. Não é erro, mas pode parecer que travou.

## Achado
- **Obstetrícia continua aparecendo** para o paciente homem na lista do aceite. É a decisão 2 pendente com o RT (filtro por sexo ou público).

## Homologação: o que mudou
- **Plantão da enfermeira:** o plantão de agora de `enfermeiro.hospital.f5` foi para a UTI Adulto durante a conferência e voltou para a Porta do Hospital.
- **Paciente novo:** "Observacao Tela Teste" (scripts 108 e 109).
- **Limpeza (script 110):**
  - o pedido nº 197 foi cancelado;
  - "Observacao Tela Teste" teve alta médica, com o CID do próprio SOAP (R10.4), pela conta que abriu a observação;
  - a observação da "Gestante A01 Teste" (OA-01, aberta desde 06/11) foi encerrada por transferência para o Hospital F5, onde ela já está internada como "Gestante A01 Teste B".
  - A UPA F5 ficou sem observação aberta.
- **Ficaram de propósito, como registro dos fluxos testados:**
  - internados no Hospital F5: Gestante A01 Teste B, Joaquim (B03), RN de Joana (A06), Rosa, Tela Chegada Teste e Chegada Enfermagem Teste;
  - Carlos F5 Pneumonia, internado na UPA F5 (fixture da Fase 5, de 03/11).
