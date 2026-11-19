-- ==========================================================================
-- VibeDance · Migração v5 — cobrança individual e descontos
-- Idempotente: pode ser executada mais de uma vez. Rode depois da v4.
--   psql -U postgres -d vibedance_teste -f database/migracao_v5_cobranca_individual.sql
--
-- faturas.valor continua sendo o valor devido (líquido). Os novos campos guardam
-- o preço cheio e o desconto aplicado, com o motivo, para o ADM tratar condições
-- especiais (bolsa, irmãos, pró-rata de quem chega no meio do mês etc.).
-- ==========================================================================

ALTER TABLE faturas ADD COLUMN IF NOT EXISTS valor_original  NUMERIC(10,2);
ALTER TABLE faturas ADD COLUMN IF NOT EXISTS desconto        NUMERIC(10,2) NOT NULL DEFAULT 0;
ALTER TABLE faturas ADD COLUMN IF NOT EXISTS motivo_desconto VARCHAR(30);
ALTER TABLE faturas ADD COLUMN IF NOT EXISTS observacao      TEXT;
ALTER TABLE faturas ADD COLUMN IF NOT EXISTS origem          VARCHAR(20) NOT NULL DEFAULT 'LOTE';   -- LOTE | INDIVIDUAL
ALTER TABLE faturas ADD COLUMN IF NOT EXISTS ajustado_em     TIMESTAMP;

UPDATE faturas SET valor_original = valor + desconto WHERE valor_original IS NULL;
ALTER TABLE faturas ALTER COLUMN valor_original SET NOT NULL;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_faturas_desconto') THEN
        ALTER TABLE faturas ADD CONSTRAINT ck_faturas_desconto
            CHECK (desconto >= 0 AND desconto < valor_original AND valor = valor_original - desconto);
    END IF;
END $$;
