import { esc, html, raw, vazio } from './ui.js';

/**
 * Tabela inteligente: ordenação por coluna, busca textual, filtros combinados
 * nomeados, paginação e ações inline por linha.
 */
export class SmartTable {
    constructor({ el, colunas, busca, porPagina = 10, onLinha, vazio: vazioCfg, chave = 'id' }) {
        this.el = el;
        this.colunas = colunas;
        this.textoBusca = busca;
        this.porPagina = porPagina;
        this.onLinha = onLinha;
        this.vazioCfg = vazioCfg || ['fa-inbox', 'Nada por aqui', 'Ajuste os filtros para ver resultados.'];
        this.chave = chave;
        this.dados = [];
        this.filtros = new Map();
        this.termo = '';
        this.ordem = null;
        this.pagina = 1;
        el.addEventListener('click', (e) => this._clique(e));
        el.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && e.target.matches('tr.is-clickable')) this._abrirLinha(e.target);
        });
    }

    setDados(dados) {
        this.dados = dados || [];
        const maxPag = Math.max(1, Math.ceil(this._filtrados().length / this.porPagina));
        if (this.pagina > maxPag) this.pagina = maxPag;
        this.render();
    }

    buscar(termo) {
        this.termo = (termo || '').toLowerCase().trim();
        this.pagina = 1;
        this.render();
    }

    setFiltro(nome, fn) {
        if (fn) this.filtros.set(nome, fn); else this.filtros.delete(nome);
        this.pagina = 1;
        this.render();
    }

    /** Linhas que passam pela busca e pelos filtros, na ordenação atual (todas as páginas). */
    visiveis() {
        return this._filtrados();
    }

    _filtrados() {
        let lista = this.dados.filter((d) => [...this.filtros.values()].every((fn) => fn(d)));
        if (this.termo && this.textoBusca) lista = lista.filter((d) => this.textoBusca(d).toLowerCase().includes(this.termo));
        if (this.ordem) {
            const col = this.colunas.find((c) => c.chave === this.ordem.chave);
            const val = col.valor || ((d) => d[col.chave]);
            lista = [...lista].sort((a, b) => {
                const va = val(a); const vb = val(b);
                const r = typeof va === 'number' && typeof vb === 'number' ? va - vb : String(va ?? '').localeCompare(String(vb ?? ''), 'pt-BR', { numeric: true });
                return this.ordem.dir === 'asc' ? r : -r;
            });
        }
        return lista;
    }

    render() {
        const lista = this._filtrados();
        const total = lista.length;
        const paginas = Math.max(1, Math.ceil(total / this.porPagina));
        const ini = (this.pagina - 1) * this.porPagina;
        const pagina = lista.slice(ini, ini + this.porPagina);
        this._pagina = pagina;

        const thead = this.colunas.map((c) => {
            const ord = Boolean(c.chave) && this.ordem?.chave === c.chave;
            const seta = ord ? (this.ordem.dir === 'asc' ? 'fa-arrow-up' : 'fa-arrow-down') : 'fa-sort';
            return `<th ${c.ordenavel !== false && c.chave ? `data-sort="${esc(c.chave)}" tabindex="0" aria-sort="${ord ? (this.ordem.dir === 'asc' ? 'ascending' : 'descending') : 'none'}"` : ''} class="${c.num ? 'num' : ''} ${ord ? 'is-sorted' : ''}">${esc(c.titulo)}${c.ordenavel !== false && c.chave ? `<i class="fas ${seta} sort-ind"></i>` : ''}</th>`;
        }).join('');

        const tbody = pagina.length
            ? pagina.map((d, i) => `<tr data-i="${i}" ${this.onLinha ? 'class="is-clickable" tabindex="0"' : ''}>${this.colunas.map((c) => `<td class="${c.num ? 'num' : ''}">${c.render ? c.render(d) : esc(d[c.chave])}</td>`).join('')}</tr>`).join('')
            : `<tr><td colspan="${this.colunas.length}">${vazio(...this.vazioCfg)}</td></tr>`;

        this.el.innerHTML = html`
            <div class="table-wrap"><table class="table"><thead><tr>${raw(thead)}</tr></thead><tbody>${raw(tbody)}</tbody></table></div>
            <div class="table-foot">
                <span class="num">${total ? `${ini + 1}–${Math.min(ini + this.porPagina, total)} de ${total}` : '0 registros'}</span>
                <div class="pager">
                    <button class="btn btn-sm btn-ghost" data-pag="-1" ${this.pagina <= 1 ? 'disabled' : ''} aria-label="Página anterior"><i class="fas fa-chevron-left"></i></button>
                    <span class="btn btn-sm btn-ghost num" aria-live="polite">${this.pagina}/${paginas}</span>
                    <button class="btn btn-sm btn-ghost" data-pag="1" ${this.pagina >= paginas ? 'disabled' : ''} aria-label="Próxima página"><i class="fas fa-chevron-right"></i></button>
                </div>
            </div>`;
        this.el.querySelectorAll('th[data-sort]').forEach((th) => th.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') this._ordenar(th.dataset.sort);
        }));
        this.onRender?.(lista);
    }

    _ordenar(chave) {
        this.ordem = this.ordem?.chave === chave && this.ordem.dir === 'asc' ? { chave, dir: 'desc' } : { chave, dir: 'asc' };
        this.render();
    }

    _abrirLinha(tr) {
        const d = this._pagina[Number(tr.dataset.i)];
        if (d && this.onLinha) this.onLinha(d);
    }

    _clique(e) {
        const th = e.target.closest('th[data-sort]');
        if (th) return this._ordenar(th.dataset.sort);
        const pag = e.target.closest('[data-pag]');
        if (pag) {
            this.pagina += Number(pag.dataset.pag);
            return this.render();
        }
        const acao = e.target.closest('[data-acao]');
        if (acao) {
            e.stopPropagation();
            const tr = acao.closest('tr');
            const d = this._pagina[Number(tr.dataset.i)];
            this.el.dispatchEvent(new CustomEvent('acao', { detail: { acao: acao.dataset.acao, item: d, botao: acao } }));
            return undefined;
        }
        const tr = e.target.closest('tr.is-clickable');
        if (tr && !e.target.closest('a, button, input, select')) this._abrirLinha(tr);
        return undefined;
    }
}
