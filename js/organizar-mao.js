(() => {
    const mao = document.getElementById("minhasCartas");
    if (!mao) return;

    const estilo = document.createElement("style");
    estilo.textContent = `
        #minhasCartas .carta-arrastavel { cursor: grab; user-select: none; }
        #minhasCartas .carta-arrastavel:active { cursor: grabbing; }
        #minhasCartas .arrastando { opacity: .55; transform: translateY(-8px); }
    `;
    document.head.appendChild(estilo);

    const params = new URLSearchParams(location.search);
    const codigo = params.get("codigo") || "sem-sala";
    const jogadorId = sessionStorage.getItem("jogadorId") || "jogador";
    const chaveStorage = `ordemCartas:${codigo}:${jogadorId}`;

    let arrastando = null;
    let mudou = false;
    let aplicando = false;
    let timerAplicar = null;

    function baseDaCarta(carta) {
        return carta.dataset.cartaId || carta.textContent.trim();
    }

    function listaChaves() {
        const ocorrencias = {};
        return [...mao.children].map(carta => {
            const base = baseDaCarta(carta);
            ocorrencias[base] = (ocorrencias[base] || 0) + 1;
            return `${base}#${ocorrencias[base]}`;
        });
    }

    function salvarOrdem() {
        try { localStorage.setItem(chaveStorage, JSON.stringify(listaChaves())); } catch (_) {}
    }

    function aplicarOrdem() {
        if (aplicando || !mao.children.length) return;
        let salva;
        try { salva = JSON.parse(localStorage.getItem(chaveStorage) || "null"); } catch (_) { salva = null; }
        if (!Array.isArray(salva) || !salva.length) return;

        const cartas = [...mao.children];
        const ocorrencias = {};
        const mapa = new Map();
        cartas.forEach(carta => {
            const base = baseDaCarta(carta);
            ocorrencias[base] = (ocorrencias[base] || 0) + 1;
            mapa.set(`${base}#${ocorrencias[base]}`, carta);
        });

        const ordenadas = [];
        salva.forEach(chave => {
            const carta = mapa.get(chave);
            if (carta) { ordenadas.push(carta); mapa.delete(chave); }
        });
        mapa.forEach(carta => ordenadas.push(carta));

        if (ordenadas.some((carta, i) => carta !== cartas[i])) {
            aplicando = true;
            ordenadas.forEach(carta => mao.appendChild(carta));
            aplicando = false;
        }
    }

    function ordenarAutomaticamente() {
        const ordem = { "A":14, "2":2, "3":3, "4":4, "5":5, "6":6, "7":7, "8":8, "9":9, "10":10, "J":11, "Q":12, "K":13 };
        const naipeOrdem = { "♣":0, "♦":1, "♥":2, "♠":3 };
        const cartas = [...mao.children];
        cartas.sort((a, b) => {
            const av = a.dataset.valor || a.textContent.trim().match(/^(10|[A2-9JQK])/i)?.[1] || "";
            const bv = b.dataset.valor || b.textContent.trim().match(/^(10|[A2-9JQK])/i)?.[1] || "";
            const an = a.dataset.naipe || a.textContent.trim().slice(-1);
            const bn = b.dataset.naipe || b.textContent.trim().slice(-1);
            return (ordem[av] || 0) - (ordem[bv] || 0) || (naipeOrdem[an] || 0) - (naipeOrdem[bn] || 0);
        });
        aplicando = true;
        cartas.forEach(carta => mao.appendChild(carta));
        aplicando = false;
        salvarOrdem();
    }

    window.organizarMao = ordenarAutomaticamente;

    function atualizarArraste() {
        [...mao.children].forEach(carta => {
            carta.draggable = true;
            carta.classList.add("carta-arrastavel");
            if (carta.dataset.dragConfigurado) return;
            carta.dataset.dragConfigurado = "1";

            carta.addEventListener("dragstart", evento => {
                arrastando = carta;
                mudou = false;
                carta.classList.add("arrastando");
                evento.dataTransfer.effectAllowed = "move";
                evento.dataTransfer.setData("text/plain", "carta");
            });
            carta.addEventListener("dragover", evento => {
                evento.preventDefault();
                if (!arrastando || arrastando === carta) return;
                const rect = carta.getBoundingClientRect();
                mao.insertBefore(arrastando, evento.clientX > rect.left + rect.width / 2 ? carta.nextSibling : carta);
                mudou = true;
            });
            carta.addEventListener("dragend", () => {
                carta.classList.remove("arrastando");
                if (arrastando && mudou) salvarOrdem();
                arrastando = null;
                mudou = false;
            });
        });
    }

    function agendarAplicacao() {
        clearTimeout(timerAplicar);
        timerAplicar = setTimeout(aplicarOrdem, 30);
    }

    const observer = new MutationObserver(() => {
        atualizarArraste();
        if (!aplicando) agendarAplicacao();
    });

    observer.observe(mao, { childList: true });
    atualizarArraste();
    aplicarOrdem();
})();
