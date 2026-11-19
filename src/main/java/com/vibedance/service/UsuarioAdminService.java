package com.vibedance.service;

import com.vibedance.dto.ApiDtos.*;
import com.vibedance.exception.AcessoNegadoException;
import com.vibedance.exception.ConflitoException;
import com.vibedance.exception.RegraNegocioException;
import com.vibedance.model.Matricula;
import com.vibedance.model.Presenca;
import com.vibedance.model.Turma;
import com.vibedance.model.Usuario;
import com.vibedance.repository.*;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.*;

/**
 * Gestão unificada de usuários (Alunos, Professores e ADMs) e matrículas.
 * Toda criação/edição revalida o domínio @vibedance.com (camada de serviço).
 */
@Service
public class UsuarioAdminService {

    private static final Set<String> PERFIS = Set.of("ALUNO", "PROFESSOR", "ADMINISTRADOR");
    private static final Set<String> STATUS_MATRICULA = Set.of("ATIVA", "CANCELADA", "TRANCADA", "PENDENTE");

    private final UsuarioRepository usuarioRepository;
    private final MatriculaRepository matriculaRepository;
    private final TurmaRepository turmaRepository;
    private final FaturaRepository faturaRepository;
    private final PagamentoRepository pagamentoRepository;
    private final PresencaRepository presencaRepository;
    private final AuditoriaGeralRepository auditoriaRepository;
    private final PasswordEncoder passwordEncoder;
    private final CatalogoService catalogo;
    private final AuditoriaService auditoria;
    private final NotificacaoService notificacoes;

    public UsuarioAdminService(UsuarioRepository usuarioRepository, MatriculaRepository matriculaRepository,
                               TurmaRepository turmaRepository, FaturaRepository faturaRepository,
                               PagamentoRepository pagamentoRepository, PresencaRepository presencaRepository,
                               AuditoriaGeralRepository auditoriaRepository, PasswordEncoder passwordEncoder,
                               CatalogoService catalogo, AuditoriaService auditoria, NotificacaoService notificacoes) {
        this.usuarioRepository = usuarioRepository;
        this.matriculaRepository = matriculaRepository;
        this.turmaRepository = turmaRepository;
        this.faturaRepository = faturaRepository;
        this.pagamentoRepository = pagamentoRepository;
        this.presencaRepository = presencaRepository;
        this.auditoriaRepository = auditoriaRepository;
        this.passwordEncoder = passwordEncoder;
        this.catalogo = catalogo;
        this.auditoria = auditoria;
        this.notificacoes = notificacoes;
    }

    @Transactional(readOnly = true)
    public List<UsuarioResumo> listar(String perfil, String status, String busca) {
        String termo = busca == null ? "" : busca.trim().toLowerCase();
        return usuarioRepository.findAllByOrderByNomeAsc().stream()
            .filter(u -> perfil == null || perfil.isBlank() || perfil.equalsIgnoreCase(u.getPerfil()))
            .filter(u -> status == null || status.isBlank()
                || ("ATIVO".equalsIgnoreCase(status) == Boolean.TRUE.equals(u.getAtivo())))
            .filter(u -> termo.isEmpty()
                || u.getNome().toLowerCase().contains(termo)
                || u.getEmail().toLowerCase().contains(termo)
                || (u.getCpf() != null && u.getCpf().contains(termo)))
            .map(catalogo::usuario)
            .toList();
    }

    @Transactional(readOnly = true)
    public UsuarioDetalhe detalhe(Integer id) {
        Usuario u = catalogo.usuario(id);
        CatalogoService.Contexto ctx = catalogo.contexto();

        List<MatriculaItem> matriculas = matriculaRepository.findByIdAluno(id).stream()
            .sorted(Comparator.comparing(Matricula::getId).reversed())
            .map(m -> {
                Turma t = ctx.turmas().get(m.getIdTurma());
                return new MatriculaItem(m.getId(), m.getIdTurma(), t == null ? "—" : t.getNomeTurma(),
                    t == null || t.getModalidade() == null ? null : t.getModalidade().getNome(), m.getStatus(),
                    m.getDataMatricula(), t == null ? null : t.getDiasSemana() + " · " + CatalogoService.hora(t.getHorario()));
            }).toList();

        List<TurmaResumo> lecionadas = "PROFESSOR".equals(u.getPerfil())
            ? catalogo.turmas(turmaRepository.findByProfessorIdOrderByHorarioAsc(id), ctx)
            : List.of();

        long emAberto = faturaRepository.findByIdAluno(id).stream()
            .filter(f -> "PENDENTE".equals(f.getStatus()) || "VENCIDO".equals(f.getStatus())).count();

        List<Presenca> presencas = presencaRepository.findByAlunoIdOrderByDataAulaDesc(id);
        long presentes = presencas.stream().filter(p -> "PRESENTE".equals(p.getStatus())).count();
        long consideradas = presencas.stream().filter(p -> !"JUSTIFICADO".equals(p.getStatus())).count();

        List<AuditoriaItem> historico = auditoriaRepository.findByEntidadeAndIdEntidadeOrderByDataHoraDesc("USUARIO", id)
            .stream().limit(20).map(catalogo::auditoria).toList();

        return new UsuarioDetalhe(catalogo.usuario(u), matriculas, lecionadas, emAberto,
            CatalogoService.percentual(presentes, consideradas), historico);
    }

    @Transactional
    public UsuarioResumo criar(UsuarioForm form, Usuario operador) {
        String email = validarEmail(form.email());
        if (usuarioRepository.findByEmail(email) != null) {
            throw new ConflitoException("EMAIL_DUPLICADO", "Já existe uma conta com o e-mail " + email + ".");
        }
        String cpf = validarCpf(form.cpf());
        if (usuarioRepository.existsByCpf(cpf)) {
            throw new ConflitoException("CPF_DUPLICADO", "Já existe uma conta com o CPF " + cpf + ".");
        }
        if (form.senha() == null || form.senha().trim().length() < 6) {
            throw new RegraNegocioException("A senha inicial deve ter no mínimo 6 caracteres.");
        }
        Usuario u = new Usuario();
        u.setNome(validarNome(form.nome()));
        u.setEmail(email);
        u.setCpf(cpf);
        u.setTelefone(form.telefone());
        u.setPerfil(validarPerfil(form.perfil()));
        u.setSenha(passwordEncoder.encode(form.senha().trim()));
        u.setAtivo(true);
        u.setDataCadastro(LocalDateTime.now());
        Usuario salvo = usuarioRepository.save(u);

        auditoria.registrar(operador, "CRIAR", "USUARIO", salvo.getId(),
            "Conta " + salvo.getPerfil() + " criada: " + salvo.getNome() + " <" + salvo.getEmail() + ">");
        notificacoes.notificar(salvo.getId(), "Bem-vindo(a) ao VibeDance!",
            "Sua conta institucional foi criada pela administração.", "SUCESSO", null);
        return catalogo.usuario(salvo);
    }

    @Transactional
    public UsuarioResumo atualizar(Integer id, UsuarioForm form, Usuario operador) {
        Usuario u = catalogo.usuario(id);
        List<String> mudancas = new ArrayList<>();

        if (form.email() != null && !form.email().isBlank()) {
            String email = validarEmail(form.email());
            if (!email.equals(u.getEmail())) {
                Usuario existente = usuarioRepository.findByEmail(email);
                if (existente != null && !existente.getId().equals(id)) {
                    throw new ConflitoException("EMAIL_DUPLICADO", "E-mail já utilizado por outra conta.");
                }
                mudancas.add("e-mail " + u.getEmail() + " → " + email);
                u.setEmail(email);
            }
        }
        if (form.cpf() != null && !form.cpf().isBlank()) {
            String cpf = validarCpf(form.cpf());
            if (!cpf.equals(u.getCpf())) {
                if (usuarioRepository.existsByCpf(cpf)) {
                    throw new ConflitoException("CPF_DUPLICADO", "CPF já utilizado por outra conta.");
                }
                u.setCpf(cpf);
                mudancas.add("CPF");
            }
        }
        if (form.nome() != null && !form.nome().isBlank() && !form.nome().trim().equals(u.getNome())) {
            mudancas.add("nome");
            u.setNome(validarNome(form.nome()));
        }
        if (form.telefone() != null && !form.telefone().equals(u.getTelefone())) {
            mudancas.add("telefone");
            u.setTelefone(form.telefone());
        }
        if (form.perfil() != null && !form.perfil().isBlank()) {
            String perfil = validarPerfil(form.perfil());
            if (!perfil.equals(u.getPerfil())) {
                if (u.getId().equals(operador.getId())) {
                    throw new RegraNegocioException("Você não pode alterar o próprio perfil de acesso.");
                }
                if ("PROFESSOR".equals(u.getPerfil()) && turmaRepository.findByProfessorIdAndAtivoTrue(id).size() > 0) {
                    throw new RegraNegocioException("Realoque as turmas ativas deste professor antes de mudar o perfil.");
                }
                mudancas.add("perfil " + u.getPerfil() + " → " + perfil);
                u.setPerfil(perfil);
            }
        }
        if (form.senha() != null && !form.senha().isBlank()) {
            if (form.senha().trim().length() < 6) throw new RegraNegocioException("A nova senha deve ter no mínimo 6 caracteres.");
            u.setSenha(passwordEncoder.encode(form.senha().trim()));
            mudancas.add("senha redefinida");
        }
        Usuario salvo = usuarioRepository.save(u);
        if (!mudancas.isEmpty()) {
            auditoria.registrar(operador, "EDITAR", "USUARIO", id, "Alterações em " + salvo.getNome() + ": "
                + String.join(", ", mudancas));
        }
        return catalogo.usuario(salvo);
    }

    @Transactional
    public UsuarioResumo alterarStatus(Integer id, boolean ativo, Usuario operador) {
        Usuario u = catalogo.usuario(id);
        if (u.getId().equals(operador.getId()) && !ativo) {
            throw new RegraNegocioException("Você não pode suspender a própria conta.");
        }
        if (!ativo && "PROFESSOR".equals(u.getPerfil()) && !turmaRepository.findByProfessorIdAndAtivoTrue(id).isEmpty()) {
            throw new RegraNegocioException("Este professor possui turmas ativas. Realoque-as antes de suspender.");
        }
        u.setAtivo(ativo);
        usuarioRepository.save(u);
        auditoria.registrar(operador, ativo ? "REATIVAR" : "SUSPENDER", "USUARIO", id,
            (ativo ? "Conta reativada: " : "Conta suspensa: ") + u.getNome());
        if (ativo) {
            notificacoes.notificar(id, "Conta reativada", "Seu acesso ao VibeDance foi restabelecido.", "SUCESSO", null);
        }
        return catalogo.usuario(u);
    }

    @Transactional
    public void excluir(Integer id, Usuario operador) {
        Usuario u = catalogo.usuario(id);
        if (u.getId().equals(operador.getId())) {
            throw new RegraNegocioException("Você não pode excluir a própria conta.");
        }
        if (!turmaRepository.findByProfessorIdOrderByHorarioAsc(id).isEmpty()) {
            throw new ConflitoException("POSSUI_TURMAS", "Este professor possui turmas vinculadas. Suspenda a conta em vez de excluir.");
        }
        if (!faturaRepository.findByIdAluno(id).isEmpty() || !pagamentoRepository.findByIdAlunoOrderByCriadoEmDesc(id).isEmpty()) {
            throw new ConflitoException("POSSUI_FINANCEIRO",
                "A conta possui histórico financeiro e não pode ser excluída. Use a suspensão para preservar a auditoria.");
        }
        auditoria.registrar(operador, "EXCLUIR", "USUARIO", id, "Conta excluída: " + u.getNome() + " <" + u.getEmail() + ">");
        usuarioRepository.delete(u);
    }

    // ============================================================ matrículas

    @Transactional
    public List<MatriculaItem> vincularMatriculas(Integer alunoId, MatriculaLoteRequest req, Usuario operador) {
        Usuario aluno = catalogo.usuario(alunoId);
        if (!"ALUNO".equals(aluno.getPerfil())) throw new RegraNegocioException("Matrículas só podem ser vinculadas a alunos.");
        if (!Boolean.TRUE.equals(aluno.getAtivo())) throw new RegraNegocioException("Reative a conta do aluno antes de matriculá-lo.");
        if (req.turmas() == null || req.turmas().isEmpty()) throw new RegraNegocioException("Selecione ao menos uma turma.");

        List<String> vinculadas = new ArrayList<>();
        for (Integer turmaId : new LinkedHashSet<>(req.turmas())) {
            Turma turma = turmaRepository.buscarPorIdComBloqueio(turmaId)
                .orElseThrow(() -> new RegraNegocioException("Turma " + turmaId + " não encontrada."));
            if (Boolean.FALSE.equals(turma.getAtivo())) throw new RegraNegocioException("A turma " + turma.getNomeTurma() + " está encerrada.");
            Optional<Matricula> existente = matriculaRepository.findByIdAlunoAndIdTurma(alunoId, turmaId);
            if (existente.isPresent() && "ATIVA".equals(existente.get().getStatus())) continue;
            long ocupadas = matriculaRepository.countByIdTurmaAndStatus(turmaId, "ATIVA");
            if (ocupadas >= turma.getLimiteVagas()) {
                throw new ConflitoException("TURMA_LOTADA", "A turma " + turma.getNomeTurma() + " está lotada ("
                    + ocupadas + "/" + turma.getLimiteVagas() + ").");
            }
            Matricula m = existente.orElseGet(Matricula::new);
            m.setIdAluno(alunoId);
            m.setIdTurma(turmaId);
            m.setStatus("ATIVA");
            matriculaRepository.save(m);
            vinculadas.add(turma.getNomeTurma());
        }
        if (!vinculadas.isEmpty()) {
            auditoria.registrar(operador, "MATRICULAR", "USUARIO", alunoId,
                aluno.getNome() + " matriculado(a) em: " + String.join(", ", vinculadas));
            notificacoes.notificar(alunoId, "Nova matrícula confirmada",
                "Você foi matriculado(a) em: " + String.join(", ", vinculadas) + ".", "AGENDA", "#/agenda");
        }
        return detalhe(alunoId).matriculas();
    }

    @Transactional
    public MatriculaItem alterarStatusMatricula(Integer matriculaId, String status, Usuario operador) {
        String novo = status == null ? "" : status.toUpperCase();
        if (!STATUS_MATRICULA.contains(novo)) throw new RegraNegocioException("Status de matrícula inválido.");
        Matricula m = matriculaRepository.findById(matriculaId)
            .orElseThrow(() -> new RegraNegocioException("Matrícula não encontrada."));
        Turma turma = catalogo.turma(m.getIdTurma());
        if ("ATIVA".equals(novo) && !"ATIVA".equals(m.getStatus())) {
            long ocupadas = matriculaRepository.countByIdTurmaAndStatus(turma.getId(), "ATIVA");
            if (ocupadas >= turma.getLimiteVagas()) throw new ConflitoException("TURMA_LOTADA", "Turma lotada.");
        }
        String anterior = m.getStatus();
        m.setStatus(novo);
        matriculaRepository.save(m);
        Usuario aluno = catalogo.usuario(m.getIdAluno());
        auditoria.registrar(operador, "MATRICULA_" + novo, "USUARIO", m.getIdAluno(),
            "Matrícula de " + aluno.getNome() + " em " + turma.getNomeTurma() + ": " + anterior + " → " + novo);
        notificacoes.notificar(m.getIdAluno(), "Matrícula atualizada",
            "Sua matrícula em " + turma.getNomeTurma() + " agora está " + novo.toLowerCase() + ".", "INFO", "#/agenda");
        return new MatriculaItem(m.getId(), turma.getId(), turma.getNomeTurma(),
            turma.getModalidade() == null ? null : turma.getModalidade().getNome(), novo, m.getDataMatricula(),
            turma.getDiasSemana() + " · " + CatalogoService.hora(turma.getHorario()));
    }

    // ============================================================ validação

    static String validarEmail(String email) {
        if (email == null || email.isBlank()) throw new RegraNegocioException("Informe o e-mail institucional.");
        String limpo = email.trim().toLowerCase();
        if (!Usuario.isDominioInstitucionalValido(limpo)) {
            throw AcessoNegadoException.dominio();
        }
        return limpo;
    }

    private static String validarCpf(String cpf) {
        if (cpf == null) throw new RegraNegocioException("Informe o CPF.");
        String digitos = cpf.replaceAll("\\D", "");
        if (digitos.length() != 11) throw new RegraNegocioException("CPF deve conter 11 dígitos.");
        return digitos.substring(0, 3) + "." + digitos.substring(3, 6) + "." + digitos.substring(6, 9) + "-" + digitos.substring(9);
    }

    private static String validarNome(String nome) {
        if (nome == null || nome.trim().length() < 3) throw new RegraNegocioException("Informe o nome completo.");
        return nome.trim();
    }

    private static String validarPerfil(String perfil) {
        String p = perfil == null ? "ALUNO" : perfil.trim().toUpperCase();
        if (!PERFIS.contains(p)) throw new RegraNegocioException("Perfil inválido.");
        return p;
    }
}
