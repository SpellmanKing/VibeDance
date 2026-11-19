package com.vibedance.service;

import com.lowagie.text.*;
import com.lowagie.text.pdf.*;
import com.vibedance.dto.ApiDtos.LinhaPlanilha;
import com.vibedance.exception.RegraNegocioException;
import com.vibedance.util.AgendaUtil;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Service;

import java.awt.Color;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.text.NumberFormat;
import java.time.LocalDateTime;
import java.time.YearMonth;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.List;
import java.util.function.Predicate;
import java.util.stream.Collectors;

/**
 * Relatório financeiro em PDF (A4 paisagem) com a identidade "Palco" do comprovante:
 * cabeçalho escuro com a arte de dança, indicadores, resumo por mês e por forma de
 * pagamento, todos os lançamentos (cabeçalho da tabela repetido a cada página),
 * paginação "x de y" e código de autenticação. Reflete exatamente os filtros da tela.
 */
@Service
public class PlanilhaPdfService {

    private static final Locale PT_BR = new Locale("pt", "BR");
    private static final Color TINTA = new Color(0x0D, 0x0B, 0x0C);
    private static final Color AMBAR = new Color(0xE8, 0xA6, 0x53);
    private static final Color CARMIM = new Color(0xDB, 0x4F, 0x7C);
    private static final Color MARFIM = new Color(0xF4, 0xEC, 0xE1);
    private static final Color PAPEL = new Color(0xFB, 0xF7, 0xF1);
    private static final Color BRANCO = new Color(0xFF, 0xFD, 0xFA);
    private static final Color TEXTO = new Color(0x2B, 0x24, 0x27);
    private static final Color SUAVE = new Color(0x8A, 0x7E, 0x75);
    private static final Color LINHA = new Color(0xE9, 0xDF, 0xD2);
    private static final Color ZEBRA = new Color(0xF7, 0xF0, 0xE6);
    private static final Color CAB_TABELA = new Color(0x23, 0x1E, 0x21);
    private static final Color VERDE = new Color(0x3F, 0xA7, 0x7C);
    private static final Color VERDE_BG = new Color(0xDD, 0xF2, 0xE8);
    private static final Color AMARELO = new Color(0xB9, 0x82, 0x1C);
    private static final Color AMARELO_BG = new Color(0xFB, 0xEE, 0xCF);
    private static final Color VERMELHO = new Color(0xC9, 0x47, 0x3B);
    private static final Color VERMELHO_BG = new Color(0xFB, 0xE0, 0xDC);
    private static final Color AZUL = new Color(0x4F, 0x6D, 0xA8);
    private static final Color AZUL_BG = new Color(0xE2, 0xE9, 0xF6);
    private static final Color CINZA_BG = new Color(0xEC, 0xE6, 0xDF);

    private static final DateTimeFormatter DATA = DateTimeFormatter.ofPattern("dd/MM/yyyy", PT_BR);
    private static final DateTimeFormatter DATA_HORA = DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm", PT_BR);
    private static final DateTimeFormatter DATA_HORA_LONGA = DateTimeFormatter.ofPattern("dd/MM/yyyy 'às' HH:mm", PT_BR);
    private static final String[] MESES = {"jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"};
    private static final Map<String, String> STATUS = Map.of("PAGO", "Pago", "PENDENTE", "Pendente", "ATRASADO", "Atrasado",
        "EM_ANALISE", "Em análise", "ESTORNADO", "Estornado", "CANCELADO", "Cancelado");
    private static final Set<String> ABERTOS = Set.of("PENDENTE", "ATRASADO", "EM_ANALISE");

    /** Filtros da tela: status, período (AAAA-MM) e busca livre. */
    public record Filtros(String status, String de, String ate, String busca) {
    }

    /** Aplica os mesmos filtros da planilha interativa. */
    public static List<LinhaPlanilha> filtrar(List<LinhaPlanilha> linhas, Filtros f) {
        String termo = f.busca() == null ? "" : f.busca().trim().toLowerCase(PT_BR);
        Predicate<LinhaPlanilha> p = l -> true;
        if (f.status() != null && !f.status().isBlank()) p = p.and(l -> f.status().equalsIgnoreCase(l.status()));
        if (f.de() != null && !f.de().isBlank()) p = p.and(l -> l.referencia() != null && l.referencia().compareTo(f.de()) >= 0);
        if (f.ate() != null && !f.ate().isBlank()) p = p.and(l -> l.referencia() != null && l.referencia().compareTo(f.ate()) <= 0);
        if (!termo.isEmpty()) {
            p = p.and(l -> String.join(" ", Objects.toString(l.transacao(), ""), Objects.toString(l.alunoNome(), ""),
                    Objects.toString(l.turmaNome(), ""), Objects.toString(l.titulo(), ""), Objects.toString(l.referencia(), ""),
                    mesCurto(l.referencia()), forma(l.metodo()), Objects.toString(l.metodoDetalhe(), ""))
                .toLowerCase(PT_BR).contains(termo));
        }
        return linhas.stream().filter(p)
            .sorted(Comparator.comparing(LinhaPlanilha::vencimento, Comparator.nullsLast(Comparator.reverseOrder())))
            .toList();
    }

    /**
     * @param comAluno  true no relatório do ADM (coluna de aluno e resumo geral)
     * @param titular   nome do aluno no extrato individual (null no relatório do ADM)
     */
    public byte[] gerar(List<LinhaPlanilha> linhas, Filtros filtros, boolean comAluno, String emitidoPor, String titular) {
        if (filtros.de() != null && filtros.ate() != null && !filtros.de().isBlank() && !filtros.ate().isBlank()
            && filtros.de().compareTo(filtros.ate()) > 0) {
            throw new RegraNegocioException("O mês inicial deve vir antes do final.");
        }
        try {
            Fontes fx = new Fontes();
            ByteArrayOutputStream saida = new ByteArrayOutputStream();
            Rectangle pagina = PageSize.A4.rotate();
            float W = pagina.getWidth(), H = pagina.getHeight();
            float cabecalho1 = 150, cabecalhoN = 58, rodape = 44;
            Document doc = new Document(pagina, 36, 36, cabecalho1 + 22, rodape + 18);
            PdfWriter writer = PdfWriter.getInstance(doc, saida);
            String titulo = comAluno ? "Relatório financeiro" : "Extrato financeiro";
            String codigo = autenticacao(linhas);
            LocalDateTime agora = LocalDateTime.now(AgendaUtil.FUSO);
            Image arte = imagem("static/img/recibo-arte.jpg");
            Image logo = imagem("static/img/vibedance-simbolo-512.png");
            String filtrosTxt = descreverFiltros(filtros);

            writer.setPageEvent(new PdfPageEventHelper() {
                PdfTemplate total;

                @Override
                public void onOpenDocument(PdfWriter w, Document d) {
                    total = w.getDirectContent().createTemplate(40, 12);
                }

                @Override
                public void onEndPage(PdfWriter w, Document d) {
                    try {
                        PdfContentByte fundo = w.getDirectContentUnder();
                        PdfContentByte frente = w.getDirectContent();
                        fundo.setColorFill(PAPEL);
                        fundo.rectangle(0, 0, W, H);
                        fundo.fill();
                        boolean primeira = w.getPageNumber() == 1;
                        float alt = primeira ? cabecalho1 : cabecalhoN;
                        fundo.setColorFill(TINTA);
                        fundo.rectangle(0, H - alt, W, alt);
                        fundo.fill();
                        if (arte != null) {
                            fundo.saveState();
                            fundo.rectangle(0, H - alt, W, alt);
                            fundo.clip();
                            fundo.newPath();
                            Image a = Image.getInstance(arte);
                            float h = W * a.getHeight() / a.getWidth();
                            a.scaleAbsolute(W, h);
                            a.setAbsolutePosition(0, H - alt - (h - alt) * 0.42f);
                            fundo.addImage(a);
                            // véu para leitura do texto à esquerda
                            PdfGState veu = new PdfGState();
                            veu.setFillOpacity(primeira ? 0.55f : 0.78f);
                            fundo.setGState(veu);
                            fundo.setColorFill(TINTA);
                            fundo.rectangle(0, H - alt, primeira ? W * 0.62f : W, alt);
                            fundo.fill();
                            fundo.restoreState();
                        }
                        faixa(w, fundo, 0, H - alt - 4, W, 4);

                        float lx = 36;
                        if (logo != null) {
                            Image l = Image.getInstance(logo);
                            float s = primeira ? 30 : 22;
                            l.scaleAbsolute(s, s);
                            l.setAbsolutePosition(lx, H - (primeira ? 58 : 40));
                            frente.addImage(l);
                        }
                        if (primeira) {
                            texto(frente, fx.serifBI, 19, MARFIM, 0, "VibeDance", lx + 38, H - 46, Element.ALIGN_LEFT);
                            texto(frente, fx.helvB, 6, AMBAR, 2.2f, "ESTÚDIO DE DANÇA", lx + 39, H - 56, Element.ALIGN_LEFT);
                            texto(frente, fx.helvB, 7.5f, AMBAR, 2.4f, titulo.toUpperCase(PT_BR), lx, H - 88, Element.ALIGN_LEFT);
                            texto(frente, fx.serifB, 26, MARFIM, 0, titular != null ? titular : "Planilha financeira do estúdio",
                                lx, H - 114, Element.ALIGN_LEFT);
                            texto(frente, fx.helv, 8.5f, new Color(0xD8, 0xCC, 0xBF), 0, filtrosTxt, lx, H - 132, Element.ALIGN_LEFT);
                            texto(frente, fx.helvB, 6.5f, AMBAR, 1.8f, "EMITIDO EM", W - 36, H - 46, Element.ALIGN_RIGHT);
                            texto(frente, fx.helv, 9, MARFIM, 0, agora.format(DATA_HORA_LONGA), W - 36, H - 59, Element.ALIGN_RIGHT);
                            if (emitidoPor != null) {
                                texto(frente, fx.helvB, 6.5f, AMBAR, 1.8f, "POR", W - 36, H - 76, Element.ALIGN_RIGHT);
                                texto(frente, fx.helv, 9, MARFIM, 0, emitidoPor, W - 36, H - 89, Element.ALIGN_RIGHT);
                            }
                        } else {
                            texto(frente, fx.serifBI, 14, MARFIM, 0, "VibeDance", lx + 30, H - 34, Element.ALIGN_LEFT);
                            texto(frente, fx.helvB, 7, AMBAR, 2.2f, titulo.toUpperCase(PT_BR) + "  ·  " + filtrosTxt.toUpperCase(PT_BR),
                                W - 36, H - 33, Element.ALIGN_RIGHT);
                        }

                        // rodapé
                        fundo.setColorFill(TINTA);
                        fundo.rectangle(0, 0, W, rodape);
                        fundo.fill();
                        faixa(w, fundo, 0, rodape, W, 2.5f);
                        texto(frente, fx.helvB, 6, AMBAR, 1.8f, "AUTENTICAÇÃO", 36, 26, Element.ALIGN_LEFT);
                        texto(frente, fx.mono, 9.5f, MARFIM, 0.8f, codigo, 36, 13, Element.ALIGN_LEFT);
                        texto(frente, fx.helv, 7, new Color(0xA8, 0x9C, 0x92), 0,
                            "Documento gerado pelo sistema VibeDance a partir dos registros financeiros na data de emissão.",
                            W / 2, 17, Element.ALIGN_CENTER);
                        String pag = "Página " + w.getPageNumber() + " de ";
                        float larg = fx.helv.getWidthPoint(pag, 8);
                        texto(frente, fx.helv, 8, MARFIM, 0, pag, W - 36 - 18 - larg, 17, Element.ALIGN_LEFT);
                        frente.addTemplate(total, W - 36 - 18, 17);
                    } catch (Exception e) {
                        throw new IllegalStateException(e);
                    }
                }

                @Override
                public void onCloseDocument(PdfWriter w, Document d) {
                    total.beginText();
                    total.setFontAndSize(fx.helv, 8);
                    total.setColorFill(MARFIM);
                    total.showText(String.valueOf(w.getPageNumber() - 1));
                    total.endText();
                }
            });

            doc.addTitle(titulo + " · VibeDance");
            doc.addAuthor("VibeDance");
            doc.open();
            doc.setMargins(36, 36, cabecalhoN + 20, rodape + 18); // vale da página 2 em diante

            // ------------------------------------------------------------------ indicadores
            BigDecimal recebido = soma(linhas, l -> "PAGO".equals(l.status()));
            BigDecimal aberto = soma(linhas, l -> ABERTOS.contains(l.status()));
            BigDecimal atrasado = soma(linhas, l -> "ATRASADO".equals(l.status()));
            BigDecimal faturado = recebido.add(aberto);
            long qPago = linhas.stream().filter(l -> "PAGO".equals(l.status())).count();
            long qAberto = linhas.stream().filter(l -> ABERTOS.contains(l.status())).count();
            long qAtrasado = linhas.stream().filter(l -> "ATRASADO".equals(l.status())).count();
            BigDecimal ajustes = linhas.stream().filter(l -> l.ajuste() != null && !"ESTORNADO".equals(l.status()))
                .map(LinhaPlanilha::ajuste).reduce(BigDecimal.ZERO, BigDecimal::add);

            PdfPTable kpis = new PdfPTable(5);
            kpis.setWidthPercentage(100);
            kpis.addCell(cartao(fx, AMBAR, "FATURADO", moeda(faturado), (qPago + qAberto) + " cobrança(s) no filtro"));
            kpis.addCell(cartao(fx, VERDE, "RECEBIDO", moeda(recebido), qPago + " pagamento(s) · " + pct(recebido, faturado) + " do faturado"));
            kpis.addCell(cartao(fx, AZUL, "EM ABERTO", moeda(aberto), qAberto + " cobrança(s) a receber"));
            kpis.addCell(cartao(fx, VERMELHO, "EM ATRASO", moeda(atrasado), qAtrasado + " vencida(s) · inadimplência " + pct(atrasado, faturado)));
            kpis.addCell(cartao(fx, CARMIM, "AJUSTES", (ajustes.signum() < 0 ? "- " : ajustes.signum() > 0 ? "+ " : "") + moeda(ajustes.abs()),
                ajustes.signum() < 0 ? "descontos líquidos concedidos" : ajustes.signum() > 0 ? "multas e juros líquidos" : "sem descontos ou acréscimos"));
            kpis.setSpacingAfter(16);
            doc.add(kpis);

            // ------------------------------------------------------------------ resumos
            if (!linhas.isEmpty()) {
                PdfPTable resumos = new PdfPTable(new float[]{63, 2, 35});
                resumos.setWidthPercentage(100);
                PdfPCell esq = new PdfPCell(resumoMensal(fx, linhas));
                PdfPCell meio = new PdfPCell(new Phrase(""));
                PdfPCell dir = new PdfPCell(resumoMetodos(fx, linhas));
                for (PdfPCell c : List.of(esq, meio, dir)) { c.setBorder(Rectangle.NO_BORDER); c.setPadding(0); }
                resumos.addCell(esq);
                resumos.addCell(meio);
                resumos.addCell(dir);
                resumos.setSpacingAfter(18);
                doc.add(resumos);
            }

            // ------------------------------------------------------------------ lançamentos
            Paragraph sec = new Paragraph();
            sec.add(new Chunk("LANÇAMENTOS", new Font(fx.helvB, 8, Font.NORMAL, AMBAR)));
            sec.add(new Chunk("    " + linhas.size() + " registro(s), do vencimento mais recente ao mais antigo",
                new Font(fx.helv, 8, Font.NORMAL, SUAVE)));
            sec.setSpacingAfter(6);
            doc.add(sec);

            if (linhas.isEmpty()) {
                Paragraph vazio = new Paragraph("Nenhum lançamento corresponde aos filtros escolhidos.", new Font(fx.serifI, 13, Font.NORMAL, SUAVE));
                vazio.setSpacingBefore(20);
                vazio.setAlignment(Element.ALIGN_CENTER);
                doc.add(vazio);
            } else {
                doc.add(tabelaLancamentos(fx, linhas, comAluno, recebido, aberto));
            }

            doc.close();
            return saida.toByteArray();
        } catch (RegraNegocioException e) {
            throw e;
        } catch (Exception e) {
            throw new IllegalStateException("Não foi possível gerar o relatório em PDF.", e);
        }
    }

    // ====================================================================== blocos

    private PdfPCell cartao(Fontes fx, Color acento, String rotulo, String valor, String rodape) {
        Paragraph p = new Paragraph();
        p.add(new Chunk(rotulo + "\n", new Font(fx.helvB, 6.5f, Font.NORMAL, SUAVE)));
        p.add(new Chunk(valor + "\n", new Font(fx.serifB, 17, Font.NORMAL, TEXTO)));
        p.add(new Chunk(rodape, new Font(fx.helv, 7, Font.NORMAL, SUAVE)));
        p.setLeading(0, 1.35f);
        PdfPCell c = new PdfPCell();
        c.addElement(p);
        c.setBorder(Rectangle.NO_BORDER);
        c.setPaddingTop(10);
        c.setPaddingBottom(14);
        c.setPaddingLeft(16);
        c.setPaddingRight(10);
        c.setCellEvent((cell, r, canvases) -> {
            PdfContentByte cb = canvases[PdfPTable.BACKGROUNDCANVAS];
            float x = r.getLeft() + 3, y = r.getBottom() + 2, w = r.getWidth() - 6, h = r.getHeight() - 4;
            cb.saveState();
            cb.setColorFill(BRANCO);
            cb.setColorStroke(LINHA);
            cb.setLineWidth(0.8f);
            cb.roundRectangle(x, y, w, h, 7);
            cb.fillStroke();
            cb.setColorFill(acento);
            cb.roundRectangle(x + 10, y + h - 3.5f, 28, 2.5f, 1.2f);
            cb.fill();
            cb.restoreState();
        });
        return c;
    }

    private PdfPTable resumoMensal(Fontes fx, List<LinhaPlanilha> linhas) {
        Map<String, List<LinhaPlanilha>> porMes = linhas.stream().filter(l -> l.referencia() != null)
            .collect(Collectors.groupingBy(LinhaPlanilha::referencia, TreeMap::new, Collectors.toList()));
        List<String> meses = new ArrayList<>(porMes.keySet());
        if (meses.size() > 8) meses = meses.subList(meses.size() - 8, meses.size());

        PdfPTable t = new PdfPTable(new float[]{14, 17, 17, 17, 15, 20});
        t.setWidthPercentage(100);
        tituloBloco(fx, t, "RESUMO POR MÊS DE REFERÊNCIA" + (porMes.size() > 8 ? "  (últimos 8)" : ""), 6);
        for (String h : List.of("Mês", "Faturado", "Recebido", "Em aberto", "Em atraso", "Recebimento")) {
            t.addCell(cabMini(fx, h, !"Mês".equals(h)));
        }
        for (String m : meses) {
            List<LinhaPlanilha> ls = porMes.get(m);
            BigDecimal rec = soma(ls, l -> "PAGO".equals(l.status()));
            BigDecimal abe = soma(ls, l -> ABERTOS.contains(l.status()));
            BigDecimal atr = soma(ls, l -> "ATRASADO".equals(l.status()));
            BigDecimal fat = rec.add(abe);
            t.addCell(celMini(fx, mesCurto(m), false, TEXTO, true));
            t.addCell(celMini(fx, moeda(fat), true, TEXTO, false));
            t.addCell(celMini(fx, moeda(rec), true, VERDE, false));
            t.addCell(celMini(fx, moeda(abe), true, TEXTO, false));
            t.addCell(celMini(fx, moeda(atr), true, atr.signum() > 0 ? VERMELHO : SUAVE, false));
            double f = fat.signum() == 0 ? 0 : rec.divide(fat, 4, RoundingMode.HALF_UP).doubleValue();
            t.addCell(barra(fx, f));
        }
        return t;
    }

    private PdfPTable resumoMetodos(Fontes fx, List<LinhaPlanilha> linhas) {
        List<LinhaPlanilha> pagos = linhas.stream().filter(l -> "PAGO".equals(l.status())).toList();
        BigDecimal total = soma(pagos, l -> true);
        Map<String, List<LinhaPlanilha>> porForma = pagos.stream()
            .collect(Collectors.groupingBy(l -> forma(l.metodo()), LinkedHashMap::new, Collectors.toList()));
        PdfPTable t = new PdfPTable(new float[]{40, 14, 26, 20});
        t.setWidthPercentage(100);
        tituloBloco(fx, t, "RECEBIDO POR FORMA DE PAGAMENTO", 4);
        for (String h : List.of("Forma", "Qtd.", "Valor", "Parcela")) t.addCell(cabMini(fx, h, !"Forma".equals(h)));
        if (porForma.isEmpty()) {
            PdfPCell c = celMini(fx, "Nenhum pagamento confirmado no filtro.", false, SUAVE, false);
            c.setColspan(4);
            t.addCell(c);
            return t;
        }
        porForma.entrySet().stream()
            .sorted((a, b) -> soma(b.getValue(), l -> true).compareTo(soma(a.getValue(), l -> true)))
            .forEach(e -> {
                BigDecimal v = soma(e.getValue(), l -> true);
                t.addCell(celMini(fx, e.getKey(), false, TEXTO, true));
                t.addCell(celMini(fx, String.valueOf(e.getValue().size()), true, TEXTO, false));
                t.addCell(celMini(fx, moeda(v), true, TEXTO, false));
                t.addCell(celMini(fx, pct(v, total), true, SUAVE, false));
            });
        PdfPCell r = celMini(fx, "Total recebido", false, TEXTO, true);
        r.setColspan(2);
        r.setBackgroundColor(ZEBRA);
        PdfPCell v = celMini(fx, moeda(total), true, TEXTO, true);
        v.setColspan(2);
        v.setBackgroundColor(ZEBRA);
        t.addCell(r);
        t.addCell(v);
        return t;
    }

    private PdfPTable tabelaLancamentos(Fontes fx, List<LinhaPlanilha> linhas, boolean comAluno, BigDecimal recebido, BigDecimal aberto) {
        List<String> cab = new ArrayList<>(List.of("Transação"));
        List<Float> larg = new ArrayList<>(List.of(9f));
        if (comAluno) { cab.add("Aluno(a)"); larg.add(14f); }
        cab.addAll(List.of("Ref.", "Cobrança", "Forma", "Vencimento", "Pago em", "Valor base", "Ajuste", "Valor final", "Status"));
        larg.addAll(List.of(7.5f, comAluno ? 18f : 24f, 11.5f, 8f, 9.5f, 8f, 7f, 8.5f, 8.5f));
        float[] w = new float[larg.size()];
        for (int i = 0; i < w.length; i++) w[i] = larg.get(i);
        PdfPTable t = new PdfPTable(w);
        t.setWidthPercentage(100);
        t.setHeaderRows(1);
        t.setSplitLate(false);
        for (int i = 0; i < cab.size(); i++) {
            String h = cab.get(i);
            boolean num = Set.of("Valor base", "Ajuste", "Valor final").contains(h);
            PdfPCell c = new PdfPCell(new Phrase(h.toUpperCase(PT_BR), new Font(fx.helvB, 6.5f, Font.NORMAL, MARFIM)));
            c.setBackgroundColor(CAB_TABELA);
            c.setBorder(Rectangle.NO_BORDER);
            c.setPaddingTop(7);
            c.setPaddingBottom(8);
            c.setPaddingLeft(6);
            c.setPaddingRight(6);
            c.setHorizontalAlignment(num ? Element.ALIGN_RIGHT : "Status".equals(h) ? Element.ALIGN_CENTER : Element.ALIGN_LEFT);
            t.addCell(c);
        }
        int i = 0;
        for (LinhaPlanilha l : linhas) {
            Color bg = i++ % 2 == 0 ? BRANCO : ZEBRA;
            boolean estornado = "ESTORNADO".equals(l.status()) || "CANCELADO".equals(l.status());
            Color cor = estornado ? SUAVE : TEXTO;
            t.addCell(cel(fx.mono, 7.5f, l.transacao(), null, cor, bg, Element.ALIGN_LEFT, fx));
            if (comAluno) t.addCell(cel(fx.helvB, 7.5f, l.alunoNome(), null, cor, bg, Element.ALIGN_LEFT, fx));
            t.addCell(cel(fx.helv, 7.5f, mesCurto(l.referencia()), null, cor, bg, Element.ALIGN_LEFT, fx));
            String sub = l.turmaNome() == null ? "Plano avulso" : l.titulo() != null && l.titulo().contains(l.turmaNome()) ? null : l.turmaNome();
            t.addCell(cel(fx.helv, 7.5f, l.titulo(), sub, cor, bg, Element.ALIGN_LEFT, fx));
            t.addCell(cel(fx.helv, 7.5f, l.metodo() == null ? "—" : forma(l.metodo()), l.metodoDetalhe(), cor, bg, Element.ALIGN_LEFT, fx));
            t.addCell(cel(fx.helv, 7.5f, l.vencimento() == null ? "—" : l.vencimento().format(DATA), null, cor, bg, Element.ALIGN_LEFT, fx));
            t.addCell(cel(fx.helv, 7.5f, l.pagoEm() == null ? "—" : l.pagoEm().format(DATA_HORA), null, cor, bg, Element.ALIGN_LEFT, fx));
            t.addCell(cel(fx.helv, 7.5f, moeda(l.valorBase()), null, cor, bg, Element.ALIGN_RIGHT, fx));
            BigDecimal aj = l.ajuste() == null ? BigDecimal.ZERO : l.ajuste();
            t.addCell(cel(fx.helv, 7.5f, aj.signum() == 0 ? "—" : (aj.signum() > 0 ? "+ " : "- ") + moeda(aj.abs()), null,
                aj.signum() > 0 ? AMARELO : aj.signum() < 0 ? VERDE : SUAVE, bg, Element.ALIGN_RIGHT, fx));
            t.addCell(cel(fx.helvB, 8, moeda(l.valorFinal()), null, cor, bg, Element.ALIGN_RIGHT, fx));
            t.addCell(pilula(fx, l.status(), bg));
        }
        // linha de totais
        int span = w.length - 3;
        PdfPCell rot = new PdfPCell(new Phrase("TOTAIS DO FILTRO   ·   recebido " + moeda(recebido) + "   ·   em aberto " + moeda(aberto),
            new Font(fx.helvB, 7.5f, Font.NORMAL, TEXTO)));
        rot.setColspan(span);
        PdfPCell val = new PdfPCell(new Phrase(moeda(recebido.add(aberto)), new Font(fx.serifB, 12, Font.NORMAL, TEXTO)));
        val.setColspan(2);
        val.setHorizontalAlignment(Element.ALIGN_RIGHT);
        PdfPCell fim = new PdfPCell(new Phrase("faturado", new Font(fx.helv, 7, Font.NORMAL, SUAVE)));
        fim.setHorizontalAlignment(Element.ALIGN_CENTER);
        for (PdfPCell c : List.of(rot, val, fim)) {
            c.setBackgroundColor(new Color(0xFB, 0xEC, 0xD6));
            c.setBorder(Rectangle.NO_BORDER);
            c.setPaddingTop(9);
            c.setPaddingBottom(10);
            c.setPaddingLeft(8);
            c.setPaddingRight(6);
            c.setVerticalAlignment(Element.ALIGN_MIDDLE);
        }
        t.addCell(rot);
        t.addCell(val);
        t.addCell(fim);
        return t;
    }

    // ====================================================================== células

    private void tituloBloco(Fontes fx, PdfPTable t, String txt, int colunas) {
        PdfPCell c = new PdfPCell(new Phrase(txt, new Font(fx.helvB, 7, Font.NORMAL, AMBAR)));
        c.setColspan(colunas);
        c.setBorder(Rectangle.NO_BORDER);
        c.setPaddingBottom(6);
        c.setPaddingLeft(0);
        t.addCell(c);
    }

    private PdfPCell cabMini(Fontes fx, String txt, boolean direita) {
        PdfPCell c = new PdfPCell(new Phrase(txt.toUpperCase(PT_BR), new Font(fx.helvB, 6, Font.NORMAL, SUAVE)));
        c.setBorder(Rectangle.BOTTOM);
        c.setBorderColor(LINHA);
        c.setBorderWidth(1f);
        c.setPaddingBottom(5);
        c.setPaddingLeft(4);
        c.setPaddingRight(4);
        c.setHorizontalAlignment(direita ? Element.ALIGN_RIGHT : Element.ALIGN_LEFT);
        return c;
    }

    private PdfPCell celMini(Fontes fx, String txt, boolean direita, Color cor, boolean negrito) {
        PdfPCell c = new PdfPCell(new Phrase(txt, new Font(negrito ? fx.helvB : fx.helv, 7.5f, Font.NORMAL, cor)));
        c.setBorder(Rectangle.BOTTOM);
        c.setBorderColor(LINHA);
        c.setBorderWidth(0.6f);
        c.setPaddingTop(5);
        c.setPaddingBottom(6);
        c.setPaddingLeft(4);
        c.setPaddingRight(4);
        c.setHorizontalAlignment(direita ? Element.ALIGN_RIGHT : Element.ALIGN_LEFT);
        return c;
    }

    /** Barra de recebimento (proporção recebida do faturado no mês). */
    private PdfPCell barra(Fontes fx, double fracao) {
        PdfPCell c = celMini(fx, String.format(PT_BR, "%.0f%%", fracao * 100), true, TEXTO, true);
        c.setCellEvent((cell, r, canvases) -> {
            PdfContentByte cb = canvases[PdfPTable.BACKGROUNDCANVAS];
            float x = r.getLeft() + 4, y = r.getBottom() + r.getHeight() / 2 - 2.5f, w = r.getWidth() - 36;
            cb.saveState();
            cb.setColorFill(CINZA_BG);
            cb.roundRectangle(x, y, w, 5, 2.5f);
            cb.fill();
            if (fracao > 0) {
                cb.setColorFill(fracao >= 0.85 ? VERDE : fracao >= 0.6 ? AMBAR : VERMELHO);
                cb.roundRectangle(x, y, (float) Math.max(5, w * Math.min(1, fracao)), 5, 2.5f);
                cb.fill();
            }
            cb.restoreState();
        });
        return c;
    }

    private PdfPCell cel(BaseFont bf, float tam, String txt, String sub, Color cor, Color bg, int alinhamento, Fontes fx) {
        Phrase p = new Phrase(txt == null || txt.isBlank() ? "—" : txt, new Font(bf, tam, Font.NORMAL, cor));
        if (sub != null && !sub.isBlank()) p.add(new Chunk("\n" + sub, new Font(fx.helv, 6.5f, Font.NORMAL, SUAVE)));
        PdfPCell c = new PdfPCell(p);
        c.setBackgroundColor(bg);
        c.setBorder(Rectangle.BOTTOM);
        c.setBorderColor(LINHA);
        c.setBorderWidth(0.5f);
        c.setPaddingTop(5);
        c.setPaddingBottom(7);
        c.setPaddingLeft(6);
        c.setPaddingRight(6);
        c.setLeading(0, 1.25f);
        c.setVerticalAlignment(Element.ALIGN_MIDDLE);
        c.setHorizontalAlignment(alinhamento);
        return c;
    }

    /** Status em "pílula" colorida, como os badges do sistema. */
    private PdfPCell pilula(Fontes fx, String status, Color bg) {
        Color[] cores = switch (status == null ? "" : status) {
            case "PAGO" -> new Color[]{VERDE, VERDE_BG};
            case "PENDENTE" -> new Color[]{AMARELO, AMARELO_BG};
            case "ATRASADO" -> new Color[]{VERMELHO, VERMELHO_BG};
            case "EM_ANALISE" -> new Color[]{AZUL, AZUL_BG};
            default -> new Color[]{SUAVE, CINZA_BG};
        };
        String rot = STATUS.getOrDefault(status, status == null ? "—" : status);
        PdfPCell c = new PdfPCell(new Phrase(rot, new Font(fx.helvB, 6.8f, Font.NORMAL, cores[0])));
        c.setBackgroundColor(bg);
        c.setBorder(Rectangle.BOTTOM);
        c.setBorderColor(LINHA);
        c.setBorderWidth(0.5f);
        c.setHorizontalAlignment(Element.ALIGN_CENTER);
        c.setVerticalAlignment(Element.ALIGN_MIDDLE);
        c.setPaddingTop(5);
        c.setPaddingBottom(7);
        float largTxt = fx.helvB.getWidthPoint(rot, 6.8f);
        c.setCellEvent((cell, r, canvases) -> {
            PdfContentByte cb = canvases[PdfPTable.BACKGROUNDCANVAS];
            float w = largTxt + 14, h = 13;
            float x = r.getLeft() + (r.getWidth() - w) / 2, y = r.getBottom() + (r.getHeight() - h) / 2 + 0.5f;
            cb.saveState();
            cb.setColorFill(cores[1]);
            cb.roundRectangle(x, y, w, h, 6.5f);
            cb.fill();
            cb.restoreState();
        });
        return c;
    }

    // ====================================================================== utilidades

    private static final class Fontes {
        final BaseFont helv, helvB, serifB, serifBI, serifI, mono;

        Fontes() throws Exception {
            helv = BaseFont.createFont(BaseFont.HELVETICA, BaseFont.CP1252, false);
            helvB = BaseFont.createFont(BaseFont.HELVETICA_BOLD, BaseFont.CP1252, false);
            serifB = BaseFont.createFont(BaseFont.TIMES_BOLD, BaseFont.CP1252, false);
            serifBI = BaseFont.createFont(BaseFont.TIMES_BOLDITALIC, BaseFont.CP1252, false);
            serifI = BaseFont.createFont(BaseFont.TIMES_ITALIC, BaseFont.CP1252, false);
            mono = BaseFont.createFont(BaseFont.COURIER_BOLD, BaseFont.CP1252, false);
        }
    }

    private static String descreverFiltros(Filtros f) {
        List<String> partes = new ArrayList<>();
        boolean de = f.de() != null && !f.de().isBlank();
        boolean ate = f.ate() != null && !f.ate().isBlank();
        partes.add("Período: " + (de && ate ? mesCurto(f.de()) + " a " + mesCurto(f.ate())
            : de ? "desde " + mesCurto(f.de()) : ate ? "até " + mesCurto(f.ate()) : "todo o histórico"));
        partes.add("Status: " + (f.status() == null || f.status().isBlank() ? "todos" : STATUS.getOrDefault(f.status(), f.status()).toLowerCase(PT_BR)));
        if (f.busca() != null && !f.busca().isBlank()) partes.add("Busca: \"" + f.busca().trim() + "\"");
        return String.join("   ·   ", partes);
    }

    private static BigDecimal soma(List<LinhaPlanilha> ls, Predicate<LinhaPlanilha> p) {
        return ls.stream().filter(p).map(l -> l.valorFinal() == null ? BigDecimal.ZERO : l.valorFinal())
            .reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    private static String pct(BigDecimal parte, BigDecimal total) {
        if (total == null || total.signum() == 0) return "0%";
        return String.format(PT_BR, "%.1f%%", parte.multiply(BigDecimal.valueOf(100)).divide(total, 1, RoundingMode.HALF_UP));
    }

    private static String moeda(BigDecimal v) {
        return NumberFormat.getCurrencyInstance(PT_BR).format(v == null ? BigDecimal.ZERO : v).replace(' ', ' ');
    }

    private static String mesCurto(String ref) {
        if (ref == null) return "—";
        try {
            YearMonth m = YearMonth.parse(ref);
            return MESES[m.getMonthValue() - 1] + "/" + m.getYear();
        } catch (Exception e) {
            return ref;
        }
    }

    private static String forma(String f) {
        if (f == null) return "";
        return switch (f) {
            case "PIX" -> "PIX";
            case "CARTAO_CREDITO" -> "Cartão de crédito";
            case "BOLETO" -> "Boleto";
            default -> "Comprovante / outro";
        };
    }

    private static Image imagem(String caminho) {
        try {
            ClassPathResource r = new ClassPathResource(caminho);
            if (!r.exists()) return null;
            try (InputStream in = r.getInputStream()) {
                return Image.getInstance(in.readAllBytes());
            }
        } catch (Exception e) {
            return null;
        }
    }

    private static void faixa(PdfWriter writer, PdfContentByte cb, float x, float y, float w, float h) {
        PdfShading s = PdfShading.simpleAxial(writer, x, y, x + w, y, AMBAR, CARMIM);
        cb.saveState();
        cb.rectangle(x, y, w, h);
        cb.clip();
        cb.newPath();
        cb.paintShading(s);
        cb.restoreState();
    }

    private static void texto(PdfContentByte cb, BaseFont bf, float tamanho, Color cor, float espaco, String txt,
                              float x, float y, int alinhamento) {
        cb.saveState();
        cb.beginText();
        cb.setFontAndSize(bf, tamanho);
        cb.setColorFill(cor);
        cb.setCharacterSpacing(espaco);
        cb.showTextAligned(alinhamento, txt, x, y, 0);
        cb.endText();
        cb.restoreState();
    }

    /** Código curto derivado do conteúdo do relatório e do instante de emissão. */
    private static String autenticacao(List<LinhaPlanilha> linhas) {
        try {
            StringBuilder sb = new StringBuilder("VD-REL|").append(System.currentTimeMillis());
            linhas.forEach(l -> sb.append('|').append(l.transacao()).append(':').append(l.valorFinal()).append(':').append(l.status()));
            String hex = HexFormat.of().withUpperCase().formatHex(MessageDigest.getInstance("SHA-256")
                .digest(sb.toString().getBytes(StandardCharsets.UTF_8)));
            return hex.substring(0, 4) + "-" + hex.substring(4, 8) + "-" + hex.substring(8, 12) + "-" + hex.substring(12, 16);
        } catch (Exception e) {
            return "VD-REL";
        }
    }
}
