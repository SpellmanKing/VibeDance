/**
 * VibeDance State & Data Store
 * Gerenciador de estado reativo e persistente via LocalStorage
 * Suporta modo Standalone imediato e sincronização futura com API Spring Boot
 */

const VibeStore = (function() {
    const STORAGE_KEY = 'VIBEDANCE_DATABASE_V1';

    // Base de dados inicial padrão (Seed)
    const initialData = {
        usuarios: [
            { id: 1, nome: 'Administrador Vibe', email: 'admin@vibedance.com', senha: 'admin123', cpf: '000.000.000-01', telefone: '(61) 99999-0001', perfil: 'ADMINISTRADOR', ativo: true },
            { id: 2, nome: 'Prof. Diego Santos', email: 'prof.diego@vibedance.com', senha: 'prof123', cpf: '111.111.111-02', telefone: '(61) 99999-0002', perfil: 'PROFESSOR', ativo: true },
            { id: 3, nome: 'Profa. Camila Dança', email: 'prof.camila@vibedance.com', senha: 'prof123', cpf: '222.222.222-03', telefone: '(61) 99999-0003', perfil: 'PROFESSOR', ativo: true },
            { id: 4, nome: 'Juliana Paiva', email: 'aluno.juliana@vibedance.com', senha: 'aluno123', cpf: '333.333.333-04', telefone: '(61) 98888-1001', perfil: 'ALUNO', ativo: true },
            { id: 5, nome: 'Lucas Rocha', email: 'aluno.lucas@vibedance.com', senha: 'aluno123', cpf: '444.444.444-05', telefone: '(61) 98888-1002', perfil: 'ALUNO', ativo: true },
            { id: 6, nome: 'Mariana Lima', email: 'aluno.mariana@vibedance.com', senha: 'aluno123', cpf: '555.555.555-06', telefone: '(61) 98888-1003', perfil: 'ALUNO', ativo: true },
            { id: 7, nome: 'Gabriel Souza', email: 'aluno.gabriel@vibedance.com', senha: 'aluno123', cpf: '666.666.666-07', telefone: '(61) 98888-1004', perfil: 'ALUNO', ativo: true }
        ],
        salas: [
            { id: 1, nome: 'Studio Neon A (Principal)', capacidade: 30, recursos: 'Espelhos 360°, piso flutuante vinílico, som JBL profissional e iluminação cênica RGB' },
            { id: 2, nome: 'Studio Beat B (Urban)', capacidade: 25, recursos: 'Acústica isolada, LED ring para vídeos/reels, piso especial anti-impacto' },
            { id: 3, nome: 'Sala Harmonia (Clássica)', capacidade: 20, recursos: 'Barras duplas de ballet em madeira, climatização suave e espelhos inteiriços' }
        ],
        modalidades: [
            { id: 1, nome: 'Hip Hop & Urban Dance', categoria: 'Urbanas', descricao: 'Ritmo intenso, groove, freestyle e passos coreográficos da cultura de rua mundial.', icone: 'fa-fire', nivel: 'Intermediário' },
            { id: 2, nome: 'Jazz Funk', categoria: 'Urbanas', descricao: 'Fusão eletrizante entre a técnica do jazz e a sensualidade e energia do pop de palco.', icone: 'fa-bolt', nivel: 'Todos os Níveis' },
            { id: 3, nome: 'Ballet Clássico Moderno', categoria: 'Clássicas', descricao: 'Alinhamento corporal, fluidez espacial, flexibilidade e elegância técnica refinada.', icone: 'fa-feather', nivel: 'Iniciante' },
            { id: 4, nome: 'Dança de Salão & Salsa', categoria: 'Ritmos', descricao: 'Conexão a dois, musicalidade latina calorosa, giros dinâmicos e condução fluida.', icone: 'fa-heart', nivel: 'Todos os Níveis' }
        ],
        turmas: [
            { id: 1, modalidadeId: 1, modalidadeNome: 'Hip Hop & Urban Dance', professorId: 2, professorNome: 'Prof. Diego Santos', salaId: 2, salaNome: 'Studio Beat B (Urban)', nome: 'Hip Hop Mastercrew', dias: 'Segundas e Quartas', horario: '19:00 - 20:15', vagas: 25, ocupadas: 19, nivel: 'Intermediário' },
            { id: 2, modalidadeId: 2, modalidadeNome: 'Jazz Funk', professorId: 3, professorNome: 'Profa. Camila Dança', salaId: 1, salaNome: 'Studio Neon A (Principal)', nome: 'Jazz Funk Commercial Vibe', dias: 'Terças e Quintas', horario: '18:30 - 19:45', vagas: 30, ocupadas: 27, nivel: 'Todos os Níveis' },
            { id: 3, modalidadeId: 3, modalidadeNome: 'Ballet Clássico Moderno', professorId: 3, professorNome: 'Profa. Camila Dança', salaId: 3, salaNome: 'Sala Harmonia (Clássica)', nome: 'Ballet Expressão & Postura', dias: 'Segundas e Quartas', horario: '08:00 - 09:15', vagas: 20, ocupadas: 14, nivel: 'Iniciante' },
            { id: 4, modalidadeId: 4, modalidadeNome: 'Dança de Salão & Salsa', professorId: 2, professorNome: 'Prof. Diego Santos', salaId: 1, salaNome: 'Studio Neon A (Principal)', nome: 'Salsa & Bachata Night', dias: 'Sextas-feiras', horario: '20:00 - 21:30', vagas: 28, ocupadas: 25, nivel: 'Todos os Níveis' }
        ],
        matriculas: [
            { id: 1, alunoId: 4, turmaId: 1, status: 'ATIVA' },
            { id: 2, alunoId: 4, turmaId: 2, status: 'ATIVA' },
            { id: 3, alunoId: 5, turmaId: 1, status: 'ATIVA' },
            { id: 4, alunoId: 6, turmaId: 2, status: 'ATIVA' },
            { id: 5, alunoId: 7, turmaId: 1, status: 'ATIVA' },
            { id: 6, alunoId: 7, turmaId: 4, status: 'ATIVA' }
        ],
        presencas: [
            { id: 1, turmaId: 1, alunoId: 4, data: '2026-09-15', presente: true },
            { id: 2, turmaId: 1, alunoId: 5, data: '2026-09-15', presente: true },
            { id: 3, turmaId: 1, alunoId: 7, data: '2026-09-15', presente: false },
            { id: 4, turmaId: 2, alunoId: 4, data: '2026-09-15', presente: true },
            { id: 5, turmaId: 2, alunoId: 6, data: '2026-09-15', presente: true }
        ],
        materiais: [
            { id: 1, turmaId: 1, professorId: 2, titulo: 'Playlist Hip Hop Beats 2026', tipo: 'PLAYLIST', url: 'https://open.spotify.com/playlist/vibedance-hiphop', descricao: 'Batidas de 90 a 115 BPM com foco em grooves de 8 tempos para treino de footwork.', faixas: 24, duracao: '1h 25m' },
            { id: 2, turmaId: 1, professorId: 2, titulo: 'Passo a Passo: Isolamento de Tronco e Transição', tipo: 'VIDEO_COREOGRAFIA', url: 'https://vibedance.studio/videos/hiphop-groove-slow.mp4', descricao: 'Vídeo detalhado em câmera lenta com contagem verbal para praticar os detalhes em casa.', duracao: '14 min' },
            { id: 3, turmaId: 2, professorId: 3, titulo: 'Pop & Commercial Diva Sounds', tipo: 'PLAYLIST', url: 'https://open.spotify.com/playlist/vibedance-jazzfunk', descricao: 'Músicas dinâmicas com batidas fortes para a coreografia de palco desta temporada.', faixas: 32, duracao: '1h 50m' },
            { id: 4, turmaId: 2, professorId: 3, titulo: 'Coreografia Oficial: Release the Energy', tipo: 'VIDEO_COREOGRAFIA', url: 'https://vibedance.studio/videos/jazzfunk-stage-preview.mp4', descricao: 'Ensaio geral gravado no Studio Neon A com a contagem completa de 8 tempos.', duracao: '18 min' }
        ],
        comunicados: [
            { id: 1, turmaId: 1, professorId: 2, professorNome: 'Prof. Diego Santos', titulo: '🔥 Ensaio Extra para o Showcase de Inverno!', conteudo: 'Galera, na próxima quarta-feira ficaremos 20 minutos extras para alinhar a formação do refrão. Tragam tênis de sola macia!', link: 'https://vibedance.studio/showcase-info', urgente: true, data: 'Hoje às 14:30' },
            { id: 2, turmaId: 2, professorId: 3, professorNome: 'Profa. Camila Dança', titulo: '✨ Playlist da nova coreografia atualizada!', conteudo: 'Adicionei as 3 novas faixas que vamos usar no módulo de chão (floorwork). Ouçam para decorar as pausas rítmicas!', link: 'https://open.spotify.com/playlist/vibedance-jazzfunk', urgente: false, data: 'Ontem às 18:10' }
        ]
    };

    // Carrega ou inicializa no LocalStorage
    function getDB() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (!raw) {
                localStorage.setItem(STORAGE_KEY, JSON.stringify(initialData));
                return initialData;
            }
            return JSON.parse(raw);
        } catch (e) {
            console.error('Falha ao ler LocalStorage:', e);
            return initialData;
        }
    }

    function saveDB(data) {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
        } catch (e) {
            console.error('Falha ao salvar LocalStorage:', e);
        }
    }

    return {
        // --- Usuários ---
        getUsuarios: function() {
            return getDB().usuarios || [];
        },
        findUsuarioByEmail: function(email) {
            const clean = (email || '').trim().toLowerCase();
            return this.getUsuarios().find(u => u.email.toLowerCase() === clean);
        },
        salvarUsuario: function(usuario) {
            const db = getDB();
            if (usuario.id) {
                const idx = db.usuarios.findIndex(u => u.id === usuario.id);
                if (idx !== -1) {
                    db.usuarios[idx] = { ...db.usuarios[idx], ...usuario };
                }
            } else {
                usuario.id = Date.now();
                usuario.ativo = usuario.ativo !== undefined ? usuario.ativo : true;
                db.usuarios.push(usuario);
            }
            saveDB(db);
            return usuario;
        },
        excluirUsuario: function(id) {
            const db = getDB();
            db.usuarios = db.usuarios.filter(u => u.id !== Number(id));
            saveDB(db);
        },

        // --- Salas ---
        getSalas: function() {
            return getDB().salas || [];
        },
        salvarSala: function(sala) {
            const db = getDB();
            if (sala.id) {
                const idx = db.salas.findIndex(s => s.id === sala.id);
                if (idx !== -1) db.salas[idx] = { ...db.salas[idx], ...sala };
            } else {
                sala.id = Date.now();
                db.salas.push(sala);
            }
            saveDB(db);
            return sala;
        },

        // --- Modalidades ---
        getModalidades: function() {
            return getDB().modalidades || [];
        },
        salvarModalidade: function(modalidade) {
            const db = getDB();
            if (modalidade.id) {
                const idx = db.modalidades.findIndex(m => m.id === modalidade.id);
                if (idx !== -1) db.modalidades[idx] = { ...db.modalidades[idx], ...modalidade };
            } else {
                modalidade.id = Date.now();
                modalidade.icone = modalidade.icone || 'fa-music';
                db.modalidades.push(modalidade);
            }
            saveDB(db);
            return modalidade;
        },

        // --- Turmas ---
        getTurmas: function() {
            return getDB().turmas || [];
        },
        salvarTurma: function(turma) {
            const db = getDB();
            if (turma.id) {
                const idx = db.turmas.findIndex(t => t.id === turma.id);
                if (idx !== -1) db.turmas[idx] = { ...db.turmas[idx], ...turma };
            } else {
                turma.id = Date.now();
                turma.ocupadas = turma.ocupadas || 0;
                db.turmas.push(turma);
            }
            saveDB(db);
            return turma;
        },
        excluirTurma: function(id) {
            const db = getDB();
            db.turmas = db.turmas.filter(t => t.id !== Number(id));
            saveDB(db);
        },

        // --- Matrículas & Alunos de Turma ---
        getAlunosDaTurma: function(turmaId) {
            const db = getDB();
            const matriculasDaTurma = db.matriculas.filter(m => m.turmaId === Number(turmaId) && m.status === 'ATIVA');
            const idsAlunos = matriculasDaTurma.map(m => m.alunoId);
            return db.usuarios.filter(u => idsAlunos.includes(u.id));
        },
        getTurmasDoAluno: function(alunoId) {
            const db = getDB();
            const matriculasAluno = db.matriculas.filter(m => m.alunoId === Number(alunoId) && m.status === 'ATIVA');
            const idsTurmas = matriculasAluno.map(m => m.turmaId);
            return db.turmas.filter(t => idsTurmas.includes(t.id));
        },
        matricularAluno: function(alunoId, turmaId) {
            const db = getDB();
            const jaMatriculado = db.matriculas.some(m => m.alunoId === Number(alunoId) && m.turmaId === Number(turmaId) && m.status === 'ATIVA');
            if (jaMatriculado) {
                return { success: false, message: 'Aluno já está matriculado nesta turma.' };
            }
            const turma = db.turmas.find(t => t.id === Number(turmaId));
            if (!turma || turma.ocupadas >= turma.vagas) {
                return { success: false, message: 'Turma lotada.' };
            }
            db.matriculas.push({
                id: Date.now(),
                alunoId: Number(alunoId),
                turmaId: Number(turmaId),
                status: 'ATIVA'
            });
            turma.ocupadas = (turma.ocupadas || 0) + 1;
            saveDB(db);
            return { success: true, message: 'Matrícula realizada com sucesso!' };
        },

        // --- Chamada Virtual & Frequência ---
        getPresencas: function(turmaId, data) {
            const db = getDB();
            return db.presencas.filter(p => p.turmaId === Number(turmaId) && (!data || p.data === data));
        },
        salvarPresencaBatch: function(turmaId, data, presencasArray) {
            const db = getDB();
            // Remove registros anteriores daquela turma e data
            db.presencas = db.presencas.filter(p => !(p.turmaId === Number(turmaId) && p.data === data));
            // Adiciona os novos
            presencasArray.forEach(p => {
                db.presencas.push({
                    id: Date.now() + Math.floor(Math.random() * 1000),
                    turmaId: Number(turmaId),
                    alunoId: Number(p.alunoId),
                    data: data,
                    presente: Boolean(p.presente)
                });
            });
            saveDB(db);
            return true;
        },

        // --- Materiais de Apoio & Comunicados ---
        getMateriais: function(turmaId) {
            const db = getDB();
            if (!turmaId) return db.materiais || [];
            return db.materiais.filter(m => m.turmaId === Number(turmaId));
        },
        salvarMaterial: function(material) {
            const db = getDB();
            material.id = Date.now();
            db.materiais.unshift(material);
            saveDB(db);
            return material;
        },
        getComunicados: function(turmaId) {
            const db = getDB();
            if (!turmaId) return db.comunicados || [];
            return db.comunicados.filter(c => c.turmaId === Number(turmaId));
        },
        salvarComunicado: function(comunicado) {
            const db = getDB();
            comunicado.id = Date.now();
            comunicado.data = 'Agora mesmo';
            db.comunicados.unshift(comunicado);
            saveDB(db);
            return comunicado;
        },

        // --- KPIs e Métricas do Admin ---
        getKpis: function() {
            const db = getDB();
            const alunosAtivos = db.usuarios.filter(u => u.perfil === 'ALUNO' && u.ativo).length;
            const professoresAtivos = db.usuarios.filter(u => u.perfil === 'PROFESSOR' && u.ativo).length;
            const totalTurmas = db.turmas.length;
            
            let totalVagas = 0;
            let totalOcupadas = 0;
            db.turmas.forEach(t => {
                totalVagas += (t.vagas || 0);
                totalOcupadas += (t.ocupadas || 0);
            });
            const taxaOcupacao = totalVagas > 0 ? Math.round((totalOcupadas / totalVagas) * 100) : 0;
            const faturamentoEstimado = (alunosAtivos * 189.90).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

            return {
                alunosAtivos,
                professoresAtivos,
                totalTurmas,
                taxaOcupacao: `${taxaOcupacao}%`,
                faturamentoEstimado
            };
        }
    };
})();

// Exporta globalmente no window
window.VibeStore = VibeStore;
