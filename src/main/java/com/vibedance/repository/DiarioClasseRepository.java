package com.vibedance.repository;

import com.vibedance.model.DiarioClasse;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface DiarioClasseRepository extends JpaRepository<DiarioClasse, Integer> {

    Optional<DiarioClasse> findByIdTurmaAndDataAula(Integer idTurma, LocalDate dataAula);

    List<DiarioClasse> findByIdTurmaOrderByDataAulaDesc(Integer idTurma);

    List<DiarioClasse> findByIdTurmaInOrderByDataAulaDesc(Collection<Integer> idsTurmas);
}
