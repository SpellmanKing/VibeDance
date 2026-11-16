package com.vibedance.repository;

import com.vibedance.model.Comunicado;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ComunicadoRepository extends JpaRepository<Comunicado, Integer> {

    List<Comunicado> findByProfessorIdOrderByDataPostagemDesc(Integer professorId);

    List<Comunicado> findByTurmaIdInOrderByDataPostagemDesc(List<Integer> idsTurmas);
}