-- ==========================================================
-- VibeDance — Migração v2 (Overhaul)
-- Idempotente: pode ser executada mais de uma vez com segurança.
--   psql -U postgres -d vibedance -f database/migracao_v2_overhaul.sql
-- ==========================================================

-- ----------------------------------------------------------
-- 1. Domínio institucional: SOMENTE @vibedance.com
-- ----------------------------------------------------------
ALTER TABLE usuarios DROP CONSTRAINT IF EXISTS chk_email_dominio_vibedance;
ALTER TABLE usuarios ADD CONSTRAINT chk_email_dominio_vibedance
    CHECK (email ~* '^[A-Za-z0-9._%+-]+@vibedance\.com$');

CREATE OR REPLACE FUNCTION fn_validar_dominio_vibedance()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.email IS NULL OR NEW.email !~* '^[A-Za-z0-9._%+-]+@vibedance\.com$' THEN
        RAISE EXCEPTION 'Acesso restrito: apenas contas institucionais @vibedance.com são permitidas no VibeDance.';
    END IF;
    NEW.email := LOWER(TRIM(NEW.email));
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ----------------------------------------------------------
-- 2. Presença com três estados (PRESENTE / FALTA / JUSTIFICADO)
-- ----------------------------------------------------------
ALTER TABLE presencas ADD COLUMN IF NOT EXISTS status VARCHAR(12);
UPDATE presencas
   SET status = CASE
        WHEN presente THEN 'PRESENTE'
        WHEN justificativa IS NOT NULL AND justificativa <> '' THEN 'JUSTIFICADO'
        ELSE 'FALTA' END
 WHERE status IS NULL;
ALTER TABLE presencas ALTER COLUMN status SET DEFAULT 'PRESENTE';
ALTER TABLE presencas ALTER COLUMN status SET NOT NULL;
ALTER TABLE presencas DROP CONSTRAINT IF EXISTS chk_presencas_status;
ALTER TABLE presencas ADD CONSTRAINT chk_presencas_status
    CHECK (status IN ('PRESENTE', 'FALTA', 'JUSTIFICADO'));
CREATE INDEX IF NOT EXISTS idx_presencas_aluno ON presencas(id_aluno, data_aula);

-- ----------------------------------------------------------
-- 3. Comunicados oficiais do estúdio (sem turma = todos)
-- ----------------------------------------------------------
ALTER TABLE comunicados ALTER COLUMN id_turma DROP NOT NULL;

-- ----------------------------------------------------------
-- 4. Log de Auditoria Geral (rastreabilidade de ações críticas)
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS auditoria_geral (
    id_auditoria SERIAL PRIMARY KEY,
    id_usuario INT REFERENCES usuarios(id_usuario) ON DELETE SET NULL,
    usuario_nome VARCHAR(100),
    perfil VARCHAR(20),
    acao VARCHAR(30) NOT NULL,
    entidade VARCHAR(40) NOT NULL,
    id_entidade INT,
    descricao TEXT,
    ip_origem VARCHAR(45),
    data_hora TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_auditoria_geral_data ON auditoria_geral(data_hora DESC);
CREATE INDEX IF NOT EXISTS idx_auditoria_geral_entidade ON auditoria_geral(entidade, id_entidade);

-- ----------------------------------------------------------
-- 5. Diário de Classe & Repositório Coreográfico
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS diario_classe (
    id_diario SERIAL PRIMARY KEY,
    id_turma INT NOT NULL REFERENCES turmas(id_turma) ON DELETE CASCADE,
    id_professor INT NOT NULL REFERENCES usuarios(id_usuario) ON DELETE CASCADE,
    data_aula DATE NOT NULL,
    conteudo TEXT NOT NULL,
    coreografia VARCHAR(150),
    links_referencia TEXT,
    observacoes TEXT,
    criado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    atualizado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (id_turma, data_aula)
);

-- ----------------------------------------------------------
-- 6. Reposições e Aulas Experimentais
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS reposicoes (
    id_reposicao SERIAL PRIMARY KEY,
    id_aluno INT NOT NULL REFERENCES usuarios(id_usuario) ON DELETE CASCADE,
    id_turma_origem INT REFERENCES turmas(id_turma) ON DELETE SET NULL,
    id_turma_destino INT NOT NULL REFERENCES turmas(id_turma) ON DELETE CASCADE,
    data_falta DATE,
    data_aula_destino DATE NOT NULL,
    tipo VARCHAR(15) NOT NULL DEFAULT 'REPOSICAO' CHECK (tipo IN ('REPOSICAO', 'EXPERIMENTAL')),
    status VARCHAR(15) NOT NULL DEFAULT 'SOLICITADA' CHECK (status IN ('SOLICITADA', 'APROVADA', 'RECUSADA', 'CANCELADA')),
    motivo TEXT,
    resposta TEXT,
    avaliado_por INT REFERENCES usuarios(id_usuario) ON DELETE SET NULL,
    solicitado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    avaliado_em TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_reposicoes_destino ON reposicoes(id_turma_destino, data_aula_destino);
CREATE INDEX IF NOT EXISTS idx_reposicoes_aluno ON reposicoes(id_aluno);

-- ----------------------------------------------------------
-- 7. Check-in antecipado do aluno
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS checkins (
    id_checkin SERIAL PRIMARY KEY,
    id_turma INT NOT NULL REFERENCES turmas(id_turma) ON DELETE CASCADE,
    id_aluno INT NOT NULL REFERENCES usuarios(id_usuario) ON DELETE CASCADE,
    data_aula DATE NOT NULL,
    confirmado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (id_turma, id_aluno, data_aula)
);

-- ----------------------------------------------------------
-- 8. Notificações persistentes (sininho em tempo real)
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS notificacoes (
    id_notificacao SERIAL PRIMARY KEY,
    id_usuario INT NOT NULL REFERENCES usuarios(id_usuario) ON DELETE CASCADE,
    titulo VARCHAR(150) NOT NULL,
    mensagem TEXT,
    tipo VARCHAR(20) NOT NULL DEFAULT 'INFO' CHECK (tipo IN ('INFO', 'SUCESSO', 'ALERTA', 'FINANCEIRO', 'AGENDA')),
    link VARCHAR(120),
    lida BOOLEAN NOT NULL DEFAULT FALSE,
    criada_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_notificacoes_usuario ON notificacoes(id_usuario, lida, criada_em DESC);

-- ----------------------------------------------------------
-- 9. Ressincroniza as sequences (os seeds usam IDs explícitos;
--    sem isso, o primeiro INSERT via JPA colide com a PK 1)
-- ----------------------------------------------------------
SELECT setval(pg_get_serial_sequence('usuarios', 'id_usuario'), COALESCE((SELECT MAX(id_usuario) FROM usuarios), 0) + 1, false);
SELECT setval(pg_get_serial_sequence('salas', 'id_sala'), COALESCE((SELECT MAX(id_sala) FROM salas), 0) + 1, false);
SELECT setval(pg_get_serial_sequence('modalidades', 'id_modalidade'), COALESCE((SELECT MAX(id_modalidade) FROM modalidades), 0) + 1, false);
SELECT setval(pg_get_serial_sequence('pacotes', 'id_pacote'), COALESCE((SELECT MAX(id_pacote) FROM pacotes), 0) + 1, false);
SELECT setval(pg_get_serial_sequence('turmas', 'id_turma'), COALESCE((SELECT MAX(id_turma) FROM turmas), 0) + 1, false);
SELECT setval(pg_get_serial_sequence('matriculas', 'id_matricula'), COALESCE((SELECT MAX(id_matricula) FROM matriculas), 0) + 1, false);
SELECT setval(pg_get_serial_sequence('presencas', 'id_presenca'), COALESCE((SELECT MAX(id_presenca) FROM presencas), 0) + 1, false);
SELECT setval(pg_get_serial_sequence('materiais_aula', 'id_material'), COALESCE((SELECT MAX(id_material) FROM materiais_aula), 0) + 1, false);
SELECT setval(pg_get_serial_sequence('comunicados', 'id_comunicado'), COALESCE((SELECT MAX(id_comunicado) FROM comunicados), 0) + 1, false);
SELECT setval(pg_get_serial_sequence('avaliacoes_tecnicas', 'id_avaliacao'), COALESCE((SELECT MAX(id_avaliacao) FROM avaliacoes_tecnicas), 0) + 1, false);
SELECT setval(pg_get_serial_sequence('aulas_particulares', 'id_aula_particular'), COALESCE((SELECT MAX(id_aula_particular) FROM aulas_particulares), 0) + 1, false);
SELECT setval(pg_get_serial_sequence('faturas', 'id_fatura'), COALESCE((SELECT MAX(id_fatura) FROM faturas), 0) + 1, false);
SELECT setval(pg_get_serial_sequence('pagamentos', 'id_pagamento'), COALESCE((SELECT MAX(id_pagamento) FROM pagamentos), 0) + 1, false);
SELECT setval(pg_get_serial_sequence('auditoria_pagamentos', 'id_auditoria'), COALESCE((SELECT MAX(id_auditoria) FROM auditoria_pagamentos), 0) + 1, false);

-- ----------------------------------------------------------
-- 10. Seeds complementares (diário e uma reposição pendente)
-- ----------------------------------------------------------
INSERT INTO diario_classe (id_turma, id_professor, data_aula, conteudo, coreografia, links_referencia)
VALUES (1, 2, CURRENT_DATE - 2, 'Aquecimento com isolamentos, drills de groove em 95 BPM e montagem dos 16 primeiros tempos.',
        'Urban Groove - Bloco A', 'https://open.spotify.com/playlist/vibedance-hiphop')
ON CONFLICT (id_turma, data_aula) DO NOTHING;

INSERT INTO reposicoes (id_aluno, id_turma_origem, id_turma_destino, data_falta, data_aula_destino, tipo, motivo)
SELECT 7, 1, 4, CURRENT_DATE, CURRENT_DATE + 3, 'REPOSICAO', 'Faltei por consulta médica, gostaria de repor na turma de sexta.'
WHERE NOT EXISTS (SELECT 1 FROM reposicoes WHERE id_aluno = 7 AND id_turma_destino = 4);
