import { database } from "./firebase-config.js";
import { ref, onValue, get, update, remove, onDisconnect } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-database.js";

const p = new URLSearchParams(location.search); const codigo = p.get("codigo"); const jogadorId = sessionStorage.getItem("jogadorId");
if (!codigo || !jogadorId) { location.href = "index.html"; throw new Error("Sala inválida"); }
const $ = id => document.getElementById(id); const salaRef = ref(database, `salas/${codigo}`); const meuRef = ref(database, `salas/${codigo}/jogadores/${jogadorId}`);
onDisconnect(meuRef).remove(); $("codigoExibido").textContent = codigo;
const nomes = {truco:"Truco", blackjack:"Blackjack", pife:"Pife"};
const limites = {truco:[2,4], blackjack:[1,7], pife:[2,4]};
const btnEscolher = $("btnEscolherJogo"), btnIniciar = $("btnIniciar"), btnBot = $("btnAdicionarBot");
let dono = false, ultimaSala = null;
function limiteTexto(j){ const [a,b]=limites[j]||[2,4]; return a===b?`${a} jogador${a===1?"":"es"}`:`${a}–${b} jogadores`; }
function mensagem(t, erro=false){ const e=$("mensagemSala"); e.textContent=t||""; e.classList.toggle("erro",!!erro); }
function configuravel(j){ return j === "truco"; }
function timesValidos(jogadores,j){ if(j!=="truco") return true; const a=Object.values(jogadores).filter(x=>x.equipe==="azul").length; const b=Object.values(jogadores).filter(x=>x.equipe==="vermelho").length; return Object.keys(jogadores).length===2 || (a===b && a+b===Object.keys(jogadores).length); }
function renderPlayers(jogadores){
  const box=$("listaJogadores"); box.innerHTML="";
  const lista=Object.entries(jogadores).sort(([,a],[,b])=>(a.ordem||0)-(b.ordem||0));
  lista.forEach(([id,j])=>{
    const row=document.createElement("div"); row.className="player-row";
    const who=document.createElement("div"); who.className="player-who";
    const avatar=document.createElement("span"); avatar.className="player-avatar"; avatar.textContent=j.dono?"♛":j.tipo==="bot"?"◆":"●";
    const info=document.createElement("div"); info.innerHTML=`<strong>${j.nome||"Jogador"}</strong><small>${j.tipo==="bot"?"BOT":j.dono?"Dono da sala":"Jogador"}</small>`;
    who.append(avatar,info); row.appendChild(who);
    if(ultimaSala?.jogo==="truco" && dono){
      const team=document.createElement("div"); team.className="team-picker";
      ["azul","vermelho"].forEach(eq=>{ const b=document.createElement("button"); b.type="button"; b.className=j.equipe===eq?"selected":""; b.textContent=eq==="azul"?"Azul":"Vermelha"; b.onclick=()=>update(ref(database,`salas/${codigo}/jogadores/${id}`),{equipe:eq}); team.appendChild(b); }); row.appendChild(team);
    } else if(j.equipe){ const tag=document.createElement("span"); tag.className=`team-tag ${j.equipe}`; tag.textContent=j.equipe==="azul"?"AZUL":"VERMELHA"; row.appendChild(tag); }
    if(dono && j.tipo==="bot"){ const rm=document.createElement("button"); rm.className="remove-player"; rm.textContent="×"; rm.title="Remover BOT"; rm.onclick=()=>remove(ref(database,`salas/${codigo}/jogadores/${id}`)); row.appendChild(rm); }
    box.appendChild(row);
  });
  const count=document.createElement("div"); count.className="players-count"; count.textContent=`${lista.length}/8 jogadores`; box.appendChild(count);
}
function atualizar(sala){
  ultimaSala=sala; const jogadores=sala.jogadores||{}; const qtd=Object.keys(jogadores).length; dono=jogadores[jogadorId]?.dono===true || sala.dono===jogadorId;
  renderPlayers(jogadores); btnBot.disabled=!dono || qtd>=8 || sala.status==="jogando"; btnEscolher.disabled=!dono || sala.status==="jogando"; btnIniciar.disabled=!dono || sala.status==="jogando" || !sala.jogo;
  $("statusTexto").innerHTML=`<i></i> ${sala.status==="jogando"?"partida iniciada":sala.jogo?"jogo escolhido":"aguardando jogadores"}`;
  $("jogoEscolhido").textContent=sala.jogo?nomes[sala.jogo]:"Nenhum jogo";
  $("variacaoEscolhida").textContent=sala.jogo?`Variação: ${sala.variacao||"Padrão"}. ${limiteTexto(sala.jogo)}.` : "Escolha um jogo e uma variação para continuar.";
  if(sala.jogo && (qtd<limites[sala.jogo][0] || qtd>limites[sala.jogo][1])){ btnIniciar.disabled=true; mensagem(`${nomes[sala.jogo]} precisa de ${limiteTexto(sala.jogo)}. Há ${qtd} na sala.`,true); }
  else if(sala.jogo && !timesValidos(jogadores,sala.jogo)){ btnIniciar.disabled=true; mensagem("No Truco, as equipes precisam estar equilibradas.",true); }
  else if(!sala.jogo) mensagem(dono?"Escolha o jogo para configurar a mesa.":"Aguardando o dono escolher o jogo.");
  else mensagem(dono?"Tudo certo. Inicie a partida quando quiser.":"Aguardando o dono iniciar a partida.");
  if(sala.status==="jogando") location.href=`jogo.html?codigo=${codigo}`;
}
onValue(salaRef, async snap=>{ if(!snap.exists()){ mensagem("A sala foi encerrada.",true); return; } let sala=snap.val(); if(!sala.jogadores?.[jogadorId] && sala.dono===jogadorId){ await update(meuRef,{nome:sessionStorage.getItem("nomeJogador")||"Você",tipo:"humano",dono:true,ordem:0}); return; } if(!sala.jogadores?.[jogadorId]){ location.href="index.html"; return; } atualizar(sala); });
btnBot.onclick=async()=>{ const s=(await get(salaRef)).val(); if(!s||!dono||s.status==="jogando")return; const n=Object.values(s.jogadores||{}).filter(x=>x.tipo==="bot").length+1; const id=`bot_${Date.now()}_${Math.random().toString(36).slice(2,7)}`; const qtd=Object.keys(s.jogadores||{}).length; await update(ref(database,`salas/${codigo}/jogadores/${id}`),{nome:`Bot ${n}`,tipo:"bot",dono:false,ordem:qtd}); };
btnEscolher.onclick=()=>{ if(dono) location.href=`seletor.html?codigo=${codigo}`; };
btnIniciar.onclick=async()=>{ const s=(await get(salaRef)).val(); const js=s?.jogadores||{}; const qtd=Object.keys(js).length; if(!s||!dono||!s.jogo)return; if(qtd<limites[s.jogo][0]||qtd>limites[s.jogo][1]||!timesValidos(js,s.jogo)){ mensagem("A configuração da mesa ainda não está válida.",true); return; } await update(salaRef,{status:"jogando",estado:null}); };
$("btnCopiarCodigo").onclick=async()=>{ try{await navigator.clipboard.writeText(codigo);mensagem("Código copiado.");}catch{mensagem("Código: "+codigo);} };
$("btnCopiarConvite").onclick=async()=>{const url=location.href;try{await navigator.clipboard.writeText(`Entre na minha sala do Baguga's Card Games: ${url}`);mensagem("Convite copiado.");}catch{mensagem(url);} };
$("btnSair").onclick=async()=>{ await remove(meuRef); location.href="index.html"; };
