# GradingLab

Antes de qualquer tarefa, leia e siga .harness/ROUTER.md.

Leia PRODUCT.md para escopo; docs/architecture.md para estrutura; docs/quality.md para checks; docs/setup.md para evidências. Este é o índice de memória carregado pelo AGENTS.md do Codex/T3. Consulte detalhes sob demanda e invalide decisões quando código, produto ou dependências mudarem. Fonte: descrição do usuário e toolkit; verificado em 2026-11-13.

## Comandos
`pnpm dev`, `pnpm lint`, `pnpm typecheck`, `pnpm lint:typed`, `pnpm lint:rules`, `pnpm test`, `pnpm build`, `pnpm check`. Node 24; pnpm 10.33.0. Prefixe comandos shell com rtk; use rtk proxy para comandos sem adaptador.

## Acordos
Entregue a menor solução completa, preserve mudanças locais, valide entradas nas fronteiras, use logger server-only sem segredos e banco lazy por src/db. Não invente integrações ou funcionalidades. Documente mudanças no arquivo responsável. Continue trabalho autorizado; pergunte apenas por informação indispensável. Não publique, crie serviços, mude permissões globais ou instale hooks Git como efeito do setup.

Use Context7: resolva a biblioteca antes de consultar documentação atual, por conceito e sem segredos. Aplique i-have-adhd em toda resposta; comunicação concisa em português. Consulte o grafo existente do projeto antes de concluir relações e confira no código; atualize após mudanças. Nunca altere provedor, modelo ou autenticação para ferramentas; delegue apenas quando solicitado ou exigido por workflow aplicável. Não habilite APIs pagas.

Skills locais ficam em .agents/skills e skills-lock.json; instalação não comprova descoberta em nova sessão ou execução. Sem duplicar configurações MCP já ativas. Detalhes e limitações dos componentes em docs/setup.md.

## Instruções geradas pelo Next.js

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Agent skills

This project is configured for the ship-it pipeline.
Role config lives in docs/agents/ (tracker, labels, reviewer, notifier, validation).
Skills must read it instead of asking. Learned project rules are written back there.
Conversation language: pt-BR (source of truth: docs/agents/language.md).

## Guidelines

- GUIDELINES.md

PRODUCT.md é a visão geral do produto. Cada nova feature entra por $create-product em docs/product/<slug>.md; preserve PRODUCT.md.
