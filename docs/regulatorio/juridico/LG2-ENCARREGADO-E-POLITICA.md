# LG2: encarregado e nova Política de Privacidade

> **Rascunho técnico para revisão do advogado.** Decisões do RT de 17/11/2026: E1 e E2 = A.
>
> **O site não muda** até o advogado revisar e o RT dar o ok. Hoje a política no ar está em `landing/app/privacidade/page.tsx`.

## 1. Termo de nomeação do encarregado

> [RAZÃO SOCIAL], CNPJ [ ], nomeia **[NOME COMPLETO DO RT]**, [CRM], como **Encarregado pelo Tratamento de Dados Pessoais**, nos termos do art. 41 da LGPD e da Resolução CD/ANPD 18/2024, a partir de [data].
>
> **Canal de contato:** `encarregado@chefecoruja.com.br`.
>
> **Atribuições:**
> - receber reclamações e comunicações dos titulares e da ANPD;
> - orientar a equipe sobre proteção de dados;
> - conduzir o plano de resposta a incidente;
> - apoiar os clientes controladores.
>
> [Local, data e assinaturas.]

## 2. Canal

O endereço `encarregado@chefecoruja.com.br` entrega na caixa `contatochefecoruja@gmail.com`, pelo roteamento de e-mail da Cloudflare, como já faz o `contato@`.

**Passo do RT** (painel da Cloudflare, cerca de 2 minutos):
1. Abra o domínio `chefecoruja.com.br`.
2. Vá em **Email → Email Routing → Routing rules → Create address**.
3. Em **Custom address**, escreva `encarregado`. Em **Action**, escolha **Send to an email**. Em **Destination**, `contatochefecoruja@gmail.com`.
4. Clique em **Save**.

Prazo de resposta ao titular: **15 dias** (art. 19, II).

## 3. Nova Política de Privacidade (texto proposto)

> ### Política de Privacidade do Chefe Coruja
>
> **1. Quem somos e qual é o nosso papel**
>
> O Chefe Coruja é uma plataforma de gestão em saúde para hospitais, UPAs, UBS e clínicas, com sede em Aparecida de Goiânia (GO).
> - **Dados dos pacientes:** quem decide é a unidade de saúde que nos contrata, que é a **controladora**. Nós somos **operadores** e tratamos esses dados só para prestar o serviço, segundo as instruções da unidade. Se você é paciente, fale primeiro com a unidade onde foi atendido.
> - **Nossos próprios dados:** somos **controladores** dos dados de cadastro e login dos profissionais na plataforma, dos contatos comerciais e dos dados do site.
>
> **2. Dados que tratamos**
>
> - **Como operadores:** identificação, documentos (CPF, CNS) e dados de saúde dos pacientes, que são dados pessoais sensíveis (LGPD, art. 5º, II), e dados de uso e auditoria.
> - **Como controladores:** nome, e-mail, telefone, unidade e função dos profissionais; dados de quem pede contato pelo site.
>
> **3. Bases legais**
>
> - **Dados de saúde:** a base é da unidade de saúde, em especial a tutela da saúde, em procedimento realizado por profissionais de saúde (art. 11, II, "f"), e a guarda do prontuário por obrigação legal (art. 11, II, "a").
> - **Dados dos profissionais e contatos:** execução de contrato (art. 7º, V) e legítimo interesse (art. 7º, IX), para segurança e suporte.
>
> **4. Para que usamos**
>
> Para operar a plataforma, manter a segurança e a trilha de auditoria, cumprir obrigações legais e atender os clientes. **Não vendemos dados e não usamos dados de pacientes para treinar inteligência artificial.**
>
> **5. Com quem compartilhamos**
>
> Com fornecedores essenciais (suboperadores), contratados com obrigação de proteção equivalente; a lista está [no link ou anexo]. Também com autoridades e sistemas oficiais (por exemplo, a RNDS), quando a lei exige e a unidade de saúde liga a integração.
>
> **6. Transferência para fora do Brasil**
>
> Os dados clínicos ficam no Brasil. Alguns serviços de apoio ficam fora do país, como o registro de erros técnicos sem dado de paciente (União Europeia) e o envio de e-mail do código de acesso (EUA), sempre com base no art. 33 da LGPD. A cópia de segurança do servidor vai **cifrada**, com chave que só nós temos.
>
> **7. Por quanto tempo**
>
> - **Prontuário:** 20 anos a partir do último registro (Lei 13.787/2018), em cofre cifrado; depois disso, descarte seguro.
> - **Texto enviado ao apoio por inteligência artificial:** apagado em 30 dias.
> - **Demais dados:** enquanto durar o contrato e pelo prazo legal.
>
> **8. Segurança**
>
> Controle de acesso por papel e plantão, segundo fator de autenticação, cifra em trânsito e em repouso, trilha de auditoria e plano de resposta a incidente. Nenhum sistema é 100% seguro. Em caso de incidente, avisamos a unidade de saúde e, quando couber, a ANPD e os titulares.
>
> **9. Seus direitos**
>
> Você pode pedir confirmação, acesso, correção, anonimização, portabilidade, eliminação e informação sobre compartilhamento (art. 18). Se o pedido for sobre um atendimento, a unidade de saúde responde, e nós ajudamos.
>
> **10. Encarregado**
>
> [NOME DO RT], `encarregado@chefecoruja.com.br`. Respondemos em até 15 dias.
>
> *Versão de [data].*
