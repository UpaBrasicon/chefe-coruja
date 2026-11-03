# Chamado ao DATASUS sobre a RNDS (5C-5.5a)

Texto para o RT abrir no WEB Atendimento do Ministério da Saúde (o e-mail `rnds@saude.gov.br` não é atendido desde 2022). Assunto sugerido: **"RNDS — dúvidas de integração (RAC, Sumário de Alta e MIRA) — sistema Chefe Coruja"**.

---

Prezados,

Somos o fornecedor do sistema Chefe Coruja, prontuário eletrônico usado em UPAs e prontos-atendimentos. Vamos pedir as credenciais de homologação do RAC e do Sumário de Alta e precisamos confirmar alguns pontos que os manuais e o guia público não respondem:

1. **Faixa de IP:** a faixa pode ter um único IP (inicial igual ao final)? A RNDS aceita IPv6?
2. **Troca de IP e de certificado:** como trocar a faixa de IP com a credencial ainda em homologação? E como trocar o certificado A1 quando ele vence?
3. **Várias unidades:** atendemos unidades sem vínculo entre si, todas com o mesmo IP de saída. Está correto pedir uma credencial por unidade (ou por grupo de unidades da mesma UF)?
4. **Cabeçalho `Authorization`:** ele aceita o CPF do profissional, já que o comunicado sobre identificação prioriza o CPF, ou só o CNS?
5. **RAC:** qual perfil do profissional vale, o `BRProfissional-1.0` com CPF ou o `BRLotacaoProfissional-1.0` com CNS e CNES? O token do EHR Auth é pedido por GET ou por POST? Os manuais divergem.
6. **Prazo:** qual o prazo de análise dos pedidos de homologação e de produção do RAC e do Sumário de Alta?
7. **Dados de teste:** no ambiente de homologação, podemos enviar pacientes fictícios? Há CPFs e CNS de teste que a RNDS aceita?
8. **Regulação assistencial (MIRA):** a Portaria GM/MS 6.656/2025 pede o envio dos dados de regulação pelo modelo MIRA. Existe portfólio de credencial para o MIRA no Portal de Serviços? Onde está o modelo de informação oficial (perfis e exemplos)? Usamos hoje o perfil `BRRegulacaoAssistencial` 1.0, publicado no Simplifier.
9. **Quem envia o MIRA:** a unidade solicitante (UPA) envia o MIRA das solicitações que ela abre, ou só a central de regulação envia?

Agradecemos o retorno.

---

As respostas entram em `CHECKLIST.md` (seções 5 e 8) e no `MIRA.md`.
