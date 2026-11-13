package com.vibedance.repository;

import com.vibedance.model.MaterialAula;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface MaterialAulaRepository extends JpaRepository<MaterialAula, Integer> {

    List<MaterialAula> findByTurmaIdInOrderByDataPublicacaoDesc(
        List<Integer> idsTurmas
    );

    List<MaterialAula> findByModalidadeIdOrderByDataPublicacaoDesc(
        Integer modalidadeId
    );
}