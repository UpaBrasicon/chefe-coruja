# LG8: telemedicina, consentimento, registro e documento assinado (diagnóstico, 18/11/2026)

Trilha de obrigatórios legais e regulatórios, item LG8 (P2). Este documento não muda código nem banco e não é parecer jurídico.

**Base:**
- Res. CFM 2.314/2022, lida no PDF oficial em 29/09/2026 (`produto/docs/pesquisa/cfm-2314-teleinterconsulta.md`).
- Lei 14.510/2022: consentimento livre e informado do paciente e autonomia do médico.

## Como está hoje

O produto tem uma modalidade de telemedicina: a **teleinterconsulta** (art. 7º), entre o médico presencial e um médico remoto. Não tem teleconsulta direta com o paciente.

| Exigência | Artigo | Como está |
|---|---|---|
| Registro no prontuário | art. 3º, §1º | **feito**: a solicitação e o parecer viram documentos numerados no prontuário, um com autor solicitante e outro com autor teleconsultor |
| A conduta é do médico presencial | art. 7º, parágrafo único | **feito**: o parecer diz isso e o teleconsultor só lê o paciente da interconsulta que aceitou, até 24 h depois |
| Consentimento (TCLE) | art. 15 | **parcial**: o médico declara "obtido", "do representante legal" ou "emergência", mas não há termo com o texto que o paciente concorda nem forma de concordância registrada. O TCLE por modelo da unidade existe (`termos_modelos`), mas não está ligado à teleinterconsulta |
| Nome e CRM do médico | art. 13, a | **feito**, com um risco: `private.identificacao_medico` lê os campos antigos `crm`/`uf_crm`. Perfil que só tenha os novos (`registro_numero`/`registro_uf`) sai como "CRM não cadastrado". Hoje a produção tem 1 perfil, com os dois preenchidos |
| Endereço profissional do médico | art. 13, a | **falta** |
| Identificação do paciente, endereço e local do atendimento | art. 13, b | **parcial**: o local (unidade) vai, o endereço do paciente não |
| Data e hora | art. 13, c | **feito** (Brasília) |
| Assinatura ICP-Brasil | art. 13, d | **falta**: o LG7 já tem o assinador, mas a teleinterconsulta não está entre os tipos assinados |
| Indicação de que foi emitido por telemedicina | art. 13, e | **feito** ("Atendimento por telemedicina, modalidade teleinterconsulta") |
| Empresa com sede no Brasil, inscrita no CRM, com RT | art. 17 | **pendente**: é a mesma inscrição do LG7 (A6), que você vai conferir com o CRM |

Na produção: **0 teleinterconsultas**. Dá para mudar sem afetar ninguém.

## Decisões para o RT

**M1. Termo de consentimento (art. 15)**
- **A (recomendada):** um termo padrão de telemedicina da plataforma, no mesmo sistema de termos da unidade.
  - O texto diz que os dados serão compartilhados com o médico remoto, para quê, e que o paciente pode recusar.
  - Ao pedir a teleinterconsulta, o médico registra como o paciente ou o representante concordou: assinatura no papel ou concordância verbal, com uma testemunha da equipe. O termo vira documento no prontuário, ligado à solicitação.
  - Na emergência, segue dispensado, com a justificativa escrita.
- **B:** manter só a declaração de hoje.

**M2. O que o documento traz (art. 13)**
- **A (recomendada):** completar a solicitação e o parecer com:
  - CRM e UF pelos campos novos, com os antigos como reserva (corrige o risco acima);
  - endereço profissional do médico: o da unidade de cada um, e o do cadastro do teleconsultor quando ele não for de uma unidade;
  - endereço do paciente.
- **B:** só corrigir o CRM.

**M3. Assinatura ICP-Brasil (art. 13, d)**
- **A (recomendada):** incluir a solicitação e o parecer da teleinterconsulta entre os tipos que o assinador do LG7 assina, quando a assinatura for ligada. A Res. 2.314 pede ICP-Brasil para o que é emitido à distância, mesmo sendo entre médicos.
- **B:** deixar fora, como os atos internos (A1 do LG7).

**M4. Teleconsulta direta com o paciente**
- **A (recomendada):** fora do produto por agora. Fica registrada no BACKLOG como item futuro, que precisaria de vídeo, termo e prescrição à distância.
- **B:** construir agora.

## Plano depois das decisões

1. **Banco** (migration expand):
   - termo de telemedicina padrão;
   - a solicitação passa a exigir o termo ou a emergência justificada;
   - `identificacao_medico` lê os campos novos;
   - os documentos ganham os endereços.
   - Rollback testado e homologação primeiro.
2. **Tela:** na solicitação, o termo para ler ao paciente, a forma de concordância e a testemunha.
3. **LG7:** `teleinterconsulta` na lista de tipos assinados (app e assinador; o teste confere que as duas listas são iguais).
4. CI, homologação e o seu "ok produção".
