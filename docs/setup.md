# Setup — 2026-11-13

## Origem e ambiente
Toolkit 7ef68dd7b00ddfc5cd464458855e4ab66dd2128f, prompt 11, projeto novo. Harness consumido da main. Node 24.13.0 já instalado via nvm, pnpm 10.33.0; Node não estava no PATH inicial, nenhum runtime global foi instalado. Cliente T3/Codex, gpt-6.1-sol, esforço medium, autenticação nativa preservada.

Next 16.4.6, React 19.3.0, TypeScript 5.9.3, Tailwind 4.3.3, ESLint 9.39.5, Vitest 5.1.0, Drizzle ORM 0.45.4, drizzle-kit 0.31.11, pg 8.23.1, Zod 4.6.7 e Pino 10.4.0. Combinação oficial do create-next-app stable com peers aceitos; não houve migração de major para contornar avisos. ESLint 9 está deprecated no registry; manter combinação compatível até avaliar migração com eslint-config-next. Lockfile é a fonte exata.

## Validado
- create-next-app --help consultado e scaffold temporário incorporado preservando .harness; git inicializado em main sem commit/remoto.
- Context7 resolveu /vercel/next.js e respondeu sobre bootstrap e typegen; conexão existente reutilizada, nenhum MCP adicionado.
- pnpm check passou: lint, typecheck, lint tipado, autocheck de três regras, 3 arquivos / 8 testes e build estático sem credenciais.
- Lint tipado isolado: 3,85 s e pico 675596 KiB neste runner. Não é benchmark comparativo.
- pnpm db:generate: zero tabelas, nenhuma migração gerada; sem conexão real, sem mocks confundidos com banco real.
- Servidor de produção em porta 3187: HTTP 200 e título LUT Studio confirmados via requisição local. Nenhuma inspeção visual ou teste do editor, que ainda não existe.
- pnpm audit --prod: zero alertas. --dev: dois alertas moderados; minimatch GHSA-g3hv-75wg-m249 (negação de serviço por globparts amplification) GHSA-67mh-4wv8-2f99 em esbuild 0.18.20 transitivo do drizzle-kit. CLI stable mantém a dependência; sem downgrade forçado. O caminho serve do esbuild não foi executado pelo bootstrap. Acompanhar correção upstream.

## Skills e capacidades
Skills web oficiais do catálogo instaladas localmente em .agents/skills e skills-lock.json, incluindo deploy, composição, React, transições, guidelines de web/escrita, optimize e CLI tokens; find-skills, next-dev-loop, next-bundle-optimizer e PostgreSQL. React Native excluído: produto web. A instalação local torna o checkout reproduzível; existem nomes também disponíveis globalmente, sem modificar instalações globais. Confirmar precedência/descoberta na próxima sessão para evitar ambiguidade.

Next-dev-loop: Next/Turbopack compatíveis, mas agent-browser não está no PATH; preflight/browser não executados. Não instalado globalmente. Analyzer: next analyze e export --help suportados; auditoria de bundle não executada, nenhuma otimização alegada.

PostgreSQL: skill disponível e testes de pool com mocks; servidor/conta não definidos. gh-fix-ci não selecionada: sem remoto GitHub, CI ou PR. differential-review não selecionada nesta fundação sem fluxo sensível; prompt manual reutilizável em quality.md. shadcn não selecionado: sistema de UI ainda não escolhido. Sentry não selecionado: sem organização/projeto ou serviço escolhido.

RTK 0.43.0 funcional e usado explicitamente; Context7 funcional. Graphify instalado, mas esta versão não oferece `extract --code-only --no-cluster`; grafo inicial não gerado. Não houve instalação/upgrade global, automação ou chamada a LLM externo. Ponytail e Superpowers não constam do catálogo ativo do cliente: pendentes; acordos locais adotam menor solução completa e processo proporcional. Caveman disponível globalmente; comunicação concisa sem alterar modelo/provedor. Hooks não instalados.

## Memória e harness
Índice curto no AGENTS.md, carregado pelo mecanismo nativo do Codex/T3; fontes canônicas PRODUCT.md e docs/*.md, origem/validade e gatilhos de revisão no índice. Smoke nesta sessão: comandos descobertos em package.json e executados; descrição recuperada de PRODUCT.md e conferida com o pedido. Nova sessão/contexto limpo e casos comportamentais descartáveis do fixture: não executados; não inferidos do build.

Harness2: adaptação nativa documentada em quality.md, sem executar framework, benchmark ou cobrar API. Nenhuma falha de instrução observada que justifique comparação de candidato; instruções preservadas. Casos de pausa/retomada, isolamento multiagente, reaplicação dupla e revisão independente permanecem não executados.

## Fontes e manutenção
Guias docs/04-project-bootstrap.md, docs/06-project-defaults.md, docs/tools/README.md, 16–23, docs/07-harness-evaluation.md, prompt 15 e manifest lidos da mesma revisão do toolkit. Documentação oficial Next.js via Context7 em 2026-11-13; flags verificadas na CLI instalada. Revisões de prompts de segurança/Harness2 fixadas em quality.md. Atualizar documentos junto às mudanças de comportamento e repetir checks afetados.

## Ship-it — confirmação do usuário
Origem a92f85ce4ef18f3a5091982c186a264def52b556, sete skills locais adaptadas para Codex/T3 com licença e lock separado. Compartilhados dependem de ~/.ship-it; regenerar caminhos em outra máquina. O catálogo desta sessão já reconhece as sete skills, comprovando descoberta; execução de produto/tarefas não iniciada. Nenhum arquivo da origem foi alterado pela adaptação.

Groundwork: tracker Linear escolhido pelo usuário; workspace/equipe/projeto pendentes após busca sem resultados por LUT nas três conexões. Repo: git local main sem commit/remoto (detectado). Reviewer: self-review, watch off (padrão sem bot). Notifier: chat (padrão), sem notificação assíncrona fora desta conversa; não executar fleets sem notifier real. Idioma pt-BR e orçamento 500 confirmados. Configurações em docs/agents, guidelines aprovadas em GUIDELINES.md. IaC, flags, métricas/latência adiadas conforme aprovação; rodar $make-guidelines novamente depois das primeiras tasks. Integração e labels/estados só ficam validados após consultar a equipe selecionada.

### Escopo Linear resolvido
Usuário autorizou criar projeto na conexão Contabgo. Equipe única Contabgo (CON) detectada; projeto LUT Studio P-CON-2 criado em https://linear.app/workphd/project/lut-studio-ddc5f258e4f2 . O slug real do workspace retornado pela API é workphd; a conexão se chama Contabgo. Estados e labels consultados ao vivo e salvos, sem criar labels ou estados. In Review e labels de automação não existem; limites e resolução tardia documentados em docs/agents. Nenhuma tarefa foi publicada.

## Módulos do harness
Harness @ 85f4cd17f701d1187327d5b9d242ecd52db67e4b. Skills copiadas integralmente para .agents/skills e .claude/skills: {'back': 8, 'debug': 1, 'front': 14, 'quality': 2, 'sec': 3, 'core': 1}. Sem conflitos locais; locks separados de módulos, core e ship-it. ROUTER e cinco MODULEs instalados; imports no AGENTS.md e CLAUDE.md verificados. Plugin insecure-defaults e registro do ship-it no Claude não executados: sessão Codex/T3, recursos exclusivos do Claude indisponíveis neste agente.

Contexto estimado por caracteres/4: Codex/T3 735 tokens (AGENTS.md); Claude 1339 tokens (CLAUDE.md + AGENTS.md + ROUTER, cada arquivo contado uma vez). Três maiores arquivos Claude e seções Codex registrados em .harness/context-report.json. Agent skills e Guidelines estão duplicados por design nos índices AGENTS/CLAUDE; preservados conforme ship-it. Totais abaixo de 6000.

Manutenção: $update-harness no Codex/T3, /update-harness no Claude. Confirmar descoberta em nova sessão se necessário. Fluxo diário: $create-product → $create-tasks → $do-task → $watch-pr → $chaos-engineering; PR/watch dependem de remoto configurado. Rodar $make-guidelines novamente após primeiras tasks. Arquivos presentes não comprovam execução de todos os módulos.

## Nome e publicação — 2026-11-13
Nome escolhido pelo usuário: GradingLab, pacote e repositório gradinglab. GitHub público na conta Pedro-phd, criado via gh; projeto Linear mantém o mesmo identificador P-CON-2 e foi renomeado. Raiz local passa de lut-studio para gradinglab e título no T3 passa a GradingLab. Entradas anteriores preservam os nomes e limitações observados na data do bootstrap; esta seção registra a mudança. Nenhum grafo existente para atualizar.
