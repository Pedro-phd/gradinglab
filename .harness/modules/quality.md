# Módulo quality

Ative sempre que a tarefa criar, alterar ou revisar código. As skills abaixo têm condições próprias: o módulo ativo não significa carregar todas.

| Skill | Quando usar |
|---|---|
| `property-based-testing` | O código tem uma regra que vale para todo um domínio de entradas: encode/decode, serialização, parsers, normalizadores, validadores, dinheiro e decimais, comparadores e ordenação, estruturas de dados. Também ao revisar testes de propriedade existentes. Não use para CRUD comum, testes E2E ou fuzzing de binário. Adicionar a biblioteca (`fast-check` em TypeScript) é dependência nova: pergunte antes. |
| `tdd` | Só quando o usuário pedir TDD, teste primeiro ou red-green-refactor. Não ative só porque a mudança precisa de verificação. |

`tdd` cita as skills `codebase-design` e `code-review`, que não fazem parte deste módulo. Se não estiverem instaladas, siga sem elas.
