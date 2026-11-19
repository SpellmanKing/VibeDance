package com.vibedance.repository;

import com.vibedance.model.Presenca;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

@Repository
public interface PresencaRepository extends JpaRepository<Presenca, Integer> {

    List<Presenca> findByAlunoIdOrderByDataAulaDesc(Integer idAluno);

    List<Presenca> findByTurmaIdAndDataAula(
        Integer idTurma,
        LocalDate dataAula
    );

    Optional<Presenca> findByTurmaIdAndAlunoIdAndDataAula(
        Integer idTurma,
        Integer idAluno,
        LocalDate dataAula
    );

    List<Presenca> findByTurmaIdIn(List<Integer> idsTurmas);

    List<Presenca> findByAlunoIdAndTurmaIdOrderByDataAulaDesc(Integer idAluno, Integer idTurma);

    List<Presenca> findByDataAulaBetween(LocalDate inicio, LocalDate fim);

    List<Presenca> findByTurmaIdAndDataAulaBetween(Integer idTurma, LocalDate inicio, LocalDate fim);
}
