package com.vibedance.service;

import com.auth0.jwt.JWT;
import com.auth0.jwt.algorithms.Algorithm;
import com.auth0.jwt.exceptions.JWTCreationException;
import com.auth0.jwt.exceptions.JWTVerificationException;
import com.vibedance.model.Usuario;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import java.time.Instant;
import java.time.temporal.ChronoUnit;

@Service
public class TokenService {

    // A senha secreta deve vir do application.properties na vida real
    @Value("${JWT_SECRET}")
    private String secret;

    public String gerarToken(Usuario usuario) {
        try {
            Algorithm algoritmo = Algorithm.HMAC256(secret);

            return JWT.create()
                    .withIssuer("API VibeDance")
                    .withSubject(usuario.getEmail())
                    .withClaim("perfil", usuario.getPerfil()) // Embutindo o perfil no token
                    .withExpiresAt(dataExpiracao())
                    .sign(algoritmo);
                    
        } catch (JWTCreationException exception) {
            throw new RuntimeException("Erro ao gerar token JWT", exception);
        }
    }

    public String validarToken(String token) {
        try {
            Algorithm algoritmo = Algorithm.HMAC256(secret);

            return JWT.require(algoritmo)
            .withIssuer("API VibeDance")
            .build()
            .verify(token)
            .getSubject();

        } catch (JWTVerificationException exception) {
            return null;
        }
    }

    // Token expira em 2 horas
    private Instant dataExpiracao() {
        return Instant.now().plus(2, ChronoUnit.HOURS);
    }
}