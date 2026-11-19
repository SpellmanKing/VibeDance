package com.vibedance.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.vibedance.repository.UsuarioRepository;
import com.vibedance.service.TokenService;
import jakarta.servlet.DispatcherType;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.io.IOException;
import java.util.Arrays;
import java.util.List;

@Configuration
@EnableWebSecurity
public class SecurityConfigurations {

    @Value("${vibedance.cors.origens:http://localhost:5500,http://127.0.0.1:5500,http://localhost:8081}")
    private String origensPermitidas;

    @Bean
    public SecurityFilterChain securityFilterChain(
        HttpSecurity http,
        TokenService tokenService,
        UsuarioRepository usuarioRepository,
        ObjectMapper objectMapper) throws Exception {

        return http
            .csrf(csrf -> csrf.disable())
            .cors(Customizer.withDefaults())
            .sessionManagement(sm -> sm.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .authorizeHttpRequests(req -> {
                // Despachos assíncronos (SSE) e de erro herdam a autorização da requisição original
                req.dispatcherTypeMatchers(DispatcherType.ASYNC, DispatcherType.ERROR).permitAll();
                req.requestMatchers("/error").permitAll();

                // Autenticação e front-end estático
                req.requestMatchers(HttpMethod.POST, "/api/auth/login").permitAll();
                req.requestMatchers(HttpMethod.OPTIONS, "/**").permitAll();
                req.requestMatchers(HttpMethod.GET, "/", "/index.html", "/login.js", "/styles.css", "/favicon.ico",
                    "/css/**", "/js/**", "/img/**", "/Aluno/**", "/Professor/**", "/Admin/**").permitAll();
                req.requestMatchers(HttpMethod.POST, "/api/webhooks/mercadopago").permitAll();
                // Vitrine da tela inicial: somente leitura, sem dados pessoais
                req.requestMatchers(HttpMethod.GET, "/api/publico/**").permitAll();
                // Pedido de acesso "Quero dançar": enviar, acompanhar e ativar (limitados por IP no serviço)
                req.requestMatchers(HttpMethod.POST, "/api/publico/acesso/pedidos", "/api/publico/acesso/consulta",
                    "/api/publico/acesso/ativacao").permitAll();

                // Registro de contas é exclusivo do ADM (contas institucionais)
                req.requestMatchers("/api/auth/registrar").hasRole("ADMINISTRADOR");

                // RBAC
                req.requestMatchers("/api/admin/**").hasRole("ADMINISTRADOR");
                req.requestMatchers("/api/professor/**").hasAnyRole("PROFESSOR", "ADMINISTRADOR");
                req.requestMatchers("/api/aluno/**").hasAnyRole("ALUNO", "ADMINISTRADOR");
                req.requestMatchers(HttpMethod.POST, "/api/modalidades", "/api/turmas").hasRole("ADMINISTRADOR");

                req.anyRequest().authenticated();
            })
            .exceptionHandling(ex -> ex
                .authenticationEntryPoint((request, response, e) -> escreverErro(objectMapper, response,
                    HttpStatus.UNAUTHORIZED, "NAO_AUTENTICADO", "Sessão ausente ou expirada. Faça login novamente.",
                    request.getRequestURI()))
                .accessDeniedHandler((request, response, e) -> escreverErro(objectMapper, response,
                    HttpStatus.FORBIDDEN, "ACESSO_NEGADO", "Seu perfil não tem permissão para acessar este recurso.",
                    request.getRequestURI())))
            .addFilterBefore(
                new FiltroAutenticacao(tokenService, usuarioRepository, objectMapper),
                UsernamePasswordAuthenticationFilter.class
            )
            .build();
    }

    static void escreverErro(ObjectMapper mapper, HttpServletResponse response, HttpStatus status,
                             String codigo, String mensagem, String caminho) throws IOException {
        if (response.isCommitted()) {
            return;
        }
        response.setStatus(status.value());
        response.setContentType("application/json;charset=UTF-8");
        mapper.writeValue(response.getOutputStream(),
            GlobalExceptionHandler.montarCorpo(status, codigo, mensagem, caminho, null));
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration config = new CorsConfiguration();
        config.setAllowedOrigins(Arrays.stream(origensPermitidas.split(",")).map(String::trim).toList());
        config.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
        config.setAllowedHeaders(List.of("Authorization", "Content-Type", "Accept", "X-Requested-With"));
        config.setExposedHeaders(List.of("Content-Disposition"));
        config.setMaxAge(3600L);
        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", config);
        return source;
    }

    @Bean
    public AuthenticationManager authenticationManager(AuthenticationConfiguration configuration) throws Exception {
        return configuration.getAuthenticationManager();
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }
}
