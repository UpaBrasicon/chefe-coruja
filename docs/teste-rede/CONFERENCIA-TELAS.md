# Conferência das telas novas na homologação (07/11/2026)

A conferência foi feita no Chrome, em `homolog.chefecoruja.com.br` (commit `a933d24e`), com as contas de teste F5. Nenhum erro apareceu no console.

## Preparação
- **Rosa:** `scripts/e2e/92_conferencia_telas.sql` deixou "Rosa Teste Arquivo" esperando o médico no PS da UPA F5. Ela já tinha 3 atendimentos encerrados. A recepção abriu a ficha, e a enfermeira chamou e classificou (amarelo, escolha da enfermeira de teste).
- **Dini:** `scripts/e2e/93_conferencia_dini.sql` moveu o plantão de agora do `enfermeiro.hospital.f5` da Porta do Hospital para a Clínica Médica, onde está o "RN de Joana A06 Teste". A escala não aceita dois setores no mesmo horário. Depois da conferência, o plantão voltou para a porta.

## Resultado

| Tela | PR | Conta | Resultado |
|---|---|---|---|
| CID sugerido | #475 | `medico.upa.f5` | Ok. "Pneumonia comunitaria" sugeriu J18.9, J12.9, J18.1, P23.9 e J15.9. O clique preenche o campo CID. |
| Histórico encerrado | #478 | `medico.upa.f5` | Ok. Mostra 3 atendimentos encerrados com data, setor, médico, cor, CID e desfecho, sem texto clínico. "Ver detalhe" fica liberado por tempo. |
| Prontuário completo | #477 | `medico.upa.f5` | Ok, conforme a direção A. O atendimento em curso fica no topo, os sinais vitais aparecem crus, os atendimentos antigos abrem com o SOAP, a ficha fica à esquerda e há navegação por ano. |
| Observações que você abriu | #482 | `medico.upa.f5` | Ok. Rosa apareceu depois do desfecho observação. "Encerrar observação" com alta médica e CID J18.9 funcionou. No banco, o autor do desfecho, do encerramento e da alta é a conta do médico (`...08`). |
| Dini | #476 | `enfermeiro.hospital.f5` | Ok. A lista mostra "Dini de hoje pendente" e o cartão traz os 11 indicadores, com as fontes. Depois de registrar, aparece "Hoje: 11 · Cuidados mínimos (11 a 17) (Enfermeira do Hospital F5, 07/11, 12:18)", com o aviso dos menores de 6 anos, e a lista passa a mostrar "Dini 11". |

## Achados (P3, nenhum bloqueia o merge)
1. **CID sugerido sem filtro de idade.** Para uma paciente de 68 anos, a lista ofereceu P23.9 (pneumonia congênita, código perinatal).
2. **Central do Plantonista.** Diz "ninguém em observação no seu acesso" enquanto o médico tem observações que abriu pela porta.
3. **Encerramento da observação.** Rosa, encerrada por "Observações que você abriu", não aparece em "Finalizados no plantão", porque essa lista é só dos setores da escala.
4. **Avisos.** 39 avisos ficam empilhados no topo da Central do Plantonista, sem limite nem botão de fechar todos. São sobras dos testes, mas um plantão movimentado chega lá.
5. **Ambiente.** A "Gestante A01 Teste" segue em observação há quase 18 horas (OA-01), sobra do A01.
