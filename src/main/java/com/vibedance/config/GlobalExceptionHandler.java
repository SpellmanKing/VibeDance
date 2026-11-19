package com.vibedance.config;

import com.vibedance.exception.ApiException;
import jakarta.servlet.http.HttpServletRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.AuthenticationException;
import org.springframework.web.HttpRequestMethodNotSupportedException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.multipart.MaxUploadSizeExceededException;
import org.springframework.web.servlet.resource.NoResourceFoundException;

import java.time.OffsetDateTime;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.NoSuchElementException;
import java.util.stream.Collectors;

/**
 * Tratamento global de exceções: toda falha da API vira um JSON padronizado
 * { timestamp, status, codigo, erro, caminho, detalhes } consumido pelo
 * interceptor de fetch do front-end (toasts de erro — nenhuma falha silenciosa).
 */
@RestControllerAdvice
public class GlobalExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    @ExceptionHandler(ApiException.class)
    public ResponseEntity<Map<String, Object>> negocio(ApiException ex, HttpServletRequest req) {
        return corpo(ex.getStatus(), ex.getCodigo(), ex.getMessage(), req, ex.getDetalhes());
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<Map<String, Object>> validacao(MethodArgumentNotValidException ex, HttpServletRequest req) {
        Map<String, String> campos = ex.getBindingResult().getFieldErrors().stream()
            .collect(Collectors.toMap(
                f -> f.getField(),
                f -> f.getDefaultMessage() == null ? "inválido" : f.getDefaultMessage(),
                (a, b) -> a,
                LinkedHashMap::new));
        return corpo(HttpStatus.BAD_REQUEST, "VALIDACAO", "Existem campos inválidos no formulário.", req, campos);
    }

    @ExceptionHandler({HttpMessageNotReadableException.class, MethodArgumentTypeMismatchException.class,
        MissingServletRequestParameterException.class})
    public ResponseEntity<Map<String, Object>> requisicaoInvalida(Exception ex, HttpServletRequest req) {
        return corpo(HttpStatus.BAD_REQUEST, "REQUISICAO_INVALIDA",
            "Requisição malformada: verifique os dados enviados.", req, null);
    }

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<Map<String, Object>> argumento(IllegalArgumentException ex, HttpServletRequest req) {
        return corpo(HttpStatus.BAD_REQUEST, "DADOS_INVALIDOS", ex.getMessage(), req, null);
    }

    @ExceptionHandler(IllegalStateException.class)
    public ResponseEntity<Map<String, Object>> estado(IllegalStateException ex, HttpServletRequest req) {
        return corpo(HttpStatus.CONFLICT, "ESTADO_INVALIDO", ex.getMessage(), req, null);
    }

    @ExceptionHandler(NoSuchElementException.class)
    public ResponseEntity<Map<String, Object>> naoEncontrado(NoSuchElementException ex, HttpServletRequest req) {
        return corpo(HttpStatus.NOT_FOUND, "NAO_ENCONTRADO", ex.getMessage(), req, null);
    }

    @ExceptionHandler(NoResourceFoundException.class)
    public ResponseEntity<Map<String, Object>> rotaInexistente(NoResourceFoundException ex, HttpServletRequest req) {
        return corpo(HttpStatus.NOT_FOUND, "ROTA_INEXISTENTE", "Recurso inexistente.", req, null);
    }

    @ExceptionHandler(HttpRequestMethodNotSupportedException.class)
    public ResponseEntity<Map<String, Object>> metodo(HttpRequestMethodNotSupportedException ex, HttpServletRequest req) {
        return corpo(HttpStatus.METHOD_NOT_ALLOWED, "METODO_NAO_SUPORTADO", ex.getMessage(), req, null);
    }

    @ExceptionHandler(DataIntegrityViolationException.class)
    public ResponseEntity<Map<String, Object>> integridade(DataIntegrityViolationException ex, HttpServletRequest req) {
        String causa = String.valueOf(ex.getMostSpecificCause().getMessage());
        if (causa.contains("vibedance")) {
            return corpo(HttpStatus.FORBIDDEN, "DOMINIO_NAO_AUTORIZADO",
                "Apenas contas institucionais @vibedance.com são permitidas.", req, null);
        }
        if (causa.toLowerCase().contains("duplicate") || causa.contains("unique") || causa.contains("único")) {
            return corpo(HttpStatus.CONFLICT, "REGISTRO_DUPLICADO",
                "Já existe um registro com esses dados (e-mail, CPF ou combinação única).", req, null);
        }
        log.warn("Violação de integridade em {}: {}", req.getRequestURI(), causa);
        return corpo(HttpStatus.CONFLICT, "INTEGRIDADE",
            "A operação viola uma regra de integridade do banco de dados.", req, null);
    }

    @ExceptionHandler(MaxUploadSizeExceededException.class)
    public ResponseEntity<Map<String, Object>> upload(MaxUploadSizeExceededException ex, HttpServletRequest req) {
        return corpo(HttpStatus.PAYLOAD_TOO_LARGE, "ARQUIVO_GRANDE", "O arquivo excede o limite de 5 MB.", req, null);
    }

    @ExceptionHandler(AccessDeniedException.class)
    public ResponseEntity<Map<String, Object>> negado(AccessDeniedException ex, HttpServletRequest req) {
        return corpo(HttpStatus.FORBIDDEN, "ACESSO_NEGADO", "Seu perfil não tem permissão para esta operação.", req, null);
    }

    @ExceptionHandler(AuthenticationException.class)
    public ResponseEntity<Map<String, Object>> naoAutenticado(AuthenticationException ex, HttpServletRequest req) {
        return corpo(HttpStatus.UNAUTHORIZED, "NAO_AUTENTICADO", "Sessão inválida ou expirada.", req, null);
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<Map<String, Object>> inesperado(Exception ex, HttpServletRequest req) {
        log.error("Erro inesperado em {} {}", req.getMethod(), req.getRequestURI(), ex);
        return corpo(HttpStatus.INTERNAL_SERVER_ERROR, "ERRO_INTERNO",
            "Erro inesperado no servidor. A equipe técnica foi notificada pelos logs.", req, null);
    }

    public static Map<String, Object> montarCorpo(HttpStatus status, String codigo, String mensagem,
                                                  String caminho, Object detalhes) {
        Map<String, Object> corpo = new LinkedHashMap<>();
        corpo.put("timestamp", OffsetDateTime.now().toString());
        corpo.put("status", status.value());
        corpo.put("codigo", codigo);
        corpo.put("erro", mensagem == null || mensagem.isBlank() ? status.getReasonPhrase() : mensagem);
        corpo.put("caminho", caminho);
        if (detalhes != null) {
            corpo.put("detalhes", detalhes);
        }
        return corpo;
    }

    private ResponseEntity<Map<String, Object>> corpo(HttpStatus status, String codigo, String mensagem,
                                                      HttpServletRequest req, Object detalhes) {
        return ResponseEntity.status(status).body(montarCorpo(status, codigo, mensagem, req.getRequestURI(), detalhes));
    }
}
