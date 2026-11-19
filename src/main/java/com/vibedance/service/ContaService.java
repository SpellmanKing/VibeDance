package com.vibedance.service;

import com.vibedance.dto.ApiDtos.*;
import com.vibedance.exception.RecursoNaoEncontradoException;
import com.vibedance.exception.RegraNegocioException;
import com.vibedance.model.Fatura;
import com.vibedance.model.Notificacao;
import com.vibedance.model.Turma;
import com.vibedance.model.Usuario;
import com.vibedance.repository.*;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;

/** Operações da própria conta: perfil, senha, notificações e busca global (Ctrl+K). */
@Service
public class ContaService {

    private final UsuarioRepository usuarioRepository;
    private final NotificacaoRepository notificacaoRepository;
    private final MatriculaRepository matriculaRepository;
    private final TurmaRepository turmaRepository;
    private final FaturaRepository faturaRepository;
    private final PasswordEncoder passwordEncoder;
    private final CatalogoService catalogo;
    private final AuditoriaService auditoria;

    public ContaService(UsuarioRepository usuarioRepository, NotificacaoRepository notificacaoRepository,
                        MatriculaRepository matriculaRepository, TurmaRepository turmaRepository,
                        FaturaRepository faturaRepository, PasswordEncoder passwordEncoder, CatalogoService catalogo,
                        AuditoriaService auditoria) {
        this.usuarioRepository = usuarioRepository;
        this.notificacaoRepository = notificacaoRepository;
        this.matriculaRepository = matriculaRepository;
        this.turmaRepository = turmaRepository;
        this.faturaRepository = faturaRepository;
        this.passwordEncoder = passwordEncoder;
        this.catalogo = catalogo;
        this.auditoria = auditoria;
    }

    @Transactional(readOnly = true)
    public UsuarioResumo eu(Usuario u) {
        return catalogo.usuario(catalogo.usuario(u.getId()));
    }

    /**
     * Atualiza os dados que o próprio usuário pode editar (telefone). A foto só muda pelo
     * upload validado em /api/me/avatar — não se aceita URL arbitrária de imagem.
     */
    @Transactional
    public UsuarioResumo atualizarPerfil(Usuario u, String telefone, String avatarUrl) {
        Usuario atual = catalogo.usuario(u.getId());
        if (telefone != null) {
            String t = telefone.trim();
            if (!t.isEmpty() && !t.matches("^[0-9()+\\-\\s]{8,20}$")) {
                throw new RegraNegocioException("Telefone inválido. Use apenas números, espaços, parênteses, + e -.");
            }
            atual.setTelefone(t.isEmpty() ? null : t);
        }
        UsuarioResumo r = catalogo.usuario(usuarioRepository.save(atual));
        auditoria.registrar(atual, "EDITAR", "USUARIO", atual.getId(), "Dados de contato atualizados pelo próprio usuário");
        return r;
    }

    @Transactional(readOnly = true)
    public MeusDados meusDados(Usuario u) {
        CatalogoService.Contexto ctx = catalogo.contexto();
        Usuario conta = catalogo.usuario(u.getId());
        List<Turma> turmas = switch (conta.getPerfil()) {
            case "ALUNO" -> matriculaRepository.findByIdAlunoAndStatus(conta.getId(), "ATIVA").stream()
                .map(m -> ctx.turmas().get(m.getIdTurma())).filter(t -> t != null && !Boolean.FALSE.equals(t.getAtivo())).toList();
            case "PROFESSOR" -> turmaRepository.findByProfessorIdAndAtivoTrue(conta.getId());
            default -> List.of();
        };
        List<Fatura> abertas = "ALUNO".equals(conta.getPerfil())
            ? faturaRepository.findByIdAluno(conta.getId()).stream()
                .filter(f -> Set.of("PENDENTE", "VENCIDO", "EM_ANALISE").contains(f.getStatus())).toList()
            : List.of();
        java.math.BigDecimal emAberto = abertas.stream().map(Fatura::getValor).reduce(java.math.BigDecimal.ZERO, java.math.BigDecimal::add);
        long naoLidas = notificacaoRepository.countByIdUsuarioAndLidaFalse(conta.getId());
        return new MeusDados(catalogo.usuario(conta), String.format("VD-%06d", conta.getId()), catalogo.turmas(turmas, ctx),
            abertas.size(), emAberto, naoLidas);
    }

    @Transactional
    public void trocarSenha(Usuario u, String atual, String nova) {
        Usuario conta = catalogo.usuario(u.getId());
        if (atual == null || !passwordEncoder.matches(atual, conta.getSenha())) {
            throw new RegraNegocioException("SENHA_INCORRETA", "A senha atual não confere.");
        }
        if (nova == null || nova.trim().length() < 6) throw new RegraNegocioException("A nova senha deve ter no mínimo 6 caracteres.");
        conta.setSenha(passwordEncoder.encode(nova.trim()));
        usuarioRepository.save(conta);
        auditoria.registrar(conta, "SENHA", "USUARIO", conta.getId(), "Senha alterada pelo próprio usuário");
    }

    // ------------------------------------------------------------ notificações

    @Transactional(readOnly = true)
    public NotificacoesResponse notificacoes(Usuario u) {
        List<NotificacaoItem> itens = notificacaoRepository.findTop40ByIdUsuarioOrderByCriadaEmDesc(u.getId()).stream()
            .map(n -> new NotificacaoItem(n.getId(), n.getTitulo(), n.getMensagem(), n.getTipo(), n.getLink(),
                n.getLida(), n.getCriadaEm())).toList();
        return new NotificacoesResponse(notificacaoRepository.countByIdUsuarioAndLidaFalse(u.getId()), itens);
    }

    @Transactional
    public void marcarLida(Usuario u, Integer id) {
        Notificacao n = notificacaoRepository.findById(id).orElseThrow(() -> new RecursoNaoEncontradoException("Notificação"));
        if (!n.getIdUsuario().equals(u.getId())) throw new RecursoNaoEncontradoException("Notificação");
        n.setLida(true);
        notificacaoRepository.save(n);
    }

    @Transactional
    public int marcarTodas(Usuario u) {
        return notificacaoRepository.marcarTodasComoLidas(u.getId());
    }

    // ------------------------------------------------------------ busca global

    @Transactional(readOnly = true)
    public List<BuscaItem> buscar(Usuario u, String q) {
        String termo = q == null ? "" : q.trim().toLowerCase();
        if (termo.length() < 2) return List.of();
        CatalogoService.Contexto ctx = catalogo.contexto();
        List<BuscaItem> itens = new ArrayList<>();

        Collection<Turma> turmasVisiveis = switch (u.getPerfil()) {
            case "ADMINISTRADOR" -> ctx.turmas().values();
            case "PROFESSOR" -> turmaRepository.findByProfessorIdAndAtivoTrue(u.getId());
            default -> matriculaRepository.findByIdAlunoAndStatus(u.getId(), "ATIVA").stream()
                .map(m -> ctx.turmas().get(m.getIdTurma())).filter(Objects::nonNull).toList();
        };
        String rotaTurma = switch (u.getPerfil()) {
            case "ADMINISTRADOR" -> "#/grade?turma=";
            case "PROFESSOR" -> "#/turmas?turma=";
            default -> "#/agenda?turma=";
        };
        for (Turma t : turmasVisiveis) {
            String modalidade = t.getModalidade() == null ? "" : t.getModalidade().getNome();
            if (t.getNomeTurma().toLowerCase().contains(termo) || modalidade.toLowerCase().contains(termo)) {
                itens.add(new BuscaItem("TURMA", t.getId(), t.getNomeTurma(),
                    modalidade + " · " + t.getDiasSemana() + " " + CatalogoService.hora(t.getHorario()),
                    rotaTurma + t.getId(), "fa-layer-group"));
            }
        }

        if ("ADMINISTRADOR".equals(u.getPerfil())) {
            for (Usuario x : ctx.usuarios().values()) {
                if (x.getNome().toLowerCase().contains(termo) || x.getEmail().contains(termo)
                    || (x.getCpf() != null && x.getCpf().contains(termo))) {
                    itens.add(new BuscaItem("USUARIO", x.getId(), x.getNome(), x.getPerfil() + " · " + x.getEmail(),
                        "#/usuarios?id=" + x.getId(), "fa-user"));
                }
            }
            for (Fatura f : faturaRepository.findAll()) {
                String aluno = ctx.nomeUsuario(f.getIdAluno());
                if (f.getTitulo().toLowerCase().contains(termo) || aluno.toLowerCase().contains(termo)) {
                    itens.add(new BuscaItem("FATURA", f.getId(), f.getTitulo(), aluno + " · " + f.getStatus(),
                        "#/financeiro?fatura=" + f.getId(), "fa-receipt"));
                }
            }
        } else if ("PROFESSOR".equals(u.getPerfil())) {
            Set<Integer> vistos = new HashSet<>();
            for (Turma t : turmasVisiveis) {
                matriculaRepository.findByIdTurmaAndStatus(t.getId(), "ATIVA").forEach(m -> {
                    Usuario a = ctx.usuarios().get(m.getIdAluno());
                    if (a != null && vistos.add(a.getId()) && a.getNome().toLowerCase().contains(termo)) {
                        itens.add(new BuscaItem("ALUNO", a.getId(), a.getNome(), t.getNomeTurma(),
                            "#/turmas?turma=" + t.getId(), "fa-user-graduate"));
                    }
                });
            }
        }
        return itens.stream().limit(25).toList();
    }
}
