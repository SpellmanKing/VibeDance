package com.vibedance.repository;

import com.vibedance.model.Pagamento;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface PagamentoRepository extends JpaRepository<Pagamento, Integer> {

    List<Pagamento> findByIdAlunoOrderByCriadoEmDesc(Integer idAluno);

    Optional<Pagamento> findByIdAndIdAluno(Integer id, Integer idAluno);

    List<Pagamento> findByIdFaturaAndIdAlunoOrderByCriadoEmDesc(
            Integer idFatura,
            Integer idAluno
    );

    Optional<Pagamento> findByGatewayTransacaoId(String gatewayTransacaoId);
}