-- ==========================================================
-- VibeDance - Esquema de Banco de Dados Relacional (PostgreSQL)
-- Plataforma Web para Gestão e Experiência de Aulas de Dança
-- ==========================================================

-- 1. Tabela de Usuários (Base para Aluno, Professor e Administrador)
CREATE TABLE IF NOT EXISTS usuarios (
    id_usuario SERIAL PRIMARY KEY,
    nome VARCHAR(100) NOT NULL,
    cpf VARCHAR(14) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    senha VARCHAR(255) NOT NULL,
    telefone VARCHAR(20),
    avatar_url VARCHAR(255),
    tipo_perfil VARCHAR(20) NOT NULL CHECK (tipo_perfil IN ('ALUNO', 'PROFESSOR', 'ADMINISTRADOR')),
    ativo BOOLEAN DEFAULT TRUE,
    data_cadastro TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Salas e Espaços Físicos do Estúdio
CREATE TABLE IF NOT EXISTS salas (
    id_sala SERIAL PRIMARY KEY,
    nome VARCHAR(50) NOT NULL,
    capacidade INT NOT NULL,
    recursos TEXT, -- Ex: 'Espelhos 360°, Piso Flutuante, Iluminação LED Cênica, Som Bluetooth 5.0'
    ativo BOOLEAN DEFAULT TRUE
);

-- 3. Modalidades de Dança
CREATE TABLE IF NOT EXISTS modalidades (
    id_modalidade SERIAL PRIMARY KEY,
    nome VARCHAR(50) NOT NULL,
    categoria VARCHAR(50), -- Ex: 'Urbanas', 'Clássicas', 'Ritmos', 'Fitness'
    descricao TEXT,
    icone VARCHAR(50) DEFAULT 'fa-music',
    imagem_url VARCHAR(255),
    ativo BOOLEAN DEFAULT TRUE
);

-- 4. Pacotes de Aulas / Mensalidades
CREATE TABLE IF NOT EXISTS pacotes (
    id_pacote SERIAL PRIMARY KEY,
    nome VARCHAR(50) NOT NULL,
    quantidade_aulas INT NOT NULL, -- -1 para passe livre ilimitado
    valor DECIMAL(10, 2) NOT NULL,
    descricao VARCHAR(255),
    ativo BOOLEAN DEFAULT TRUE
);

-- 5. Turmas Regulares (Com alocação de Sala e Professor)
CREATE TABLE IF NOT EXISTS turmas (
    id_turma SERIAL PRIMARY KEY,
    id_modalidade INT NOT NULL REFERENCES modalidades(id_modalidade) ON DELETE CASCADE,
    id_professor INT NOT NULL REFERENCES usuarios(id_usuario) ON DELETE RESTRICT,
    id_sala INT REFERENCES salas(id_sala) ON DELETE SET NULL,
    nome_turma VARCHAR(100),
    dias_semana VARCHAR(100) NOT NULL, -- Ex: 'Segundas e Quartas'
    horario_inicio TIME NOT NULL,
    horario_fim TIME NOT NULL,
    nivel VARCHAR(30) DEFAULT 'INICIANTE' CHECK (nivel IN ('INICIANTE', 'INTERMEDIARIO', 'AVANCADO', 'TODOS_OS_NIVEIS')),
    limite_vagas INT NOT NULL,
    ativo BOOLEAN DEFAULT TRUE
);

-- 6. Matrículas dos Alunos em Turmas
CREATE TABLE IF NOT EXISTS matriculas (
    id_matricula SERIAL PRIMARY KEY,
    id_aluno INT NOT NULL REFERENCES usuarios(id_usuario) ON DELETE CASCADE,
    id_turma INT NOT NULL REFERENCES turmas(id_turma) ON DELETE CASCADE,
    data_matricula TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(20) DEFAULT 'ATIVA' CHECK (status IN ('ATIVA', 'CANCELADA', 'TRANCADA', 'PENDENTE')),
    UNIQUE(id_aluno, id_turma)
);

-- 7. Registro de Chamada Virtual / Frequência
CREATE TABLE IF NOT EXISTS presencas (
    id_presenca SERIAL PRIMARY KEY,
    id_turma INT NOT NULL REFERENCES turmas(id_turma) ON DELETE CASCADE,
    id_aluno INT NOT NULL REFERENCES usuarios(id_usuario) ON DELETE CASCADE,
    data_aula DATE NOT NULL,
    presente BOOLEAN NOT NULL DEFAULT TRUE,
    justificativa TEXT,
    registrado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(id_turma, id_aluno, data_aula)
);

-- 8. Materiais de Apoio (Playlists, Vídeos de Coreografia, Exercícios)
CREATE TABLE IF NOT EXISTS materiais_aula (
    id_material SERIAL PRIMARY KEY,
    id_turma INT REFERENCES turmas(id_turma) ON DELETE CASCADE,
    id_modalidade INT REFERENCES modalidades(id_modalidade) ON DELETE CASCADE,
    id_professor INT NOT NULL REFERENCES usuarios(id_usuario) ON DELETE CASCADE,
    titulo VARCHAR(150) NOT NULL,
    tipo VARCHAR(30) NOT NULL CHECK (tipo IN ('PLAYLIST', 'VIDEO_COREOGRAFIA', 'DOCUMENTO_PDF', 'LINK_EXTERNO')),
    url_conteudo VARCHAR(255) NOT NULL,
    descricao TEXT,
    duracao_minutos INT,
    data_publicacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 9. Mural de Comunicados das Turmas
CREATE TABLE IF NOT EXISTS comunicados (
    id_comunicado SERIAL PRIMARY KEY,
    id_turma INT NOT NULL REFERENCES turmas(id_turma) ON DELETE CASCADE,
    id_professor INT NOT NULL REFERENCES usuarios(id_usuario) ON DELETE CASCADE,
    titulo VARCHAR(150) NOT NULL,
    conteudo TEXT NOT NULL,
    link_anexo VARCHAR(255),
    urgente BOOLEAN DEFAULT FALSE,
    data_postagem TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 10. Agendamento de Aulas Particulares / Personal Dancer
CREATE TABLE IF NOT EXISTS aulas_particulares (
    id_aula_particular SERIAL PRIMARY KEY,
    id_aluno INT NOT NULL REFERENCES usuarios(id_usuario) ON DELETE CASCADE,
    id_professor INT REFERENCES usuarios(id_usuario) ON DELETE SET NULL,
    id_modalidade INT NOT NULL REFERENCES modalidades(id_modalidade),
    id_sala INT REFERENCES salas(id_sala) ON DELETE SET NULL,
    data_horario TIMESTAMP NOT NULL,
    duracao_minutos INT DEFAULT 60,
    status VARCHAR(20) DEFAULT 'SOLICITADO' CHECK (status IN ('SOLICITADO', 'CONFIRMADO', 'CONCLUIDO', 'CANCELADO')),
    observacoes TEXT
);

-- 11. Histórico Financeiro e Pagamentos
CREATE TABLE IF NOT EXISTS pagamentos (
    id_pagamento SERIAL PRIMARY KEY,
    id_aluno INT NOT NULL REFERENCES usuarios(id_usuario) ON DELETE CASCADE,
    id_matricula INT REFERENCES matriculas(id_matricula) ON DELETE SET NULL,
    id_pacote INT REFERENCES pacotes(id_pacote) ON DELETE SET NULL,
    valor DECIMAL(10, 2) NOT NULL,
    forma_pagamento VARCHAR(20) NOT NULL CHECK (forma_pagamento IN ('PIX', 'CARTAO', 'BOLETO')),
    status VARCHAR(20) NOT NULL CHECK (status IN ('PAGO', 'PENDENTE', 'CANCELADO')),
    data_pagamento TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ==========================================================
-- DADOS INICIAIS DE DEMONSTRAÇÃO (SEEDS)
-- ==========================================================

-- Inserção de Usuários Base (1 Admin, 2 Professores, 4 Alunos)
INSERT INTO usuarios (id_usuario, nome, cpf, email, senha, telefone, tipo_perfil) VALUES
(1, 'Administrador Vibe', '000.000.000-01', 'admin@vibedance.com', 'admin123', '(61) 99999-0001', 'ADMINISTRADOR'),
(2, 'Prof. Diego Santos', '111.111.111-02', 'prof.diego@vibedance.com', 'prof123', '(61) 99999-0002', 'PROFESSOR'),
(3, 'Profa. Camila Dança', '222.222.222-03', 'prof.camila@vibedance.com', 'prof123', '(61) 99999-0003', 'PROFESSOR'),
(4, 'Juliana Paiva', '333.333.333-04', 'aluno.juliana@vibedance.com', 'aluno123', '(61) 98888-1001', 'ALUNO'),
(5, 'Lucas Rocha', '444.444.444-05', 'aluno.lucas@vibedance.com', 'aluno123', '(61) 98888-1002', 'ALUNO'),
(6, 'Mariana Lima', '555.555.555-06', 'aluno.mariana@vibedance.com', 'aluno123', '(61) 98888-1003', 'ALUNO'),
(7, 'Gabriel Souza', '666.666.666-07', 'aluno.gabriel@vibedance.com', 'aluno123', '(61) 98888-1004', 'ALUNO')
ON CONFLICT (id_usuario) DO NOTHING;

-- Inserção de Salas do Estúdio
INSERT INTO salas (id_sala, nome, capacidade, recursos) VALUES
(1, 'Studio Neon A (Principal)', 30, 'Espelhos panorâmicos, piso flutuante vinílico, som JBL profissional e luzes neon dinâmicas'),
(2, 'Studio Beat B (Urban)', 25, 'Acústica isolada, LED ring para gravações de reels, piso especial anti-impacto'),
(3, 'Sala Harmonia (Clássica)', 20, 'Barras duplas de ballet em madeira nobre, iluminação zen e climatização suave')
ON CONFLICT (id_sala) DO NOTHING;

-- Inserção de Modalidades
INSERT INTO modalidades (id_modalidade, nome, categoria, descricao, icone) VALUES
(1, 'Hip Hop & Urban Dance', 'Urbanas', 'Ritmo intenso, groove, freestyle e passos coreográficos da cultura de rua mundial.', 'fa-fire'),
(2, 'Jazz Funk', 'Urbanas', 'Fusão eletrizante entre a técnica do jazz e a sensualidade e energia do pop/hip-hop.', 'fa-bolt'),
(3, 'Ballet Clássico Moderno', 'Clássicas', 'Alinhamento corporal, fluidez espacial, flexibilidade e elegância técnica atemporal.', 'fa-feather'),
(4, 'Dança de Salão & Salsa', 'Ritmos', 'Conexão a dois, musicalidade latina calorosa, giros dinâmicos e condução fluida.', 'fa-heart')
ON CONFLICT (id_modalidade) DO NOTHING;

-- Inserção de Pacotes
INSERT INTO pacotes (id_pacote, nome, quantidade_aulas, valor, descricao) VALUES
(1, 'Plano Flow (2x na semana)', 8, 189.90, 'Acesso a 2 aulas semanais na sua turma principal'),
(2, 'Plano Vibe VIP (Acesso Livre)', -1, 289.90, 'Acesso ilimitado a todas as modalidades e workshops do estúdio'),
(3, 'Avulso / Drop-in Class', 1, 45.00, 'Entrada única para qualquer aula do calendário')
ON CONFLICT (id_pacote) DO NOTHING;

-- Inserção de Turmas
INSERT INTO turmas (id_turma, id_modalidade, id_professor, id_sala, nome_turma, dias_semana, horario_inicio, horario_fim, nivel, limite_vagas) VALUES
(1, 1, 2, 2, 'Hip Hop Mastercrew', 'Segundas e Quartas', '19:00:00', '20:15:00', 'INTERMEDIARIO', 25),
(2, 2, 3, 1, 'Jazz Funk Commercial Vibe', 'Terças e Quintas', '18:30:00', '19:45:00', 'TODOS_OS_NIVEIS', 30),
(3, 3, 3, 3, 'Ballet Expressão & Postura', 'Segundas e Quartas', '08:00:00', '09:15:00', 'INICIANTE', 20),
(4, 4, 2, 1, 'Salsa & Bachata Night', 'Sextas-feiras', '20:00:00', '21:30:00', 'TODOS_OS_NIVEIS', 28)
ON CONFLICT (id_turma) DO NOTHING;

-- Inserção de Matrículas
INSERT INTO matriculas (id_matricula, id_aluno, id_turma, status) VALUES
(1, 4, 1, 'ATIVA'),
(2, 4, 2, 'ATIVA'),
(3, 5, 1, 'ATIVA'),
(4, 6, 2, 'ATIVA'),
(5, 7, 1, 'ATIVA'),
(6, 7, 4, 'ATIVA')
ON CONFLICT (id_matricula) DO NOTHING;

-- Inserção de Materiais de Apoio (Playlists e Vídeos de Coreografia)
INSERT INTO materiais_aula (id_material, id_turma, id_modalidade, id_professor, titulo, tipo, url_conteudo, descricao, duracao_minutos) VALUES
(1, 1, 1, 2, 'Playlist Hip Hop Beats 2026', 'PLAYLIST', 'https://open.spotify.com/playlist/vibedance-hiphop', 'Batidas de 90 a 115 BPM utilizadas nas sequências de footwork da aula.', 68),
(2, 1, 1, 2, 'Passo a Passo: Isolamentos & Groove', 'VIDEO_COREOGRAFIA', 'https://vibedance.studio/videos/hiphop-groove-intro.mp4', 'Vídeo com câmera lenta para praticar em casa a transição de peso e contração de tronco.', 12),
(3, 2, 2, 3, 'Pop & Commercial Diva Sounds', 'PLAYLIST', 'https://open.spotify.com/playlist/vibedance-jazzfunk', 'Músicas dinâmicas com batidas fortes para a coreografia de palco desta temporada.', 85),
(4, 2, 2, 3, 'Coreografia Oficial: Release the Energy', 'VIDEO_COREOGRAFIA', 'https://vibedance.studio/videos/jazzfunk-stage-preview.mp4', 'Ensaio geral gravado no Studio Neon A com a contagem de 8 tempos.', 15)
ON CONFLICT (id_material) DO NOTHING;

-- Inserção de Comunicados
INSERT INTO comunicados (id_comunicado, id_turma, id_professor, titulo, conteudo, link_anexo, urgente) VALUES
(1, 1, 2, 'Ensaio Extra para o Showcase de Inverno!', 'Galera, na próxima quarta-feira ficaremos 20 minutos extras para alinhar a formação do refrão. Tragam tênis de solado liso!', 'https://vibedance.studio/showcase-info', TRUE),
(2, 2, 3, 'Playlist da nova coreografia atualizada', 'Adicionei as 3 novas faixas que vamos usar no módulo de chão (floorwork). Ouçam para decorar os tempos fortes!', 'https://open.spotify.com/playlist/vibedance-jazzfunk', FALSE)
ON CONFLICT (id_comunicado) DO NOTHING;

-- Inserção de Chamada / Presenças Registradas
INSERT INTO presencas (id_turma, id_aluno, data_aula, presente) VALUES
(1, 4, CURRENT_DATE, TRUE),
(1, 5, CURRENT_DATE, TRUE),
(1, 7, CURRENT_DATE, FALSE),
(2, 4, CURRENT_DATE, TRUE),
(2, 6, CURRENT_DATE, TRUE)
ON CONFLICT (id_turma, id_aluno, data_aula) DO NOTHING;
