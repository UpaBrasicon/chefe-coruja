# Relatório de Impacto à Proteção de Dados (RIPD): parte da plataforma

> **Rascunho técnico para revisão do advogado.** Decisão do RT de 17/11/2026: R1 = A.
>
> **Para que serve:** o RIPD é do controlador, isto é, de cada cliente (LGPD, art. 5º, XVII, e art. 38). Este documento descreve a parte da plataforma. O cliente completa as seções marcadas **[CLIENTE]**.
>
> **Revisão:** a cada mudança grande e uma vez por ano.
>
> **Versão:** 17/11/2026.

## 1. Identificação

- **Controlador:** [CLIENTE]. Encarregado: [CLIENTE].
- **Operador:** Chefe Coruja. Encarregado: [NOME DO RT], `encarregado@chefecoruja.com.br`.
- **Sistema:** plataforma Chefe Coruja (SaaS), com prontuário, leitos, prescrição, escala, regulação, faturamento e apoio clínico.

## 2. Necessidade do relatório

O tratamento envolve dado pessoal sensível de saúde, em larga escala, com uso de tecnologia, inclusive apoio por inteligência artificial. Por isso o relatório é recomendado e pode ser pedido pela ANPD.

## 3. Descrição do tratamento

| Item | Descrição |
|---|---|
| Titulares | pacientes, acompanhantes e responsáveis; profissionais da unidade |
| Dados | identificação, CPF, CNS, contato; dados de saúde (registros clínicos, prescrição, exames, anexos, sinais vitais, classificação); dados de uso e auditoria |
| Finalidade | assistência ao paciente e gestão da unidade |
| Base legal | tutela da saúde (art. 11, II, "f"); obrigação legal (prontuário, art. 11, II, "a"); execução de contrato para os dados da equipe. **[CLIENTE confirma]** |
| Ciclo de vida | coleta na recepção, triagem e atendimento; uso pela equipe com acesso por papel e plantão; guarda de 20 anos em cofre cifrado; descarte seguro após o prazo |
| Quem acessa | equipe da unidade, por papel e vínculo; o Operador só para suporte e manutenção, com registro; suboperadores do Apêndice A do anexo de operador |
| Onde fica | Brasil (banco e cofre em São Paulo). Exceções no Apêndice A, cada uma com a sua base |
| Compartilhamento externo | RNDS e órgãos oficiais, por obrigação legal, quando ligados pelo cliente; integrações que o cliente configurar |

## 4. Riscos e controles

Escala: probabilidade (P) e impacto (I), de 1 a 3. O risco é P × I.

| # | Risco | P | I | Controles que existem | Risco residual | O que falta |
|---|---|---|---|---|---|---|
| 1 | Acesso indevido de alguém da própria equipe | 2 | 3 | RLS por papel, unidade e plantão; check-in; auditoria encadeada; revisão de acessos pelo gestor | 3 (médio) | revisão periódica de acessos registrada pelo cliente [CLIENTE] |
| 2 | Invasão de conta (senha vazada) | 2 | 3 | 2FA no servidor; sessão de 30 min sem uso; proteção no login (CAPTCHA, limites) | 2 (baixo) | — |
| 3 | Vazamento por falha da plataforma | 1 | 3 | trilha de segurança S0–S12 fechada; testes de acesso no CI; pentests; cabeçalhos e CSP | 3 (médio) | pentest anual |
| 4 | Dado de saúde fora do Brasil pela IA | 2 | 2 | gateway com desidentificação e NER; sem provedor de reserva; lembrete ao usuário; texto apagado em 30 dias; só a Edge chama o modelo | 4 (médio) | troca para o provedor em São Paulo (LG6, I1) |
| 5 | Regra clínica errada chegar ao usuário | 1 | 3 | fonte citada em cada ficha; testes; gate de aprovação antes de publicar (LG10) | 2 (baixo) | comitê clínico (LG13) |
| 6 | Perda de dados ou indisponibilidade | 2 | 2 | backup diário; guarda de 20 anos com Object Lock; cópia do servidor cifrada fora dele; teste de restauração; contingência em papel | 2 (baixo) | PITR ao sair do piloto |
| 7 | Retenção além do necessário | 2 | 1 | texto para a IA apagado em 30 dias; prazo de 20 anos só para o prontuário | 2 (baixo) | inventário com prazos (LG4) |
| 8 | Dado no aparelho do profissional (modo sem conexão) | 1 | 2 | fila cifrada (AES-256-GCM) com chave não exportável | 2 (baixo) | chave entregue pelo servidor depois do 2FA |
| 9 | Suboperador falhar ou mudar | 1 | 2 | contrato com cada um; aviso de 30 dias ao cliente; cópia cifrada sob a nossa chave | 2 (baixo) | — |
| 10 | Incidente sem resposta a tempo | 1 | 3 | plano de incidente (LG5) com prazos, modelos e simulado anual | 3 (médio) | primeiro simulado |

## 5. Medidas do cliente [CLIENTE]

- contas nominais e revogação no mesmo dia em que alguém sai;
- gestor da unidade nomeado;
- computadores com usuário próprio e bloqueio de tela;
- plano de contingência em papel;
- encarregado nomeado;
- aviso ao paciente sobre o uso do sistema (transparência, art. 9º).

## 6. Conclusão

[Advogado e CLIENTE.] Proposta técnica: os riscos residuais estão em nível baixo ou médio, com plano para cada um. O tratamento pode seguir com as medidas da seção 4 e as do cliente.
