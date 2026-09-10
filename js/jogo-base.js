export const VALORES=["A","2","3","4","5","6","7","8","9","10","J","Q","K"], NAIPES=["♠","♥","♦","♣"];
export const criarBaralho=()=>NAIPES.flatMap(n=>VALORES.map(v=>({id:v+n,valor:v,naipe:n})));
export const embaralhar=(arr)=>{const a=[...arr];for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;};
export const proximoJogador=(ids,id)=>{const i=ids.indexOf(id);return i<0?ids[0]:ids[(i+1)%ids.length];};
export const sortearJogador=ids=>ids[Math.floor(Math.random()*ids.length)]||null;
export const nomeDe=(js,id)=>js?.[id]?.nome||"Jogador";
export const rank=c=>VALORES.indexOf(c?.valor);

const CARD_CDN="https://cdn.jsdelivr.net/gh/AustinGabriel/The-Public-Domain-Deck-Public-Domain-and-CC0-Playing-Cards@main/svg%20cards/card%20fronts";
const suitFolders={"♠":"spades","♥":"hearts","♦":"diamonds","♣":"clubs"};
const faceNames={A:"ace",J:"jack",Q:"queen",K:"king"};
function nomeArquivoCarta(c){
    const valor=faceNames[c?.valor]||c?.valor;
    const naipe=suitFolders[c?.naipe];
    if(!valor||!naipe)return null;
    return `${encodeURIComponent(valor+" of "+naipe)}.svg`;
}
export function urlCarta(c){
    if(c?.valor==="🂠")return "https://cdn.jsdelivr.net/gh/AustinGabriel/The-Public-Domain-Deck-Public-Domain-and-CC0-Playing-Cards@main/svg%20cards/card%20backs/card%20back%20blue.svg";
    const arquivo=nomeArquivoCarta(c);
    if(!arquivo)return null;
    return `${CARD_CDN}/${suitFolders[c.naipe]}/${arquivo}`;
}

export function elementoCarta(c,click){
    const el=document.createElement(click?"button":"div");
    el.className="card play-card";
    el.dataset.cartaId=c?.id||`${c?.valor||"?"}${c?.naipe||""}`;
    el.dataset.valor=c?.valor||"";
    el.dataset.naipe=c?.naipe||"";
    if(click){el.type="button";el.classList.add("clickable");el.onclick=click;}

    const url=urlCarta(c);
    if(url){
        const img=document.createElement("img");
        img.className="card-art";
        img.src=url;
        img.alt=c?.valor==="🂠"?"Carta virada para baixo":`${c?.valor||"Carta"} de ${c?.naipe||""}`;
        img.draggable=false;
        img.loading="lazy";
        img.addEventListener("error",()=>{
            img.remove();
            el.classList.add("card-fallback");
            el.textContent=`${c?.valor||"?"}${c?.naipe||""}`;
        },{once:true});
        el.appendChild(img);
    }else{
        el.classList.add("card-fallback");
        el.textContent=`${c?.valor||"?"}${c?.naipe||""}`;
    }
    return el;
}

export const mostrarToast=(texto,tipo="info")=>{let box=document.getElementById("toastContainer");if(!box){box=document.createElement("div");box.id="toastContainer";box.className="toast-container";document.body.appendChild(box);}const t=document.createElement("div");t.className=`toast ${tipo}`;t.textContent=texto;box.appendChild(t);setTimeout(()=>t.remove(),2600);};
export function executarTransacao(salaRef,fn){return import("https://www.gstatic.com/firebasejs/12.18.0/firebase-database.js").then(({runTransaction})=>runTransaction(salaRef,s=>{if(!s?.estado||s.estado.fim)return s;fn(s.estado,s.jogadores||{});return s;}));}
export function normalizarEstado(e){e.ids??=[];e.maos??={};e.deck??=[];e.descarte??=[];e.atual??=null;e.fim??=false;e.resultado??="";e.placar??={};return e;}
