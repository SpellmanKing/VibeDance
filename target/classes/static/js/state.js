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
        ],
        faturas: [
            {
                id: 1,
                alunoId: 4,
                alunoNome: 'Juliana Paiva',
                turmaId: 1,
                turmaNome: 'Hip Hop Mastercrew',
                titulo: 'Mensalidade Setembro/2026 - Hip Hop',
                mesReferencia: '2026-09',
                valor: 189.90,
                dataVencimento: '2026-09-25',
                status: 'CONFIRMADO',
                pixCopiaCola: '00020126580014br.gov.bcb.pix0136vibedance-financeiro-123455204000053039865406189.905802BR5915VibeDance Studio6008Brasilia62070503***6304ABCD'
            },
            {
                id: 2,
                alunoId: 5,
                alunoNome: 'Lucas Rocha',
                turmaId: 1,
                turmaNome: 'Hip Hop Mastercrew',
                titulo: 'Mensalidade Setembro/2026 - Hip Hop',
                mesReferencia: '2026-09',
                valor: 189.90,
                dataVencimento: '2026-09-25',
                status: 'EM_ANALISE',
                pixCopiaCola: '00020126580014br.gov.bcb.pix0136vibedance-financeiro-123455204000053039865406189.905802BR5915VibeDance Studio6008Brasilia62070503***6304ABCE'
            },
            {
                id: 3,
                alunoId: 6,
                alunoNome: 'Mariana Lima',
                turmaId: 2,
                turmaNome: 'Jazz Funk Commercial Vibe',
                titulo: 'Mensalidade Setembro/2026 - Jazz Funk',
                mesReferencia: '2026-09',
                valor: 189.90,
                dataVencimento: '2026-09-10',
                status: 'VENCIDO',
                pixCopiaCola: '00020126580014br.gov.bcb.pix0136vibedance-financeiro-123455204000053039865406189.905802BR5915VibeDance Studio6008Brasilia62070503***6304ABCF'
            },
            {
                id: 4,
                alunoId: 7,
                alunoNome: 'Gabriel Souza',
                turmaId: 1,
                turmaNome: 'Hip Hop Mastercrew',
                titulo: 'Mensalidade Setembro/2026 - Hip Hop',
                mesReferencia: '2026-09',
                valor: 189.90,
                dataVencimento: '2026-09-30',
                status: 'PENDENTE',
                pixCopiaCola: '00020126580014br.gov.bcb.pix0136vibedance-financeiro-123455204000053039865406189.905802BR5915VibeDance Studio6008Brasilia62070503***6304ABDA'
            },
            {
                id: 5,
                alunoId: 4,
                alunoNome: 'Juliana Paiva',
                turmaId: 2,
                turmaNome: 'Jazz Funk Commercial Vibe',
                titulo: 'Mensalidade Setembro/2026 - Jazz Funk',
                mesReferencia: '2026-09',
                valor: 189.90,
                dataVencimento: '2026-09-28',
                status: 'PENDENTE',
                pixCopiaCola: '00020126580014br.gov.bcb.pix0136vibedance-financeiro-123455204000053039865406189.905802BR5915VibeDance Studio6008Brasilia62070503***6304ABDB'
            }
        ],
        pagamentos: [
            {
                id: 1,
                faturaId: 1,
                alunoId: 4,
                alunoNome: 'Juliana Paiva',
                formaPagamento: 'PIX',
                valor: 189.90,
                status: 'CONFIRMADO',
                comprovanteUrl: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=600',
                comprovanteNome: 'comprovante_pix_juliana.pdf',
                dataEnvio: '2026-09-14T10:30:00.000Z',
                dataConfirmacao: '2026-09-14T11:00:00.000Z',
                validadoPor: 1,
                validadoPorNome: 'Administrador Vibe'
            },
            {
                id: 2,
                faturaId: 2,
                alunoId: 5,
                alunoNome: 'Lucas Rocha',
                formaPagamento: 'COMPROVANTE_MANUAL',
                valor: 189.90,
                status: 'EM_ANALISE',
                comprovanteUrl: 'https://images.unsplash.com/photo-1554224154-26032ffc0d07?w=600',
                comprovanteNome: 'ted_itau_lucas_rocha.jpg',
                dataEnvio: '2026-09-16T14:15:00.000Z',
                dataConfirmacao: null,
                validadoPor: null,
                validadoPorNome: null
            }
        ],
        auditoria: [
            {
                id: 1,
                pagamentoId: 1,
                faturaId: 1,
                operadorId: 4,
                operadorNome: 'Juliana Paiva',
                acao: 'UPLOAD_COMPROVANTE',
                statusAnterior: 'PENDENTE',
                statusNovo: 'EM_ANALISE',
                dataHora: '14/09/2026 10:30',
                observacao: 'Aluno enviou comprovante de transferência bancária via aplicativo'
            },
            {
                id: 2,
                pagamentoId: 1,
                faturaId: 1,
                operadorId: 1,
                operadorNome: 'Administrador Vibe',
                acao: 'APROVACAO_MANUAL',
                statusAnterior: 'EM_ANALISE',
                statusNovo: 'CONFIRMADO',
                dataHora: '14/09/2026 11:00',
                observacao: 'Comprovante verificado pelo Administrador Vibe com valor e data corretos'
            },
            {
                id: 3,
                pagamentoId: 2,
                faturaId: 2,
                operadorId: 5,
                operadorNome: 'Lucas Rocha',
                acao: 'UPLOAD_COMPROVANTE',
                statusAnterior: 'PENDENTE',
                statusNovo: 'EM_ANALISE',
                dataHora: '16/09/2026 14:15',
                observacao: 'Comprovante anexado pelo aluno aguardando conferência bancária'
            }
        ]
    };

    // Canal de Sincronização Realtime entre abas
    let syncBroadcast = null;
    try {
        if (typeof BroadcastChannel !== 'undefined') {
            syncBroadcast = new BroadcastChannel('vibedance_sync_channel');
        }
    } catch (e) {
        console.warn('BroadcastChannel não suportado neste navegador:', e);
    }

    // Carrega ou inicializa no LocalStorage com migração suave
    function getDB() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (!raw) {
                localStorage.setItem(STORAGE_KEY, JSON.stringify(initialData));
                return initialData;
            }
            const data = JSON.parse(raw);
            let updated = false;
            if (!data.faturas || data.faturas.length === 0) {
                data.faturas = initialData.faturas;
                updated = true;
            }
            if (!data.pagamentos) {
                data.pagamentos = initialData.pagamentos;
                updated = true;
            }
            if (!data.auditoria) {
                data.auditoria = initialData.auditoria;
                updated = true;
            }
            if (updated) {
                localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
            }
            return data;
        } catch (e) {
            console.error('Falha ao ler LocalStorage:', e);
            return initialData;
        }
    }

    function saveDB(data) {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
            
            // 1. Notifica abas via BroadcastChannel em tempo real
            if (syncBroadcast) {
                syncBroadcast.postMessage({ type: 'VIBE_STATE_UPDATED', timestamp: Date.now() });
            }

            // 2. Notifica a própria aba localmente
            window.dispatchEvent(new CustomEvent('vibedance_sync_event', { detail: { timestamp: Date.now() } }));
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
        },

        // =========================================================================
        // --- MÓDULO FINANCEIRO: FATURAS, PAGAMENTOS E CONTROLE DE ACESSO RBAC ---
        // =========================================================================

        getFaturas: function(alunoId = null) {
            const db = getDB();
            let lista = db.faturas || [];
            if (alunoId) {
                lista = lista.filter(f => f.alunoId === Number(alunoId));
            }
            return lista;
        },

        getFaturaById: function(id) {
            const db = getDB();
            return (db.faturas || []).find(f => f.id === Number(id));
        },

        getPagamentos: function() {
            return getDB().pagamentos || [];
        },

        getPagamentoByFatura: function(faturaId) {
            const db = getDB();
            return (db.pagamentos || []).find(p => p.faturaId === Number(faturaId));
        },

        getAuditoria: function() {
            return getDB().auditoria || [];
        },

        /**
         * Regra de Negócio: Liberação e Bloqueio de Acesso a Aulas
         * Retorna se o aluno tem presença/acesso autorizado, em análise ou bloqueado
         */
        getStatusAcessoAluno: function(alunoId, turmaId) {
            const db = getDB();
            const faturasAluno = (db.faturas || []).filter(f => f.alunoId === Number(alunoId));
            
            // Prioriza fatura vinculada à turma específica, senão busca fatura geral do mês
            let fatura = faturasAluno.find(f => f.turmaId === Number(turmaId));
            if (!fatura && faturasAluno.length > 0) {
                fatura = faturasAluno[0];
            }

            if (!fatura) {
                return {
                    status: 'AUTORIZADO',
                    label: 'Acesso Liberado (Cortesia/Trial)',
                    badgeClass: 'badge-green',
                    icon: 'fa-check-circle',
                    fatura: null,
                    pagamento: null,
                    autorizado: true
                };
            }

            const pagamento = (db.pagamentos || []).find(p => p.faturaId === fatura.id);

            switch (fatura.status) {
                case 'CONFIRMADO':
                    return {
                        status: 'AUTORIZADO',
                        label: 'Acesso Autorizado',
                        badgeClass: 'badge-green',
                        icon: 'fa-check-circle',
                        fatura: fatura,
                        pagamento: pagamento,
                        autorizado: true
                    };
                case 'EM_ANALISE':
                    return {
                        status: 'EM_ANALISE',
                        label: 'Comprovante em Análise',
                        badgeClass: 'badge-amber',
                        icon: 'fa-hourglass-half',
                        fatura: fatura,
                        pagamento: pagamento,
                        autorizado: false,
                        permiteVisualizarComprovante: Boolean(pagamento && pagamento.comprovanteUrl)
                    };
                case 'VENCIDO':
                    return {
                        status: 'BLOQUEADO',
                        label: 'Acesso Bloqueado (Vencido)',
                        badgeClass: 'badge-red',
                        icon: 'fa-ban',
                        fatura: fatura,
                        pagamento: pagamento,
                        autorizado: false
                    };
                case 'PENDENTE':
                default:
                    return {
                        status: 'PENDENTE',
                        label: 'Acesso Tolerância (Pendente)',
                        badgeClass: 'badge-cyan',
                        icon: 'fa-clock',
                        fatura: fatura,
                        pagamento: pagamento,
                        autorizado: true // Período de tolerância antes do vencimento
                    };
            }
        },

        /**
         * Aluno: Envia comprovante de pagamento para validação
         */
        enviarComprovante: function(faturaId, alunoId, fileData) {
            const db = getDB();
            const fatura = (db.faturas || []).find(f => f.id === Number(faturaId));
            const aluno = (db.usuarios || []).find(u => u.id === Number(alunoId));

            if (!fatura) return { success: false, message: 'Fatura não encontrada.' };

            const statusAnterior = fatura.status;
            fatura.status = 'EM_ANALISE';

            // Atualiza ou cria pagamento
            let pagamento = (db.pagamentos || []).find(p => p.faturaId === fatura.id);
            if (!pagamento) {
                pagamento = {
                    id: Date.now(),
                    faturaId: fatura.id,
                    alunoId: fatura.alunoId,
                    alunoNome: aluno ? aluno.nome : fatura.alunoNome,
                    formaPagamento: 'COMPROVANTE_MANUAL',
                    valor: fatura.valor,
                    status: 'EM_ANALISE',
                    comprovanteUrl: fileData.url || 'https://images.unsplash.com/photo-1554224154-26032ffc0d07?w=600',
                    comprovanteNome: fileData.nome || 'comprovante_transferencia.jpg',
                    dataEnvio: new Date().toISOString(),
                    dataConfirmacao: null,
                    validadoPor: null,
                    validadoPorNome: null
                };
                db.pagamentos.push(pagamento);
            } else {
                pagamento.status = 'EM_ANALISE';
                pagamento.comprovanteUrl = fileData.url || pagamento.comprovanteUrl;
                pagamento.comprovanteNome = fileData.nome || pagamento.comprovanteNome;
                pagamento.dataEnvio = new Date().toISOString();
            }

            // Registra auditoria
            db.auditoria = db.auditoria || [];
            db.auditoria.unshift({
                id: Date.now() + Math.floor(Math.random() * 100),
                pagamentoId: pagamento.id,
                faturaId: fatura.id,
                operadorId: aluno ? aluno.id : Number(alunoId),
                operadorNome: aluno ? aluno.nome : 'Aluno Vibe',
                acao: 'UPLOAD_COMPROVANTE',
                statusAnterior: statusAnterior,
                statusNovo: 'EM_ANALISE',
                dataHora: new Date().toLocaleString('pt-BR'),
                observacao: `Comprovante (${pagamento.comprovanteNome}) anexado para conferência`
            });

            saveDB(db);
            return { success: true, message: 'Comprovante enviado com sucesso! Aguarde a aprovação do administrador.', fatura, pagamento };
        },

        /**
         * Aluno: Simula pagamento automático instantâneo via Pix
         */
        simularPagamentoPix: function(faturaId, alunoId) {
            const db = getDB();
            const fatura = (db.faturas || []).find(f => f.id === Number(faturaId));
            const aluno = (db.usuarios || []).find(u => u.id === Number(alunoId));

            if (!fatura) return { success: false, message: 'Fatura não encontrada.' };

            const statusAnterior = fatura.status;
            fatura.status = 'CONFIRMADO';

            let pagamento = (db.pagamentos || []).find(p => p.faturaId === fatura.id);
            const agoraIso = new Date().toISOString();

            if (!pagamento) {
                pagamento = {
                    id: Date.now(),
                    faturaId: fatura.id,
                    alunoId: fatura.alunoId,
                    alunoNome: aluno ? aluno.nome : fatura.alunoNome,
                    formaPagamento: 'PIX',
                    valor: fatura.valor,
                    status: 'CONFIRMADO',
                    comprovanteUrl: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=600',
                    comprovanteNome: `pix_automatico_${Date.now()}.pdf`,
                    dataEnvio: agoraIso,
                    dataConfirmacao: agoraIso,
                    validadoPor: 0,
                    validadoPorNome: 'Gateway Integrado (PIX API)'
                };
                db.pagamentos.push(pagamento);
            } else {
                pagamento.status = 'CONFIRMADO';
                pagamento.formaPagamento = 'PIX';
                pagamento.dataConfirmacao = agoraIso;
                pagamento.validadoPorNome = 'Gateway Integrado (PIX API)';
            }

            // Auditoria
            db.auditoria = db.auditoria || [];
            db.auditoria.unshift({
                id: Date.now() + Math.floor(Math.random() * 100),
                pagamentoId: pagamento.id,
                faturaId: fatura.id,
                operadorId: 0,
                operadorNome: 'Gateway Integrado',
                acao: 'CONFIRMACAO_AUTOMATICA_PIX',
                statusAnterior: statusAnterior,
                statusNovo: 'CONFIRMADO',
                dataHora: new Date().toLocaleString('pt-BR'),
                observacao: 'Pagamento Pix liquidado instantaneamente pelo Banco Central'
            });

            saveDB(db);
            return { success: true, message: 'Pagamento PIX confirmado com sucesso! Acesso às aulas desbloqueado imediatamente.', fatura, pagamento };
        },

        /**
         * Admin: Aprovação manual de comprovante
         */
        aprovarComprovanteAdmin: function(pagamentoId, adminId, adminNome) {
            const db = getDB();
            const pagamento = (db.pagamentos || []).find(p => p.id === Number(pagamentoId));
            if (!pagamento) return { success: false, message: 'Pagamento não localizado.' };

            const fatura = (db.faturas || []).find(f => f.id === pagamento.faturaId);
            const statusAnterior = pagamento.status;
            const agoraIso = new Date().toISOString();

            pagamento.status = 'CONFIRMADO';
            pagamento.dataConfirmacao = agoraIso;
            pagamento.validadoPor = Number(adminId);
            pagamento.validadoPorNome = adminNome || 'Administrador Vibe';

            if (fatura) {
                fatura.status = 'CONFIRMADO';
            }

            db.auditoria = db.auditoria || [];
            db.auditoria.unshift({
                id: Date.now() + Math.floor(Math.random() * 100),
                pagamentoId: pagamento.id,
                faturaId: fatura ? fatura.id : null,
                operadorId: Number(adminId),
                operadorNome: adminNome || 'Administrador Vibe',
                acao: 'APROVACAO_MANUAL',
                statusAnterior: statusAnterior,
                statusNovo: 'CONFIRMADO',
                dataHora: new Date().toLocaleString('pt-BR'),
                observacao: 'Comprovante verificado e aprovado com sucesso'
            });

            saveDB(db);
            return { success: true, message: 'Comprovante aprovado! Acesso do aluno liberado com badge verde em todas as telas.', pagamento, fatura };
        },

        /**
         * Admin: Rejeição de comprovante com justificativa
         */
        rejeitarComprovanteAdmin: function(pagamentoId, adminId, adminNome, motivo) {
            const db = getDB();
            const pagamento = (db.pagamentos || []).find(p => p.id === Number(pagamentoId));
            if (!pagamento) return { success: false, message: 'Pagamento não localizado.' };

            const fatura = (db.faturas || []).find(f => f.id === pagamento.faturaId);
            const statusAnterior = pagamento.status;

            pagamento.status = 'RECUSADO';
            pagamento.observacao = motivo || 'Comprovante ilegível ou com valor divergente';
            pagamento.validadoPor = Number(adminId);
            pagamento.validadoPorNome = adminNome || 'Administrador Vibe';

            if (fatura) {
                fatura.status = 'PENDENTE';
            }

            db.auditoria = db.auditoria || [];
            db.auditoria.unshift({
                id: Date.now() + Math.floor(Math.random() * 100),
                pagamentoId: pagamento.id,
                faturaId: fatura ? fatura.id : null,
                operadorId: Number(adminId),
                operadorNome: adminNome || 'Administrador Vibe',
                acao: 'REJEICAO_MANUAL',
                statusAnterior: statusAnterior,
                statusNovo: 'RECUSADO',
                dataHora: new Date().toLocaleString('pt-BR'),
                observacao: `Comprovante rejeitado: ${motivo}`
            });

            saveDB(db);
            return { success: true, message: 'Comprovante rejeitado. O aluno foi notificado para enviar novo documento.', pagamento, fatura };
        },

        /**
         * Admin: Métricas consolidadas em tempo real
         */
        getKpisFinanceirosAdmin: function() {
            const db = getDB();
            const faturas = db.faturas || [];

            let receitaTotal = 0;
            let valorPendente = 0;
            let totalInadimplente = 0;
            let qtdVencidas = 0;
            let qtdConfirmadas = 0;
            let qtdEmAnalise = 0;

            faturas.forEach(f => {
                const val = Number(f.valor) || 0;
                if (f.status === 'CONFIRMADO') {
                    receitaTotal += val;
                    qtdConfirmadas++;
                } else if (f.status === 'EM_ANALISE') {
                    valorPendente += val;
                    qtdEmAnalise++;
                } else if (f.status === 'PENDENTE') {
                    valorPendente += val;
                } else if (f.status === 'VENCIDO') {
                    totalInadimplente += val;
                    qtdVencidas++;
                }
            });

            const totalFaturas = faturas.length;
            const taxaInadimplencia = totalFaturas > 0 ? Math.round((qtdVencidas / totalFaturas) * 100) : 0;
            const projecaoMensal = receitaTotal + valorPendente;

            return {
                receitaTotal: receitaTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
                receitaTotalRaw: receitaTotal,
                valorPendente: valorPendente.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
                valorPendenteRaw: valorPendente,
                totalInadimplente: totalInadimplente.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
                taxaInadimplencia: `${taxaInadimplencia}%`,
                projecaoMensal: projecaoMensal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
                projecaoMensalRaw: projecaoMensal,
                comprovantesEmAnaliseQtd: qtdEmAnalise,
                totalTransacoes: (db.pagamentos || []).length
            };
        },

        /**
         * Admin: Fila prioritária de comprovantes pendentes de aprovação
         */
        getComprovantesPendentes: function() {
            const db = getDB();
            const pendentes = (db.pagamentos || []).filter(p => p.status === 'EM_ANALISE');
            return pendentes.map(p => {
                const fatura = (db.faturas || []).find(f => f.id === p.faturaId);
                const aluno = (db.usuarios || []).find(u => u.id === p.alunoId);
                return {
                    ...p,
                    faturaTitulo: fatura ? fatura.titulo : 'Mensalidade Vibe',
                    faturaVencimento: fatura ? fatura.dataVencimento : '-',
                    turmaNome: fatura ? fatura.turmaNome : 'Turma Regular',
                    alunoEmail: aluno ? aluno.email : '',
                    alunoTelefone: aluno ? aluno.telefone : ''
                };
            });
        },

        /**
         * Admin: Tabela analítica com filtros dinâmicos
         */
        getTransacoesAnaliticas: function(filtros = {}) {
            const db = getDB();
            let lista = (db.faturas || []).map(f => {
                const pagamento = (db.pagamentos || []).find(p => p.faturaId === f.id);
                const aluno = (db.usuarios || []).find(u => u.id === f.alunoId);
                return {
                    faturaId: f.id,
                    pagamentoId: pagamento ? pagamento.id : null,
                    alunoId: f.alunoId,
                    alunoNome: f.alunoNome || (aluno ? aluno.nome : 'Aluno'),
                    alunoEmail: aluno ? aluno.email : '',
                    turmaId: f.turmaId,
                    turmaNome: f.turmaNome || 'Geral',
                    titulo: f.titulo,
                    mesReferencia: f.mesReferencia,
                    valor: f.valor,
                    dataVencimento: f.dataVencimento,
                    status: f.status,
                    formaPagamento: pagamento ? pagamento.formaPagamento : 'PIX/Boleto',
                    comprovanteUrl: pagamento ? pagamento.comprovanteUrl : null,
                    comprovanteNome: pagamento ? pagamento.comprovanteNome : null,
                    dataConfirmacao: pagamento ? pagamento.dataConfirmacao : null,
                    validadoPorNome: pagamento ? pagamento.validadoPorNome : null
                };
            });

            // Filtro por Status
            if (filtros.status && filtros.status !== 'TODOS') {
                lista = lista.filter(t => t.status === filtros.status);
            }

            // Filtro por Turma
            if (filtros.turmaId && filtros.turmaId !== 'TODAS') {
                lista = lista.filter(t => t.turmaId === Number(filtros.turmaId));
            }

            // Filtro por Busca de Texto (nome ou e-mail do aluno)
            if (filtros.busca) {
                const termo = filtros.busca.trim().toLowerCase();
                lista = lista.filter(t => 
                    (t.alunoNome && t.alunoNome.toLowerCase().includes(termo)) ||
                    (t.alunoEmail && t.alunoEmail.toLowerCase().includes(termo)) ||
                    (t.titulo && t.titulo.toLowerCase().includes(termo))
                );
            }

            return lista;
        },

        /**
         * Listener Realtime: registra callbacks acionados quando qualquer aba atualiza o estado
         */
        onSync: function(callback) {
            if (typeof callback !== 'function') return;

            // 1. BroadcastChannel (entre abas)
            if (syncBroadcast) {
                syncBroadcast.addEventListener('message', (ev) => {
                    if (ev.data && ev.data.type === 'VIBE_STATE_UPDATED') {
                        callback(ev.data);
                    }
                });
            }

            // 2. CustomEvent (na própria aba)
            window.addEventListener('vibedance_sync_event', (ev) => {
                callback(ev.detail);
            });

            // 3. Fallback: StorageEvent nativo do navegador
            window.addEventListener('storage', (ev) => {
                if (ev.key === STORAGE_KEY) {
                    callback({ source: 'storage' });
                }
            });
        }
    };
})();

// Exporta globalmente no window
window.VibeStore = VibeStore;
