package com.vibedance.service;

import com.vibedance.dto.ApiDtos.UsuarioResumo;
import com.vibedance.exception.RecursoNaoEncontradoException;
import com.vibedance.exception.RegraNegocioException;
import com.vibedance.model.Usuario;
import com.vibedance.repository.UsuarioRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.UUID;
import java.util.regex.Pattern;

/**
 * Foto de perfil: aceita JPEG, PNG ou WebP de até 3 MB, validados pelos bytes do
 * arquivo (não pela extensão). Grava com nome aleatório e remove a foto anterior.
 * As fotos são servidas sem login em /api/publico/avatars/{arquivo} (nome não adivinhável).
 */
@Service
public class AvatarService {

    public static final String PREFIXO_URL = "/api/publico/avatars/";
    private static final long LIMITE = 3L * 1024 * 1024;
    private static final Pattern NOME_VALIDO = Pattern.compile("^\\d+-[0-9a-f]{32}\\.(jpg|png|webp)$");

    private final Path diretorio;
    private final UsuarioRepository usuarioRepository;
    private final CatalogoService catalogo;
    private final AuditoriaService auditoria;

    public AvatarService(@Value("${vibedance.avatar-dir:uploads/avatars}") String dir, UsuarioRepository usuarioRepository,
                         CatalogoService catalogo, AuditoriaService auditoria) {
        this.diretorio = Paths.get(dir).toAbsolutePath().normalize();
        this.usuarioRepository = usuarioRepository;
        this.catalogo = catalogo;
        this.auditoria = auditoria;
    }

    @Transactional
    public UsuarioResumo salvar(Usuario eu, MultipartFile arquivo) {
        if (arquivo == null || arquivo.isEmpty()) throw new RegraNegocioException("Escolha uma imagem.");
        if (arquivo.getSize() > LIMITE) throw new RegraNegocioException("A foto deve ter no máximo 3 MB.");
        byte[] bytes;
        try {
            bytes = arquivo.getBytes();
        } catch (IOException e) {
            throw new RegraNegocioException("Não foi possível ler a imagem enviada.");
        }
        String ext = extensao(bytes);
        if (ext == null) throw new RegraNegocioException("Formato não suportado. Envie uma foto JPG, PNG ou WebP.");

        Usuario u = catalogo.usuario(eu.getId());
        String nome = u.getId() + "-" + UUID.randomUUID().toString().replace("-", "") + "." + ext;
        try {
            Files.createDirectories(diretorio);
            Files.write(diretorio.resolve(nome), bytes);
        } catch (IOException e) {
            throw new IllegalStateException("Falha ao gravar a foto de perfil.", e);
        }
        apagarArquivo(u.getAvatarUrl());
        u.setAvatarUrl(PREFIXO_URL + nome);
        usuarioRepository.save(u);
        auditoria.registrar(u, "FOTO", "USUARIO", u.getId(), "Foto de perfil atualizada");
        return catalogo.usuario(u);
    }

    @Transactional
    public UsuarioResumo remover(Usuario eu) {
        Usuario u = catalogo.usuario(eu.getId());
        apagarArquivo(u.getAvatarUrl());
        u.setAvatarUrl(null);
        usuarioRepository.save(u);
        auditoria.registrar(u, "FOTO", "USUARIO", u.getId(), "Foto de perfil removida");
        return catalogo.usuario(u);
    }

    /** Resolve um arquivo de avatar com segurança (sem path traversal). */
    public Path localizar(String nome) {
        if (nome == null || !NOME_VALIDO.matcher(nome).matches()) throw new RecursoNaoEncontradoException("Foto");
        Path p = diretorio.resolve(nome).normalize();
        if (!p.startsWith(diretorio) || !Files.isRegularFile(p)) throw new RecursoNaoEncontradoException("Foto");
        return p;
    }

    public static String tipo(String nome) {
        return nome.endsWith(".png") ? "image/png" : nome.endsWith(".webp") ? "image/webp" : "image/jpeg";
    }

    private void apagarArquivo(String url) {
        if (url == null || !url.startsWith(PREFIXO_URL)) return;
        try {
            Path antigo = localizar(url.substring(PREFIXO_URL.length()));
            Files.deleteIfExists(antigo);
        } catch (Exception ignorado) {
            // foto antiga já não existe: nada a fazer
        }
    }

    /** Identifica o formato real pela assinatura dos bytes. */
    static String extensao(byte[] b) {
        if (b.length > 3 && (b[0] & 0xFF) == 0xFF && (b[1] & 0xFF) == 0xD8 && (b[2] & 0xFF) == 0xFF) return "jpg";
        if (b.length > 8 && (b[0] & 0xFF) == 0x89 && b[1] == 'P' && b[2] == 'N' && b[3] == 'G') return "png";
        if (b.length > 12 && b[0] == 'R' && b[1] == 'I' && b[2] == 'F' && b[3] == 'F'
            && b[8] == 'W' && b[9] == 'E' && b[10] == 'B' && b[11] == 'P') return "webp";
        return null;
    }
}
