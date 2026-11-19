package com.vibedance.util;

import com.vibedance.model.Turma;

import java.text.Normalizer;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.EnumSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Converte o campo textual {@code dias_semana} ("Segundas e Quartas", "SEG,QUA",
 * "Sextas-feiras"...) em dias da semana reais e calcula ocorrências de aula.
 */
public final class AgendaUtil {

    public static final ZoneId FUSO = ZoneId.of("America/Sao_Paulo");

    private static final String[] NOMES_PLURAIS = {
        "Segundas", "Terças", "Quartas", "Quintas", "Sextas", "Sábados", "Domingos"
    };

    private AgendaUtil() {
    }

    public static LocalDate hoje() {
        return LocalDate.now(FUSO);
    }

    public static LocalTime agora() {
        return LocalTime.now(FUSO);
    }

    public static Set<DayOfWeek> parseDias(String texto) {
        Set<DayOfWeek> dias = EnumSet.noneOf(DayOfWeek.class);
        if (texto == null) {
            return dias;
        }
        String normalizado = Normalizer.normalize(texto, Normalizer.Form.NFD)
            .replaceAll("\\p{M}", "")
            .toLowerCase(Locale.ROOT);
        for (String token : normalizado.split("[^a-z]+")) {
            if (token.startsWith("seg")) dias.add(DayOfWeek.MONDAY);
            else if (token.startsWith("ter")) dias.add(DayOfWeek.TUESDAY);
            else if (token.startsWith("qua") && !token.startsWith("quai")) dias.add(DayOfWeek.WEDNESDAY);
            else if (token.startsWith("qui")) dias.add(DayOfWeek.THURSDAY);
            else if (token.startsWith("sex")) dias.add(DayOfWeek.FRIDAY);
            else if (token.startsWith("sab")) dias.add(DayOfWeek.SATURDAY);
            else if (token.startsWith("dom")) dias.add(DayOfWeek.SUNDAY);
        }
        return dias;
    }

    /** Formata dias (1=Seg … 7=Dom) no padrão "Segundas e Quartas". */
    public static String formatarDias(List<Integer> dias) {
        List<String> nomes = dias.stream()
            .filter(d -> d != null && d >= 1 && d <= 7)
            .distinct()
            .sorted()
            .map(d -> NOMES_PLURAIS[d - 1])
            .collect(Collectors.toList());
        if (nomes.isEmpty()) {
            return "";
        }
        if (nomes.size() == 1) {
            return nomes.get(0);
        }
        return String.join(", ", nomes.subList(0, nomes.size() - 1)) + " e " + nomes.get(nomes.size() - 1);
    }

    public static List<Integer> diasComoNumeros(String texto) {
        return parseDias(texto).stream().map(DayOfWeek::getValue).sorted().collect(Collectors.toList());
    }

    public static boolean ocorreEm(Turma turma, LocalDate data) {
        return turma != null && data != null && parseDias(turma.getDiasSemana()).contains(data.getDayOfWeek());
    }

    public static List<LocalDate> ocorrencias(Turma turma, LocalDate inicio, LocalDate fim) {
        Set<DayOfWeek> dias = parseDias(turma.getDiasSemana());
        List<LocalDate> datas = new ArrayList<>();
        if (dias.isEmpty()) {
            return datas;
        }
        for (LocalDate d = inicio; !d.isAfter(fim); d = d.plusDays(1)) {
            if (dias.contains(d.getDayOfWeek())) {
                datas.add(d);
            }
        }
        return datas;
    }

    public static boolean horariosSobrepoem(LocalTime inicioA, LocalTime fimA, LocalTime inicioB, LocalTime fimB) {
        if (inicioA == null || inicioB == null) {
            return false;
        }
        LocalTime fa = fimA != null ? fimA : inicioA.plusHours(1);
        LocalTime fb = fimB != null ? fimB : inicioB.plusHours(1);
        return inicioA.isBefore(fb) && inicioB.isBefore(fa);
    }
}
