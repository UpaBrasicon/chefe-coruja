// AIH de cada unidade da chave. Do paciente fica só o id.
let
    Registros = List.Combine(List.Transform(Unidades[id], (u) => CorujaLista("producao/aih", [unidade_id = u, limite = "100"]))),
    Planos = List.Transform(Registros, (r) => [
        id = r[id], unidade_id = r[unidade_id], paciente_id = try r[paciente][id] otherwise null,
        internacao_id = r[internacao_id], status = r[status], numero = r[numero], competencia = r[competencia],
        procedimento = r[procedimento], cid_principal = r[cid_principal], solicitada_em = r[solicitada_em], decidida_em = r[decidida_em]
    ]),
    Colunas = {"id", "unidade_id", "paciente_id", "internacao_id", "status", "numero", "competencia",
               "procedimento", "cid_principal", "solicitada_em", "decidida_em"},
    Tabela = Table.FromRecords(Planos, Colunas, MissingField.UseNull),
    Tipos = Table.TransformColumnTypes(Tabela, {
        {"id", type text}, {"unidade_id", type text}, {"paciente_id", type text}, {"internacao_id", type text},
        {"status", type text}, {"numero", type text}, {"competencia", type text}, {"procedimento", type text},
        {"cid_principal", type text}, {"solicitada_em", type datetimezone}, {"decidida_em", type datetimezone}})
in
    Tipos
