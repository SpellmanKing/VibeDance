package com.vibedance.service;

import com.lowagie.text.*;
import com.lowagie.text.pdf.*;
import com.vibedance.model.Fatura;
import com.vibedance.model.Pagamento;
import com.vibedance.repository.FaturaRepository;
import com.vibedance.util.AgendaUtil;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Service;

import java.awt.Color;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.text.NumberFormat;
import java.time.LocalDateTime;
import java.time.YearMonth;
import java.time.format.DateTimeFormatter;
import java.util.HexFormat;
import java.util.Locale;

/**
 * Comprovante de pagamento em PDF com a identidade "Palco" do VibeDance: cabeçalho
 * escuro com arte de dança (gerada no Higgsfield), logo, valor em destaque, selo de
 * confirmação, detalhes organizados e código de autenticação.
 */
@Service
public class ReciboPagamentoService {

    private static final Locale PT_BR = new Locale("pt", "BR");
    private static final Color TINTA = new Color(0x0D, 0x0B, 0x0C);
    private static final Color GRAFITE = new Color(0x1A, 0x16, 0x18);
    private static final Color AMBAR = new Color(0xE8, 0xA6, 0x53);
    private static final Color CARMIM = new Color(0xDB, 0x4F, 0x7C);
    private static final Color MARFIM = new Color(0xF4, 0xEC, 0xE1);
    private static final Color PAPEL = new Color(0xFB, 0xF7, 0xF1);
    private static final Color TEXTO = new Color(0x2B, 0x24, 0x27);
    private static final Color SUAVE = new Color(0x8A, 0x7E, 0x75);
    private static final Color LINHA = new Color(0xE9, 0xDF, 0xD2);
    private static final Color FAIXA_TOTAL = new Color(0xFB, 0xEC, 0xD6);
    private static final Color VERDE = new Color(0x63, 0xC4, 0x9A);

    private static final DateTimeFormatter DATA_HORA = DateTimeFormatter.ofPattern("dd/MM/yyyy 'às' HH:mm", PT_BR);
    private static final String[] MESES = {"janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto",
        "setembro", "outubro", "novembro", "dezembro"};

    private final FaturaRepository faturaRepository;
    private final CatalogoService catalogo;

    public ReciboPagamentoService(FaturaRepository faturaRepository, CatalogoService catalogo) {
        this.faturaRepository = faturaRepository;
        this.catalogo = catalogo;
    }

    public byte[] gerar(Pagamento pagamento, String nomeAluno) {
        try {
            Fatura fatura = faturaRepository.findById(pagamento.getIdFatura()).orElse(null);
            String turma = fatura == null || fatura.getIdTurma() == null ? null : catalogo.contexto().nomeTurma(fatura.getIdTurma());

            BaseFont helv = BaseFont.createFont(BaseFont.HELVETICA, BaseFont.CP1252, false);
            BaseFont helvB = BaseFont.createFont(BaseFont.HELVETICA_BOLD, BaseFont.CP1252, false);
            BaseFont serifBI = BaseFont.createFont(BaseFont.TIMES_BOLDITALIC, BaseFont.CP1252, false);
            BaseFont serifI = BaseFont.createFont(BaseFont.TIMES_ITALIC, BaseFont.CP1252, false);
            BaseFont serifB = BaseFont.createFont(BaseFont.TIMES_BOLD, BaseFont.CP1252, false);
            BaseFont mono = BaseFont.createFont(BaseFont.COURIER_BOLD, BaseFont.CP1252, false);
            BaseFont dingbats = BaseFont.createFont(BaseFont.ZAPFDINGBATS, BaseFont.WINANSI, false);

            ByteArrayOutputStream saida = new ByteArrayOutputStream();
            Rectangle a4 = PageSize.A4;
            float W = a4.getWidth(), H = a4.getHeight();
            Document doc = new Document(a4, 48, 48, 292, 96);
            PdfWriter writer = PdfWriter.getInstance(doc, saida);
            doc.addTitle("Comprovante de pagamento · VibeDance");
            doc.addAuthor("VibeDance");
            doc.open();

            PdfContentByte fundo = writer.getDirectContentUnder();
            PdfContentByte frente = writer.getDirectContent();

            // ---------------------------------------------------------- papel e cabeçalho
            fundo.setColorFill(PAPEL);
            fundo.rectangle(0, 0, W, H);
            fundo.fill();

            float alturaCab = 262;
            fundo.setColorFill(TINTA);
            fundo.rectangle(0, H - alturaCab, W, alturaCab);
            fundo.fill();
            Image arte = imagem("static/img/recibo-arte.jpg");
            if (arte != null) {
                float h = W * arte.getHeight() / arte.getWidth();
                arte.scaleAbsolute(W, h);
                arte.setAbsolutePosition(0, H - h);
                fundo.addImage(arte);
            }
            faixaGradiente(writer, fundo, 0, H - alturaCab - 5, W, 5);

            // logo + marca
            Image logo = imagem("static/img/vibedance-simbolo-512.png");
            if (logo != null) {
                logo.scaleAbsolute(34, 34);
                logo.setAbsolutePosition(48, H - 74);
                frente.addImage(logo);
            }
            texto(frente, serifBI, 22, MARFIM, 0, "VibeDance", 90, H - 60, Element.ALIGN_LEFT);
            texto(frente, helvB, 6.5f, AMBAR, 2.2f, "ESTÚDIO DE DANÇA", 91, H - 72, Element.ALIGN_LEFT);

            // título e valor
            texto(frente, helvB, 8.5f, AMBAR, 2.6f, "COMPROVANTE DE PAGAMENTO", 48, H - 146, Element.ALIGN_LEFT);
            texto(frente, serifB, 44, MARFIM, 0, moeda(pagamento.getValorPago()), 46, H - 192, Element.ALIGN_LEFT);
            String quando = pagamento.getDataConfirmacao() == null ? "" : "Pago em " + pagamento.getDataConfirmacao().format(DATA_HORA);
            texto(frente, helv, 10, new Color(0xD8, 0xCC, 0xBF), 0, quando + " · " + forma(pagamento.getFormaPagamento()), 48, H - 212, Element.ALIGN_LEFT);

            // selo de confirmação
            float seloY = H - 252, seloW = 176;
            frente.setColorFill(VERDE);
            frente.roundRectangle(48, seloY, seloW, 22, 11);
            frente.fill();
            texto(frente, dingbats, 10, TINTA, 0, "4", 60, seloY + 7, Element.ALIGN_LEFT);
            texto(frente, helvB, 8, TINTA, 1.4f, "PAGAMENTO CONFIRMADO", 74, seloY + 8, Element.ALIGN_LEFT);

            // ---------------------------------------------------------- rodapé (antes do corpo: fica sempre na página 1)
            float alturaRod = 78;
            fundo.setColorFill(TINTA);
            fundo.rectangle(0, 0, W, alturaRod);
            fundo.fill();
            faixaGradiente(writer, fundo, 0, alturaRod, W, 3);
            texto(frente, helvB, 6.5f, AMBAR, 2, "CÓDIGO DE AUTENTICAÇÃO", 48, 52, Element.ALIGN_LEFT);
            texto(frente, mono, 12, MARFIM, 1, autenticacao(pagamento), 48, 34, Element.ALIGN_LEFT);
            String gerado = "Gerado em " + LocalDateTime.now(AgendaUtil.FUSO).format(DATA_HORA)
                + " · Este documento confirma o registro do pagamento no sistema VibeDance.";
            texto(frente, helv, 7, new Color(0xA8, 0x9C, 0x92), 0, gerado, 48, 18, Element.ALIGN_LEFT);
            texto(frente, serifBI, 14, MARFIM, 0, "VibeDance", W - 48, 38, Element.ALIGN_RIGHT);
            if (logo != null) {
                Image mini = Image.getInstance(logo);
                mini.scaleAbsolute(18, 18);
                mini.setAbsolutePosition(W - 140, 33);
                frente.addImage(mini);
            }

            // ---------------------------------------------------------- corpo
            String primeiroNome = nomeAluno == null ? "" : nomeAluno.trim().split("\\s+")[0];
            Paragraph ola = new Paragraph("Olá, " + primeiroNome + "!", new Font(serifBI, 20, Font.NORMAL, TEXTO));
            ola.setSpacingAfter(4);
            doc.add(ola);
            Paragraph msg = new Paragraph("Recebemos o seu pagamento com sucesso. Obrigado por fazer parte do VibeDance: "
                + "cada mensalidade mantém o palco aceso e a música tocando.", new Font(helv, 10.5f, Font.NORMAL, SUAVE));
            msg.setLeading(15);
            msg.setSpacingAfter(18);
            doc.add(msg);

            PdfPTable tabela = new PdfPTable(new float[]{38, 62});
            tabela.setWidthPercentage(100);
            linha(tabela, helvB, helv, "Nº da transação", String.format("TX-%06d", pagamento.getId()));
            linha(tabela, helvB, helv, "Aluno(a)", nomeAluno);
            if (fatura != null) {
                linha(tabela, helvB, helv, "Referente a", fatura.getTitulo());
                if (turma != null && !"—".equals(turma)) linha(tabela, helvB, helv, "Turma", turma);
                linha(tabela, helvB, helv, "Mês de referência", mesExtenso(fatura.getMesReferencia()));
            }
            String detalhe = pagamento.getMetodoDetalhe() == null ? "" : " · " + pagamento.getMetodoDetalhe();
            linha(tabela, helvB, helv, "Forma de pagamento", forma(pagamento.getFormaPagamento()) + detalhe);
            if (pagamento.getDataConfirmacao() != null) {
                linha(tabela, helvB, helv, "Data da confirmação", pagamento.getDataConfirmacao().format(DATA_HORA));
            }
            BigDecimal base = pagamento.getValorBase() != null ? pagamento.getValorBase()
                : fatura != null ? fatura.getValor() : pagamento.getValorPago();
            linha(tabela, helvB, helv, "Valor da mensalidade", moeda(base));
            BigDecimal desconto = fatura == null ? BigDecimal.ZERO : fatura.getDesconto();
            BigDecimal ajuste = pagamento.getValorPago().subtract(base);
            if (desconto.signum() > 0 && fatura.getValorOriginal() != null && base.compareTo(fatura.getValorOriginal()) == 0) {
                String motivo = FinanceiroAdminService.MOTIVOS_DESCONTO.getOrDefault(
                    fatura.getMotivoDesconto() == null ? "" : fatura.getMotivoDesconto(), "Condição especial");
                linha(tabela, helvB, helv, "Desconto · " + motivo, "- " + moeda(desconto));
                ajuste = ajuste.add(desconto); // o que sobra são multa e juros
            }
            if (ajuste.signum() != 0) {
                linha(tabela, helvB, helv, ajuste.signum() > 0 ? "Multa e juros" : "Desconto",
                    (ajuste.signum() > 0 ? "+ " : "- ") + moeda(ajuste.abs()));
            }
            // total em faixa âmbar
            PdfPCell rotTotal = celula(new Phrase(espacado("TOTAL PAGO"), new Font(helvB, 9, Font.NORMAL, TEXTO)), FAIXA_TOTAL);
            rotTotal.setPaddingLeft(14);
            PdfPCell valTotal = celula(new Phrase(moeda(pagamento.getValorPago()), new Font(serifB, 20, Font.NORMAL, TEXTO)), FAIXA_TOTAL);
            valTotal.setHorizontalAlignment(Element.ALIGN_RIGHT);
            valTotal.setPaddingRight(14);
            tabela.addCell(rotTotal);
            tabela.addCell(valTotal);
            tabela.setSpacingAfter(26);
            doc.add(tabela);

            // contagem de 8: a assinatura do estúdio
            Paragraph conta = new Paragraph();
            conta.setAlignment(Element.ALIGN_CENTER);
            for (int i = 1; i <= 8; i++) {
                Font f = i == 8 ? new Font(serifBI, 20, Font.NORMAL, CARMIM) : new Font(serifI, 16, Font.NORMAL, AMBAR);
                conta.add(new Chunk(i + (i < 8 ? "     " : ""), f));
            }
            doc.add(conta);
            Paragraph assinatura = new Paragraph("No compasso certo — até a próxima aula.", new Font(serifI, 11, Font.NORMAL, SUAVE));
            assinatura.setAlignment(Element.ALIGN_CENTER);
            assinatura.setSpacingBefore(4);
            doc.add(assinatura);

            doc.close();
            return saida.toByteArray();
        } catch (Exception e) {
            throw new IllegalStateException("Não foi possível gerar o recibo PDF.", e);
        }
    }

    // ================================================================ helpers

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

    private static void faixaGradiente(PdfWriter writer, PdfContentByte cb, float x, float y, float w, float h) {
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

    private static PdfPCell celula(Phrase p, Color fundo) {
        PdfPCell c = new PdfPCell(p);
        c.setBorder(Rectangle.NO_BORDER);
        c.setBackgroundColor(fundo);
        c.setPaddingTop(12);
        c.setPaddingBottom(12);
        c.setVerticalAlignment(Element.ALIGN_MIDDLE);
        return c;
    }

    private static void linha(PdfPTable t, BaseFont rotulo, BaseFont valor, String r, String v) {
        PdfPCell a = new PdfPCell(new Phrase(espacado(r.toUpperCase(PT_BR)), new Font(rotulo, 7.5f, Font.NORMAL, SUAVE)));
        PdfPCell b = new PdfPCell(new Phrase(v == null || v.isBlank() ? "—" : v, new Font(rotulo, 10, Font.NORMAL, TEXTO)));
        for (PdfPCell c : new PdfPCell[]{a, b}) {
            c.setBorder(Rectangle.BOTTOM);
            c.setBorderColor(LINHA);
            c.setBorderWidth(0.8f);
            c.setPaddingTop(7);
            c.setPaddingBottom(7);
            c.setVerticalAlignment(Element.ALIGN_MIDDLE);
        }
        a.setPaddingLeft(2);
        b.setHorizontalAlignment(Element.ALIGN_RIGHT);
        t.addCell(a);
        t.addCell(b);
    }

    /** Rótulos em caixa alta levemente espaçados (espaço comum entre as letras não cabe; usa só caixa alta). */
    private static String espacado(String s) {
        return s;
    }

    private static String moeda(BigDecimal v) {
        return NumberFormat.getCurrencyInstance(PT_BR).format(v == null ? BigDecimal.ZERO : v);
    }

    private static String forma(String f) {
        if (f == null) return "—";
        return switch (f) {
            case "PIX" -> "PIX";
            case "CARTAO_CREDITO" -> "Cartão de crédito";
            case "BOLETO" -> "Boleto bancário";
            default -> "Comprovante / outro";
        };
    }

    private static String mesExtenso(String ref) {
        try {
            YearMonth m = YearMonth.parse(ref);
            return MESES[m.getMonthValue() - 1] + " de " + m.getYear();
        } catch (Exception e) {
            return ref;
        }
    }

    /** Código curto e verificável derivado dos dados imutáveis do pagamento. */
    static String autenticacao(Pagamento p) {
        try {
            String base = "VD|" + p.getId() + "|" + p.getIdFatura() + "|" + p.getValorPago() + "|" + p.getDataConfirmacao()
                + "|" + p.getGatewayTransacaoId();
            String hex = HexFormat.of().withUpperCase().formatHex(MessageDigest.getInstance("SHA-256")
                .digest(base.getBytes(StandardCharsets.UTF_8)));
            return hex.substring(0, 4) + "-" + hex.substring(4, 8) + "-" + hex.substring(8, 12) + "-" + hex.substring(12, 16);
        } catch (Exception e) {
            return String.format("VD-%08d", p.getId());
        }
    }
}
