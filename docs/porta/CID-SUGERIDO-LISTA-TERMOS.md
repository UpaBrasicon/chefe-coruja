# CID sugerido: lista inicial de termos para revisão do RT

Esta lista é o conteúdo da tabela `public.cid_termo`, carregada pela migration `20270302000001_cid_sugerido.sql`.

- **Decisão C4:** o RT revisa a lista antes de qualquer coisa ir para a produção.
- **Origem do texto:** a descrição de cada código foi lida da tabela `terminologia.cid10` (CID-10 DATASUS) da homologação em 06/11/2026.
- **Ordem:** a lista está ordenada por código.
- **Correções:** enquanto a migration não estiver na produção, a correção do RT entra nela mesma. Depois, entra numa migration nova.
- **Tipo:** só muda o texto do motivo que aparece no chip ("sigla PAC", "termo pneumonia").

| Termo | Tipo | CID | Descrição oficial |
|---|---|---|---|
| gastroenterite | popular | A09 | Diarréia e gastroenterite de origem infecciosa presumível |
| GECA | sigla | A09 | Diarréia e gastroenterite de origem infecciosa presumível |
| sepse | popular | A41.9 | Septicemia não especificada |
| erisipela | preferido | A46 | Erisipela |
| dengue | preferido | A90 | Dengue [dengue clássico] |
| diabetes tipo 1 | popular | E10.9 | Diabetes mellitus insulino-dependente - sem complicações |
| DM1 | sigla | E10.9 | Diabetes mellitus insulino-dependente - sem complicações |
| diabetes tipo 2 | popular | E11.9 | Diabetes mellitus não-insulino-dependente - sem complicações |
| DM2 | sigla | E11.9 | Diabetes mellitus não-insulino-dependente - sem complicações |
| CAD | sigla | E14.1 | Diabetes mellitus não especificado - com cetoacidose |
| cetoacidose diabética | preferido | E14.1 | Diabetes mellitus não especificado - com cetoacidose |
| diabetes | preferido | E14.9 | Diabetes mellitus não especificado - sem complicações |
| DM | sigla | E14.9 | Diabetes mellitus não especificado - sem complicações |
| hipoglicemia | preferido | E16.2 | Hipoglicemia não especificada |
| desidratação | popular | E86 | Depleção de volume |
| AIT | sigla | G45.9 | Isquemia cerebral transitória não especificada |
| otite média | preferido | H66.9 | Otite média não especificada |
| HAS | sigla | I10 | Hipertensão essencial (primária) |
| hipertensão arterial | popular | I10 | Hipertensão essencial (primária) |
| angina instável | preferido | I20.0 | Angina instável |
| IAM | sigla | I21.9 | Infarto agudo do miocárdio não especificado |
| infarto agudo do miocárdio | preferido | I21.9 | Infarto agudo do miocárdio não especificado |
| embolia pulmonar | preferido | I26.9 | Embolia pulmonar sem menção de cor pulmonale agudo |
| TEP | sigla | I26.9 | Embolia pulmonar sem menção de cor pulmonale agudo |
| fibrilação atrial | preferido | I48 | Flutter e fibrilação atrial |
| ICC | sigla | I50.9 | Insuficiência cardíaca não especificada |
| insuficiência cardíaca | preferido | I50.9 | Insuficiência cardíaca não especificada |
| AVC isquêmico | sigla | I63.9 | Infarto cerebral não especificado |
| acidente vascular cerebral | preferido | I64 | Acidente vascular cerebral, não especificado como hemorrágico ou isquêmico |
| AVC | sigla | I64 | Acidente vascular cerebral, não especificado como hemorrágico ou isquêmico |
| trombose venosa profunda | popular | I80.2 | Flebite e tromboflebite de outros vasos profundos dos membros inferiores |
| TVP | sigla | I80.2 | Flebite e tromboflebite de outros vasos profundos dos membros inferiores |
| resfriado | popular | J00 | Nasofaringite aguda [resfriado comum] |
| sinusite aguda | preferido | J01.9 | Sinusite aguda não especificada |
| faringite | preferido | J02.9 | Faringite aguda não especificada |
| amigdalite | preferido | J03.9 | Amigdalite aguda não especificada |
| IVAS | sigla | J06.9 | Infecção aguda das vias aéreas superiores não especificada |
| PAC | sigla | J18.9 | Pneumonia não especificada |
| pneumonia | preferido | J18.9 | Pneumonia não especificada |
| DPOC descompensada | sigla | J44.1 | Doença pulmonar obstrutiva crônica com exacerbação aguda não especificada |
| DPOC exacerbada | sigla | J44.1 | Doença pulmonar obstrutiva crônica com exacerbação aguda não especificada |
| DPOC | sigla | J44.9 | Doença pulmonar obstrutiva crônica não especificada |
| asma | preferido | J45.9 | Asma não especificada |
| crise asmática | popular | J45.9 | Asma não especificada |
| apendicite aguda | preferido | K35.9 | Apendicite aguda sem outra especificação |
| apendicite | preferido | K37 | Apendicite, sem outras especificações |
| colecistite aguda | preferido | K81.0 | Colecistite aguda |
| colecistite | preferido | K81.9 | Colecistite, sem outra especificação |
| pancreatite aguda | preferido | K85.9 | Pancreatite aguda, não especificada |
| hemorragia digestiva | popular | K92.2 | Hemorragia gastrointestinal, sem outra especificação |
| celulite | preferido | L03.9 | Celulite não especificada |
| lombalgia | popular | M54.5 | Dor lombar baixa |
| cólica nefrética | preferido | N23 | Cólica nefrética não especificada |
| cólica renal | popular | N23 | Cólica nefrética não especificada |
| cistite | preferido | N30.9 | Cistite, não especificada |
| infecção do trato urinário | preferido | N39.0 | Infecção do trato urinário de localização não especificada |
| infecção urinária | popular | N39.0 | Infecção do trato urinário de localização não especificada |
| ITU | sigla | N39.0 | Infecção do trato urinário de localização não especificada |
| dor torácica | preferido | R07.4 | Dor torácica, não especificada |
| abdome agudo | preferido | R10.0 | Abdome agudo |
| dor abdominal | preferido | R10.4 | Outras dores abdominais e as não especificadas |
| febre | preferido | R50.9 | Febre não especificada |
| cefaleia | preferido | R51 | Cefaléia |
| síncope | preferido | R55 | Síncope e colapso |
| convulsão febril | preferido | R56.0 | Convulsões febris |
| convulsão | popular | R56.8 | Outras convulsões e as não especificadas |
| crise convulsiva | popular | R56.8 | Outras convulsões e as não especificadas |
| anafilaxia | popular | T78.2 | Choque anafilático não especificado |
| choque anafilático | preferido | T78.2 | Choque anafilático não especificado |

## Pontos para o RT olhar com atenção

- **Códigos de agrupamento:** os termos abaixo levam a um código "não especificado" amplo.
  - desidratação → E86
  - sepse → A41.9
  - anafilaxia → T78.2
  - lombalgia → M54.5
  - TVP → I80.2
  - AVC isquêmico → I63.9
  - GECA → A09
- **AVC sem tipo** vai para I64, que é o código "não especificado como hemorrágico ou isquêmico". **AVC isquêmico** vai para I63.9.
- **DM sem tipo** vai para E14.9, e **CAD** vai para E14.1.
- **Busca de texto:** além da lista, a sugestão completa com códigos da busca de texto. Ela pode trazer códigos fora do contexto. Por exemplo, "pneumonia" traz P23.9 (pneumonia congênita) em quinto lugar. Esses chips aparecem com o motivo "texto".
- **Pediatria:** a lista não separa termos pediátricos. A convulsão febril (R56.0) é a única entrada típica da infância.

## Conferência na homologação (06/11/2026, usuário autenticado, transação desfeita)

| Texto da Avaliação | Sugestões (código e motivo) |
|---|---|
| PAC + DPOC exacerbada, TEP afastado | J18.9 (sigla PAC), J44.1 (sigla DPOC exacerbada). O TEP negado não aparece |
| pneumonia | J18.9 (termo), J18 (CIAP-2 R81), J12.9, J18.1, P23.9 (texto) |
| descartado IAM. ITU baixa | N39.0 (sigla ITU). O IAM negado não aparece |
| crise asmática em criança | J45.9 (termo crise asmática) |
| xyz sem sentido | nenhuma |
