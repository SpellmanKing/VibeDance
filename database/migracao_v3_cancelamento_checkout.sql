-- ==========================================================================
-- VibeDance · Migração v3 — cancelamento de matrícula e checkout
-- Idempotente: pode ser executada mais de uma vez. Rode depois da v2.
--   psql -U postgres -d vibedance_teste -f database/migracao_v3_cancelamento_checkout.sql
-- ==========================================================================

-- 1. Solicitações de cancelamento de matrícula (aluno → ADM)
CREATE TABLE IF NOT EXISTS solicitacoes_cancelamento (
    id_solicitacao SERIAL PRIMARY KEY,
    id_aluno       INT NOT NULL REFERENCES usuarios(id_usuario) ON DELETE CASCADE,
    turmas         VARCHAR(255) NOT NULL,              -- ids das turmas, separados por vírgula
    motivo         VARCHAR(40)  NOT NULL,
    justificativa  TEXT         NOT NULL,
    status         VARCHAR(15)  NOT NULL DEFAULT 'SOLICITADA'
                   CHECK (status IN ('SOLICITADA', 'APROVADA', 'RECUSADA')),
    resposta       TEXT,
    avaliado_por   INT REFERENCES usuarios(id_usuario),
    solicitado_em  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    avaliado_em    TIMESTAMP
);

-- Trava no banco: no máximo uma solicitação em análise por aluno
CREATE UNIQUE INDEX IF NOT EXISTS uq_cancelamento_pendente
    ON solicitacoes_cancelamento (id_aluno) WHERE status = 'SOLICITADA';

CREATE INDEX IF NOT EXISTS ix_cancelamento_status ON solicitacoes_cancelamento (status, solicitado_em DESC);

-- 2. Detalhes do checkout nos pagamentos
ALTER TABLE pagamentos ADD COLUMN IF NOT EXISTS valor_base     NUMERIC(10, 2);
ALTER TABLE pagamentos ADD COLUMN IF NOT EXISTS parcelas       INT;
ALTER TABLE pagamentos ADD COLUMN IF NOT EXISTS metodo_detalhe VARCHAR(80);

-- Pagamentos antigos: valor base = valor da fatura
UPDATE pagamentos p SET valor_base = f.valor
  FROM faturas f
 WHERE p.id_fatura = f.id_fatura AND p.valor_base IS NULL;
