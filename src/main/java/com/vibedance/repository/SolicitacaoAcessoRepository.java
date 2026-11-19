package com.vibedance.repository;

import com.vibedance.model.SolicitacaoAcesso;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

@Repository
public interface SolicitacaoAcessoRepository extends JpaRepository<SolicitacaoAcesso, Integer> {

    Optional<SolicitacaoAcesso> findByProtocolo(String protocolo);

    boolean existsByProtocolo(String protocolo);

    boolean existsByCpfAndStatusIn(String cpf, Collection<String> status);

    List<SolicitacaoAcesso> findAllByOrderBySolicitadoEmDesc();

    long countByStatusIn(Collection<String> status);
}
