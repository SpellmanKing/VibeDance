package com.vibedance.repository;

import com.vibedance.model.Turma;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface TurmaRepository extends JpaRepository<Turma, Integer> {

    // Método customizado que o Spring Data cria automaticamente
    // Útil para quando o aluno clicar em uma modalidade específica
    List<Turma> findByModalidadeId(Integer modalidadeId);

    List<Turma> findByProfessorIdAndAtivoTrue(Integer professorId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT t FROM Turma t WHERE t.id = :id")
    Optional<Turma> buscarPorIdComBloqueio(@Param("id") Integer id);

    List<Turma> findByAtivoTrueOrderByHorarioAsc();

    List<Turma> findByProfessorIdOrderByHorarioAsc(Integer professorId);
}
