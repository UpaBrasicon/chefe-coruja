<!-- Texto-base do roteiro de objeções (backlog comercial, item 6). Uso interno: o RT estuda antes da reunião; o cliente não recebe este documento. A versão editável fica no documento do Claude "Chefe Coruja — roteiro de objeções (uso interno)". -->

# Chefe Coruja — roteiro de objeções (uso interno)

Para estudar antes da reunião; o cliente não recebe este documento. Cada objeção traz como o cliente costuma falar, a resposta curta, a prova a mostrar e o que não prometer. Fatos sobre concorrentes vêm da matriz competitiva, com fonte pública e data: "não encontrado" quer dizer que não achamos em fonte pública, não que o concorrente não tenha.

## 1. "Já temos MV, Tasy ou TOTVS. Por que trocar?"

**Resposta.** Não pedimos para trocar tudo no primeiro dia: a proposta é um piloto de 90 dias numa UPA, medido com os números da própria unidade. A diferença está no plantão (classificação da enfermagem, CID sugerido pela hipótese, checagem com nome e hora), no apoio clínico (232 ferramentas revistas e IA que só responde com fonte) e na rede num sistema só (porta, leitos, regulação, UBS e faturamento SUS).

**Prova.** A demonstração de 15 minutos e a matriz competitiva.

| Critério (fonte pública, acesso em 15/11/2026) | O que a matriz mostra |
| --- | --- |
| IA clínica que cita a fonte | Não encontrada em MV, Tasy, TOTVS nem SisHOSP |
| Alerta de medicamento de alta vigilância | Não encontrado nos quatro |
| Certificação SBIS vigente | MV até 10/12/2026; Tasy até 20/05/2028; nós não temos |
| Faturamento SUS em documentação pública | TOTVS e SisHOSP sim; MV e Tasy parcial |
| Convênios (TISS), laboratório e PACS | Eles têm; nós não |

**Se a UBS usa o e-SUS APS.** É gratuito e cobre bem a atenção básica (pré-natal, listas de hipertensos e diabéticos). O piloto é na UPA; a UBS vem depois e não substitui o e-SUS no primeiro dia.

**Não prometer.** Que o concorrente "não tem" algo; comparação de preço.

## 2. "É seguro? E a LGPD?"

**Resposta.** Só entra quem está na escala, e cada um vê o que o seu papel permite. Todo acesso pede o segundo fator, ligado na produção desde 02/10/2026, e a tela bloqueia depois de 10 minutos parada. Toda ação fica registrada com o autor, numa trilha encadeada. Os dados ficam em São Paulo, com cópia diária cifrada guardada por 20 anos (Lei 13.787/2018), e a IA não recebe a identidade do paciente.

**Prova.** O documento de segurança e LGPD para a TI da secretaria e a seção de segurança da proposta de piloto. Houve pentest externo, e o sistema passa por revisões de segurança contínuas.

**Se perguntarem "há algo pendente?".** "Há melhorias em andamento, registradas e priorizadas."

**Não prometer.** "Sistema 100% seguro"; detalhes de auditorias e itens pendentes; certificação SBIS. O contrato e o termo de tratamento de dados (LGPD) são documentos à parte, com o jurídico.

## 3. "Tem assinatura digital ICP-Brasil?"

**Resposta.** Ainda não. Hoje cada registro tem autor (o login de quem fez), com nome e hora na trilha de auditoria. A assinatura ICP-Brasil está em construção; a prova de conceito depende das credenciais do fornecedor do certificado. Até ela entrar, a unidade imprime e assina à mão o que a regra exigir.

**Prova.** O registro com autor e hora numa tela da demo, e a impressão do documento.

**Não prometer.** Data para a assinatura digital.

## 4. "Envia para a RNDS?"

**Resposta.** O sistema já gera os registros no padrão da RNDS (FHIR) e tem o módulo de envio pronto, testado num simulador, com o certificado da unidade guardado cifrado. O envio real depende do que vem com a unidade piloto: o credenciamento da unidade e a credencial do DATASUS.

**Prova.** A tela de RNDS do administrador, com o envio do certificado.

**Não prometer.** Data de envio nem integração com o e-SUS.

## 5. "Tem certificação SBIS/CFM?"

**Resposta.** Não temos a certificação. Parte dos controles de segurança que ela cobra já está no sistema (segundo fator, trilha de auditoria, guarda por 20 anos), mas sem o selo.

**Prova.** O documento de segurança e LGPD.

**Não prometer.** Data de certificação nem "equivalente à SBIS".

## 6. "Fatura SUS? BPA, AIH, APAC?"

**Resposta.** Sim. O sistema monta as contas a partir do atendimento, gera BPA, AIH e APAC, mostra as pendências antes do fechamento e controla as glosas. Falta importar o retorno do SIA e do SIH, que depende do arquivo da secretaria.

**Prova.** As telas de faturamento na demo.

**Não prometer.** Faturamento de convênios (TISS), que não temos; nenhum percentual de recuperação de glosa.

## 7. "E se a internet cair?"

**Resposta.** O plantão não para. O sistema segue registrando no aparelho, guardado cifrado, e envia quando a conexão volta; o que chega fora do prazo vai para revisão antes de entrar no prontuário. Para queda longa, a unidade tem o plano de contingência em papel, com os formulários entregues na implantação.

**Prova.** O plano de contingência do playbook e o formulário de papel.

**Não prometer.** Que tudo funciona igual sem rede: a IA e a regulação dependem de conexão.

## 8. "E se o sistema cair?"

**Resposta.** A unidade segue no papel, pelo plano de contingência, e digita depois. Antes do primeiro paciente real, a recuperação ponto a ponto é ligada e uma restauração é testada: a perda máxima é de 5 minutos de dados, e o sistema volta em até 4 horas. Toda mudança passa antes pela homologação, e uma versão nova pode voltar à anterior.

**Prova.** A seção de continuidade da proposta e o registro do teste de restauração.

**Não prometer.** Disponibilidade de 100% nem volta em menos de 4 horas.

## 9. "A equipe não vai aprender" / "vai atrasar a porta"

**Resposta.** O treinamento é por papel, na homologação: recepção 1 hora, enfermagem 2, médico 2, farmácia 1 hora e meia. Há ensaio na véspera da virada, a equipe do Chefe Coruja fica presente em cada turno da virada, e a operação assistida dura 14 dias.

**Prova.** A demo (da recepção à alta em poucos cliques) e o plano de treinamento do playbook.

**Não prometer.** Impacto zero na primeira semana.

## 10. "E os nossos dados antigos?"

**Resposta.** A importação do sistema atual não entra no piloto; ela depende de um levantamento do formato e do acesso aos dados. Na recepção, o sistema busca o paciente antes de cadastrar, o que evita duplicidade desde o primeiro dia.

**Não prometer.** Migração completa nem prazo de importação.

## 11. "A IA vai decidir pelo médico?"

**Resposta.** Não. A IA responde dúvidas clínicas e só responde com a fonte; não recebe a identidade do paciente. O sistema não sugere dose, a decisão é sempre do profissional, e a cor da classificação é da enfermagem. As 232 ferramentas da Central foram revistas e aprovadas pelo responsável técnico.

**Prova.** "Pergunte à IA" na demo, com a fonte aparecendo.

**Não prometer.** Que a IA "diagnostica" ou acerta um percentual.

## 12. "Vocês são pequenos. E o suporte? E se a empresa acabar?"

**Resposta.** No piloto, o suporte é pelo canal de chamados do próprio sistema, com presença na virada e operação assistida; horário e prazo de resposta vão na proposta. Os dados ficam em São Paulo, com cópia diária cifrada, e a unidade exporta os próprios dados em formato estruturado quando quiser.

**Prova.** A exportação estruturada dos dados, protegida por um código novo do segundo fator.

**Não prometer.** Suporte 24 horas nem prazo de resposta antes de o RT definir.

## 13. "Quanto custa?"

**Resposta.** A proposta de piloto traz a implantação e a mensalidade, definidas para cada rede depois da demonstração.

**Não prometer.** Valor, desconto ou condição sem o RT.
