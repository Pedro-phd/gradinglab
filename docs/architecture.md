# Arquitetura

Next.js App Router em src/app, alias @/*, TypeScript estrito e Tailwind. A tela gerada pelo scaffold ainda é provisória. A rota /editor abre um vídeo local e aplica uma LUT 3D com intensidade na prévia; não há endpoints de upload nem exportação. src/features/editor/cube-lut.ts é um módulo puro (sem UI nem WebGL) que valida e lê LUT 3D .cube, limitado a tamanhos 2–65 e ao limite de bytes MAX_CUBE_LUT_BYTES.

src/lib contém validação de ambiente, logger Pino server-only e cn. src/db/index.ts centraliza Drizzle/pg com pool lazy, reutilizável e limitado; src/db/schema começa sem entidades fictícias. drizzle.config.ts carrega ambiente apenas para a CLI. Nenhuma migração roda em build ou importação.

Camada de apresentação não acessa banco diretamente; módulos de funcionalidades serão introduzidos com o primeiro fluxo. Arquivos de mídia não devem ser registrados em logs. Hospedagem, processamento e armazenamento continuam decisões de implementação.

## Prévia com LUT (/editor)
O vídeo local continua sendo a fonte de quadros e áudio; um canvas WebGL2 (lut-renderer.ts) envia cada quadro a uma textura 2D e o shader amostra a LUT em textura 3D RGB16F e faz mix(base, look, intensidade). Nada volta para a CPU nem sai do aparelho. A matemática testável fica em lut-math.ts e lut-state.ts; sem WebGL2, a prévia mostra o vídeo sem look e avisa.

Limitações conhecidas: a interpolação é trilinear (filtro linear 3D), não tetraédrica como a especificação recomenda. Sem normalização, a "base" é o quadro como o navegador o decodifica; não há fidelidade de cor comprovada por arquivos de referência. A conversão de cor do navegador ao enviar o quadro à textura pode variar. Observado só no Chromium 1248 (Linux, SwiftShader): o quadro na textura é idêntico ao de drawImage do mesmo quadro; contra a decodificação do ffmpeg num vídeo sem tags de cor, amostras diferiram (causa não investigada). Safari/iPhone não foram testados.

## Comparação antes/depois
A mesma textura de quadro alimenta os dois lados: o shader recebe `uSplit` (fração 0..1 da largura) e `uShowOriginal`; à esquerda do divisor sai a base, à direita o look na intensidade escolhida. Não há dois vídeos nem dois canvases. A lógica pura (fração do ponteiro, passos de teclado, parâmetros por modo, rótulos, conversão da barra de tempo) fica em compare.ts; compare-overlay.tsx desenha a alça (role slider, ponteiro com captura e teclado) e os rótulos. O modo "Original" mostra o quadro sem conversão e difere de "Antes" quando o perfil é Apple Log (o "antes" é o quadro convertido). A caixa da imagem tem a proporção do vídeo, para a fração do divisor valer para a imagem inteira.
