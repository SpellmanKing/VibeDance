package com.vibedance.realtime;

import com.vibedance.model.Usuario;
import org.springframework.http.MediaType;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

@RestController
public class StreamController {

    private final RealtimeHub hub;

    public StreamController(RealtimeHub hub) {
        this.hub = hub;
    }

    /** Canal SSE único por aba: GET /api/stream?access_token=JWT */
    @GetMapping(path = "/api/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter stream(@AuthenticationPrincipal Usuario usuario) {
        return hub.conectar(usuario);
    }
}
