# Roteiro da demo — evidência

Backlog comercial, item 1. Decisões do RT em 15/11/2026: D1 a D6 = A (`docs/comercial/DEMO-ROTEIRO-DIAGNOSTICO.md`, #740).

## Base na homologação (15/11/2026)

- `scripts/demo/02_plantao_agora.sql` rodou às 07:2x: 2 aguardando triagem, 5 aguardando médico, 2 em atendimento, 1 em reavaliação, 4 altas, 8 de 11 leitos ocupados.
- `scripts/demo/03_acesso_conta.sql`, agora com recepção e enfermeiro, rodou duas vezes seguidas sem erro para a conta @chefecoruja.com.br da homologação. Rodou também para a conta de teste `gestor.ubs.f5`, com que o RT entrou no Chrome para a conferência. As duas ficaram com gestor, plantonista, recepção e enfermeiro, e na escala de hoje do Pronto Socorro.

## Conferência no Chrome (15/11/2026, 07:29 a 07:40)

Feita por mim, com a conta `gestor.ubs.f5` já logada pelo RT. Paciente fictício: José Demonstração da Silva.

| Passo | Resultado |
|---|---|
| Painel | 73%, 8 de 11 leitos, 8 em plantão, auditoria de check-in |
| Porta | Gargalo "Aguardando médico", 6 cartões, por cor, 15 pacientes |
| Check-in | Tela "Faça o check-in para entrar" com 30 min de atraso; duas recusas por distância; justificativa registrada às 07:30 |
| Nova ficha | Prontuário criado; prioridade 60+ automática; entrou na fila da triagem às 07:31 |
| Triagem | Sala Triagem 1, chamada, Queixas respiratórias, Amarelo; registrado às 07:32 |
| Atendimento | NEWS2 6 na tela; CIDs de referência ao digitar "Pneumonia"; J18.9 registrado às 07:33 |
| Prescrição | Aviso de alergia não registrada; medicamento pede o peso antes. Para não inventar dose, conferi com um item de cuidado ("Cabeceira elevada"), prescrito às 07:33 |
| Checagem | Item "Feito" com data, hora e nome às 07:34 |
| Desfecho | Alta médica com o CID do atendimento e a lista "Antes de confirmar"; alta às 07:34 |
| Observação (gestor) | 6 pacientes, coluna "Prazo de 6 h" |
| Painel, Divergências | O check-in com atraso, fora do raio e a justificativa |
| "Perguntar" do gestor | Respondeu com a ocupação e a média dos censos, sem nome de paciente |
| Desvio A, "Perguntar à IA" | "noradrenalina pode correr em acesso periférico no adulto?": diretriz alemã 2025, manual de 2022 ao lado e fontes |
| Desvio B, Contas do atendimento | 24 contas abertas, com as pendências |
| Desvio C, UBS Fase 5 | Regulação com pedidos, prazos e mapa de vagas da rede; Hiperdia com C5 e C4 |

Os tempos acima são da conferência automática. O tempo de 15 minutos sai do ensaio do RT.

## Achados

1. **O nome da conta aparece na tela** como autor da classificação, da prescrição e da checagem, e na auditoria de check-in. A conta @chefecoruja.com.br da homologação se chama "Teste Homologação", e a de teste, "Gestor UBS F5".
2. **Observação com cara de abandono:** os 6 pacientes do `02` aparecem como "Não atendido · aguardando primeiro atendimento há 5 h". O `02` põe o paciente na observação, mas ninguém da equipe fictícia o atende lá.
3. **Rede de demonstração sem Central de Regulação:** a tela Regulação da Jardim Primavera diz "A rede ainda não tem Central de Regulação". O desvio de regulação foi para a UBS Fase 5, como a UBS (D3 = A).
4. **IA:** a pergunta "pneumonia adquirida na comunidade no adulto: quando internar?" respondeu que os trechos não trazem o ponto de corte. O roteiro usa a pergunta da noradrenalina. No "Perguntar" do gestor, a pergunta sobre "7 dias" respondeu com a média de 30 dias.
5. **Roteiro de 07/10 desatualizado:** ele escalava a mesma pessoa em três setores ao mesmo tempo, o que a regra de escala sem sobreposição recusa hoje; e avisava para não recarregar a triagem, o que já não vale.
6. **Escala de duas contas:** com o `03` rodado para duas contas, a que não apresenta aparece como "sem check-in" nas divergências do Painel.

## Decisões do RT sobre os achados (15/11/2026: "Todas A")

1. A conta @chefecoruja.com.br da homologação foi renomeada de "Teste Homologação" para **"Equipe Chefe Coruja"** e é a conta da demo.
2. O `02` passou a gravar o primeiro atendimento de cada paciente da observação. Rodado de novo: os 6 pacientes da observação têm o evento de atendimento, e a porta segue com 8 de 11 leitos ocupados.
6. A conta de teste `gestor.ubs.f5` saiu da Jardim Primavera: 3 plantões e 4 papéis desligados (`ativo = false`), sem apagar nada.

## Falta

- Ensaio cronometrado do RT com a conta "Equipe Chefe Coruja", até 15 minutos no fluxo principal: é a validação interna do item.
