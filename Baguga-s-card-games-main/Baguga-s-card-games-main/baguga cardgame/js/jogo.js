import { database } from "./firebase-config.js";
import { ref, onValue, runTransaction, update, onDisconnect, remove } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-database.js";
import { criarEstadoPorJogo, normalizarEstado } from "./stateManager.js";
import { executarAcaoBot } from "./js/botController.js";
import { removerAusentes, elementoCarta, mostrarToast, nomeDe } from "./jogo-base.js";
import * as Truco from "./jogos/truco.js?v=3";
import * as Blackjack from "./jogos/blackjack.js";
import * as Pife from "./jogos/pife.js";
import * as Buraco from "./jogos/buraco.js";
import * as Poker from "./jogos/poker.js";

const codigo = new URLSearchParams(location.search).get("codigo");
const jogadorId = sessionStorage.getItem("jogadorId");
if (!codigo || !jogadorId) { location.href = "index.html"; throw new Error("Sala ou jogador não encontrados."); }

const salaRef = ref(database, `salas/${codigo}`);
const meuRef = ref(database, `salas/${codigo}/jogadores/${jogadorId}`);
const desconector = onDisconnect(meuRef);
desconector.remove();
const $ = id => document.getElementById(id);

const ui = { 
    codigo: $("codigoSala"), 
    nome: $("nomeJogo"), 
    mao: $("minhasCartas"), 
    mesa: $("cartasMesa"), 
    seqAdversario: $("sequenciasAdversario"),
    seqPropria: $("sequenciasPropria"),
    msg: $("mensagemJogo"), 
    placar: $("listaPlacar"), 
    participantesExtras: $("participantesExtras"),
    listaParticipantesExtras: $("listaParticipantesExtras"),
    comprar: $("btnComprar"), 
    passar: $("btnPassar"), 
    comprarDescarte: $("btnComprarDescarte"), 
    truco: $("controlesTruco"), 
    respostas: $("respostasTruco"), 
    aceitar: $("btnAceitarTruco"), 
    recusar: $("btnRecusarTruco"), 
    aumentar: $("btnAumentarTruco"), 
    nova: $("btnNovaRodada"), 
    trocar: $("btnTrocarJogo"), 
    sair: $("btnSair"), 
    poker: $("controlesPoker"), 
    fold: $("btnFold"), 
    call: $("btnCall"), 
    raise: $("btnRaise"), 
    raiseValor: $("raiseValor"), 
    rodada: $("infoRodada"), 
    aposta: $("infoAposta") 
};

ui.codigo.textContent = codigo;
const nomes = { truco: "Truco", blackjack: "Blackjack", pife: "Pife", buraco: "Buraco", poker: "Poker" };
const jogos = { truco: Truco, blackjack: Blackjack, pife: Pife, buraco: Buraco, poker: Poker };
let souDono = false;
let tipoAtual = null;
let timerBot = null;
let timerRevelarVaza = null;
let selecionadasBuraco = [];

function jogadores(js) {
    const lista = Object.entries(js).sort(([, a], [, b]) => (a.ordem || 0) - (b.ordem || 0));
    const meuIndice = lista.findIndex(([id]) => id === jogadorId);
    const rotacionada = meuIndice < 0 ? lista : [...lista.slice(meuIndice), ...lista.slice(0, meuIndice)];
    // O próximo da lista sempre fica à direita de quem está vendo a mesa.
    // Assim, a sequência de turnos é baixo → direita → cima → esquerda.
    const slots = ["jogadorDireita", "jogadorSuperior", "jogadorEsquerda"];
    slots.forEach(id => { $(id).style.visibility = "hidden"; $(id).removeAttribute("data-jogador-id"); });
    rotacionada.slice(1).forEach(([id, jogador], indice) => {
        const el = $(slots[indice]);
        if (!el) return;
        el.style.visibility = "visible"; el.dataset.jogadorId = id;
        el.dataset.equipe = jogador.equipe || "";
        el.querySelector(".nome").textContent = jogador.nome || "Jogador";
        el.querySelector(".tipo").textContent = jogador.tipo === "bot" ? "BOT" : jogador.dono ? "Dono" : "Jogador";
        el.querySelector(".avatar").textContent = jogador.tipo === "bot" ? "🤖" : "👤";
    });
    const eu = js[jogadorId];
    $("jogadorPrincipal").dataset.jogadorId = jogadorId;
    $("jogadorPrincipal").dataset.equipe = eu?.equipe || "";
    $("jogadorPrincipal").querySelector(".nome").textContent = eu?.nome || "Você";
    souDono = !!eu?.dono;
    mostrarParticipantesExtras(rotacionada.slice(4));
}

function mostrarParticipantesExtras(extras) {
    if (!ui.participantesExtras || !ui.listaParticipantesExtras) return;
    ui.listaParticipantesExtras.innerHTML = "";
    ui.participantesExtras.classList.toggle("escondido", extras.length === 0);
    extras.forEach(([id, jogador]) => {
        const linha = document.createElement("div");
        linha.className = "participante-extra";
        if (id === pendingSnapshot?.estado?.atual) linha.classList.add("vez");
        if (jogador.equipe) {
            const marcador = document.createElement("span");
            marcador.className = `marcador-equipe ${jogador.equipe}`;
            linha.appendChild(marcador);
        }
        const nome = document.createElement("span");
        nome.textContent = `${jogador.tipo === "bot" ? "🤖 " : "👤 "}${jogador.nome || "Jogador"}`;
        linha.appendChild(nome);
        ui.listaParticipantesExtras.appendChild(linha);
    });
}

function preencherPlacar(linhas) {
    ui.placar.innerHTML = "";
    linhas.forEach(({ nome, valor, detalhe, equipe }) => {
        const linha = document.createElement("div");
        linha.className = "placar-jogador";
        if (equipe) linha.dataset.equipe = equipe;
        const titulo = document.createElement("span");
        titulo.textContent = detalhe ? `${nome} · ${detalhe}` : nome;
        const pontos = document.createElement("strong");
        pontos.textContent = valor;
        linha.append(titulo, pontos);
        ui.placar.append(linha);
    });
}

function nomeDupla(ids, numero, js, equipes = {}) {
    return ids
        .filter((id, indice) => equipes[id] ? (equipes[id] === "azul" ? 0 : 1) === numero : (ids.length === 4 ? indice % 2 === numero : indice === numero))
        .map(id => nomeDe(js, id))
        .join(" e ");
}

function atualizarPlacar(estado, js, tipo) {
    if (tipo === "truco") {
        preencherPlacar([0, 1].map(numero => ({
            nome: nomeDupla(estado.ids, numero, js, estado.equipes),
            valor: estado.pontosDupla?.[numero] || 0,
            detalhe: "pontos",
            equipe: numero === 0 ? "azul" : "vermelho"
        })));
        return;
    }

    if (tipo === "buraco") {
        const quantidade = estado.ids.length === 4 ? 2 : estado.ids.length;
        preencherPlacar(Array.from({ length: quantidade }, (_, numero) => ({
            nome: nomeDupla(estado.ids, numero, js, estado.equipes),
            valor: estado.pontos?.[`dupla_${numero}`] || 0,
            detalhe: "pontos",
            equipe: numero === 0 ? "azul" : "vermelho"
        })));
        return;
    }

    if (tipo === "poker") {
        preencherPlacar(estado.ids.map(id => ({
            nome: nomeDe(js, id),
            valor: estado.fichas?.[id] || 0,
            detalhe: "fichas"
        })));
        return;
    }

    preencherPlacar(estado.ids.map(id => ({
        nome: nomeDe(js, id),
        valor: estado.placar?.[id] || 0,
        detalhe: "vitórias"
    })));
}

function render(e, js, tipo) {
    tipoAtual = tipo;
    atualizarPlacar(e, js, tipo);
    if (ui.rodada) ui.rodada.textContent = tipo === "truco" ? `Vaza ${e.rodada || 1}/3` : e.fase || "Partida";
    if (ui.aposta) ui.aposta.textContent = tipo === "truco" ? `Aposta: ${e.valor || 1}` : e.pote !== undefined ? `Pote: ${e.pote}` : "";
    ui.mao.innerHTML = ""; ui.mesa.innerHTML = "";
    
    if (ui.seqAdversario && ui.seqPropria) {
        ui.seqAdversario.innerHTML = "";
        ui.seqPropria.innerHTML = "";
        ui.seqAdversario.classList.toggle("escondido", tipo !== "buraco");
        ui.seqPropria.classList.toggle("escondido", tipo !== "buraco");
    }

    ui.comprar.disabled = true; ui.passar.disabled = true;
    ui.truco.classList.add("escondido"); ui.respostas.classList.add("escondido"); ui.poker.classList.add("escondido");
    document.querySelectorAll(".jogador").forEach(el => el.classList.toggle("vez", el.dataset.jogadorId === e.atual && !e.fim));
    const minhaVez = e.atual === jogadorId && !e.fim;
    if (tipo !== "buraco" || !minhaVez) selecionadasBuraco = [];
    if (ui.comprarDescarte) ui.comprarDescarte.classList.toggle("escondido", tipo !== "buraco" || !minhaVez || e.etapa !== "comprar");
    ui.mesa.onclick = null;

    const mao = e.maos?.[jogadorId] || [];
    if (tipo === "truco") mao.forEach((c, i) => ui.mao.append(elementoCarta(c, minhaVez && !e.pedido ? () => Truco.acoesTruco(salaRef, jogadorId).jogar(i) : null)));
    else if (tipo === "pife") mao.forEach((c, i) => ui.mao.append(elementoCarta(c, minhaVez && e.etapa === "descartar" ? () => Pife.acoesPife(salaRef, jogadorId).descartar(i) : null)));
    else if (tipo === "buraco") mao.forEach((c, i) => {
        const elemento = elementoCarta(c, minhaVez && e.etapa === "descartar" ? () => {
            selecionadasBuraco = selecionadasBuraco.includes(i) ? selecionadasBuraco.filter(indice => indice !== i) : [...selecionadasBuraco, i];
            render(e, js, tipo);
        } : null);
        if (selecionadasBuraco.includes(i)) elemento.classList.add("selecionada");
        ui.mao.append(elemento);
    });
    else mao.forEach(c => ui.mao.append(elementoCarta(c)));

    if (tipo === "blackjack") {
        e.dealer.forEach((c, i) => ui.mesa.append(elementoCarta(i === 1 && !e.fim ? { valor: "🂠", naipe: "" } : c)));
        ui.comprar.disabled = !minhaVez; ui.passar.disabled = !minhaVez;
        ui.msg.textContent = e.resultado || `Sua mão: ${Blackjack.pontuacao(mao)}. ${minhaVez ? "Sua vez." : "Aguardando outro jogador."}`;
    } else if (tipo === "truco") {
        Object.values(e.jogadas || {}).forEach(c => ui.mesa.append(elementoCarta(c)));
        const podePedir = minhaVez && !e.pedido && e.ultimoPedidoPor !== jogadorId && Truco.pedidoSeguinte(e.valor);
        ui.truco.classList.toggle("escondido", !podePedir);
        ui.truco.querySelectorAll("button").forEach(b => b.disabled = Number(b.dataset.pedido) !== Truco.pedidoSeguinte(e.valor));
        const responder = e.pedido?.para === jogadorId; 
        ui.respostas.classList.toggle("escondido", !responder);
        ui.msg.textContent = e.resultado || (e.revelarVazaAte
            ? "Última carta na mesa…"
            : e.pedido
                ? `Pedido de ${e.pedido.valor}! ${responder ? "Responda." : "Aguardando resposta."}`
                : `Vira: ${e.vira.valor}${e.vira.naipe}. ${minhaVez ? "Jogue uma carta ou peça Truco." : `Aguardando ${nomeDe(js, e.atual)}.`}`);
    } else if (tipo === "pife" || tipo === "buraco") {
        if (tipo === "buraco" && ui.seqAdversario && ui.seqPropria) {
            Object.entries(e.baixadas || {}).forEach(([donoId, grupos]) => {
                if (!grupos.length) return;
                const ehProprio = donoId === jogadorId;
                const containerAlvo = ehProprio ? ui.seqPropria : ui.seqAdversario;

                const section = document.createElement("div");
                section.className = `sequencia-grupo ${ehProprio ? "sequencia-propria" : "sequencia-adversaria"}`;

                const titulo = document.createElement("div");
                titulo.className = "sequencia-titulo";
                titulo.textContent = ehProprio ? "🟥 Suas sequências" : `🟦 Sequências de ${nomeDe(js, donoId)}`;
                section.appendChild(titulo);

                grupos.forEach((grupo, grupoIndice) => {
                    const jogo = document.createElement("div");
                    jogo.className = `jogo-baixado ${ehProprio ? "jogo-proprio" : ""}`;
                    jogo.dataset.jogadorId = donoId;

                    if (ehProprio) {
                        jogo.title = "Clique para encaixar as cartas selecionadas";
                        jogo.onclick = evento => {
                            evento.stopPropagation();
                            if (!minhaVez || e.etapa !== "descartar" || !selecionadasBuraco.length) return;
                            Buraco.acoesBuraco(salaRef, jogadorId).encaixar(grupoIndice, selecionadasBuraco);
                            selecionadasBuraco = [];
                        };
                    }

                    grupo.forEach(cartaBaixada => jogo.append(elementoCarta(cartaBaixada)));
                    section.appendChild(jogo);
                });

                containerAlvo.appendChild(section);
            });
        }
        const topo = e.descarte?.at(-1);
        if (topo) {
            const cartaDescarte = elementoCarta(topo, tipo === "buraco" && minhaVez && e.etapa === "descartar" ? evento => {
                evento.stopPropagation();
                if (selecionadasBuraco.length !== 1) return;
                Buraco.acoesBuraco(salaRef, jogadorId).descartar(selecionadasBuraco[0]);
                selecionadasBuraco = [];
            } : null);
            cartaDescarte.classList.add("descarte-mesa");
            ui.mesa.append(cartaDescarte);
        }
        ui.comprar.disabled = !["pife", "buraco"].includes(tipo) || !minhaVez || e.etapa !== "comprar";
        if (tipo === "buraco") {
            ui.msg.textContent = e.resultado || (minhaVez ? e.etapa === "comprar" ? "Compre do monte ou do descarte." : "Baixe uma combinação ou descarte uma carta." : `Aguardando ${nomeDe(js, e.atual)}.`);
        } else {
            ui.msg.textContent = e.resultado || (minhaVez ? e.etapa === "comprar" ? "Compre uma carta." : "Descarte uma carta." : `Aguardando ${nomeDe(js, e.atual)}.`);
        }
    } else {
        e.mesa.forEach(c => ui.mesa.append(elementoCarta(c))); ui.poker.classList.remove("escondido");
        ui.msg.textContent = e.resultado || `Texas Hold'em: ${e.fase}. ${minhaVez ? "Escolha uma ação." : `Aguardando ${nomeDe(js, e.atual)}.`}`;
        ui.fold.disabled = ui.call.disabled = ui.raise.disabled = !minhaVez;
    }
    ui.nova.classList.toggle("escondido", !(e.fim && souDono && !e.partidaEncerrada));
    ui.trocar.classList.toggle("escondido", !(e.fim && souDono));
}

function executarBot(estado, js) {
    clearTimeout(timerBot);
    const id = estado.pedido?.para || estado.atual;
    if (estado.fim || !id || js[id]?.tipo !== "bot") return;
    timerBot = setTimeout(() => {
        executarAcaoBot(estado, id, salaRef);
    }, 650);
}

function resolverVazaDepoisDaPausa(estado) {
    clearTimeout(timerRevelarVaza);
    if (estado.tipo !== "truco" || !estado.revelarVazaAte || estado.fim) return;

    const espera = Math.max(0, estado.revelarVazaAte - Date.now());
    timerRevelarVaza = setTimeout(() => {
        runTransaction(salaRef, sala => {
            const partida = sala?.estado;
            // O temporizador já garantiu a pausa. Não repetimos a comparação de
            // relógio aqui, pois relógios de clientes diferentes podem divergir.
            if (!partida || partida.tipo !== "truco" || partida.fim || !partida.revelarVazaAte) return sala;
            Truco.resolverVaza(partida, sala.jogadores || {});
            return sala;
        }).catch(erro => {
            console.error("Erro ao resolver a vaza após a pausa:", erro);
            ui.msg.textContent = "Não foi possível resolver a vaza. Recarregue a partida.";
        });
    }, espera);
}

// Usando requestAnimationFrame para agrupar updates
let pendingSnapshot = null;
let renderTimeout = null;
onValue(salaRef, async snap => {
    if (!snap.exists()) { location.href = "index.html"; return; }
    pendingSnapshot = snap.val();
    if (renderTimeout) return;
    renderTimeout = setTimeout(async () => {
        renderTimeout = null;
        const sala = pendingSnapshot;
        const js = sala.jogadores || {};
        if (!js[jogadorId]) {
            // criação do jogador...
            return; // aguarda atualização
        }
        ui.nome.textContent = nomes[sala.jogo] || "Partida";
        jogadores(js);
        
        // Verifica se o estado precisa ser criado
        if (!sala.estado || Object.keys(sala.estado).length === 0) {
            console.log("Criando estado para", sala.jogo, "com variação", sala.variacao);
            await runTransaction(salaRef, atual => {
                if (atual && (!atual.estado || Object.keys(atual.estado).length === 0)) {
                    const ids = Object.entries(atual.jogadores || {}).sort(([, a], [, b]) => (a.ordem || 0) - (b.ordem || 0)).map(([id]) => id);
                    const equipes = Object.fromEntries(Object.entries(atual.jogadores || {})
                        .filter(([, jogador]) => jogador.equipe === "azul" || jogador.equipe === "vermelho")
                        .map(([id, jogador]) => [id, jogador.equipe]));
                    atual.estado = criarEstadoPorJogo(atual.jogo, ids, atual.variacao, equipes);
                }
                return atual;
            });
            return;
        }
        
        const estado = normalizarEstado(sala.estado);
        try {
            render(estado, js, sala.jogo);
        } catch (erro) {
            console.error("Erro na renderização:", erro);
        }
        await removerAusentes(salaRef, estado, js);
        resolverVazaDepoisDaPausa(estado);
        executarBot(estado, js);
    }, 50);
}, erro => {
    console.error(erro);
    ui.msg.textContent = "Conexão com a sala perdida.";
});

ui.comprar.onclick = () => {
    if (tipoAtual === "blackjack") Blackjack.acoesBlackjack(salaRef, jogadorId).comprar();
    if (tipoAtual === "pife") Pife.acoesPife(salaRef, jogadorId).comprar();
    if (tipoAtual === "buraco") Buraco.acoesBuraco(salaRef, jogadorId).comprar();
};  
ui.comprarDescarte.onclick = () => Buraco.acoesBuraco(salaRef, jogadorId).comprarDescarte();
ui.passar.onclick = () => {
    if (tipoAtual === "blackjack") Blackjack.acoesBlackjack(salaRef, jogadorId).parar();
};
ui.truco.querySelectorAll("button").forEach(b => b.onclick = () => Truco.acoesTruco(salaRef, jogadorId).pedir(Number(b.dataset.pedido)));
ui.aceitar.onclick = () => Truco.acoesTruco(salaRef, jogadorId).responder("aceitar");
ui.recusar.onclick = () => Truco.acoesTruco(salaRef, jogadorId).responder("recusar");
ui.aumentar.onclick = () => Truco.acoesTruco(salaRef, jogadorId).responder("aumentar");
ui.fold.onclick = () => Poker.acoesPoker(salaRef, jogadorId).fold();
ui.call.onclick = () => Poker.acoesPoker(salaRef, jogadorId).call();
ui.raise.onclick = () => Poker.acoesPoker(salaRef, jogadorId).raise(Number(ui.raiseValor.value) || 1);
ui.nova.onclick = () => runTransaction(salaRef, sala => {
    if (sala?.estado?.fim && !sala.estado.partidaEncerrada) {
        const ids = Object.entries(sala.jogadores || {})
            .sort(([, a], [, b]) => (a.ordem || 0) - (b.ordem || 0))
            .map(([id]) => id);
        const pontosDupla = sala.estado.pontosDupla;
        const placar = sala.estado.placar;
        const equipes = Object.fromEntries(Object.entries(sala.jogadores || {})
            .filter(([, jogador]) => jogador.equipe === "azul" || jogador.equipe === "vermelho")
            .map(([id, jogador]) => [id, jogador.equipe]));
        sala.estado = criarEstadoPorJogo(sala.jogo, ids, sala.variacao, equipes);
        if (pontosDupla) sala.estado.pontosDupla = pontosDupla;
        if (placar) sala.estado.placar = placar;
    }
    return sala;
});
ui.trocar.onclick = () => update(salaRef, { status: "aguardando", estado: null }).then(() => location.href = `sala.html?codigo=${codigo}`);
ui.sair.onclick = async () => { await desconector.cancel(); await remove(meuRef); sessionStorage.clear(); location.href = "index.html"; };
