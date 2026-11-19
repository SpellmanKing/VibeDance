package com.vibedance.service;

import com.vibedance.model.AuditoriaGeral;
import com.vibedance.model.Usuario;
import com.vibedance.repository.AuditoriaGeralRepository;
import com.vibedance.util.RequestUtil;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/** Registra ações críticas (quem fez, o quê, em qual registro, de onde). */
@Service
public class AuditoriaService {

    private final AuditoriaGeralRepository repository;

    public AuditoriaService(AuditoriaGeralRepository repository) {
        this.repository = repository;
    }

    @Transactional(propagation = Propagation.REQUIRED)
    public void registrar(Usuario operador, String acao, String entidade, Integer idEntidade, String descricao) {
        AuditoriaGeral a = new AuditoriaGeral();
        if (operador != null) {
            a.setIdUsuario(operador.getId());
            a.setUsuarioNome(operador.getNome());
            a.setPerfil(operador.getPerfil());
        }
        a.setAcao(acao);
        a.setEntidade(entidade);
        a.setIdEntidade(idEntidade);
        a.setDescricao(descricao);
        a.setIpOrigem(RequestUtil.ipAtual());
        repository.save(a);
    }

    /** Usado em eventos fora de transação (ex.: tentativa de login bloqueada). */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void registrarIsolado(Usuario operador, String acao, String entidade, Integer idEntidade, String descricao) {
        registrar(operador, acao, entidade, idEntidade, descricao);
    }
}
