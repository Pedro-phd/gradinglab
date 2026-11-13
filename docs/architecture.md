# Arquitetura

Next.js App Router em src/app, alias @/*, TypeScript estrito e Tailwind. A tela gerada pelo scaffold ainda é provisória. Não há tela de editor, endpoints de upload ou processamento de mídia. src/features/editor/cube-lut.ts é um módulo puro (sem UI nem WebGL) que valida e lê LUT 3D .cube, limitado a tamanhos 2–65 e ao limite de bytes MAX_CUBE_LUT_BYTES.

src/lib contém validação de ambiente, logger Pino server-only e cn. src/db/index.ts centraliza Drizzle/pg com pool lazy, reutilizável e limitado; src/db/schema começa sem entidades fictícias. drizzle.config.ts carrega ambiente apenas para a CLI. Nenhuma migração roda em build ou importação.

Camada de apresentação não acessa banco diretamente; módulos de funcionalidades serão introduzidos com o primeiro fluxo. Arquivos de mídia não devem ser registrados em logs. Hospedagem, processamento e armazenamento continuam decisões de implementação.
