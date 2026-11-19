package com.vibedance;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class VibeDanceApplication {
    public static void main(String[] args) {
        SpringApplication.run(VibeDanceApplication.class, args);
    }
}