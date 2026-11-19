-- ==========================================================================
-- VibeDance · Migração v4 — pedidos de acesso ("Quero dançar")
-- Idempotente: pode ser executada mais de uma vez. Rode depois da v3.
--   psql -U postgres -d vibedance_teste -f database/migracao_v4_solicitacoes_acesso.sql
-- ==========================================================================

-- Pedido público de quem quer começar a dançar. O ADM analisa e, ao aprovar,
-- cria a conta @vibedance.com; a pessoa ativa o acesso com protocolo + e-mail.
CREATE TABLE IF NOT EXISTS solicitacoes_acesso (
    id_solicitacao      SERIAL PRIMARY KEY,
    protocolo           VARCHAR(12)  NOT NULL UNIQUE,
    nome                VARCHAR(120) NOT NULL,
    email_contato       VARCHAR(150) NOT NULL,
    telefone            VARCHAR(20)  NOT NULL,
    cpf                 VARCHAR(14)  NOT NULL,
    data_nascimento     DATE,
    modalidades         VARCHAR(255),                 -- nomes separados por vírgula
    experiencia         VARCHAR(20)  NOT NULL,
    turmas_interesse    VARCHAR(255),                 -- ids separados por vírgula
    disponibilidade     VARCHAR(255),                 -- ex.: "SEG,QUA,NOITE"
    objetivo            VARCHAR(30),
    mensagem            TEXT,
    origem              VARCHAR(40),
    status              VARCHAR(15)  NOT NULL DEFAULT 'NOVA'
                        CHECK (status IN ('NOVA', 'EM_CONTATO', 'APROVADA', 'RECUSADA')),
    resposta            TEXT,
    nota_interna        TEXT,
    email_institucional VARCHAR(150),
    id_usuario_criado   INT REFERENCES usuarios(id_usuario) ON DELETE SET NULL,
    avaliado_por        INT REFERENCES usuarios(id_usuario) ON DELETE SET NULL,
    ip_origem           VARCHAR(45),
    solicitado_em       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    atualizado_em       TIMESTAMP,
    avaliado_em         TIMESTAMP,
    ativado_em          TIMESTAMP
);

-- No máximo um pedido em aberto por CPF
CREATE UNIQUE INDEX IF NOT EXISTS uq_acesso_cpf_aberto
    ON solicitacoes_acesso (cpf) WHERE status IN ('NOVA', 'EM_CONTATO');

CREATE INDEX IF NOT EXISTS ix_acesso_status ON solicitacoes_acesso (status, solicitado_em DESC);
