# VibeDance — gestão de estúdios e companhias de dança

Plataforma web com três portais (ADM, Professor e Aluno) sobre uma única base PostgreSQL.
Toda operação de qualquer perfil é gravada no banco e propagada em tempo real (SSE) para os perfis impactados — sem dados mockados e sem cache local como fonte de verdade.

| Camada | Stack |
| :--- | :--- |
| Back-end | Java 17+, Spring Boot 3.4, Spring Security 6 (JWT stateless), Spring Data JPA |
| Banco | PostgreSQL (`database/db.sql` + `database/migracao_v2_overhaul.sql`) |
| Front-end | HTML5, CSS3 (design system próprio), JavaScript ES6+ em módulos nativos — sem build |
| Tempo real | Server-Sent Events (`/api/stream`) disparados após o COMMIT de cada transação |

---

## Como executar

### 1. Banco de dados

```bash
createdb vibedance_teste           # ou o nome configurado em application.properties
psql -U postgres -d vibedance_teste -f database/db.sql
psql -U postgres -d vibedance_teste -f database/migracao_v2_overhaul.sql
psql -U postgres -d vibedance_teste -f database/migracao_v3_cancelamento_checkout.sql
psql -U postgres -d vibedance_teste -f database/migracao_v4_solicitacoes_acesso.sql
psql -U postgres -d vibedance_teste -f database/migracao_v5_cobranca_individual.sql
```

A migração v3 (idempotente) cria `solicitacoes_cancelamento` — com índice único que permite só uma solicitação em análise por aluno — e adiciona `valor_base`, `parcelas` e `metodo_detalhe` em `pagamentos` para o checkout.

A migração v2 é idempotente e obrigatória: cria `auditoria_geral`, `diario_classe`, `reposicoes`, `checkins` e `notificacoes`, adiciona `presencas.status` (PRESENTE / FALTA / JUSTIFICADO), restringe o domínio a **@vibedance.com** e ressincroniza as sequences (os seeds usam IDs fixos).

### 2. Back-end + front-end (mesma origem)

```powershell
$env:DB_USER="postgres"; $env:DB_PASSWORD="sua_senha"; $env:JWT_SECRET="um-segredo-longo-e-aleatorio"
mvn clean spring-boot:run
```

Acesse `http://localhost:8080/`. O Maven copia `frontend/` para `static/`, então o Spring serve as telas e a API.

> Para editar o front sem reiniciar o back, rode `.\server.ps1` (porta 5500). O front detecta a porta e chama a API em `http://localhost:8080` (CORS liberado para 5500/8081 via `CORS_ORIGENS`).

### Contas de demonstração

| Perfil | E-mail | Senha |
| :--- | :--- | :--- |
| ADM | admin@vibedance.com | admin123 |
| Professor | prof.diego@vibedance.com · prof.camila@vibedance.com | prof123 |
| Aluno | aluno.juliana@vibedance.com · aluno.lucas@vibedance.com · aluno.mariana@vibedance.com · aluno.gabriel@vibedance.com | aluno123 |

---

## Regras de arquitetura

### Bloqueio de domínio `@vibedance.com` (4 camadas)
1. **Front-end** — validação ao vivo no login e nos formulários (`js/core/config.js`).
2. **Filtro JWT** (`FiltroAutenticacao`) — rejeita com 403 tokens de domínio externo ou contas suspensas.
3. **Interceptor MVC** (`DominioInstitucionalInterceptor`) — revalida o usuário antes de todo handler `/api/**`; serviços revalidam e-mails em criação/edição.
4. **Banco** — `CHECK` + trigger `fn_validar_dominio_vibedance`.

Tentativas bloqueadas e logins ficam no log de auditoria. O cadastro de contas é exclusivo do ADM (`/api/auth/registrar` e `/api/admin/usuarios`).

### Sincronização total (Single Source of Truth)
- `SincronizacaoEntityListener` está registrado em **todas** as entidades JPA: qualquer INSERT/UPDATE/DELETE (inclusive dos endpoints legados) gera um evento de domínio.
- `RealtimeHub` entrega o evento via SSE **somente após o COMMIT**, roteando para ADMs, para o aluno afetado, para o professor da turma ou para todos.
- O shell do front recarrega do banco a tela aberta quando o domínio do evento é relevante para ela (`dominios: [...]` de cada rota) e atualiza o sininho com notificações persistidas.
- O indicador "contagem de 8" no cabeçalho mostra o estado do canal e pulsa a cada sincronização.

### Tratamento de erros
- `GlobalExceptionHandler` (`@RestControllerAdvice`) converte toda exceção em `{ timestamp, status, codigo, erro, caminho, detalhes }`.
- Hierarquia `ApiException` (`RecursoNaoEncontrado`, `Conflito`, `RegraNegocio`, `AcessoNegado`).
- No front, `js/core/api.js` aplica interceptors de request/response: injeta o JWT, encerra a sessão em 401/403 de domínio ou conta suspensa e exibe toast para qualquer falha não tratada.

---

## Funcionalidades por perfil

**Cockpit ADM** (`/Admin`): KPIs de MRR, inadimplência, ocupação e retenção com gráficos; grade horária semanal interativa com detecção de conflito de sala/professor; financeiro com lote de mensalidades, baixa rápida, conferência de comprovantes e histórico; usuários e matrículas (criar/editar/suspender/excluir, vínculo em várias turmas); reposições; comunicados oficiais; salas e modalidades; log de auditoria.

**Workspace do Professor** (`/Professor`): "Hoje no estúdio" com contagem regressiva e linha do tempo; chamada de 1 clique (Presente/Falta/Justificado) com taxa ao vivo; turmas com frequência por aluno e avaliações técnicas; diário de classe e repertório; aprovação de reposições e aulas experimentais; comunicados por turma.

**Portal do Aluno** (`/Aluno`): passaporte digital (status da matrícula, situação financeira, próxima aula, frequência com alerta abaixo de 75%); agenda de 14 dias com check-in antecipado; solicitação de reposição/experimental em 3 etapas; auto-matrícula; hub de evolução (gráfico de notas, feedbacks, repertório, presenças); avisos; financeiro com PIX copia-e-cola, envio de comprovante e recibo em PDF.

Em todos os portais: sidebar recolhível, breadcrumbs, busca global `Ctrl+K` (ou `/`), sininho em tempo real, drawers de inspeção, modais multi-etapas, tabelas com ordenação/filtros/paginação, skeletons e toasts.

---

## API v2 (principais rotas)

| Prefixo | Perfil | Conteúdo |
| :--- | :--- | :--- |
| `POST /api/auth/login` | público | JWT |
| `GET /api/stream?access_token=` | autenticado | canal SSE (`sync`, `notificacao`) |
| `/api/me`, `/api/notificacoes`, `/api/busca` | autenticado | conta, sininho, busca global |
| `/api/admin/dashboard`, `/auditoria` | ADM | KPIs e log |
| `/api/admin/usuarios[/{id}]`, `/matriculas/{id}` | ADM | CRUD de contas, suspensão, matrículas em lote |
| `/api/admin/grade`, `/turmas[/validar]`, `/salas`, `/modalidades` | ADM | grade horária e conflitos |
| `/api/admin/financeiro[/lote, /faturas/{id}/baixa, /pagamentos/{id}/aprovar]` | ADM | cobranças |
| `/api/professor/workspace/hoje`, `/turmas/{id}/chamada`, `/diario`, `/avaliacoes`, `/reposicoes` | Professor/ADM | workspace |
| `/api/aluno/portal/passaporte`, `/agenda`, `/checkin`, `/reposicoes`, `/evolucao`, `/avisos`, `/financeiro` | Aluno | portal |

Os endpoints legados (`/api/aluno/comprovantes`, `/api/aluno/pagamentos/{id}/recibo`, Mercado Pago etc.) continuam ativos e também disparam sincronização.

---

## Estrutura do front-end

```text
frontend/
├── index.html, login.js, styles.css     # login
├── css/theme.css                        # tokens (cores, tipografia, raios, movimento)
├── css/components.css                   # shell, cards, tabelas, drawer, modal, timetable, chamada…
├── js/core/
│   ├── config.js    session.js   api.js # base da API, sessão JWT, cliente com interceptors
│   ├── realtime.js                      # cliente SSE com reconexão
│   ├── shell.js                         # sidebar, header, roteador, sininho, Ctrl+K
│   ├── ui.js  table.js  charts.js  timetable.js
├── Admin/admin.js · Professor/professor.js · Aluno/aluno.js
```

Arquivos obsoletos que podem ser excluídos: `frontend/js/state.js`, `js/auth.js`, `js/auth-guard.js`, `js/ui.js`, `frontend/app.js`, `frontend/Aluno/dashboard-aluno.html` e a pasta `backend/` (cópias antigas fora do `src/`).
