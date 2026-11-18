/**
 * "Disegna e indovina": parole facili da disegnare in 60 secondi (oggetti, animali, cibo, cose di coppia). Tutte
 * minuscole, senza articolo. Gli indici contano per i "mai ripetute": non riordinare, solo aggiungere in fondo.
 */
export const WORD_DECK: readonly string[] = (
  "casa,sole,luna,stella,fiore,albero,nuvola,pioggia,arcobaleno,cuore,fragola,mela,pera,banana,ciliegia,anguria,limone,carota,pizza,gelato," +
  "torta,biscotto,pane,formaggio,uovo,caffè,tè,bicchiere,bottiglia,forchetta,cucchiaio,coltello,piatto,tazza,teiera,pentola,frigorifero,letto,divano,sedia," +
  "tavolo,lampada,finestra,porta,chiave,orologio,sveglia,telefono,computer,libro,matita,penna,forbici,ombrello,cappello,scarpa,calzino,maglione,occhiali,borsa," +
  "anello,corona,regalo,palloncino,candela,candelina,biglietto,lettera,busta,francobollo,mappa,valigia,zaino,tenda,falò,barca,nave,aereo,treno,bicicletta," +
  "macchina,autobus,razzo,gatto,cane,coniglio,pesce,uccello,farfalla,ape,coccinella,lumaca,rana,tartaruga,elefante,giraffa,leone,orso,pinguino,maiale," +
  "mucca,cavallo,pecora,gallina,topo,serpente,ragno,delfino,balena,stella marina,granchio,medusa,montagna,mare,spiaggia,isola,ponte,castello,faro,fontana," +
  "bacio,abbraccio,mano nella mano,lettera d'amore,cena a lume di candela,tramonto,fuochi d'artificio,cinema,popcorn,chitarra,pianoforte,tamburo,cuffie,microfono,macchina fotografica,telecamera,pallone,racchetta,bandiera,trofeo," +
  "ciabatte,pigiama,coperta,cuscino,ombrellone,gelato al cono,occhiali da sole,costume,palla da spiaggia,paperella,bolle di sapone,aquilone,altalena,scivolo,robot,fantasma,drago,sirena,unicorno,mago"
).split(",");
