# Módulo sec

Ative quando a tarefa mexer em código executável, configuração de runtime, dependências, autenticação, permissões ou fluxo de dados. Não ative para edição só de documentação.

| Skill | Quando usar |
|---|---|
| `secure-by-default` | Sempre que este módulo for ativado. Olha só o que mudou, quem consome e as decisões de segurança alcançáveis. Nunca vira auditoria do repositório inteiro. |
| `backend-security` | Junto com `secure-by-default` quando a mudança de backend cruza uma fronteira de confiança: endpoint novo ou alterado, dados expostos ou modificados, autorização, tenants, credenciais, pagamentos, uploads, webhooks, PII, ações destrutivas, requisições do servidor influenciadas pelo usuário. Refatoração interna que mantém fronteiras e contratos não ativa. |
| `differential-review` | Revisão de segurança de um PR, commit ou diff, quando pedida ou quando a mudança for crítica (auth, sessões, pagamentos, segredos, uploads, ações destrutivas). Instalada pelo toolkit na etapa 1, quando aplicável. |
| `security-audit` | Só quando o usuário pedir uma auditoria de segurança do repositório ou de uma pasta. Roda várias fases com subagentes e gera relatórios; nunca inicie por conta própria. |
| `insecure-defaults` | Só quando o usuário pedir auditoria de configurações inseguras (segredos de fallback, credenciais padrão, fail-open, debug ligado, crypto fraca). Plugin do Claude Code: `/insecure-defaults:audit [caminho]`. Em outros agentes não está disponível; diga isso em vez de simular. |
