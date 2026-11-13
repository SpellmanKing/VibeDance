package com.vibedance.service;

import com.vibedance.model.Fatura;
import com.vibedance.model.Pagamento;
import com.vibedance.repository.PagamentoRepository;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.annotation.Propagation;

@Service
public class PagamentoGatewayService {

    private final PagamentoRepository pagamentoRepository;

    public PagamentoGatewayService(
            PagamentoRepository pagamentoRepository) {
        this.pagamentoRepository = pagamentoRepository;
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public Pagamento registrarTentativa(
            Fatura fatura,
            Integer idAluno,
            String formaPagamento) {

        Pagamento pagamento = new Pagamento();
        pagamento.setIdFatura(fatura.getId());
        pagamento.setIdAluno(idAluno);
        pagamento.setFormaPagamento(formaPagamento);
        pagamento.setValorPago(fatura.getValor());
        pagamento.setStatus("PENDENTE");

        return pagamentoRepository.saveAndFlush(pagamento);
    }
}