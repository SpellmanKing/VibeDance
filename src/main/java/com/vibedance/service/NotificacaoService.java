package com.vibedance.service;

import com.vibedance.model.Notificacao;
import com.vibedance.model.Usuario;
import com.vibedance.repository.NotificacaoRepository;
import com.vibedance.repository.UsuarioRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Collection;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Objects;
import java.util.Set;

/**
 * Persiste notificações do sininho. Cada INSERT dispara (via listener JPA) um evento
 * SSE "notificacao" para o destinatário — o sino atualiza em tempo real.
 */
@Service
public class NotificacaoService {

    private final NotificacaoRepository repository;
    private final UsuarioRepository usuarioRepository;

    public NotificacaoService(NotificacaoRepository repository, UsuarioRepository usuarioRepository) {
        this.repository = repository;
        this.usuarioRepository = usuarioRepository;
    }

    @Transactional
    public void notificar(Collection<Integer> usuarios, String titulo, String mensagem, String tipo, String link) {
        Set<Integer> destinos = new LinkedHashSet<>();
        usuarios.stream().filter(Objects::nonNull).forEach(destinos::add);
        for (Integer idUsuario : destinos) {
            Notificacao n = new Notificacao();
            n.setIdUsuario(idUsuario);
            n.setTitulo(titulo.length() > 150 ? titulo.substring(0, 150) : titulo);
            n.setMensagem(mensagem);
            n.setTipo(tipo == null ? "INFO" : tipo);
            n.setLink(link);
            n.setLida(false);
            repository.save(n);
        }
    }

    @Transactional
    public void notificar(Integer usuario, String titulo, String mensagem, String tipo, String link) {
        notificar(List.of(usuario), titulo, mensagem, tipo, link);
    }

    @Transactional
    public void notificarAdmins(String titulo, String mensagem, String tipo, String link) {
        List<Integer> admins = usuarioRepository.findByPerfilAndAtivoTrueOrderByNomeAsc("ADMINISTRADOR")
            .stream().map(Usuario::getId).toList();
        notificar(admins, titulo, mensagem, tipo, link);
    }
}
