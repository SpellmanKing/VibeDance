package com.vibedance.controller;

import com.vibedance.model.Usuario;
import com.vibedance.repository.UsuarioRepository;
import com.vibedance.service.AuditoriaService;
import com.vibedance.service.TokenService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.Map;

@RestController
@RequestMapping("/api/auth")
public class AutenticacaoController {

    private static final String MSG_DOMINIO_EXCLUSIVO =
        "Acesso bloqueado: o sistema VibeDance é restrito exclusivamente a contas institucionais (@vibedance.com).";

    @Autowired
    private AuthenticationManager manager;

    @Autowired
    private TokenService tokenService;

    @Autowired
    private UsuarioRepository usuarioRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private AuditoriaService auditoriaService;

    @PostMapping("/login")
    public ResponseEntity<?> efetuarLogin(@RequestBody DadosAutenticacao dados) {
        if (dados == null || dados.email() == null || dados.email().isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("erro", "O endereço de e-mail é obrigatório."));
        }

        String emailLimpo = dados.email().trim().toLowerCase();

        // Trava estrita de domínio institucional @vibedance
        if (!Usuario.isDominioInstitucionalValido(emailLimpo)) {
            auditoriaService.registrarIsolado(null, "LOGIN_BLOQUEADO", "AUTENTICACAO", null,
                "Tentativa de login com domínio externo: " + emailLimpo);
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of(
                "erro", MSG_DOMINIO_EXCLUSIVO,
                "codigo", "DOMINIO_NAO_AUTORIZADO"
            ));
        }

        try {
            var authenticationToken = new UsernamePasswordAuthenticationToken(
                emailLimpo,
                dados.senha()
            );

            var authentication = manager.authenticate(authenticationToken);
            var usuario = (Usuario) authentication.getPrincipal();

            if (!Usuario.isDominioInstitucionalValido(usuario.getEmail())) {
                return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of(
                    "erro", MSG_DOMINIO_EXCLUSIVO,
                    "codigo", "DOMINIO_NAO_AUTORIZADO"
                ));
            }

            var tokenJWT = tokenService.gerarToken(usuario);
            auditoriaService.registrarIsolado(usuario, "LOGIN", "AUTENTICACAO", usuario.getId(),
                "Login realizado no portal " + usuario.getPerfil());

            return ResponseEntity.ok(
                new DadosTokenJWT(
                    tokenJWT,
                    usuario.getPerfil(),
                    usuario.getId(),
                    usuario.getNome(),
                    usuario.getEmail()
                )
            );
        } catch (Exception e) {
            auditoriaService.registrarIsolado(null, "LOGIN_FALHOU", "AUTENTICACAO", null,
                "Credenciais inválidas para " + emailLimpo);
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of(
                "erro", "Credenciais institucionais inválidas ou conta inativa."
            ));
        }
    }

    @PostMapping("/registrar")
    public ResponseEntity<?> registrarContaInstitucional(@RequestBody DadosRegistroInstitucional dados) {
        if (dados == null || dados.email() == null || dados.nome() == null || dados.senha() == null) {
            return ResponseEntity.badRequest().body(Map.of("erro", "Preencha todos os campos obrigatórios."));
        }

        String emailLimpo = dados.email().trim().toLowerCase();

        // Bloqueio imediato de domínios externos
        if (!Usuario.isDominioInstitucionalValido(emailLimpo)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of(
                "erro", MSG_DOMINIO_EXCLUSIVO,
                "codigo", "DOMINIO_NAO_AUTORIZADO"
            ));
        }

        if (dados.senha().trim().length() < 6) {
            return ResponseEntity.badRequest().body(Map.of("erro", "A senha deve conter no mínimo 6 caracteres."));
        }

        if (usuarioRepository.findByEmail(emailLimpo) != null) {
            return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of(
                "erro", "Já existe uma conta institucional cadastrada com este e-mail @vibedance."
            ));
        }

        Usuario novo = new Usuario();
        novo.setNome(dados.nome().trim());
        novo.setEmail(emailLimpo);
        novo.setCpf(dados.cpf() != null ? dados.cpf().trim() : "000.000.000-00");
        novo.setTelefone(dados.telefone() != null ? dados.telefone().trim() : "(61) 98888-0000");
        novo.setPerfil(dados.perfil() != null && !dados.perfil().isBlank() ? dados.perfil().trim().toUpperCase() : "ALUNO");
        novo.setSenha(passwordEncoder.encode(dados.senha().trim()));
        novo.setAtivo(true);
        novo.setDataCadastro(LocalDateTime.now());

        Usuario salvo = usuarioRepository.save(novo);
        String tokenJWT = tokenService.gerarToken(salvo);

        return ResponseEntity.status(HttpStatus.CREATED).body(
            new DadosTokenJWT(
                tokenJWT,
                salvo.getPerfil(),
                salvo.getId(),
                salvo.getNome(),
                salvo.getEmail()
            )
        );
    }
}

record DadosAutenticacao(String email, String senha) {
}

record DadosRegistroInstitucional(
    String nome,
    String email,
    String cpf,
    String telefone,
    String senha,
    String perfil
) {
}

record DadosTokenJWT(
    String token,
    String perfil,
    Integer id,
    String nome,
    String email
) {
}
