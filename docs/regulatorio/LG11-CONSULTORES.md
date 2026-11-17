# LG11, decisão C1: lista curta de consultorias para o enquadramento SaMD

Pesquisa de 17/11/2026, só com informação pública dos sites das próprias empresas. Ninguém foi contatado e nenhum formulário foi preenchido. **O contato é do RT.**

**Achado geral:** nenhuma consultoria brasileira publica caso de SaMD já notificado ou registrado, nem página dedicada a software com IEC 62304. A evidência pública é fraca em quase todas. Por isso o critério 1 abaixo (pedir o caso por escrito) pesa mais que o site.

## Candidatas

| Nome e site | Local | Evidência pública de SaMD | Faz só o enquadramento? | Boas práticas e IEC 62304 |
|---|---|---|---|---|
| **Compliance Saúde** (compliancesaude.com.br) | não informado no site; telefone com DDD 41 (Paraná) | artigo que oferece "nota técnica de enquadramento regulatório", com classe de risco: [link](https://www.compliancesaude.com.br/post/software-como-dispositivo-m%C3%A9dico-samd-quando-seu-app-precisa-de-registro-na-anvisa) | **sim: é exatamente esse produto** | não; foco em compliance sanitário e LGPD, porte pequeno |
| **Emergo by UL** (emergobyul.com) | Brasília e São Paulo; multinacional | serviço de ciclo de vida de software IEC 62304: [link](https://www.emergobyul.com/services/software-development-lifecycle-regulatory-compliance-medical-devices) | sim, tem serviço avulso de classificação na ANVISA ([link](https://www.emergobyul.com/services/brazil-anvisa-medical-device-classification-consulting)), sem falar de software | sim (equipe global); provavelmente o mais caro |
| **Sobel Consult** (sobelconsult.com) | Valinhos/SP | fraca: software aparece só como tipo de dispositivo ([link](https://sobelconsult.com/our-solutions-brazil/)) | sim: classe de risco e via pela RDC 751 aparecem como serviço | ISO 13485, MDSAP e RDC 665 sim; IEC 62304 não citada |
| **Domo Salute** (domosalute.com.br) | Porto Alegre/RS | a página de registro cita SaMD nas classes I e II por notificação ([link](https://www.domosalute.com.br/how-we-help/anvisa-medical-device-registration-in-brazil/)) | não explícito | boas práticas sim; IEC 62304 não citada |
| *Jurídico-regulatório:* **Belisário Maciel Advogados** (belisario.com.br) | São Paulo/SP | página sobre registro de SaMD na ANVISA ([link](https://belisario.com.br/ia-direito-digital-saude/samd-registro-anvisa/)) | assessora notificação e registro; o enquadramento aparece nas perguntas frequentes | não (escritório de advocacia) |

**Ficaram de fora**, porque não mostram serviço de software médico:
- Vera Rosas: só um artigo de 2022.
- Passarini, Qualisys, Latini, M2Farma e SQR: trabalham com regulatório, sem citar software.
- Pure Global: só serve de detentor de registro para empresa estrangeira.
- Inovide: é consultoria de controle de infecção.

**Recomendação técnica:** pedir proposta a três, por exemplo Compliance Saúde, Sobel e Emergo. São três portes diferentes, e as três oferecem o enquadramento separado. Comparar pelos critérios abaixo.

## Critérios de escolha

1. **Caso real:** um SaMD que eles já notificaram ou registraram na ANVISA, informado por escrito com o número do processo.
2. **Parecer com preço fechado e prazo definido:** classe pela RDC 751/2022, notificação ou registro, sem obrigar a contratar o pacote completo (decisão C2).
3. **Domínio de software clínico:** escores, dose por peso, alertas e IA. Pedir a opinião deles sobre a justificativa de IA que a RDC 657 pede.
4. **Capacidade de continuar,** se o parecer apontar boas práticas (RDC 665/2022, ISO 13485), IEC 62304 e ISO 14971.
5. **Independência:** porte compatível com uma startup e sem conflito de interesse, por exemplo se a mesma empresa também vende o desenvolvimento do software.

## Fatos da norma que a pesquisa trouxe (o consultor confirma)

- **Notificação ou registro:** o manual da ANVISA ([manual GQUIP](https://www.gov.br/anvisa/pt-br/centraisdeconteudo/publicacoes/produtos-para-a-saude/manuais/manual-regularizacao-gquip)) diz que a notificação vale só para as Classes I e II, e o registro para as Classes III e IV.
- **Software de uso interno:** a RDC 657/2022 dispensa o software feito pelo próprio serviço de saúde para uso exclusivo dele. A dispensa não vale para software vendido a terceiros, como o nosso ([texto da RDC 657 em inglês, publicado pela ANVISA](https://www.gov.br/anvisa/pt-br/assuntos/produtosparasaude/temas-em-destaque/arquivos/2024/rdc-657-2022-en.pdf)).
- **Pedido de classificação à própria ANVISA:** pela pesquisa, a RDC 657 prevê um formulário para pedir a classificação direto à agência. Seria um caminho gratuito, em paralelo ao consultor. Vale perguntar ao consultor se compensa usar.
- **Revisão da norma:** a Agenda Regulatória 2026–2027 da ANVISA traz a "Revisão da RDC nº 657/2022", que deve incluir IA e aprendizado de máquina ([lista final](https://www.gov.br/anvisa/pt-br/assuntos/regulamentacao/agenda-regulatoria/agenda-2026-2027/arquivos/portal_lista_final_ar_2026-2027.pdf)). Não foi achada consulta pública aberta sobre o tema.
