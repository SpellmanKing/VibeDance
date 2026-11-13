package com.vibedance.service;

import com.vibedance.model.AulaParticular;
import com.vibedance.repository.AulaParticularRepository;
import com.vibedance.repository.ModalidadeRepository;
import com.vibedance.repository.UsuarioRepository;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.time.ZoneId;

@Service
public class AulaParticularService {

    private final AulaParticularRepository aulaRepository;
    private final ModalidadeRepository modalidadeRepository;
    private final UsuarioRepository usuarioRepository;

    public AulaParticularService(
            AulaParticularRepository aulaRepository,
            ModalidadeRepository modalidadeRepository,
            UsuarioRepository usuarioRepository) {

        this.aulaRepository = aulaRepository;
        this.modalidadeRepository = modalidadeRepository;
        this.usuarioRepository = usuarioRepository;
    }

    @Transactional
    public AulaParticular solicitar(
            Integer idAluno,
            Integer idModalidade,
            Integer idProfessor,
            LocalDateTime dataHora,
            Integer duracaoMinutos,
            String observacoes) {

        if (idAluno == null || !usuarioRepository.existsById(idAluno)) {
            throw new IllegalArgumentException("Aluno invalido.");
        }

        if (idModalidade == null || !modalidadeRepository.existsById(idModalidade)) {
            throw new IllegalArgumentException("Modalidade nao encontrada.");
        }

        if (idProfessor != null) {
            var professor = usuarioRepository.findById(idProfessor)
                .orElseThrow(() ->
                    new IllegalArgumentException("Professor nao encontrado.")
                );

            boolean perfilProfessor = professor.getAuthorities()
                .stream()
                .anyMatch(a -> "ROLE_PROFESSOR".equals(a.getAuthority()));

            if (!perfilProfessor) {
                throw new IllegalArgumentException(
                    "O usuario informado nao e professor."
                );
            }
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

            boolean professorOcupado = aulaRepository.findByIdProfessor(idProfessor)
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
                           dataHora.plusMinutes(duracao).isAfter(inicioExistente);
                });

            if (professorOcupado) {
                throw new IllegalStateException(
                    "O professor já possui uma aula nesse horário."
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