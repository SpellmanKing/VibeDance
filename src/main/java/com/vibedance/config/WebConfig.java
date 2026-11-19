package com.vibedance.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
public class WebConfig implements WebMvcConfigurer {

    private final DominioInstitucionalInterceptor dominioInterceptor;

    public WebConfig(DominioInstitucionalInterceptor dominioInterceptor) {
        this.dominioInterceptor = dominioInterceptor;
    }

    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        registry.addInterceptor(dominioInterceptor).addPathPatterns("/api/**");
    }
}
