---
name: update-harness
description: Atualiza o harness-phd, suas skills, o ship-it e os componentes instalados do Vibe Coding Toolkit de Matheus Gomes em um projeto existente.
metadata:
  source: https://github.com/Pedro-phd/harness-phd/tree/main/skills/update-harness
---

# Atualizar o harness do projeto

Execute a manutenção, não apenas um diagnóstico. Use a pasta informada pelo usuário ou a raiz do projeto atual. No Codex/T3 a chamada é `$update-harness [pasta]`; no Claude Code, `/update-harness [pasta]`.

## 1. Identificar o projeto e registrar o ponto de partida

- Leia as instruções locais, `.harness/state.md`, os locks de `.harness/`, os locks de skills existentes e `docs/setup.md` ou seu equivalente. Identifique versões, origens, escopos e adaptações já adotadas. Não use a pasta da própria skill como projeto de destino.
- Se o destino for o repositório fonte harness-phd, ship-it ou vibe-coding-toolkit, peça a pasta do projeto consumidor. Se não houver evidência de instalação do harness, explique que este comando é manutenção e peça o destino correto ou autorização para o primeiro setup.
- Registre o estado inicial do Git sem exigir árvore limpa e sem descartar mudanças existentes. Não faça commit, push nem publique nada. Compare arquivos gerenciados com a revisão anteriormente instalada quando disponível; propriedade no lock não prova ausência de customizações.
- Salve uma cópia dos arquivos que serão substituídos fora do repositório, numa pasta temporária persistente para esta execução, incluindo os locks. Não copie credenciais para o projeto. Registre o caminho de recuperação em `.harness/updates.md`.
- Crie ou retome uma entrada nesse arquivo com data, projeto, origem/revisão anterior e nova, componentes, status, evidências e pendências. Mantenha o histórico. Ao retomar, confira arquivos e versões reais antes de pular trabalho.

### Workspace com vários projetos

Se `.harness/state.md` registrar `Layout: workspace`, siga também `docs/workspace.md` do snapshot do harness:

- O backup da raiz é obrigatório, porque ela não é versionada. Inclua `.harness/`, `CLAUDE.md`, `AGENTS.md` e as skills gerenciadas.
- Registre o estado do Git de cada subprojeto, não da raiz. Subprojeto sem git entra no backup como os arquivos da raiz.
- O toolkit é mantido por subprojeto, dentro da pasta de cada um. A instalação do ship-it, os módulos, as skills próprias e o `.harness/WORKSPACE.md` são mantidos uma vez, na raiz. A configuração do ship-it de cada subprojeto (`docs/agents/`) só é reconciliada se a nova versão exigir.
- Confira a lista de subprojetos. Uma subpasta de projeto nova ou removida não muda o layout sozinha: mostre a diferença ao usuário. Subprojeto novo aprovado precisa das etapas 1 e 2; ofereça rodá-las em vez de fazer isso como parte da atualização.

## 2. Obter as fontes atuais uma vez

| Componente | Origem |
|---|---|
| harness-phd | https://github.com/Pedro-phd/harness-phd |
| ship-it | https://github.com/samsantosb/ship-it |
| Vibe Coding Toolkit | https://github.com/soumatheusgomes/vibe-coding-toolkit |

Obtenha snapshots das branches padrão em diretórios temporários fora do projeto e registre o SHA completo de cada um. Leia os arquivos desses snapshots durante toda a execução, resolvendo links relativos contra a mesma revisão. Não misture versões de `main` entre etapas. Use outras origens somente se o projeto registrar explicitamente um fork escolhido pelo usuário.

Não altere checkouts de origem com mudanças locais, não troque branches do usuário e não use reset forçado. Para a instalação compartilhada em `~/.ship-it`, atualize somente por fast-forward depois de conferir origem, branch e modificações locais. Se houver divergência, registre o bloqueio sem sobrescrever a instalação; outras origens independentes podem continuar. Não regenere skills do ship-it a partir de uma versão que não foi efetivamente instalada.

## 3. Atualizar os componentes instalados

Use esta ordem, com um único escritor para arquivos e locks compartilhados:

1. **Toolkit do Matheus Gomes:** leia [o procedimento de manutenção](references/toolkit.md) e execute-o com o snapshot obtido. Atualize também as skills e integrações que o toolkit instalou, a partir das origens reais registradas, no escopo original. Não basta baixar o repositório do toolkit ou registrar seu SHA.
2. **Ship-it:** siga somente a seção de instalação e atualização de `steps/02-ship-it.md` do snapshot do harness, incluindo as cópias adaptadas em `.agents/skills/`, o lock próprio e as verificações. No Claude Code, atualize também o plugin já instalado pelo mecanismo suportado. Preserve os arquivos compartilhados e confirme que os caminhos usados pelas skills existem. Não rode `groundwork`, `make-guidelines` ou o fluxo de produto só para atualizar; reconcilie configuração existente apenas se a nova versão exigir.
3. **Harness e suas skills:** siga `steps/03-modules.md` do mesmo snapshot, atualizando módulos, skills próprias, roteador, plugins aplicáveis e imports nos arquivos de instruções. Os módulos são distribuídos nas versões mantidas pelo harness; não substitua suas cópias por versões arbitrárias de terceiros que removam adaptações documentadas em `SOURCES.md`.
4. **A própria update-harness:** a etapa de skills próprias atualiza a cópia do projeto. Se a skill invocada estiver numa instalação global, atualize-a também a partir de `skills/update-harness/` do snapshot somente se sua origem for reconhecida como harness-phd (campo `metadata.source` e conteúdo instalado). Preserve recursos auxiliares e o escopo original; se a origem for desconhecida ou houver alterações locais, reconcilie antes de substituir. Se o snapshot publicado ainda não contiver esta skill ou a instalação de skills próprias, preserve a skill atual e registre a pendência de publicação; não a remova como se tivesse sido descontinuada. Termine a execução usando o procedimento já carregado, sem reiniciar recursivamente a skill.

As regras de preservação desta manutenção valem também quando uma etapa de instalação manda substituir arquivos do lock: una customizações locais com mudanças upstream, sem duplicar instruções. Se não houver revisão anterior para comparar, examine e reconcilie o conteúdo existente; não assuma que ele é descartável. Skills de outra origem com o mesmo nome são conflitos, não arquivos gerenciados. Não siga links simbólicos ao sobrescrever destinos.

Atualize apenas componentes pertencentes ao harness/toolkit e suas integrações já adotadas. Não execute um atualizador indiscriminado de todas as skills globais, dependências da aplicação ou pacotes da máquina. Novas skills previstas pelo catálogo podem entrar quando aplicáveis à stack existente; serviços, credenciais e mudanças de escopo exigem a decisão correspondente do usuário. Preserve decisões anteriores sobre itens opcionais.

## 4. Verificar e concluir

- Valide frontmatter e arquivos auxiliares de cada skill instalada e os destinos dos locks. Confirme os imports do roteador e que cada integração foi instalada no cliente correto, sem duplicação de hooks, skills ou servidores MCP.
- Nas cópias adaptadas do ship-it, confirme a raiz resolvida, os contratos compartilhados e as chamadas para a próxima skill no formato do cliente. Não execute skills que publicam, entregam tasks ou criam produtos como teste.
- Execute verificações específicas das integrações alteradas. Se mudou configuração de lint, tipos, testes ou build do projeto, execute os checks correspondentes e diferencie falhas anteriores das introduzidas. Não afirme descoberta ou funcionamento no cliente com base apenas na existência de arquivos; quando depender de nova sessão, registre como pendência.
- Atualize `.harness/state.md` e `docs/setup.md` sem apagar decisões ou marcar fases de setup não executadas como concluídas. Em `.harness/updates.md`, registre por componente as revisões efetivamente instaladas, o que mudou, verificações e bloqueios. Sem mudanças upstream, valide o estado existente e relate que já está atualizado.
- Relate o resultado no idioma do usuário: atualizados, já atuais e pendentes, com caminho do backup e necessidade de nova sessão quando houver. Só declare atualização completa quando todos os componentes aplicáveis tiverem sido verificados. Uma falha parcial mantém pendente aquele componente; continue o trabalho independente e não repita indefinidamente a mesma operação que falhou.
