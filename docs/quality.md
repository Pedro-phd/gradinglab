# Qualidade

`pnpm check` executa lint, tipos de rotas/TypeScript, lint tipado, autocheck das regras, Vitest e build. Nenhum comando conecta ao banco. Testes do toolkit verificam validação sem exposição de valores, redação de logs e ciclo do pool com mocks; não comprovam PostgreSQL real ou processamento de mídia.

ESLint: presets oficiais Next/TypeScript, teto de 350 linhas, logger servidor, fronteira de dados e guards Drizzle. Lint tipado exige no-floating-promises/no-misused-promises. Auditar produção e desenvolvimento separadamente; não usar downgrades forçados.

## Revisão de segurança reutilizável
Leia e execute somente o bloco Prompt de https://github.com/soumatheusgomes/vibe-coding-toolkit/blob/7ef68dd7b00ddfc5cd464458855e4ab66dd2128f/docs/prompts/13-security-review.md para baseline ou diff preciso. Revisão é somente leitura; relatórios privados fora do repositório. Atualizações exigem revisar a nova revisão, preservando limites. O editor futuro precisa validar arquivos e limites de recursos antes do processamento.

## Harness2: adaptação nativa
Procedimento: https://github.com/soumatheusgomes/vibe-coding-toolkit/blob/7ef68dd7b00ddfc5cd464458855e4ab66dd2128f/docs/prompts/15-harness-improvement.md . Execute o bloco Prompt para uma falha observada do harness, com baseline e no máximo um candidato em cópias descartáveis, critérios idênticos e checks independentes. Sem falha observada, preserve as instruções. Não executa o framework Harness2, benchmarks ou APIs pagas.

Use os casos de docs/07-harness-evaluation.md da mesma revisão. Separe instalação, descoberta no cliente e execução real. Nova sessão, pausa/retomada e comportamento multiagente só contam quando observados. Não inferir esses resultados do build. Evidências em setup.md.
