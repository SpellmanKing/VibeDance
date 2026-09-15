package com.vibedance.controller;

import com.vibedance.model.Usuario;
import com.vibedance.service.TokenService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/auth")
@CrossOrigin(origins = "*")
public class AutenticacaoController {

    @Autowired
    private AuthenticationManager manager;

    @Autowired
    private TokenService tokenService;

    @PostMapping("/login")
    public ResponseEntity efetuarLogin(@RequestBody DadosAutenticacao dados) {
        // Encapsula o e-mail e senha recebidos do frontend
        var authenticationToken = new UsernamePasswordAuthenticationToken(dados.email(), dados.senha());

        // Dispara a validação no banco de dados
        var authentication = manager.authenticate(authenticationToken);

        // Se passar, gera o Token JWT
        var usuario = (Usuario) authentication.getPrincipal();
        var tokenJWT = tokenService.gerarToken(usuario);

        // Retorna o token e o perfil para o JavaScript saber para onde navegar
        return ResponseEntity.ok(new DadosTokenJWT(tokenJWT, usuario.getPerfil()));
    }
}

// Records auxiliares (DTOs) para receber e enviar os dados json
record DadosAutenticacao(String email, String senha) {
}

record DadosTokenJWT(String token, String perfil) {
}