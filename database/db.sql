-- 1. Tabela de Usuários (Base para Aluno, Professor e Admin)
CREATE TABLE usuarios (
    id_usuario SERIAL PRIMARY KEY,
    nome VARCHAR(100) NOT NULL,
    cpf VARCHAR(14) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    senha VARCHAR(255) NOT NULL,
    tipo_perfil VARCHAR(20) NOT NULL CHECK (tipo_perfil IN ('ALUNO', 'PROFESSOR', 'ADMINISTRADOR')),
    data_cadastro TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Modalidades de Dança
CREATE TABLE modalidades (
    id_modalidade SERIAL PRIMARY KEY,
    nome VARCHAR(50) NOT NULL,
    descricao TEXT,
    imagem_url VARCHAR(255)
);

-- 3. Pacotes de Aulas
CREATE TABLE pacotes (
    id_pacote SERIAL PRIMARY KEY,
    nome VARCHAR(50) NOT NULL,
    quantidade_aulas INT NOT NULL,
    valor DECIMAL(10, 2) NOT NULL,
    ativo BOOLEAN DEFAULT TRUE
);

-- 4. Turmas
CREATE TABLE turmas (
    id_turma SERIAL PRIMARY KEY,
    id_modalidade INT NOT NULL REFERENCES modalidades(id_modalidade) ON DELETE CASCADE,
    id_professor INT NOT NULL REFERENCES usuarios(id_usuario) ON DELETE RESTRICT,
    dias_semana VARCHAR(50) NOT NULL,
    horario TIME NOT NULL,
    limite_vagas INT NOT NULL
);

-- 5. Matrículas em Turmas Regulares
CREATE TABLE matriculas (
    id_matricula SERIAL PRIMARY KEY,
    id_aluno INT NOT NULL REFERENCES usuarios(id_usuario) ON DELETE CASCADE,
    id_turma INT NOT NULL REFERENCES turmas(id_turma) ON DELETE CASCADE,
    data_matricula TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(20) DEFAULT 'ATIVA' CHECK (status IN ('ATIVA', 'CANCELADA', 'PENDENTE'))
);

-- 6. Agendamento de Aulas Particulares
CREATE TABLE aulas_particulares (
    id_aula_particular SERIAL PRIMARY KEY,
    id_aluno INT NOT NULL REFERENCES usuarios(id_usuario) ON DELETE CASCADE,
    id_professor INT REFERENCES usuarios(id_usuario) ON DELETE SET NULL,
    id_modalidade INT NOT NULL REFERENCES modalidades(id_modalidade),
    data_horario TIMESTAMP NOT NULL,
    status VARCHAR(20) DEFAULT 'SOLICITADO' CHECK (status IN ('SOLICITADO', 'CONFIRMADO', 'CANCELADO'))
);

-- 7. Histórico de Pagamentos
CREATE TABLE pagamentos (
    id_pagamento SERIAL PRIMARY KEY,
    id_aluno INT NOT NULL REFERENCES usuarios(id_usuario) ON DELETE CASCADE,
    id_matricula INT REFERENCES matriculas(id_matricula) ON DELETE SET NULL,
    id_pacote INT REFERENCES pacotes(id_pacote) ON DELETE SET NULL,
    valor DECIMAL(10, 2) NOT NULL,
    forma_pagamento VARCHAR(20) NOT NULL CHECK (forma_pagamento IN ('PIX', 'CARTAO', 'BOLETO')),
    status VARCHAR(20) NOT NULL CHECK (status IN ('PAGO', 'PENDENTE', 'CANCELADO')),
    data_pagamento TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

