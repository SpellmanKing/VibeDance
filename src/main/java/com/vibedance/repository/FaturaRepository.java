package com.vibedance.repository;

import java.time.LocalDate;
import com.vibedance.model.Fatura;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface FaturaRepository extends JpaRepository<Fatura, Integer> {

    List<Fatura> findByIdAlunoOrderByDataVencimentoDesc(Integer idAluno);

    Optional<Fatura> findByIdAndIdAluno(Integer id, Integer idAluno);

    List<Fatura> findAllByOrderByDataVencimentoDesc();

    List<Fatura> findByMesReferencia(String mesReferencia);

    List<Fatura> findByStatusAndDataVencimentoBefore(String status, LocalDate data);

    List<Fatura> findByIdAluno(Integer idAluno);

    /** Trava a fatura durante o checkout para impedir pagamento em dobro. */
    @org.springframework.data.jpa.repository.Lock(jakarta.persistence.LockModeType.PESSIMISTIC_WRITE)
    @org.springframework.data.jpa.repository.Query("SELECT f FROM Fatura f WHERE f.id = :id")
    Optional<Fatura> buscarComBloqueio(@org.springframework.data.repository.query.Param("id") Integer id);

    boolean existsByIdAlunoAndIdTurmaAndMesReferenciaAndStatusNot(
        Integer idAluno, Integer idTurma, String mesReferencia, String status);
}
