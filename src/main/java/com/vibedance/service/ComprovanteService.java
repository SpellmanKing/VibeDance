
package com.vibedance.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.Set;
import java.util.UUID;
import java.util.Locale;

@Service
public class ComprovanteService {

    private final Path diretorio;

    public static final long TAMANHO_MAXIMO = 5 * 1024 * 1024;

    public ComprovanteService(
            @Value("${vibedance.upload-dir}") String diretorioUpload) {

        this.diretorio = Paths.get(diretorioUpload)
                .toAbsolutePath()
                .normalize();
    }

    public String salvar(MultipartFile arquivo) {

        if (arquivo == null || arquivo.isEmpty()) {
            throw new IllegalArgumentException("Selecione um arquivo.");
        }

        if (arquivo.getSize() > TAMANHO_MAXIMO) {
            throw new IllegalArgumentException(
                    "O arquivo deve ter no máximo 5 MB."
            );
        }

        String nomeOriginal = arquivo.getOriginalFilename();
        String extensao = obterExtensao(nomeOriginal);

        if (extensao == null) {
            throw new IllegalArgumentException(
                    "Formato inválido. Envie PDF, JPG ou PNG."
            );
        }

        try {
            byte[] conteudo = arquivo.getBytes();

            if (!conteudoValido(conteudo, extensao)) {
                throw new IllegalArgumentException(
                        "O conteúdo do arquivo não corresponde ao formato informado."
                );
            }

            Files.createDirectories(diretorio);

            String nomeArquivo = UUID.randomUUID() + extensao;
            Path destino = diretorio.resolve(nomeArquivo).normalize();

            if (!destino.startsWith(diretorio)) {
                throw new IllegalArgumentException("Caminho inválido.");
            }

            Files.write(destino, conteudo);

            return destino.toString();

        } catch (IOException e) {
            throw new RuntimeException(
                    "Erro ao armazenar o comprovante.", e
            );
        }
    }

    public Path localizar(String caminhoSalvo) {

        if (caminhoSalvo == null || caminhoSalvo.isBlank()) {
            throw new java.util.NoSuchElementException(
                    "Comprovante não encontrado."
            );
        }

        try {
            Path diretorioReal = diretorio.toRealPath();

            Path arquivo = Paths.get(caminhoSalvo)
                    .toAbsolutePath()
                    .normalize();

            Path arquivoReal = arquivo.toRealPath();

            if (!arquivoReal.startsWith(diretorioReal)
                    || !Files.isRegularFile(arquivoReal)
                    || !Files.isReadable(arquivoReal)) {

                throw new java.util.NoSuchElementException(
                        "Comprovante não encontrado."
                );
            }

            return arquivoReal;

        } catch (IOException e) {
            throw new java.util.NoSuchElementException(
                    "Comprovante não encontrado."
            );
        }
    }

    private boolean conteudoValido(byte[] arquivo, String extensao) {

        if (".pdf".equals(extensao)) {
            return comecaCom(arquivo, new byte[]{'%', 'P', 'D', 'F', '-'});
        }

        if (".jpg".equals(extensao) || ".jpeg".equals(extensao)) {
            return arquivo.length >= 3
                    && (arquivo[0] & 0xFF) == 0xFF
                    && (arquivo[1] & 0xFF) == 0xD8
                    && (arquivo[2] & 0xFF) == 0xFF;
        }

        if (".png".equals(extensao)) {
            return comecaCom(arquivo, new byte[]{
                    (byte) 0x89, 0x50, 0x4E, 0x47,
                    0x0D, 0x0A, 0x1A, 0x0A
            });
        }

        return false;
    }

    private boolean comecaCom(byte[] arquivo, byte[] assinatura) {

        if (arquivo.length < assinatura.length) {
            return false;
        }

        for (int i = 0; i < assinatura.length; i++) {
            if (arquivo[i] != assinatura[i]) {
                return false;
            }
        }

        return true;
    }

    private String obterExtensao(String nomeArquivo) {

        if (nomeArquivo == null || !nomeArquivo.contains(".")) {
            return null;
        }

        String extensao = nomeArquivo.substring(
                nomeArquivo.lastIndexOf(".")
        ).toLowerCase(Locale.ROOT);

        if (!Set.of(".pdf", ".jpg", ".jpeg", ".png").contains(extensao)) {
            return null;
        }

        return extensao;
    }
}