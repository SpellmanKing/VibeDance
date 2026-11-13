package com.vibedance.repository;

import com.vibedance.model.Fatura;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface FaturaRepository extends JpaRepository<Fatura, Integer> {

    List<Fatura> findByIdAlunoOrderByDataVencimentoDesc(Integer idAluno);

    Optional<Fatura> findByIdAndIdAluno(Integer id, Integer idAluno);
    
}