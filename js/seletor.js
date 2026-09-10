import { database } from "./firebase-config.js";
import { ref, get, update } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-database.js";

const p=new URLSearchParams(location.search), codigo=p.get("codigo"), jogadorId=sessionStorage.getItem("jogadorId");
if(!codigo||!jogadorId){location.href="index.html";throw new Error("Dados ausentes");}
const salaRef=ref(database,`salas/${codigo}`), cards=[...document.querySelectorAll(".game-card")], select=document.getElementById("seletorVariacao"), msg=document.getElementById("mensagem"), confirm=document.getElementById("btnConfirmar");
document.getElementById("codigoSala").textContent=codigo;
const configs={
 truco:{nome:"Truco",desc:"Partidas de vazas com possibilidade de aumentar a aposta.",vars:[["padrao","Truco Padrão"]]},
 blackjack:{nome:"Blackjack",desc:"Cada jogador enfrenta o dealer em uma rodada rápida.",vars:[["classico","Blackjack Clássico"]]},
 pife:{nome:"Pife",desc:"Monte trincas e sequências com sua mão de 9 cartas.",vars:[["tradicional","Pife Tradicional"]]}
};
const limites={truco:[2,4],blackjack:[1,7],pife:[2,4]}; let jogo=null;
function selecionar(card, anterior){cards.forEach(c=>c.classList.remove("selected"));card.classList.add("selected");jogo=card.dataset.jogo;const c=configs[jogo];document.getElementById("nomeSelecionado").textContent=c.nome;document.getElementById("descricaoSelecionada").textContent=c.desc;select.innerHTML="";c.vars.forEach(([v,t])=>{const o=document.createElement("option");o.value=v;o.textContent=t;select.appendChild(o);});select.disabled=false;if(anterior)select.value=anterior;confirm.disabled=false;}
cards.forEach(c=>c.onclick=()=>selecionar(c));
async function carregar(){const snap=await get(salaRef);if(!snap.exists()){msg.textContent="Sala não encontrada.";return;}const sala=snap.val();if(sala.status==="jogando"){location.href=`jogo.html?codigo=${codigo}`;return;}const eu=sala.jogadores?.[jogadorId];if(!(eu?.dono===true||sala.dono===jogadorId)){msg.textContent="Somente o dono da sala pode escolher o jogo.";confirm.disabled=true;cards.forEach(c=>c.disabled=true);return;}if(sala.jogo&&configs[sala.jogo])selecionar(cards.find(c=>c.dataset.jogo===sala.jogo),sala.variacao);}
confirm.onclick=async()=>{if(!jogo)return;confirm.disabled=true;const snap=await get(salaRef);const sala=snap.val();const qtd=Object.keys(sala?.jogadores||{}).length;const [min,max]=limites[jogo];if(qtd<min||qtd>max){msg.textContent=`${configs[jogo].nome} precisa de ${min===max?min:`${min}–${max}`} jogadores.`;confirm.disabled=false;return;}await update(salaRef,{jogo,variacao:select.value,status:"aguardando",estado:null});location.href=`sala.html?codigo=${codigo}`;};
document.getElementById("btnVoltar").onclick=()=>location.href=`sala.html?codigo=${codigo}`;carregar();