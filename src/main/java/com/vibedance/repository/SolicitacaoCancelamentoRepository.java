package com.vibedance.repository;

import com.vibedance.model.SolicitacaoCancelamento;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface SolicitacaoCancelamentoRepository extends JpaRepository<SolicitacaoCancelamento, Integer> {

    List<SolicitacaoCancelamento> findByIdAlunoOrderBySolicitadoEmDesc(Integer idAluno);

    List<SolicitacaoCancelamento> findAllByOrderBySolicitadoEmDesc();

    boolean existsByIdAlunoAndStatus(Integer idAluno, String status);

    long countByStatus(String status);
}
