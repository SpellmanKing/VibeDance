package com.vibedance.repository;

import com.vibedance.model.AulaParticular;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface AulaParticularRepository 
        extends JpaRepository<AulaParticular, Integer> {

    List<AulaParticular> findByIdAluno(Integer idAluno);

    List<AulaParticular> findByIdProfessor(Integer idProfessor);

}