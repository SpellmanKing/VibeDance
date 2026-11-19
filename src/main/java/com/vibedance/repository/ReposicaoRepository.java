package com.vibedance.repository;

import com.vibedance.model.Reposicao;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.util.Collection;
import java.util.List;

public interface ReposicaoRepository extends JpaRepository<Reposicao, Integer> {

    List<Reposicao> findByIdAlunoOrderBySolicitadoEmDesc(Integer idAluno);

    List<Reposicao> findByIdTurmaDestinoInOrderByDataAulaDestinoAsc(Collection<Integer> idsTurmas);

    List<Reposicao> findByIdTurmaDestinoAndDataAulaDestinoAndStatus(Integer idTurma, LocalDate data, String status);

    List<Reposicao> findByIdAlunoAndStatusAndDataAulaDestinoGreaterThanEqual(Integer idAluno, String status, LocalDate data);

    List<Reposicao> findAllByOrderBySolicitadoEmDesc();

    boolean existsByIdAlunoAndIdTurmaDestinoAndDataAulaDestinoAndStatusIn(
        Integer idAluno, Integer idTurma, LocalDate data, Collection<String> status);

    long countByStatus(String status);
}
