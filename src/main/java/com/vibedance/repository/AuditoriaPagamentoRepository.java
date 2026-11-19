package com.vibedance.repository;

import com.vibedance.model.AuditoriaPagamento;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface AuditoriaPagamentoRepository extends JpaRepository<AuditoriaPagamento, Integer> {

    List<AuditoriaPagamento> findByIdPagamentoOrderByDataHoraDesc(
        Integer idPagamento
    );

    List<AuditoriaPagamento> findByIdUsuarioOperadorOrderByDataHoraDesc(
        Integer idUsuarioOperador
    );

    List<AuditoriaPagamento> findTop300ByOrderByDataHoraDesc();
}
