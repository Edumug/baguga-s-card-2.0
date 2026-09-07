import { database } from "./firebase-config.js";
import { ref, onValue, runTransaction, update, onDisconnect, remove } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-database.js";
import { criarEstadoPorJogo, normalizarEstado } from "./stateManager.js";
import { executarAcaoBot } from "./botController.js";
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
