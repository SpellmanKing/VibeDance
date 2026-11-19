/** Motivos de desconto das cobranças (iguais aos aceitos pelo back-end). */
export const MOTIVOS = {
    PRO_RATA: { rotulo: 'Recém-chegado', aluno: 'Proporcional (entrada no mês)', icone: 'fa-seedling', dica: 'Cobra só os dias a partir da entrada.' },
    BOLSA: { rotulo: 'Bolsa', aluno: 'Bolsa de estudos', icone: 'fa-graduation-cap', dica: 'Bolsa integral ou parcial.' },
    IRMAOS: { rotulo: 'Família', aluno: 'Desconto família', icone: 'fa-people-roof', dica: 'Irmãos, pais e filhos dançando juntos.' },
    CONVENIO: { rotulo: 'Convênio', aluno: 'Convênio / parceria', icone: 'fa-handshake', dica: 'Empresa ou escola parceira.' },
    PONTUALIDADE: { rotulo: 'Antecipado', aluno: 'Pagamento antecipado', icone: 'fa-bolt', dica: 'Quem paga adiantado.' },
    NEGOCIACAO: { rotulo: 'Negociação', aluno: 'Negociação', icone: 'fa-scale-balanced', dica: 'Acordo combinado com o aluno.' },
    PROMOCIONAL: { rotulo: 'Promoção', aluno: 'Promoção', icone: 'fa-tags', dica: 'Campanha do estúdio.' },
    CORTESIA: { rotulo: 'Cortesia', aluno: 'Cortesia', icone: 'fa-gift', dica: 'Agrado pontual.' },
    OUTRO: { rotulo: 'Outro', aluno: 'Condição especial', icone: 'fa-star', dica: 'Descreva na observação.' },
};
export const rotuloMotivo = (m) => MOTIVOS[m]?.aluno || 'Condição especial';
