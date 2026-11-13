# Módulo back

Ative para comportamento de backend: endpoints, controllers, serviços, regras de negócio, persistência, integrações, jobs, workers, eventos. Não ative para trabalho só de infraestrutura (provisionamento, deploy, observabilidade) sem mudança de comportamento da aplicação.

Leia `backend-core` primeiro. Depois, só os especialistas e adaptadores que a parte tocada do código comprova. Num monorepo, uma dependência em outro pacote não ativa o adaptador.

| Skill | Quando usar |
|---|---|
| `backend-core` | Sempre que este módulo for ativado. |
| `backend-jobs-webhooks` | A mudança toca ou exige jobs, workers, agendamentos, eventos, webhooks, callbacks, reentrega ou retries. |
| `database-migrations` | Mudança de schema, índice, constraint, tipo, rename, backfill ou transformação de dados. Carregue junto o adaptador do banco. |
| `nestjs` | O pacote tocado usa NestJS (`@nestjs/core`, `nest-cli.json`). |
| `prisma-client-api` | O pacote tocado usa Prisma Client ou `schema.prisma`. |
| `postgres` | O pacote tocado usa PostgreSQL. Use esta em vez de `supabase-postgres-best-practices`, instalada pelo toolkit: esta já inclui o conteúdo dela. |
| `mysql` | O pacote tocado usa MySQL/InnoDB. |
| `redis` | O pacote tocado usa um cliente ou comandos Redis de fato. |

Drizzle (ORM padrão de projeto novo no toolkit) ainda não tem skill. Consulte a documentação atual pelo Context7 e siga as regras de lint de Drizzle que o toolkit instalou.
