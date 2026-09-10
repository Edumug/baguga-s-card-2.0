import * as Truco from "./jogos/truco.js";
import * as Blackjack from "./jogos/blackjack.js";
import * as Pife from "./jogos/pife.js";
const jogos={truco:Truco,blackjack:Blackjack,pife:Pife};
export function criarEstadoPorJogo(tipo,ids,variacao,equipes={}){const jogo=jogos[tipo];if(!jogo)throw new Error(`Jogo indisponível: ${tipo}`);return jogo.criarEstado(ids,variacao,equipes);}
export function normalizarEstado(e){e.ids??=[];e.maos??={};e.deck??=[];e.descarte??=[];e.atual??=null;e.fim??=false;e.resultado??="";e.placar??={};return e;}
