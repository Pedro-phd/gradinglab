# GradingLab

## Problema e objetivo
Centralizar geração, aplicação e modificação de looks de cor em vídeos e fotos.

## Público e papéis
Hipótese reversível: fotógrafos, videomakers e criadores de conteúdo. Papéis e autenticação ainda não definidos.

## Fluxos e MVP
1. Importar mídia e um look compatível, validar e apresentar prévia antes/depois.
2. Ajustar o look e comparar o resultado com o original.
3. Gerar um look e exportar o arquivo compatível para reutilização.

Vídeo: LUT em `.cube`; foto: preset `.xmp` ou formato similar a definir. Vídeos e fotos são as mídias de entrada; `.cube` e `.xmp` são arquivos de transformação/ajustes, não contêineres de mídia. Não prometer conversão sem perdas entre LUT e preset: compatibilidade precisa ser validada na implementação.

## Requisitos
Preservar o original; validar tamanho, conteúdo e formato de arquivos na fronteira. Informar formatos incompatíveis e progresso de operações. Interface inicial em português, com teclado, foco visível e estados de erro claros.

## Restrições e decisões
Base web Next.js/App Router, TypeScript, pnpm. Drizzle/PostgreSQL preparado de forma lazy pelo padrão do toolkit, sem tabelas ou banco provisionado. O uso persistente para biblioteca de looks é hipótese a validar; não enviar mídia a serviços externos sem definir a política. Bootstrap não implementa o editor.

## Hipóteses e pendências
Processamento local no navegador é a primeira alternativa a avaliar. Geração manual, algorítmica ou por IA, formatos de mídia, perfis de cor, limites de tamanho/duração, suporte RAW e aplicativos alvo de XMP precisam ser definidos por etapa. Não há serviço, conta, cobrança ou login escolhido.

## Critérios de aceite do produto
Importação válida permite comparação antes/depois sem modificar o original. Exportações reabrem em aplicação alvo definida. Entrada inválida recebe erro legível. Fidelidade de cor e compatibilidade devem ser avaliadas com arquivos de referência antes de declarar suporte.

## Próxima entrega
Implementar importação e validação de `.cube` com testes de arquivos válidos, inválidos e limites, seguida de uma prévia em foto de referência. Exportação XMP exige definir o aplicativo alvo.

## Manutenção
Atualizar ao mudar escopo ou decisões. Evidências técnicas ficam em docs/setup.md.
