package com.vibedance.service;

import com.vibedance.model.Pagamento;

import com.lowagie.text.Document;
import com.lowagie.text.Font;
import com.lowagie.text.Paragraph;
import com.lowagie.text.Element;
import com.lowagie.text.pdf.PdfWriter;

import org.springframework.stereotype.Service;

import java.io.ByteArrayOutputStream;
import java.math.BigDecimal;
import java.text.NumberFormat;
import java.time.format.DateTimeFormatter;
import java.util.Locale;

@Service
public class ReciboPagamentoService {

    public byte[] gerar(Pagamento pagamento, String nomeAluno) {

        try {
            ByteArrayOutputStream saida = new ByteArrayOutputStream();

            Document documento = new Document();
            PdfWriter.getInstance(documento, saida);

            documento.open();

            Font titulo = new Font(Font.HELVETICA, 20, Font.BOLD);
            Font normal = new Font(Font.HELVETICA, 12);
            Font destaque = new Font(Font.HELVETICA, 12, Font.BOLD);

            Paragraph cabecalho = new Paragraph("VibeDance", titulo);
            cabecalho.setAlignment(Element.ALIGN_CENTER);
            documento.add(cabecalho);

            Paragraph subtitulo = new Paragraph("RECIBO DE PAGAMENTO", destaque);
            subtitulo.setAlignment(Element.ALIGN_CENTER);
            documento.add(subtitulo);

            documento.add(new Paragraph(" "));

            documento.add(new Paragraph(
                    "Número do recibo: " + pagamento.getId(), normal));

            documento.add(new Paragraph(
                    "Fatura: " + pagamento.getIdFatura(), normal));

            documento.add(new Paragraph(
                    "Aluno: " + nomeAluno, normal));

            BigDecimal valor = pagamento.getValorPago();

            String valorFormatado = NumberFormat
                    .getCurrencyInstance(new Locale("pt", "BR"))
                    .format(valor);

            documento.add(new Paragraph(
                    "Valor pago: " + valorFormatado, destaque));

            documento.add(new Paragraph(
                    "Forma de pagamento: " + pagamento.getFormaPagamento(),
                    normal));

            if (pagamento.getDataConfirmacao() != null) {
                String data = pagamento.getDataConfirmacao().format(
                        DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm"));

                documento.add(new Paragraph(
                        "Data da confirmação: " + data, normal));
            }

            documento.add(new Paragraph(" "));
            documento.add(new Paragraph(
                    "Status: PAGAMENTO CONFIRMADO", destaque));

            documento.add(new Paragraph(" "));
            documento.add(new Paragraph(
                    "Este documento comprova o registro do pagamento no sistema VibeDance.",
                    normal));

            documento.close();

            return saida.toByteArray();

        } catch (Exception e) {
            throw new IllegalStateException(
                    "Não foi possível gerar o recibo PDF.", e);
        }
    }
}