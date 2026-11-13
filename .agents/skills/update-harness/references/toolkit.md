# Manutenção do Vibe Coding Toolkit

Use o snapshot de `soumatheusgomes/vibe-coding-toolkit` obtido pela skill principal. O toolkit fornece receitas, templates e catálogos; atualizar seu clone não atualiza o projeto consumidor.

Leia nesse snapshot:

- `docs/prompts/12-existing-project-setup.md`: reconciliação de projeto existente e verificações.
- `docs/tools/README.md`: catálogo atual e condições de aplicabilidade.
- `docs/01-installation.md`: métodos de instalação e distinção entre máquina e projeto.
- Os guias de `docs/tools/` correspondentes aos componentes realmente instalados, os templates aplicáveis e o manifesto de documentos, quando houver mudanças neles.

A solicitação é manutenção do harness. Use as instruções relevantes do prompt 12 nesse escopo; não execute automaticamente todo o setup, o bootstrap do prompt 11 ou a preparação da máquina do prompt 10. Não transforme a atualização em refactor da aplicação, troca de stack, ORM ou bundler, regeneração de `PRODUCT.md` ou nova entrevista de produto.

## Inventário e aplicação

1. Monte uma lista de componentes adotados usando `docs/setup.md`, configurações dos clientes, locks de skills e arquivos locais. Para cada um, determine origem, revisão/versão instalada, escopo, método de instalação, atualização proposta e verificação. Não trate um serviço remoto como pacote local atualizável.
2. Compare o catálogo atual com o inventário. Classifique cada item como atualizar, manter, novo aplicável, não aplicável ou bloqueado. Preserve equivalentes existentes e decisões de exclusão; uma skill nova compatível com o projeto pode ser instalada, mas adicionar serviço ou conta não é uma atualização automática.
3. Atualize skills pelos guias e origens atuais do catálogo. Descubra nomes pelo frontmatter em vez de fixar contagens. Preserve licenças, arquivos auxiliares e os locks do instalador adotado. Não substitua skills dos módulos do harness ou do ship-it: elas têm seus próprios responsáveis e serão atualizadas depois.
4. Reconcilie templates e instruções nos arquivos canônicos existentes, preservando conteúdo específico do projeto. Preserve os imports do roteador e as seções do ship-it. Não sobrescreva documentos preenchidos com templates crus.
5. Para plugins, hooks, CLIs ou MCPs já adotados, consulte o guia atual do cliente e o mecanismo pelo qual foram instalados; atualize quando houver versão disponível. Reutilize conexões e autenticação existentes. Não duplique instalações, altere o provedor/modelo da sessão ou introduza cobrança para concluir uma atualização.

Se um comando de atualização não estiver documentado ou faltar acesso, registre aquele componente como pendente com o motivo e prossiga nos independentes. Não declare o toolkit atualizado só porque o SHA de sua documentação foi registrado. Registre quais alterações chegaram ao projeto e quais integrações foram efetivamente verificadas.

Atualize um grafo existente se os arquivos por ele cobertos mudarem e o projeto usar Graphify. Se não houver grafo, não gere nem instale um durante esta manutenção sem pedido do usuário; registre a ausência como configuração opcional.
