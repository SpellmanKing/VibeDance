package com.vibedance.repository;

import com.vibedance.model.Checkin;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface CheckinRepository extends JpaRepository<Checkin, Integer> {

    List<Checkin> findByIdTurmaAndDataAula(Integer idTurma, LocalDate dataAula);

    List<Checkin> findByIdAlunoAndDataAulaGreaterThanEqual(Integer idAluno, LocalDate data);

    Optional<Checkin> findByIdTurmaAndIdAlunoAndDataAula(Integer idTurma, Integer idAluno, LocalDate dataAula);
}
