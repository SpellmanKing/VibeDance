package com.vibedance.service;

import com.vibedance.dto.ApiDtos.*;
import com.vibedance.exception.ApiException;
import com.vibedance.exception.ConflitoException;
import com.vibedance.exception.RecursoNaoEncontradoException;
import com.vibedance.exception.RegraNegocioException;
import com.vibedance.model.SolicitacaoAcesso;
import com.vibedance.model.Turma;
import com.vibedance.model.Usuario;
import com.vibedance.repository.SolicitacaoAcessoRepository;
import com.vibedance.repository.UsuarioRepository;
import com.vibedance.util.AgendaUtil;
import com.vibedance.util.RequestUtil;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.text.Normalizer;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.Period;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.regex.Pattern;

/**
 * Pedidos de acesso ("Quero dançar"): a pessoa interessada envia um pedido público,
 * o ADM analisa, aprova (criando a conta @vibedance.com e, se quiser, as matrículas)
 * ou recusa com parecer. Aprovado, o pedido vira um convite: com protocolo + e-mail
 * de contato a pessoa define a própria senha e entra no Portal do Aluno.
 */
@Service
public class AcessoService {

    static final Set<String> EXPERIENCIAS = Set.of("NUNCA", "POUCA", "REGULAR", "PROFISSIONAL");
    static final Set<String> OBJETIVOS = Set.of("SAUDE", "HOBBY", "PALCO", "COMPETICAO", "SOCIAL", "OUTRO");
    static final Set<String> DISPONIBILIDADE = Set.of("SEG", "TER", "QUA", "QUI", "SEX", "SAB", "DOM", "MANHA", "TARDE", "NOITE");
    static final Set<String> ABERTOS = Set.of("NOVA", "EM_CONTATO");
    static final int VALIDADE_CONVITE_DIAS = 14;

    private static final Pattern EMAIL = Pattern.compile("^[^@\\s]{1,64}@[^@\\s]+\\.[^@\\s]{2,}$");
    private static final Pattern TELEFONE = Pattern.compile("^\\+?[0-9()\\s.-]{10,20}$");
    private static final char[] ALFABETO = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789".toCharArray();
    private static final SecureRandom RANDOM = new SecureRandom();

    private final SolicitacaoAcessoRepository repository;
    private final UsuarioRepository usuarioRepository;
    private final UsuarioAdminService usuarios;
    private final CatalogoService catalogo;
    private final NotificacaoService notificacoes;
    private final AuditoriaService auditoria;
    private final PasswordEncoder passwordEncoder;

    /** Limite simples por IP para as rotas públicas (envio e consulta/ativação). */
    private final Map<String, Deque<Long>> tentativas = new ConcurrentHashMap<>();

    public AcessoService(SolicitacaoAcessoRepository repository, UsuarioRepository usuarioRepository,
                         UsuarioAdminService usuarios, CatalogoService catalogo, NotificacaoService notificacoes,
                         AuditoriaService auditoria, PasswordEncoder passwordEncoder) {
        this.repository = repository;
        this.usuarioRepository = usuarioRepository;
        this.usuarios = usuarios;
        this.catalogo = catalogo;
        this.notificacoes = notificacoes;
        this.auditoria = auditoria;
        this.passwordEncoder = passwordEncoder;
    }

    // ============================================================ público

    @Transactional
    public PedidoAcessoRecibo solicitar(PedidoAcessoForm f) {
        limitar("envio", 5, 60);
        // Campo invisível: só robôs o preenchem
        if (f.site() != null && !f.site().isBlank()) throw new RegraNegocioException("Não foi possível enviar o pedido.");
        if (!Boolean.TRUE.equals(f.consentimento())) {
            throw new RegraNegocioException("Autorize o uso dos seus dados para que o estúdio possa entrar em contato.");
        }
        String nome = texto(f.nome(), 120);
        if (nome == null || nome.length() < 5 || !nome.contains(" ")) throw new RegraNegocioException("Informe seu nome completo.");
        String email = f.email() == null ? "" : f.email().trim().toLowerCase();
        if (email.length() > 150 || !EMAIL.matcher(email).matches()) throw new RegraNegocioException("Informe um e-mail válido para contato.");
        String telefone = f.telefone() == null ? "" : f.telefone().trim();
        if (!TELEFONE.matcher(telefone).matches() || telefone.replaceAll("\\D", "").length() < 10) {
            throw new RegraNegocioException("Informe um telefone com DDD.");
        }
        String cpf = cpfValido(f.cpf());
        LocalDate nascimento = f.dataNascimento();
        if (nascimento != null) {
            int idade = Period.between(nascimento, AgendaUtil.hoje()).getYears();
            if (nascimento.isAfter(AgendaUtil.hoje()) || idade < 4 || idade > 100) throw new RegraNegocioException("Confira a data de nascimento.");
        }
        String experiencia = f.experiencia() == null ? "" : f.experiencia().toUpperCase();
        if (!EXPERIENCIAS.contains(experiencia)) throw new RegraNegocioException("Conte sua experiência com dança.");
        String objetivo = f.objetivo() == null || f.objetivo().isBlank() ? null : f.objetivo().toUpperCase();
        if (objetivo != null && !OBJETIVOS.contains(objetivo)) throw new RegraNegocioException("Objetivo inválido.");

        List<String> modalidades = f.modalidades() == null ? List.of()
            : f.modalidades().stream().map(m -> texto(m, 40)).filter(Objects::nonNull).distinct().limit(6).toList();
        List<String> disponibilidade = f.disponibilidade() == null ? List.of()
            : f.disponibilidade().stream().map(String::toUpperCase).filter(DISPONIBILIDADE::contains).distinct().toList();
        CatalogoService.Contexto ctx = catalogo.contexto();
        List<Integer> turmas = f.turmas() == null ? List.of() : f.turmas().stream().filter(Objects::nonNull).distinct()
            .filter(id -> ctx.turmas().containsKey(id) && !Boolean.FALSE.equals(ctx.turmas().get(id).getAtivo())).limit(3).toList();
        if (modalidades.isEmpty() && turmas.isEmpty()) throw new RegraNegocioException("Escolha ao menos uma modalidade ou turma de interesse.");

        if (usuarioRepository.existsByCpf(cpf)) {
            throw new ConflitoException("CPF_JA_CADASTRADO", "Este CPF já tem uma conta no VibeDance. Entre no portal ou fale com a recepção.");
        }
        if (repository.existsByCpfAndStatusIn(cpf, ABERTOS)) {
            throw new ConflitoException("PEDIDO_EM_ANDAMENTO", "Já existe um pedido em análise para este CPF. Acompanhe pelo protocolo que você recebeu.");
        }

        SolicitacaoAcesso s = new SolicitacaoAcesso();
        s.setProtocolo(novoProtocolo());
        s.setNome(nome);
        s.setEmailContato(email);
        s.setTelefone(telefone);
        s.setCpf(cpf);
        s.setDataNascimento(nascimento);
        s.setModalidades(SolicitacaoAcesso.juntar(modalidades));
        s.setExperiencia(experiencia);
        s.setTurmasInteresse(SolicitacaoAcesso.juntar(turmas));
        s.setDisponibilidade(SolicitacaoAcesso.juntar(disponibilidade));
        s.setObjetivo(objetivo);
        s.setMensagem(texto(f.mensagem(), 1000));
        s.setOrigem(texto(f.origem(), 40));
        s.setStatus("NOVA");
        s.setIpOrigem(RequestUtil.ipAtual());
        SolicitacaoAcesso salva = repository.saveAndFlush(s);

        notificacoes.notificarAdmins("Novo pedido de acesso",
            nome + " quer dançar" + (modalidades.isEmpty() ? "" : " (" + String.join(", ", modalidades) + ")") + ".",
            "INFO", "#/acessos?id=" + salva.getId());
        return new PedidoAcessoRecibo(salva.getProtocolo(), primeiroNome(nome), LocalDateTime.now());
    }

    @Transactional(readOnly = true)
    public PedidoAcessoPublico consultar(ConsultaAcessoRequest req) {
        limitar("consulta", 30, 60);
        return publico(localizar(req.protocolo(), req.email()));
    }

    @Transactional
    public PedidoAcessoPublico ativar(AtivacaoAcessoRequest req) {
        limitar("consulta", 30, 60);
        SolicitacaoAcesso s = localizar(req.protocolo(), req.email());
        if (!"APROVADA".equals(s.getStatus()) || s.getIdUsuarioCriado() == null) {
            throw new RegraNegocioException("Este pedido ainda não foi aprovado.");
        }
        if (s.getAtivadoEm() != null) throw new RegraNegocioException("Este acesso já foi ativado. Entre com seu e-mail institucional.");
        if (conviteExpirado(s)) throw new RegraNegocioException("CONVITE_EXPIRADO", "O convite expirou. Peça à recepção para reenviá-lo.");
        String senha = req.senha() == null ? "" : req.senha();
        if (senha.length() < 8 || !senha.matches(".*[A-Za-z].*") || !senha.matches(".*\\d.*")) {
            throw new RegraNegocioException("A senha precisa ter ao menos 8 caracteres, com letras e números.");
        }
        Usuario u = usuarioRepository.findById(s.getIdUsuarioCriado())
            .orElseThrow(() -> new RegraNegocioException("A conta deste pedido não existe mais. Fale com a recepção."));
        u.setSenha(passwordEncoder.encode(senha));
        usuarioRepository.save(u);
        s.setAtivadoEm(LocalDateTime.now());
        s.setAtualizadoEm(LocalDateTime.now());
        repository.save(s);
        auditoria.registrar(u, "ATIVAR_ACESSO", "USUARIO", u.getId(), u.getNome() + " ativou o acesso (protocolo " + s.getProtocolo() + ")");
        notificacoes.notificarAdmins("Acesso ativado", u.getNome() + " ativou a conta e já pode entrar.", "SUCESSO", "#/acessos?id=" + s.getId());
        return publico(s);
    }

    private SolicitacaoAcesso localizar(String protocolo, String email) {
        String p = protocolo == null ? "" : protocolo.trim().toUpperCase();
        if (!p.startsWith("VD-")) p = "VD-" + p;
        String e = email == null ? "" : email.trim().toLowerCase();
        Optional<SolicitacaoAcesso> s = repository.findByProtocolo(p);
        // Mesma resposta para protocolo inexistente ou e-mail incorreto: não revela pedidos de terceiros
        if (s.isEmpty() || !s.get().getEmailContato().equalsIgnoreCase(e)) throw new RecursoNaoEncontradoException("Pedido");
        return s.get();
    }

    private PedidoAcessoPublico publico(SolicitacaoAcesso s) {
        CatalogoService.Contexto ctx = catalogo.contexto();
        boolean aprovada = "APROVADA".equals(s.getStatus());
        boolean recusada = "RECUSADA".equals(s.getStatus());
        boolean expirado = aprovada && s.getAtivadoEm() == null && conviteExpirado(s);
        List<EtapaAcesso> etapas = List.of(
            new EtapaAcesso("RECEBIDO", "Pedido recebido", "Seu pedido chegou à equipe do estúdio.", s.getSolicitadoEm(), "feito"),
            new EtapaAcesso("CONTATO", "Conversa com o estúdio",
                "EM_CONTATO".equals(s.getStatus()) ? "A recepção está falando com você para alinhar turma e horário."
                    : "NOVA".equals(s.getStatus()) ? "A recepção vai entrar em contato pelo telefone ou e-mail informados." : "Etapa concluída.",
                "EM_CONTATO".equals(s.getStatus()) ? s.getAtualizadoEm() : null,
                "NOVA".equals(s.getStatus()) ? "atual" : "EM_CONTATO".equals(s.getStatus()) ? "atual" : "feito"),
            new EtapaAcesso("DECISAO", recusada ? "Pedido não aprovado" : "Matrícula aprovada",
                recusada ? "Veja a mensagem do estúdio abaixo." : aprovada ? "Sua conta institucional foi criada." : "A administração confirma sua vaga.",
                s.getAvaliadoEm(), recusada ? "recusado" : aprovada ? "feito" : "pendente"),
            new EtapaAcesso("ATIVACAO", "Acesso ativado", s.getAtivadoEm() != null ? "Tudo pronto: é só entrar no portal."
                : "Você define sua senha e entra no Portal do Aluno.", s.getAtivadoEm(),
                s.getAtivadoEm() != null ? "feito" : aprovada ? "atual" : "pendente"));
        List<String> turmas = s.getIdsTurmas().stream().map(id -> ctx.turmas().get(id)).filter(Objects::nonNull)
            .map(Turma::getNomeTurma).toList();
        return new PedidoAcessoPublico(s.getProtocolo(), primeiroNome(s.getNome()), s.getStatus(), s.getSolicitadoEm(),
            aprovada || recusada ? s.getResposta() : null, aprovada ? s.getEmailInstitucional() : null,
            s.getAtivadoEm() != null, aprovada && s.getAtivadoEm() == null && !expirado, expirado, turmas, etapas);
    }

    // ============================================================ ADM

    @Transactional(readOnly = true)
    public List<PedidoAcessoItem> listar() {
        CatalogoService.Contexto ctx = catalogo.contexto();
        return repository.findAllByOrderBySolicitadoEmDesc().stream().map(s -> item(s, ctx, false)).toList();
    }

    @Transactional(readOnly = true)
    public PedidoAcessoItem detalhe(Integer id) {
        return item(buscar(id), catalogo.contexto(), true);
    }

    @Transactional
    public PedidoAcessoItem marcarContato(Integer id, NotaAcessoRequest req, Usuario operador) {
        SolicitacaoAcesso s = buscar(id);
        if (!ABERTOS.contains(s.getStatus())) throw new RegraNegocioException("Este pedido já foi decidido.");
        s.setStatus("EM_CONTATO");
        s.setAtualizadoEm(LocalDateTime.now());
        String nota = texto(req == null ? null : req.nota(), 1000);
        if (nota != null) s.setNotaInterna(nota);
        repository.save(s);
        auditoria.registrar(operador, "CONTATO", "ACESSO", id, "Pedido " + s.getProtocolo() + " de " + s.getNome() + " em contato");
        return detalhe(id);
    }

    @Transactional
    public PedidoAcessoItem salvarNota(Integer id, NotaAcessoRequest req) {
        SolicitacaoAcesso s = buscar(id);
        s.setNotaInterna(texto(req == null ? null : req.nota(), 1000));
        repository.save(s);
        return detalhe(id);
    }

    @Transactional
    public PedidoAcessoItem aprovar(Integer id, AprovarAcessoRequest req, Usuario operador) {
        SolicitacaoAcesso s = buscar(id);
        if (!ABERTOS.contains(s.getStatus())) throw new RegraNegocioException("Este pedido já foi decidido.");
        String email = req == null || req.emailInstitucional() == null || req.emailInstitucional().isBlank()
            ? sugerirEmail(s.getNome()) : req.emailInstitucional().trim().toLowerCase();

        // Conta criada com senha aleatória e inutilizável: quem define a senha é a própria pessoa, na ativação
        UsuarioResumo conta = usuarios.criar(new UsuarioForm(s.getNome(), email, s.getCpf(), s.getTelefone(), "ALUNO",
            senhaAleatoria()), operador);
        List<Integer> turmas = req == null || req.turmas() == null ? List.of() : req.turmas();
        if (!turmas.isEmpty()) usuarios.vincularMatriculas(conta.id(), new MatriculaLoteRequest(turmas), operador);

        s.setStatus("APROVADA");
        s.setEmailInstitucional(conta.email());
        s.setIdUsuarioCriado(conta.id());
        s.setResposta(texto(req == null ? null : req.mensagem(), 1000));
        s.setAvaliadoPor(operador.getId());
        s.setAvaliadoEm(LocalDateTime.now());
        s.setAtualizadoEm(LocalDateTime.now());
        repository.save(s);
        auditoria.registrar(operador, "APROVAR", "ACESSO", id, "Pedido " + s.getProtocolo() + " aprovado: conta " + conta.email()
            + (turmas.isEmpty() ? "" : " com " + turmas.size() + " matrícula(s)"));
        return detalhe(id);
    }

    @Transactional
    public PedidoAcessoItem recusar(Integer id, DecisaoRequest req, Usuario operador) {
        SolicitacaoAcesso s = buscar(id);
        if (!ABERTOS.contains(s.getStatus())) throw new RegraNegocioException("Este pedido já foi decidido.");
        String resposta = texto(req == null ? null : req.resposta(), 1000);
        if (resposta == null || resposta.length() < 10) throw new RegraNegocioException("Escreva uma resposta de ao menos 10 caracteres para a pessoa.");
        s.setStatus("RECUSADA");
        s.setResposta(resposta);
        s.setAvaliadoPor(operador.getId());
        s.setAvaliadoEm(LocalDateTime.now());
        s.setAtualizadoEm(LocalDateTime.now());
        repository.save(s);
        auditoria.registrar(operador, "RECUSAR", "ACESSO", id, "Pedido " + s.getProtocolo() + " de " + s.getNome() + " recusado");
        return detalhe(id);
    }

    /** Renova o prazo do convite de ativação. */
    @Transactional
    public PedidoAcessoItem renovarConvite(Integer id, Usuario operador) {
        SolicitacaoAcesso s = buscar(id);
        if (!"APROVADA".equals(s.getStatus()) || s.getAtivadoEm() != null) throw new RegraNegocioException("Não há convite pendente neste pedido.");
        s.setAvaliadoEm(LocalDateTime.now());
        s.setAtualizadoEm(LocalDateTime.now());
        repository.save(s);
        auditoria.registrar(operador, "RENOVAR_CONVITE", "ACESSO", id, "Convite do pedido " + s.getProtocolo() + " renovado");
        return detalhe(id);
    }

    public long pendentes() {
        return repository.countByStatusIn(ABERTOS);
    }

    private PedidoAcessoItem item(SolicitacaoAcesso s, CatalogoService.Contexto ctx, boolean completo) {
        List<TurmaResumo> turmas = s.getIdsTurmas().stream().map(i -> ctx.turmas().get(i)).filter(Objects::nonNull)
            .map(t -> catalogo.turma(t, ctx)).toList();
        Integer idade = s.getDataNascimento() == null ? null : Period.between(s.getDataNascimento(), AgendaUtil.hoje()).getYears();
        List<String> alertas = new ArrayList<>();
        String sugestao = null;
        if (completo) {
            if (ABERTOS.contains(s.getStatus()) && usuarioRepository.existsByCpf(s.getCpf())) {
                alertas.add("Já existe uma conta com este CPF. Recuse o pedido ou oriente a pessoa a entrar com a conta atual.");
            }
            if (idade != null && idade < 18) alertas.add("Menor de idade (" + idade + " anos): confirme os dados do responsável no contato.");
            turmas.stream().filter(t -> t.ocupadas() >= t.limiteVagas())
                .forEach(t -> alertas.add("A turma " + t.nome() + " está lotada no momento."));
            if (ABERTOS.contains(s.getStatus())) sugestao = sugerirEmail(s.getNome());
        }
        return new PedidoAcessoItem(s.getId(), s.getProtocolo(), s.getNome(), s.getEmailContato(), s.getTelefone(), s.getCpf(),
            s.getDataNascimento(), idade, SolicitacaoAcesso.separar(s.getModalidades()), s.getExperiencia(), turmas,
            SolicitacaoAcesso.separar(s.getDisponibilidade()), s.getObjetivo(), s.getMensagem(), s.getOrigem(), s.getStatus(),
            s.getResposta(), s.getNotaInterna(), s.getEmailInstitucional(), s.getIdUsuarioCriado(),
            s.getAvaliadoPor() == null ? null : ctx.nomeUsuario(s.getAvaliadoPor()), s.getSolicitadoEm(), s.getAtualizadoEm(),
            s.getAvaliadoEm(), s.getAtivadoEm(), "APROVADA".equals(s.getStatus()) && s.getAtivadoEm() == null && conviteExpirado(s),
            sugestao, alertas);
    }

    private SolicitacaoAcesso buscar(Integer id) {
        return repository.findById(id).orElseThrow(() -> new RecursoNaoEncontradoException("Pedido"));
    }

    // ============================================================ utilidades

    private static boolean conviteExpirado(SolicitacaoAcesso s) {
        return s.getAvaliadoEm() != null && s.getAvaliadoEm().plusDays(VALIDADE_CONVITE_DIAS).isBefore(LocalDateTime.now());
    }

    /** aluno.primeiro.ultimo@vibedance.com, numerado se já existir. */
    String sugerirEmail(String nome) {
        String[] partes = Normalizer.normalize(nome, Normalizer.Form.NFD).replaceAll("\\p{M}", "").toLowerCase(Locale.ROOT)
            .replaceAll("[^a-z\\s]", " ").trim().split("\\s+");
        List<String> uteis = Arrays.stream(partes).filter(p -> p.length() > 2 || partes.length <= 2).toList();
        if (uteis.isEmpty()) uteis = List.of("aluno");
        String base = "aluno." + uteis.get(0) + (uteis.size() > 1 ? "." + uteis.get(uteis.size() - 1) : "");
        String email = base + "@vibedance.com";
        for (int i = 2; usuarioRepository.findByEmail(email) != null; i++) email = base + i + "@vibedance.com";
        return email;
    }

    private String novoProtocolo() {
        String p;
        do {
            StringBuilder sb = new StringBuilder("VD-");
            for (int i = 0; i < 6; i++) sb.append(ALFABETO[RANDOM.nextInt(ALFABETO.length)]);
            p = sb.toString();
        } while (repository.existsByProtocolo(p));
        return p;
    }

    private static String senhaAleatoria() {
        byte[] b = new byte[24];
        RANDOM.nextBytes(b);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(b);
    }

    private static String primeiroNome(String nome) {
        return nome == null ? "" : nome.trim().split("\\s+")[0];
    }

    private static String texto(String v, int max) {
        if (v == null) return null;
        String t = v.trim().replaceAll("\\s{2,}", " ");
        if (t.isEmpty()) return null;
        return t.length() > max ? t.substring(0, max) : t;
    }

    /** Valida os dígitos verificadores e devolve no formato 000.000.000-00. */
    static String cpfValido(String cpf) {
        String d = cpf == null ? "" : cpf.replaceAll("\\D", "");
        if (d.length() != 11 || d.chars().distinct().count() == 1) throw new RegraNegocioException("CPF inválido.");
        for (int pos = 9; pos <= 10; pos++) {
            int soma = 0;
            for (int i = 0; i < pos; i++) soma += (d.charAt(i) - '0') * (pos + 1 - i);
            int dv = (soma * 10) % 11 % 10;
            if (dv != d.charAt(pos) - '0') throw new RegraNegocioException("CPF inválido. Confira os números.");
        }
        return d.substring(0, 3) + "." + d.substring(3, 6) + "." + d.substring(6, 9) + "-" + d.substring(9);
    }

    private void limitar(String tipo, int maximo, int minutos) {
        String chave = tipo + "|" + Objects.requireNonNullElse(RequestUtil.ipAtual(), "?");
        long agora = System.currentTimeMillis();
        long janela = minutos * 60_000L;
        Deque<Long> fila = tentativas.computeIfAbsent(chave, k -> new ArrayDeque<>());
        synchronized (fila) {
            while (!fila.isEmpty() && agora - fila.peekFirst() > janela) fila.pollFirst();
            if (fila.size() >= maximo) {
                throw new ApiException(HttpStatus.TOO_MANY_REQUESTS, "MUITAS_TENTATIVAS",
                    "Muitas tentativas em pouco tempo. Aguarde alguns minutos e tente de novo.");
            }
            fila.addLast(agora);
        }
    }
}
