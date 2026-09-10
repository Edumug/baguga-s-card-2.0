import { database } from "./firebase-config.js";
import { ref, set, get, update } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-database.js";

const $ = id => document.getElementById(id);
const btnCriarSala = $("btnCriarSala");
const btnEntrarSala = $("btnEntrarSala");
const nomeJogador = $("nomeJogador");
const codigoSala = $("codigoSala");
const mensagem = $("mensagem");

nomeJogador.value = localStorage.getItem("nomeJogador") || "";

const jogosPermitidos = new Set(["truco", "blackjack", "pife"]);

function mostrar(texto, erro = false) {
  mensagem.textContent = texto;
  mensagem.classList.toggle("erro", erro);
}
function salvarNome(nome) {
  localStorage.setItem("nomeJogador", nome);
}
function gerarId() {
  return window.crypto?.randomUUID?.() || `j_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}
function gerarCodigo() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 5 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

async function criarSala() {
  const nome = nomeJogador.value.trim();
  if (!nome) { mostrar("Digite seu nome para continuar.", true); nomeJogador.focus(); return; }
  salvarNome(nome);
  btnCriarSala.disabled = true;
  mostrar("Criando sua sala…");
  try {
    let codigo = gerarCodigo();
    while ((await get(ref(database, `salas/${codigo}`))).exists()) codigo = gerarCodigo();
    const jogadorId = gerarId();
    await set(ref(database, `salas/${codigo}`), {
      dono: jogadorId,
      jogo: null,
      variacao: "padrao",
      status: "aguardando",
      criadoEm: Date.now(),
      jogadores: { [jogadorId]: { nome, tipo: "humano", dono: true, ordem: 0 } }
    });
    sessionStorage.setItem("jogadorId", jogadorId);
    sessionStorage.setItem("nomeJogador", nome);
    localStorage.setItem("codigoSala", codigo);
    location.href = `sala.html?codigo=${codigo}`;
  } catch (erro) {
    console.error(erro); mostrar("Não foi possível criar a sala.", true); btnCriarSala.disabled = false;
  }
}

async function entrarSala() {
  const nome = nomeJogador.value.trim();
  const codigo = codigoSala.value.trim().toUpperCase();
  if (!nome) { mostrar("Digite seu nome para entrar.", true); nomeJogador.focus(); return; }
  if (!/^[A-Z0-9]{5}$/.test(codigo)) { mostrar("O código deve ter 5 caracteres.", true); codigoSala.focus(); return; }
  salvarNome(nome);
  btnEntrarSala.disabled = true; mostrar("Entrando na sala…");
  try {
    const salaRef = ref(database, `salas/${codigo}`);
    const snap = await get(salaRef);
    if (!snap.exists()) { mostrar("Essa sala não existe.", true); btnEntrarSala.disabled = false; return; }
    const sala = snap.val();
    const jogadores = sala.jogadores || {};
    if (sala.status === "jogando") { mostrar("Essa partida já começou.", true); btnEntrarSala.disabled = false; return; }
    if (Object.keys(jogadores).length >= 8) { mostrar("A sala está cheia.", true); btnEntrarSala.disabled = false; return; }
    const jogadorId = gerarId();
    await update(ref(database, `salas/${codigo}/jogadores`), {
      [jogadorId]: { nome, tipo: "humano", dono: false, ordem: Object.keys(jogadores).length }
    });
    sessionStorage.setItem("jogadorId", jogadorId);
    sessionStorage.setItem("nomeJogador", nome);
    localStorage.setItem("codigoSala", codigo);
    location.href = `sala.html?codigo=${codigo}`;
  } catch (erro) {
    console.error(erro); mostrar("Não foi possível entrar na sala.", true); btnEntrarSala.disabled = false;
  }
}

btnCriarSala.addEventListener("click", criarSala);
btnEntrarSala.addEventListener("click", entrarSala);
[nomeJogador, codigoSala].forEach(el => el.addEventListener("keydown", e => { if (e.key === "Enter") entrarSala(); }));
nomeJogador.addEventListener("input", () => salvarNome(nomeJogador.value));
codigoSala.addEventListener("input", () => { codigoSala.value = codigoSala.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 5); });
