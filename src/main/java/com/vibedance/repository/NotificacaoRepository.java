package com.vibedance.repository;

import com.vibedance.model.Notificacao;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface NotificacaoRepository extends JpaRepository<Notificacao, Integer> {

    List<Notificacao> findTop40ByIdUsuarioOrderByCriadaEmDesc(Integer idUsuario);

    long countByIdUsuarioAndLidaFalse(Integer idUsuario);

    @Modifying
    @Query("update Notificacao n set n.lida = true where n.idUsuario = :idUsuario and n.lida = false")
    int marcarTodasComoLidas(@Param("idUsuario") Integer idUsuario);
}
