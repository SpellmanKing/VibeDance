package com.vibedance.repository;

import com.vibedance.model.Matricula;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface MatriculaRepository extends JpaRepository<Matricula, Integer> {

    List<Matricula> findByIdAluno(Integer idAluno);

    Optional<Matricula> findByIdAlunoAndIdTurma(
        Integer idAluno, Integer idTurma
    );

    List<Matricula> findByIdTurmaAndStatus(Integer idTurma, String status);

    List<Matricula> findByIdAlunoAndStatus(Integer idAluno, String status);
    
    long countByIdTurmaAndStatus(Integer idTurma, String status);
    
    List<Matricula> findByIdTurmaInAndStatus(
        List<Integer> idsTurmas, String status
    );
}