# Preparação local

Use Node 24 (`nvm use`) e pnpm 10.33.0. Instale com `pnpm install --frozen-lockfile`; execute `pnpm dev`. Rode `pnpm check` antes de entregar mudanças.

.env.example lista apenas nomes e valores de exemplo. Configure .env.local ignorado somente quando houver um banco autorizado. DATABASE_URL usa PostgreSQL; DATABASE_URL_UNPOOLED pode selecionar conexão direta de migração. Não conectar ou migrar para validar a base.

`pnpm db:generate` gera SQL quando existirem tabelas reais; `pnpm db:migrate` altera o destino e só deve rodar após revisar SQL e autorização. Comece pela próxima entrega em PRODUCT.md.
