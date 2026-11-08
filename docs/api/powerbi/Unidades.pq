// Unidades liberadas na chave. As outras consultas buscam unidade por unidade.
let
    Resposta = Json.Document(Web.Contents(CorujaBase, [
        RelativePath = "v1/unidades",
        Headers = [Authorization = "Bearer " & CorujaChave, Accept = "application/json"]
    ])),
    Tabela = Table.FromRecords(Resposta[dados], {"id", "nome", "cnes", "municipio", "uf"}, MissingField.UseNull),
    Tipos = Table.TransformColumnTypes(Tabela, {{"id", type text}, {"nome", type text}, {"cnes", type text}, {"municipio", type text}, {"uf", type text}})
in
    Tipos
