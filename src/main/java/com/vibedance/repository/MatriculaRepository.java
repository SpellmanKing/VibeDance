package com.vibedance.repository;

import org.springframework.data.jpa.repository.Query;
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

    List<Matricula> findByStatus(String status);

    @Query("select m.idTurma, count(m) from Matricula m where m.status = 'ATIVA' group by m.idTurma")
    List<Object[]> contarAtivasPorTurma();
}
