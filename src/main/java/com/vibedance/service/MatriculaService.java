package com.vibedance.service;

import com.vibedance.model.Matricula;
import com.vibedance.model.Turma;
import com.vibedance.repository.MatriculaRepository;
import com.vibedance.repository.TurmaRepository;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class MatriculaService {

    private final MatriculaRepository matriculaRepository;
    private final TurmaRepository turmaRepository;

    public MatriculaService(
        MatriculaRepository matriculaRepository,
        TurmaRepository turmaRepository) {

            this.matriculaRepository = matriculaRepository;
            this.turmaRepository = turmaRepository;
    }

    @Transactional
    public Matricula matricular(Integer idAluno, Integer idTurma) {

        if (idAluno == null || idTurma == null) {
            throw new IllegalArgumentException("Aluno ou turma invalida.");
        }

        Turma turma = turmaRepository.buscarPorIdComBloqueio(idTurma)
        .orElseThrow(() ->
        new IllegalArgumentException("Turma nao encontrada."));

        if (!Boolean.TRUE.equals(turma.getAtivo())) {
            throw new IllegalStateException("Turma inativa.");
        }

        boolean jaExiste = matriculaRepository
        .findByIdAlunoAndIdTurma(idAluno, idTurma)
        .isPresent();

        if (jaExiste) {
            throw new IllegalStateException(
                "O aluno ja possui registro de matricula nessa turma.");
        }

        long vagasOcupadas = matriculaRepository
        .countByIdTurmaAndStatus(idTurma, "ATIVA");

        Integer limiteVagas = turma.getLimiteVagas();

        if (limiteVagas == null || limiteVagas <=0) {
            throw new IllegalStateException(
                "Esta turma nao possui vagas disponiveis.");
        }

        if (vagasOcupadas >= limiteVagas) {
            throw new IllegalStateException("Turma Lotada.");
        }

        Matricula matricula = new Matricula();
        matricula.setIdAluno(idAluno);
        matricula.setIdTurma(idTurma);
        matricula.setStatus("ATIVA");

        return matriculaRepository.saveAndFlush(matricula);
        
    }

    @Transactional
    public Matricula cancelar(Integer idAluno, Integer idMatricula) {

        if (idAluno == null || idMatricula == null) {
            throw new IllegalArgumentException(
                "Aluno ou matricula invalida."
            );
        }

        Matricula matricula = matriculaRepository
        .findById(idMatricula)
        .filter(m -> idAluno.equals(m.getIdAluno()))
        .orElseThrow(() -> new IllegalArgumentException(
            "Matricula nao encontrada para este aluno."
        ));

        if (!"ATIVA".equals(matricula.getStatus())) {
            throw new IllegalStateException(
                "Somente matriculas ativas podem ser canceladas."
            );
        }

        matricula.setStatus("CANCELADA");

        return matriculaRepository.saveAndFlush(matricula);
    }
}