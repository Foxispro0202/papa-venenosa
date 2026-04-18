(function () {
  "use strict";

  var TAM = 3;
  var VIDAS = 3;
  var VENENOS = 3;

  // Variables de modo de juego
  var modoJuego = null; // 'local' o 'online'
  var socket = null;
  var roomName = null;
  var playerNumber = null; // 1 o 2
  var opponentReady = false;

  var nombreJ1 = "Jugador 1";
  var nombreJ2 = "Jugador 2";

  function escaparHtml(s) {
    if (s == null || s === "") {
      return "";
    }
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  var audioCtx = null;

  function getAudioContext() {
    if (!audioCtx) {
      window.AudioContext = window.AudioContext || window.webkitAudioContext;
      audioCtx = new AudioContext();
      if (typeof audioCtx.resume === "function") {
        audioCtx.resume();
      }
    }
    return audioCtx;
  }

  function playChokeSound() {
    var ctx = getAudioContext();
    var now = ctx.currentTime;

    var osc = ctx.createOscillator();
    var gain = ctx.createGain();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(220, now);
    osc.frequency.exponentialRampToValueAtTime(90, now + 0.18);
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.exponentialRampToValueAtTime(0.16, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.4);
    osc.connect(gain).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.4);

    var noise = ctx.createBufferSource();
    var buffer = ctx.createBuffer(1, ctx.sampleRate * 0.12, ctx.sampleRate);
    var data = buffer.getChannelData(0);
    for (var i = 0; i < data.length; i++) {
      data[i] = (Math.random() * 2 - 1) * 0.35;
    }
    noise.buffer = buffer;
    var noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.001, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.08, now + 0.01);
    noiseGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);
    noise.connect(noiseGain).connect(ctx.destination);
    noise.start(now);
    noise.stop(now + 0.12);
  }

  function playDeathSound() {
    var ctx = getAudioContext();
    var now = ctx.currentTime;

    var osc = ctx.createOscillator();
    var gain = ctx.createGain();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(150, now);
    osc.frequency.exponentialRampToValueAtTime(38, now + 0.8);
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.22, now + 0.04);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.1);
    osc.connect(gain).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 1.1);

    var sub = ctx.createOscillator();
    var subGain = ctx.createGain();
    sub.type = "square";
    sub.frequency.setValueAtTime(72, now);
    subGain.gain.setValueAtTime(0.001, now);
    subGain.gain.linearRampToValueAtTime(0.06, now + 0.05);
    subGain.gain.exponentialRampToValueAtTime(0.0001, now + 1.1);
    sub.connect(subGain).connect(ctx.destination);
    sub.start(now);
    sub.stop(now + 1.1);
  }

  function normalizarNombre(raw, defecto) {
    var t = String(raw || "").trim();
    if (!t) {
      return defecto;
    }
    if (t.length > 24) {
      return t.slice(0, 24);
    }
    return t;
  }

  function tableroLleno() {
    var t = [];
    for (var i = 0; i < TAM; i++) {
      t[i] = [];
      for (var j = 0; j < TAM; j++) {
        t[i][j] = true;
      }
    }
    return t;
  }

  function matrizVeneno() {
    var v = [];
    for (var i = 0; i < TAM; i++) {
      v[i] = [];
      for (var j = 0; j < TAM; j++) {
        v[i][j] = false;
      }
    }
    return v;
  }

  function cuentaPuntos(puntos) {
    var n = 0;
    for (var i = 0; i < TAM; i++) {
      for (var j = 0; j < TAM; j++) {
        if (puntos[i][j]) n++;
      }
    }
    return n;
  }

  var puntosJ1 = tableroLleno();
  var venenoJ1 = matrizVeneno();
  var puntosJ2 = tableroLleno();
  var venenoJ2 = matrizVeneno();

  var vidasJ1 = VIDAS;
  var vidasJ2 = VIDAS;
  var turnoJ1 = true;

  /** "setup_j1" | "setup_j2" | "play" */
  var fase = "setup_j1";
  var venenosColocados = 0;

  // Elementos DOM
  var elBloqueModo = document.getElementById("bloqueModo");
  var elBloqueNombres = document.getElementById("bloqueNombres");
  var elBloqueOnline = document.getElementById("bloqueOnline");
  var elBloqueEsperando = document.getElementById("bloqueEsperando");
  var elBloqueJuego = document.getElementById("bloqueJuego");
  var elFase = document.getElementById("fase");
  var elVidas = document.getElementById("vidas");
  var elContainer = document.getElementById("tableroContainer");
  var elMensaje = document.getElementById("mensaje");
  var elFin = document.getElementById("fin");
  var elBtn = document.getElementById("btnContinuar");
  var elBtnReiniciar = document.getElementById("btnReiniciar");
  var elBtnSiguienteTurno = document.getElementById("btnSiguienteTurno");
  var elEsperandoTitulo = document.getElementById("esperandoTitulo");
  var elEsperandoMensaje = document.getElementById("esperandoMensaje");
  var elCodigoSala = document.getElementById("codigoSala");

  // Funciones de Socket.IO
  function initSocket() {
    socket = io();

    socket.on('roomCreated', function(data) {
      roomName = data.roomName;
      playerNumber = data.playerNumber;
      elCodigoSala.textContent = roomName;
      mostrarEsperando("Sala creada", "Esperando a que se una tu oponente...");
    });

    socket.on('gameStart', function(data) {
      var players = data.players;
      roomName = data.roomName;

      // Encontrar mi número de jugador
      var myPlayer = players.find(p => p.id === socket.id);
      if (myPlayer) {
        playerNumber = myPlayer.number;
        if (playerNumber === 1) {
          nombreJ1 = myPlayer.name;
          nombreJ2 = players.find(p => p.number === 2).name;
        } else {
          nombreJ2 = myPlayer.name;
          nombreJ1 = players.find(p => p.number === 1).name;
        }
      }

      ocultarEsperando();
      iniciarJuegoOnline();
    });

    socket.on('roomError', function(error) {
      alert("Error: " + error);
    });

    socket.on('gameStateUpdate', function(gameState) {
      // Actualizar estado del juego desde el oponente
      puntosJ1 = gameState.puntosJ1;
      venenoJ1 = gameState.venenoJ1;
      puntosJ2 = gameState.puntosJ2;
      venenoJ2 = gameState.venenoJ2;
      vidasJ1 = gameState.vidasJ1;
      vidasJ2 = gameState.vidasJ2;
      turnoJ1 = gameState.turnoJ1;
      fase = gameState.fase;
      venenosColocados = gameState.venenosColocados;

      actualizarVidas();
      turnoPlayOnline();
    });

    socket.on('opponentReady', function(opponentPlayerNumber) {
      opponentReady = true;
      if (playerNumber !== opponentPlayerNumber) {
        mensaje("Tu oponente está listo. ¡Comienza el juego!");
      }
    });

    socket.on('playerDisconnected', function(data) {
      alert("Tu oponente se ha desconectado. La partida ha terminado.");
      reiniciarAlMenu();
    });

    socket.on('roomTimeout', function() {
      alert("La sala ha expirado por inactividad.");
      reiniciarAlMenu();
    });
  }

  function sendGameState() {
    if (socket && roomName) {
      socket.emit('updateGameState', {
        roomName: roomName,
        gameState: {
          puntosJ1: puntosJ1,
          venenoJ1: venenoJ1,
          puntosJ2: puntosJ2,
          venenoJ2: venenoJ2,
          vidasJ1: vidasJ1,
          vidasJ2: vidasJ2,
          turnoJ1: turnoJ1,
          fase: fase,
          venenosColocados: venenosColocados
        }
      });
    }
  }

  function mostrarEsperando(titulo, mensaje) {
    elEsperandoTitulo.textContent = titulo;
    elEsperandoMensaje.innerHTML = mensaje;
    elBloqueEsperando.classList.remove("oculto");
    elBloqueOnline.classList.add("oculto");
  }

  function ocultarEsperando() {
    elBloqueEsperando.classList.add("oculto");
  }

  function reiniciarAlMenu() {
    // Reiniciar todas las variables
    modoJuego = null;
    socket = null;
    roomName = null;
    playerNumber = null;
    opponentReady = false;

    puntosJ1 = tableroLleno();
    venenoJ1 = matrizVeneno();
    puntosJ2 = tableroLleno();
    venenoJ2 = matrizVeneno();
    vidasJ1 = VIDAS;
    vidasJ2 = VIDAS;
    turnoJ1 = true;
    fase = "setup_j1";
    venenosColocados = 0;

    // Ocultar todos los bloques
    elBloqueModo.classList.remove("oculto");
    elBloqueNombres.classList.add("oculto");
    elBloqueOnline.classList.add("oculto");
    elBloqueEsperando.classList.add("oculto");
    elBloqueJuego.classList.add("oculto");

    elFin.textContent = "";
    mensaje("");
  }

  function reiniciarPartida() {
    ocultarBotonSiguienteTurno();
    puntosJ1 = tableroLleno();
    venenoJ1 = matrizVeneno();
    puntosJ2 = tableroLleno();
    venenoJ2 = matrizVeneno();
    vidasJ1 = VIDAS;
    vidasJ2 = VIDAS;
    turnoJ1 = true;
    fase = "setup_j1";
    venenosColocados = 0;
    elFin.textContent = "";
    mensaje("");
    elBtn.classList.add("oculto");
    actualizarVidas();

    if (modoJuego === 'online') {
      iniciarSetupJ1Online();
    } else {
      iniciarSetupJ1();
    }
  }

  function ocultarBotonSiguienteTurno() {
    elBtnSiguienteTurno.classList.add("oculto");
  }

  function mostrarBotonPasarTurno(nombreSiguiente) {
    elBtnSiguienteTurno.textContent =
      "Listo — ahora le toca a " + nombreSiguiente + " 👉";
    elBtnSiguienteTurno.classList.remove("oculto");
  }

  function congelarTableroYOfrecerPasar(
    puntos,
    veneno,
    tituloTablero,
    nombreSiguiente
  ) {
    renderGrid({
      puntos: puntos,
      veneno: veneno,
      modo: "play",
      titulo: tituloTablero,
      onCell: null,
    });
    mostrarBotonPasarTurno(nombreSiguiente);
  }

  function mensaje(texto) {
    elMensaje.textContent = texto || "";
  }

  function corazones(n) {
    if (n <= 0) {
      return "💔";
    }
    var s = "";
    var i;
    for (i = 0; i < n; i++) {
      s += "❤️";
    }
    return s;
  }

  function actualizarVidas() {
    elVidas.innerHTML =
      '<span class="vida-pill vida-pill--j1"><span class="nombre-jug">' +
      escaparHtml(nombreJ1) +
      '</span> <span class="corazones">' +
      corazones(vidasJ1) +
      "</span></span>" +
      '<span class="vida-pill vida-pill--j2"><span class="nombre-jug">' +
      escaparHtml(nombreJ2) +
      '</span> <span class="corazones">' +
      corazones(vidasJ2) +
      "</span></span>";
  }

  function renderGrid(o) {
    var puntos = o.puntos;
    var veneno = o.veneno;
    var modo = o.modo;
    var titulo = o.titulo || "";
    var onCell = o.onCell;

    var wrap = document.createElement("div");
    wrap.className = "tabla-wrap modo-" + modo;
    if (modo === "play" && typeof onCell !== "function") {
      wrap.classList.add("tablero-congelado");
    }
    if (titulo) {
      var h2 = document.createElement("h2");
      h2.textContent = titulo;
      wrap.appendChild(h2);
    }
    var table = document.createElement("table");
    table.className = "tablero modo-" + modo;
    var thead = document.createElement("thead");
    var trh = document.createElement("tr");
    trh.appendChild(document.createElement("th"));
    for (var c = 0; c < TAM; c++) {
      var th = document.createElement("th");
      th.textContent = String(c + 1);
      trh.appendChild(th);
    }
    thead.appendChild(trh);
    table.appendChild(thead);
    var tbody = document.createElement("tbody");
    for (var i = 0; i < TAM; i++) {
      var tr = document.createElement("tr");
      var thRow = document.createElement("th");
      thRow.textContent = String(i + 1);
      tr.appendChild(thRow);
      for (var j = 0; j < TAM; j++) {
        var td = document.createElement("td");
        td.dataset.row = String(i);
        td.dataset.col = String(j);
        var disabled = false;
        if (modo === "setup") {
          td.textContent = veneno[i][j] ? "☠" : "🍟";
          if (veneno[i][j]) {
            td.classList.add("disabled");
            td.classList.add("is-poison");
          }
        } else if (modo === "play") {
          if (puntos[i][j]) {
            td.textContent = "🍟";
          } else if (veneno[i][j]) {
            td.textContent = "🥔";
            td.classList.add("is-veneno-borrado");
          } else {
            td.textContent = "";
            td.classList.add("is-empty-cell");
          }
          if (!puntos[i][j]) {
            td.classList.add("disabled");
            disabled = true;
          }
        } else {
          if (puntos[i][j]) {
            td.textContent = veneno[i][j] ? "V" : "🍟";
            if (veneno[i][j]) td.classList.add("is-poison-final");
          } else {
            td.textContent = veneno[i][j] ? "🥔" : "";
            if (veneno[i][j]) {
              td.classList.add("is-veneno-borrado");
            } else {
              td.classList.add("is-empty-cell");
            }
          }
          td.classList.add("disabled");
          disabled = true;
        }
        if (!disabled && typeof onCell === "function") {
          td.addEventListener("click", function (ev) {
            var r = parseInt(ev.currentTarget.dataset.row, 10);
            var co = parseInt(ev.currentTarget.dataset.col, 10);
            onCell(r, co);
          });
        }
        tr.appendChild(td);
      }
      tbody.appendChild(tr);
    }
    table.appendChild(tbody);
    wrap.appendChild(table);
    elContainer.innerHTML = "";
    elContainer.appendChild(wrap);
  }

  function separadorPantalla() {
    mensaje("");
  }

  // Funciones para modo local
  function iniciarSetupJ1() {
    venenosColocados = 0;
    ocultarBotonSiguienteTurno();
    elBtn.classList.add("oculto");
    elFase.innerHTML =
      "<strong>&gt;&gt;&gt; " +
      escaparHtml(nombreJ2) +
      ": aparta la mirada.</strong><br />" +
      escaparHtml(nombreJ1) +
      ": elige " +
      VENENOS +
      " puntos distintos del tablero de <strong>" +
      escaparHtml(nombreJ2) +
      "</strong> (veneno).";
    mensaje("Coloca veneno: 1/" + VENENOS);
    function onPoisonJ2(f, c) {
      if (venenoJ2[f][c]) {
        mensaje("Esa casilla ya tiene veneno. Elige otra.");
        return;
      }
      venenoJ2[f][c] = true;
      venenosColocados++;
      if (venenosColocados < VENENOS) {
        mensaje("Coloca veneno: " + (venenosColocados + 1) + "/" + VENENOS);
        renderGrid({
          puntos: puntosJ2,
          veneno: venenoJ2,
          modo: "setup",
          titulo: "Tablero de " + nombreJ2 + " (coloca veneno)",
          onCell: onPoisonJ2,
        });
      } else {
        mensaje("¡Listo! Pulsa el botón verde para que juegue el otro.");
        elBtn.classList.remove("oculto");
        renderGrid({
          puntos: puntosJ2,
          veneno: venenoJ2,
          modo: "setup",
          titulo: "Tablero de " + nombreJ2 + " (veneno colocado)",
        });
      }
    }
    renderGrid({
      puntos: puntosJ2,
      veneno: venenoJ2,
      modo: "setup",
      titulo: "Tablero de " + nombreJ2 + " (coloca veneno)",
      onCell: onPoisonJ2,
    });
  }

  function iniciarSetupJ2() {
    venenosColocados = 0;
    ocultarBotonSiguienteTurno();
    elBtn.classList.add("oculto");
    elFase.innerHTML =
      "<strong>&gt;&gt;&gt; " +
      escaparHtml(nombreJ1) +
      ": aparta la mirada.</strong><br />" +
      escaparHtml(nombreJ2) +
      ": elige " +
      VENENOS +
      " puntos distintos del tablero de <strong>" +
      escaparHtml(nombreJ1) +
      "</strong> (veneno).";
    mensaje("Coloca veneno: 1/" + VENENOS);
    function onPoisonJ1(f, c) {
      if (venenoJ1[f][c]) {
        mensaje("Esa casilla ya tiene veneno. Elige otra.");
        return;
      }
      venenoJ1[f][c] = true;
      venenosColocados++;
      if (venenosColocados < VENENOS) {
        mensaje("Coloca veneno: " + (venenosColocados + 1) + "/" + VENENOS);
        renderGrid({
          puntos: puntosJ1,
          veneno: venenoJ1,
          modo: "setup",
          titulo: "Tablero de " + nombreJ1 + " (coloca veneno)",
          onCell: onPoisonJ1,
        });
      } else {
        mensaje("¡Listo! Pulsa el botón verde para empezar a jugar.");
        elBtn.classList.remove("oculto");
        renderGrid({
          puntos: puntosJ1,
          veneno: venenoJ1,
          modo: "setup",
          titulo: "Tablero de " + nombreJ1 + " (veneno colocado)",
        });
      }
    }
    renderGrid({
      puntos: puntosJ1,
      veneno: venenoJ1,
      modo: "setup",
      titulo: "Tablero de " + nombreJ1 + " (coloca veneno)",
      onCell: onPoisonJ1,
    });
  }

  // Funciones para modo online
  function iniciarSetupJ1Online() {
    venenosColocados = 0;
    ocultarBotonSiguienteTurno();
    elBtn.classList.add("oculto");

    var tableroObjetivo, venenoObjetivo, nombreObjetivo;
    if (playerNumber === 1) {
      tableroObjetivo = puntosJ2;
      venenoObjetivo = venenoJ2;
      nombreObjetivo = nombreJ2;
    } else {
      tableroObjetivo = puntosJ1;
      venenoObjetivo = venenoJ1;
      nombreObjetivo = nombreJ1;
    }

    elFase.innerHTML =
      "<strong>&gt;&gt;&gt; Fase de preparación</strong><br />" +
      "Coloca " +
      VENENOS +
      " venenos en el tablero de <strong>" +
      escaparHtml(nombreObjetivo) +
      "</strong>.";
    mensaje("Coloca veneno: 1/" + VENENOS);

    function onPoison(f, c) {
      if (venenoObjetivo[f][c]) {
        mensaje("Esa casilla ya tiene veneno. Elige otra.");
        return;
      }
      venenoObjetivo[f][c] = true;
      venenosColocados++;
      if (venenosColocados < VENENOS) {
        mensaje("Coloca veneno: " + (venenosColocados + 1) + "/" + VENENOS);
        renderGrid({
          puntos: tableroObjetivo,
          veneno: venenoObjetivo,
          modo: "setup",
          titulo: "Tablero de " + nombreObjetivo + " (coloca veneno)",
          onCell: onPoison,
        });
      } else {
        mensaje("¡Veneno colocado! Esperando a tu oponente...");
        elBtn.classList.remove("oculto");
        elBtn.textContent = "¡Listo! Esperar oponente";
        renderGrid({
          puntos: tableroObjetivo,
          veneno: venenoObjetivo,
          modo: "setup",
          titulo: "Tablero de " + nombreObjetivo + " (veneno colocado)",
        });
        socket.emit('playerReady', { roomName: roomName, playerNumber: playerNumber });
      }
    }
    renderGrid({
      puntos: tableroObjetivo,
      veneno: venenoObjetivo,
      modo: "setup",
      titulo: "Tablero de " + nombreObjetivo + " (coloca veneno)",
      onCell: onPoison,
    });
  }

  function iniciarJuego() {
    elBtn.classList.add("oculto");
    ocultarBotonSiguienteTurno();
    mensaje("");
    turnoJ1 = true;
    elFase.innerHTML =
      "<strong>--- Fase de juego ---</strong><br />" +
      "Por turnos, cada uno borra UN punto de SU PROPIO tablero.<br />" +
      "Si tocas veneno pierdes 1 vida. <strong>Cuando acabes tu jugada</strong>, lee el aviso amarillo y pulsa el <strong>botón azul</strong> para pasar el turno.";
    turnoPlay();
  }

  function iniciarJuegoOnline() {
    elBloqueJuego.classList.remove("oculto");
    elBloqueOnline.classList.add("oculto");
    elBtn.classList.add("oculto");
    ocultarBotonSiguienteTurno();
    mensaje("");
    turnoJ1 = (playerNumber === 1);
    elFase.innerHTML =
      "<strong>--- Fase de juego ---</strong><br />" +
      "Por turnos, cada uno borra UN punto de SU PROPIO tablero.<br />" +
      "Si tocas veneno pierdes 1 vida.";
    turnoPlayOnline();
  }

  function turnoPlay() {
    ocultarBotonSiguienteTurno();
    actualizarVidas();
    if (vidasJ1 <= 0 || vidasJ2 <= 0) {
      finPartida();
      return;
    }
    if (cuentaPuntos(puntosJ1) === 0 && cuentaPuntos(puntosJ2) === 0) {
      mensaje("No quedan puntos. Empate.");
      finPartida();
      return;
    }

    if (turnoJ1) {
      if (cuentaPuntos(puntosJ1) === 0) {
        mensaje(nombreJ1 + " no tiene puntos. Pasa turno.");
        turnoJ1 = false;
        turnoPlay();
        return;
      }
      elFase.innerHTML =
        "<strong>--- Turno de " +
        escaparHtml(nombreJ1) +
        " ---</strong> (vidas: " +
        vidasJ1 +
        ")";
      mensaje("Toca una 🍟 en tu tablero para borrarlo.");
      renderGrid({
        puntos: puntosJ1,
        veneno: venenoJ1,
        modo: "play",
        titulo: "Tu tablero — borra un punto",
        onCell: function (f, c) {
          if (!puntosJ1[f][c]) {
            mensaje("Ahí ya no hay punto. Elige otra casilla con 🍟.");
            return;
          }
          puntosJ1[f][c] = false;
          if (venenoJ1[f][c]) {
            vidasJ1--;
            playChokeSound();
            mensaje(
              "☠️ ¡Te envenenaste! Pierdes 1 vida. Te quedan " + vidasJ1 + "."
            );
          } else {
            mensaje("✅ ¡No había veneno! Punto seguro.");
          }
          turnoJ1 = false;
          actualizarVidas();
          if (vidasJ1 <= 0 || vidasJ2 <= 0) {
            finPartida();
            return;
          }
          congelarTableroYOfrecerPasar(
            puntosJ1,
            venenoJ1,
            "Tu jugada — mira el mensaje de arriba",
            nombreJ2
          );
        },
      });
    } else {
      if (cuentaPuntos(puntosJ2) === 0) {
        mensaje(nombreJ2 + " no tiene puntos. Pasa turno.");
        turnoJ1 = true;
        turnoPlay();
        return;
      }
      elFase.innerHTML =
        "<strong>--- Turno de " +
        escaparHtml(nombreJ2) +
        " ---</strong> (vidas: " +
        vidasJ2 +
        ")";
      mensaje("Toca una 🍟 en tu tablero para borrarlo.");
      renderGrid({
        puntos: puntosJ2,
        veneno: venenoJ2,
        modo: "play",
        titulo: "Tu tablero — borra un punto",
        onCell: function (f, c) {
          if (!puntosJ2[f][c]) {
            mensaje("Ahí ya no hay punto. Elige otra casilla con 🍟.");
            return;
          }
          puntosJ2[f][c] = false;
          if (venenoJ2[f][c]) {
            vidasJ2--;
            playChokeSound();
            mensaje(
              "☠️ ¡Te envenenaste! Pierdes 1 vida. Te quedan " + vidasJ2 + "."
            );
          } else {
            mensaje("✅ ¡No había veneno! Punto seguro.");
          }
          turnoJ1 = true;
          actualizarVidas();
          if (vidasJ1 <= 0 || vidasJ2 <= 0) {
            finPartida();
            return;
          }
          congelarTableroYOfrecerPasar(
            puntosJ2,
            venenoJ2,
            "Tu jugada — mira el mensaje de arriba",
            nombreJ1
          );
        },
      });
    }
  }

  function turnoPlayOnline() {
    ocultarBotonSiguienteTurno();
    actualizarVidas();

    if (vidasJ1 <= 0 || vidasJ2 <= 0) {
      finPartida();
      return;
    }
    if (cuentaPuntos(puntosJ1) === 0 && cuentaPuntos(puntosJ2) === 0) {
      mensaje("No quedan puntos. Empate.");
      finPartida();
      return;
    }

    var esMiTurno = (turnoJ1 && playerNumber === 1) || (!turnoJ1 && playerNumber === 2);

    if (esMiTurno) {
      var misPuntos, miVeneno, miNombre;
      if (playerNumber === 1) {
        misPuntos = puntosJ1;
        miVeneno = venenoJ1;
        miNombre = nombreJ1;
      } else {
        misPuntos = puntosJ2;
        miVeneno = venenoJ2;
        miNombre = nombreJ2;
      }

      if (cuentaPuntos(misPuntos) === 0) {
        mensaje("No tienes puntos. Esperando turno del oponente...");
        turnoJ1 = !turnoJ1;
        sendGameState();
        return;
      }

      elFase.innerHTML =
        "<strong>--- Tu turno ---</strong> (vidas: " +
        (playerNumber === 1 ? vidasJ1 : vidasJ2) +
        ")";
      mensaje("Toca una 🍟 en tu tablero para borrarlo.");

      renderGrid({
        puntos: misPuntos,
        veneno: miVeneno,
        modo: "play",
        titulo: "Tu tablero — borra un punto",
        onCell: function (f, c) {
          if (!misPuntos[f][c]) {
            mensaje("Ahí ya no hay punto. Elige otra casilla con 🍟.");
            return;
          }
          misPuntos[f][c] = false;

          if (miVeneno[f][c]) {
            if (playerNumber === 1) {
              vidasJ1--;
            } else {
              vidasJ2--;
            }
            playChokeSound();
            mensaje(
              "☠️ ¡Te envenenaste! Pierdes 1 vida. Te quedan " +
              (playerNumber === 1 ? vidasJ1 : vidasJ2) +
              "."
            );
          } else {
            mensaje("✅ ¡No había veneno! Punto seguro.");
          }

          turnoJ1 = !turnoJ1;
          actualizarVidas();

          if (vidasJ1 <= 0 || vidasJ2 <= 0) {
            finPartida();
            return;
          }

          congelarTableroYOfrecerPasar(
            misPuntos,
            miVeneno,
            "Tu jugada — esperando confirmación",
            playerNumber === 1 ? nombreJ2 : nombreJ1
          );

          sendGameState();
        },
      });
    } else {
      elFase.innerHTML = "<strong>--- Turno del oponente ---</strong><br />Espera a que termine su jugada...";
      mensaje("Esperando jugada del oponente...");
      renderGrid({
        puntos: playerNumber === 1 ? puntosJ1 : puntosJ2,
        veneno: playerNumber === 1 ? venenoJ1 : venenoJ2,
        modo: "play",
        titulo: "Tu tablero (esperando...)",
        onCell: null,
      });
    }
  }

  function finPartida() {
    elContainer.innerHTML = "";
    mensaje("");
    if (vidasJ1 <= 0 || vidasJ2 <= 0) {
      playDeathSound();
    }
    if (vidasJ1 <= 0) {
      elFin.textContent =
        nombreJ1 + " se quedó sin vidas. ¡Gana " + nombreJ2 + "!";
    } else if (vidasJ2 <= 0) {
      elFin.textContent =
        nombreJ2 + " se quedó sin vidas. ¡Gana " + nombreJ1 + "!";
    } else {
      elFin.textContent = "Fin de la partida (empate o sin puntos).";
    }

    var w1 = document.createElement("div");
    w1.className = "tabla-wrap modo-final";
    var h1 = document.createElement("h2");
    h1.textContent = "Tablero de " + nombreJ1 + " (final)";
    w1.appendChild(h1);
    var w2 = document.createElement("div");
    w2.className = "tabla-wrap modo-final";
    var h2 = document.createElement("h2");
    h2.textContent = "Tablero de " + nombreJ2 + " (final)";
    w2.appendChild(h2);

    elContainer.appendChild(w1);
    elContainer.appendChild(w2);

    var t1 = buildTableOnly({ puntos: puntosJ1, veneno: venenoJ1, modo: "final" });
    var t2 = buildTableOnly({ puntos: puntosJ2, veneno: venenoJ2, modo: "final" });
    w1.appendChild(t1);
    w2.appendChild(t2);

    elFase.innerHTML =
      "🎊 <strong>¡Partida terminada!</strong> Mira abajo el resultado.";
    elBtn.classList.add("oculto");
    ocultarBotonSiguienteTurno();
  }

  function buildTableOnly(o) {
    var puntos = o.puntos;
    var veneno = o.veneno;
    var modo = o.modo;
    var table = document.createElement("table");
    table.className = "tablero modo-" + modo;
    var thead = document.createElement("thead");
    var trh = document.createElement("tr");
    trh.appendChild(document.createElement("th"));
    for (var c = 0; c < TAM; c++) {
      var th = document.createElement("th");
      th.textContent = String(c + 1);
      trh.appendChild(th);
    }
    thead.appendChild(trh);
    table.appendChild(thead);
    var tbody = document.createElement("tbody");
    for (var i = 0; i < TAM; i++) {
      var tr = document.createElement("tr");
      var thRow = document.createElement("th");
      thRow.textContent = String(i + 1);
      tr.appendChild(thRow);
      for (var j = 0; j < TAM; j++) {
        var td = document.createElement("td");
        td.classList.add("disabled");
        if (modo === "final") {
          if (puntos[i][j]) {
            td.textContent = veneno[i][j] ? "V" : "🍟";
            if (veneno[i][j]) td.classList.add("is-poison-final");
          } else {
            td.textContent = veneno[i][j] ? "x" : "";
            if (veneno[i][j]) {
              td.classList.add("is-veneno-borrado");
            } else {
              td.classList.add("is-empty-cell");
            }
          }
        }
        tr.appendChild(td);
      }
      tbody.appendChild(tr);
    }
    table.appendChild(tbody);
    return table;
  }

  // Event listeners
  document.getElementById("btnModoLocal").addEventListener("click", function () {
    modoJuego = 'local';
    elBloqueModo.classList.add("oculto");
    elBloqueNombres.classList.remove("oculto");
  });

  document.getElementById("btnModoOnline").addEventListener("click", function () {
    modoJuego = 'online';
    initSocket();
    elBloqueModo.classList.add("oculto");
    elBloqueOnline.classList.remove("oculto");
  });

  document.getElementById("btnCrearSala").addEventListener("click", function () {
    var nombre = document.getElementById("inputNombreOnline").value.trim();
    if (!nombre) {
      alert("Por favor ingresa tu nombre");
      return;
    }
    var roomName = nombre.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (!roomName) {
      alert("El nombre debe contener al menos una letra o número");
      return;
    }
    socket.emit('createRoom', { playerName: nombre, roomName: roomName });
  });

  document.getElementById("btnUnirseSala").addEventListener("click", function () {
    var nombre = document.getElementById("inputNombreUnirse").value.trim();
    var sala = document.getElementById("inputSalaUnirse").value.trim();
    if (!nombre || !sala) {
      alert("Por favor ingresa tu nombre y el nombre de la sala");
      return;
    }
    socket.emit('joinRoom', { playerName: nombre, roomName: sala.toLowerCase() });
  });

  document.getElementById("btnToggleModo").addEventListener("click", function () {
    var crear = document.getElementById("onlineCrear");
    var unirse = document.getElementById("onlineUnirse");
    if (crear.classList.contains("oculto")) {
      crear.classList.remove("oculto");
      unirse.classList.add("oculto");
      this.textContent = "¿Quieres unirte a una sala existente?";
    } else {
      crear.classList.add("oculto");
      unirse.classList.remove("oculto");
      this.textContent = "¿Quieres crear una nueva sala?";
    }
  });

  document.getElementById("btnCancelarEspera").addEventListener("click", function () {
    if (socket) {
      socket.disconnect();
    }
    reiniciarAlMenu();
  });

  elBtnReiniciar.addEventListener("click", function () {
    if (modoJuego === 'online') {
      reiniciarAlMenu();
    } else {
      reiniciarPartida();
    }
  });

  elBtnSiguienteTurno.addEventListener("click", function () {
    ocultarBotonSiguienteTurno();
    if (modoJuego === 'online') {
      turnoPlayOnline();
    } else {
      turnoPlay();
    }
  });

  function aplicarNombresYEmpezar() {
    var bj = document.getElementById("bloqueJuego");
    if (bj && !bj.classList.contains("oculto")) {
      return;
    }
    var in1 = document.getElementById("inputNombreJ1");
    var in2 = document.getElementById("inputNombreJ2");
    nombreJ1 = normalizarNombre(in1 ? in1.value : "", "Jugador 1");
    nombreJ2 = normalizarNombre(in2 ? in2.value : "", "Jugador 2");
    document.getElementById("bloqueNombres").classList.add("oculto");
    bj.classList.remove("oculto");
    fase = "setup_j1";
    actualizarVidas();
    iniciarSetupJ1();
  }

  document.getElementById("btnEmpezarPartida").addEventListener("click", function () {
    aplicarNombresYEmpezar();
  });

  document.getElementById("inputNombreJ1").addEventListener("keydown", function (ev) {
    if (ev.key === "Enter") {
      aplicarNombresYEmpezar();
    }
  });
  document.getElementById("inputNombreJ2").addEventListener("keydown", function (ev) {
    if (ev.key === "Enter") {
      aplicarNombresYEmpezar();
    }
  });

  elBtn.addEventListener("click", function () {
    if (modoJuego === 'online') {
      if (fase === "setup_j1") {
        fase = "setup_j2";
        iniciarSetupJ1Online();
      } else if (fase === "setup_j2") {
        fase = "play";
        iniciarJuegoOnline();
      }
    } else {
      if (fase === "setup_j1") {
        separadorPantalla();
        fase = "setup_j2";
        iniciarSetupJ2();
      } else if (fase === "setup_j2") {
        separadorPantalla();
        fase = "play";
        iniciarJuego();
      }
    }
  });

})();