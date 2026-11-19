package com.vibedance.repository;

import com.vibedance.model.Sala;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface SalaRepository extends JpaRepository<Sala, Integer> {

    List<Sala> findAllByOrderByNomeAsc();
}
