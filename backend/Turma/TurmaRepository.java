package com.vibedance.repository;

import com.vibedance.model.Turma;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface TurmaRepository extends JpaRepository<Turma, Long> {

    // Método customizado que o Spring Data cria automaticamente
    // Útil para quando o aluno clicar em uma modalidade específica
    List<Turma> findByModalidadeId(Long modalidadeId);

}