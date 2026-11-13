package com.vibedance.service;

import com.vibedance.model.Fatura;
import com.vibedance.repository.FaturaRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.NoSuchElementException;

@Service 
@Transactional(readOnly = true)
public class FaturaService {

    private final FaturaRepository faturaRepository;

    public FaturaService(FaturaRepository faturaRepository) {
        this.faturaRepository = faturaRepository;
    }

    public List<Fatura> listarPorAluno(Integer idAluno) {

        if (idAluno == null) {
            throw new IllegalArgumentException("Aluno não identificado.");
        }

        return faturaRepository.findByIdAlunoOrderByDataVencimentoDesc(idAluno);
    }

    public Fatura buscarPorAluno(Integer idFatura, Integer idAluno) {

        if (idFatura == null || idAluno == null) {
            throw new IllegalArgumentException("Dados da fatura inválidos.");
        }

        return faturaRepository.findByIdAndIdAluno(idFatura, idAluno)
                .orElseThrow(() -> new NoSuchElementException("Fatura não encontrada."));
    }
}