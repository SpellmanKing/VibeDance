package com.vibedance.service;

import com.vibedance.model.AuditoriaPagamento;
import com.vibedance.repository.AuditoriaPagamentoRepository;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional
public class AuditoriaPagamentoService {

    private final AuditoriaPagamentoRepository auditoriaRepository;

    public AuditoriaPagamentoService(AuditoriaPagamentoRepository auditoriaRepository) {
        this.auditoriaRepository = auditoriaRepository;
    }

    public void registrar(
            Integer idPagamento,
            Integer idUsuarioOperador,
            String acao,
            String statusAnterior,
            String statusNovo,
            String motivoObservacao,
            String ipOrigem) {

        AuditoriaPagamento auditoria = new AuditoriaPagamento();

        auditoria.setIdPagamento(idPagamento);
        auditoria.setIdUsuarioOperador(idUsuarioOperador);
        auditoria.setAcao(acao);
        auditoria.setStatusAnterior(statusAnterior);
        auditoria.setStatusNovo(statusNovo);
        auditoria.setMotivoObservacao(motivoObservacao);
        auditoria.setIpOrigem(ipOrigem);

        auditoriaRepository.save(auditoria);
    }
}