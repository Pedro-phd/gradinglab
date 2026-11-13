# Guidelines — GradingLab

> Precedence: module GUIDELINES.md > codebase GUIDELINES.md > defaults. Guidelines tighten the pipeline's guardrails — they can never loosen them.

## Estilo e arquitetura
Use TypeScript estrito, alias @/* e presets ESLint. Mantenha arquivos de código em até 350 linhas. Use nomes que expressem o domínio; comente razões que não estejam claras no código. Introduza módulos de funcionalidades com fluxos reais; apresentação não importa o cliente do banco. Preserve Server Components por padrão.

## Bibliotecas e validação
Reutilize dependências existentes. Justifique novas dependências por necessidade concreta, compatibilidade e custo. Valide ambiente e entradas externas com Zod nas fronteiras. Rode pnpm check e testes apropriados à mudança. Não crie testes que apenas repitam a implementação.

## Erros e falhas
Mostre mensagens legíveis sem stack, valores secretos ou configuração interna. Falhe cedo em configuração inválida ao usar o subsistema, preservando o bootstrap sem credenciais. Preserve o original quando processamento/exportação falhar. Defina timeouts e retries limitados quando surgir I/O externo; não repita operações destrutivas sem idempotência.

## Logs e observabilidade
Use Pino apenas no servidor. Nunca registre mídia, presets completos, URLs de conexão, tokens ou dados pessoais. Use campos estruturados com contexto limitado; não coloque segredos em texto livre. Não há dashboards/alertas configurados; não alegue telemetria coletada. Instrumentação e orçamentos de latência serão definidos por fluxo real, sem valores fictícios.

## Dados e migrações
Use apenas src/db para inicializar Drizzle/pg, de forma lazy e limitada. Crie tabelas a partir de necessidades confirmadas. Prefira mudanças aditivas, gere e revise SQL e defina recuperação antes de aplicar em destino autorizado. Não execute migrações em build, imports ou requests. Use queries parametrizadas e valide autorização quando usuários forem introduzidos.

## Segurança e criticidade
Preserve arquivos originais e fidelidade de cor. Corrupção ou perda do original é crítica. Valide conteúdo, tamanho e limites dos arquivos antes de processar; não confie só na extensão. Não envie mídia a serviços sem uma política definida. Segredos ficam fora do Git e do cliente.

## Frontend
Use interface e mensagens em pt-BR, HTML semântico, labels, foco visível, teclado e contraste. Respeite reduced-motion. Não prometa suporte de formato ou fidelidade sem arquivos de referência e aplicativo alvo. Defina slugs de rota claros ao introduzir novas páginas, sem criar camada i18n antecipada.

## Entrega
Descreva em commits e PRs o problema, mudança e validação. Limite: 500 linhas de produção alteradas por PR, excluindo testes, fixtures e gerados. Não imponha convenção de branch ou hook Git adicional. Atualize o documento canônico afetado e relate verificações não executadas.

## Decisões adiadas
IaC, SDK de feature flags, serviço de métricas e budgets de latência não foram escolhidos nesta fase. Não introduza ferramentas apenas para preencher o setup. Reavalie essas decisões quando um fluxo exigir.
