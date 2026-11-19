package com.vibedance.realtime;

import org.springframework.context.ApplicationEventPublisher;
import org.springframework.context.ApplicationEventPublisherAware;
import org.springframework.stereotype.Component;

/**
 * Ponte entre os listeners JPA (instanciados pelo Hibernate) e o barramento de
 * eventos do Spring.
 */
@Component
public class EventosDominio implements ApplicationEventPublisherAware {

    private static volatile ApplicationEventPublisher publisher;

    @Override
    public void setApplicationEventPublisher(ApplicationEventPublisher applicationEventPublisher) {
        EventosDominio.publisher = applicationEventPublisher;
    }

    public static void publicar(MudancaDominio evento) {
        ApplicationEventPublisher atual = publisher;
        if (atual != null && evento != null) {
            atual.publishEvent(evento);
        }
    }
}
