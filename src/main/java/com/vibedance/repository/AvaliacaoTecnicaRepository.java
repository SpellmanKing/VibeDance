package com.vibedance.repository;

import com.vibedance.model.AvaliacaoTecnica;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface AvaliacaoTecnicaRepository extends JpaRepository<AvaliacaoTecnica, Integer> {

    List<AvaliacaoTecnica> findByIdAlunoOrderByDataAvaliacaoDesc(Integer idAluno);

    List<AvaliacaoTecnica> findByIdTurmaOrderByDataAvaliacaoDesc(Integer idTurma);

    List<AvaliacaoTecnica> findByIdTurmaAndIdAlunoOrderByDataAvaliacaoDesc(Integer idTurma, Integer idAluno);
}
