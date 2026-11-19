package com.vibedance.repository;

import com.vibedance.model.AuditoriaGeral;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface AuditoriaGeralRepository extends JpaRepository<AuditoriaGeral, Integer> {

    List<AuditoriaGeral> findTop1000ByOrderByDataHoraDesc();

    List<AuditoriaGeral> findByEntidadeAndIdEntidadeOrderByDataHoraDesc(String entidade, Integer idEntidade);
}
