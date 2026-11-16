package com.vibedance.service;

import com.vibedance.model.AulaParticular;
import com.vibedance.model.Usuario;
import com.vibedance.repository.AulaParticularRepository;
import com.vibedance.repository.ModalidadeRepository;
import com.vibedance.repository.UsuarioRepository;
import com.vibedance.repository.TurmaRepository;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.time.ZoneId;

@Service
public class AulaParticularService {

    private final AulaParticularRepository aulaRepository;
    private final ModalidadeRepository modalidadeRepository;
    private final UsuarioRepository usuarioRepository;
    private final TurmaRepository turmaRepository;

    public AulaParticularService(
            AulaParticularRepository aulaRepository,
            ModalidadeRepository modalidadeRepository,
            UsuarioRepository usuarioRepository,
            TurmaRepository turmaRepository) {

        this.aulaRepository = aulaRepository;
        this.modalidadeRepository = modalidadeRepository;
        this.usuarioRepository = usuarioRepository;
        this.turmaRepository = turmaRepository;
    }

    @Transactional
    public AulaParticular solicitar(
            Integer idAluno,
            Integer idModalidade,
            Integer idProfessor,
            LocalDateTime dataHora,
            Integer duracaoMinutos,
            String observacoes) {

        Usuario aluno = usuarioRepository.findById(idAluno)
            .orElseThrow(() ->
                new IllegalArgumentException("Aluno nao encontrado.")
            );

        if (!"ALUNO".equals(aluno.getPerfil())
                || !Boolean.TRUE.equals(aluno.getAtivo())) {
            throw new IllegalArgumentException(
                "Usuario nao e um aluno ativo."
            );
        }

        var modalidade = modalidadeRepository.findById(idModalidade)
            .orElseThrow(() ->
                new IllegalArgumentException("Modalidade nao encontrada.")
            );

        if (!Boolean.TRUE.equals(modalidade.getStatus())) {
            throw new IllegalArgumentException(
                "A modalidade nao esta ativa."
            );
        }

        if (idProfessor == null) {
            throw new IllegalArgumentException(
                "Selecione um professor."
            );
        }

        Usuario professor = usuarioRepository.findById(idProfessor)
            .orElseThrow(() ->
                new IllegalArgumentException("Professor nao encontrado.")
            );

        if (!"PROFESSOR".equals(professor.getPerfil())
                || !Boolean.TRUE.equals(professor.getAtivo())) {
            throw new IllegalArgumentException(
                "Professor nao encontrado ou inativo."
            );
        }

        boolean professorMinistraModalidade =
            turmaRepository.findByModalidadeId(idModalidade)
                .stream()
                .anyMatch(turma ->
                    Boolean.TRUE.equals(turma.getAtivo())
                    && idProfessor.equals(turma.getProfessorId())
                );

        if (!professorMinistraModalidade) {
            throw new IllegalArgumentException(
                "O professor selecionado nao ministra essa modalidade."
            );
        }

        LocalDateTime agora = LocalDateTime.now(
            ZoneId.of("America/Sao_Paulo")
        );

        if (dataHora == null || !dataHora.isAfter(agora)) {
            throw new IllegalArgumentException(
                "A data da aula deve ser futura."
            );
        }

        int duracao = duracaoMinutos == null ? 60 : duracaoMinutos;

        if (duracao <= 0) {
            throw new IllegalArgumentException(
                "A duracao deve ser maior que zero."
            );
        }

        LocalDateTime fimNovaAula = dataHora.plusMinutes(duracao);

        boolean horarioOcupado = aulaRepository.findByIdAluno(idAluno)
            .stream()
            .filter(a -> "SOLICITADO".equals(a.getStatus()) ||
                         "CONFIRMADO".equals(a.getStatus()))
            .anyMatch(a -> {
                LocalDateTime inicioExistente = a.getDataHora();

                int duracaoExistente = a.getDuracaoMinutos() == null
                    ? 60
                    : a.getDuracaoMinutos();

                LocalDateTime fimExistente =
                    inicioExistente.plusMinutes(duracaoExistente);

                return dataHora.isBefore(fimExistente) &&
                       fimNovaAula.isAfter(inicioExistente);
            });

        if (horarioOcupado) {
            throw new IllegalStateException(
                "O aluno ja possui uma aula particular nesse horario."
            );
        }

        if (idProfessor != null) {

            boolean professorOcupado =
                aulaRepository.findByIdProfessor(idProfessor)
                    .stream()
                    .filter(a -> "SOLICITADO".equals(a.getStatus()) ||
                                 "CONFIRMADO".equals(a.getStatus()))
                    .anyMatch(a -> {
                        LocalDateTime inicioExistente = a.getDataHora();

                        int duracaoExistente =
                            a.getDuracaoMinutos() == null
                                ? 60
                                : a.getDuracaoMinutos();

                        LocalDateTime fimExistente =
                            inicioExistente.plusMinutes(duracaoExistente);

                        return dataHora.isBefore(fimExistente) &&
                               fimNovaAula.isAfter(inicioExistente);
                    });

            if (professorOcupado) {
                throw new IllegalStateException(
                    "O professor ja possui uma aula nesse horario."
                );
            }
        }

        AulaParticular aula = new AulaParticular();

        aula.setIdAluno(idAluno);
        aula.setIdModalidade(idModalidade);
        aula.setIdProfessor(idProfessor);
        aula.setDataHora(dataHora);
        aula.setDuracaoMinutos(duracao);
        aula.setObservacoes(observacoes);
        aula.setStatus("SOLICITADO");

        return aulaRepository.saveAndFlush(aula);
    }
}