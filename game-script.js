/**
 * Juego de Puntos y Veneno
 * Un juego de dos jugadores con tableros 3x3
 */

// Estado del juego
let estado = {
  modo: null, // 'local'
  jugadores: [
    { nombre: 'Jugador 1', vidas: 3, tablero: [], tableroFinal: [] },
    { nombre: 'Jugador 2', vidas: 3, tablero: [], tableroFinal: [] }
  ],
  turnoActual: 0,
  fase: 'setup', // 'setup', 'play', 'final'
  celdasClickeadas: [[], []], // Track which cells were clicked
};

// Elementos del DOM
const bloqueModo = document.getElementById('bloqueModo');
const bloqueNombres = document.getElementById('bloqueNombres');
const bloqueJuego = document.getElementById('bloqueJuego');
const tableroContainer = document.getElementById('tableroContainer');
const vidas = document.getElementById('vidas');
const fase = document.getElementById('fase');
const mensaje = document.getElementById('mensaje');
const btnContinuar = document.getElementById('btnContinuar');
const btnSiguienteTurno = document.getElementById('btnSiguienteTurno');
const btnReiniciar = document.getElementById('btnReiniciar');
const btnEmpezarPartida = document.getElementById('btnEmpezarPartida');
const btnModoLocal = document.getElementById('btnModoLocal');
const finElement = document.getElementById('fin');

// Event listeners
btnModoLocal.addEventListener('click', () => mostrarNombres());
btnEmpezarPartida.addEventListener('click', () => empezarPartida());
btnContinuar.addEventListener('click', () => continuar());
btnSiguienteTurno.addEventListener('click', () => siguienteTurno());
btnReiniciar.addEventListener('click', () => reiniciar());

function mostrarNombres() {
  estado.modo = 'local';
  bloqueModo.classList.add('oculto');
  bloqueNombres.classList.remove('oculto');
}

function empezarPartida() {
  const nombre1 = document.getElementById('inputNombreJ1').value || 'Jugador 1';
  const nombre2 = document.getElementById('inputNombreJ2').value || 'Jugador 2';
  
  estado.jugadores[0].nombre = nombre1;
  estado.jugadores[1].nombre = nombre2;
  
  // Inicializar tableros
  generarTableros();
  
  bloqueNombres.classList.add('oculto');
  bloqueJuego.classList.remove('oculto');
  
  estado.fase = 'setup';
  estado.turnoActual = 0;
  mostrarFase();
  renderizar();
}

function generarTableros() {
  for (let j = 0; j < 2; j++) {
    estado.jugadores[j].tablero = Array(9).fill(null);
    estado.jugadores[j].tableroFinal = Array(9).fill(null);
    estado.celdasClickeadas[j] = [];
    
    // Generar números del 1 al 9
    const numeros = Array.from({ length: 9 }, (_, i) => i + 1);
    for (let i = 0; i < 9; i++) {
      const idx = Math.floor(Math.random() * numeros.length);
      estado.jugadores[j].tablero[i] = numeros[idx];
      numeros.splice(idx, 1);
    }
  }
}

function mostrarFase() {
  const faseDiv = document.getElementById('fase');
  const jugador = estado.jugadores[estado.turnoActual];
  
  if (estado.fase === 'setup') {
    faseDiv.innerHTML = `<strong>${jugador.nombre}</strong>, elige 3 casillas para el veneno (haz clic en 3 celdas)`;
  } else if (estado.fase === 'play') {
    faseDiv.innerHTML = `<strong>${jugador.nombre}</strong>, elige una casilla del tablero de tu oponente`;
  } else if (estado.fase === 'final') {
    faseDiv.innerHTML = `¡Juego terminado! El ganador es... ¡<strong>${getFinalWinner()}</strong>!`;
  }
}

function renderizar() {
  renderizarVidas();
  renderizarTableros();
}

function renderizarVidas() {
  vidas.innerHTML = estado.jugadores
    .map((j, idx) => {
      const corazones = '❤️'.repeat(j.vidas) + '🤍'.repeat(3 - j.vidas);
      return `<div class="vida-pill vida-pill--j${idx + 1}">
        <span class="nombre-jug">${j.nombre}</span>
        <span class="corazones">${corazones}</span>
      </div>`;
    })
    .join('');
}

function renderizarTableros() {
  tableroContainer.innerHTML = '';
  
  for (let jugadorIdx = 0; jugadorIdx < 2; jugadorIdx++) {
    const isCurrentPlayer = jugadorIdx === estado.turnoActual;
    let claseWrap = 'tabla-wrap';
    
    if (estado.fase === 'setup') {
      claseWrap += ' modo-setup';
    } else if (estado.fase === 'play') {
      claseWrap += ' modo-play';
      if (!isCurrentPlayer) {
        claseWrap += ' tablero-congelado';
      }
    } else if (estado.fase === 'final') {
      claseWrap += ' modo-final';
    }
    
    const wrap = document.createElement('div');
    wrap.className = claseWrap;
    
    const titulo = document.createElement('h2');
    titulo.textContent = `Tablero de ${estado.jugadores[jugadorIdx].nombre}`;
    wrap.appendChild(titulo);
    
    const tabla = crearTabla(jugadorIdx);
    wrap.appendChild(tabla);
    
    tableroContainer.appendChild(wrap);
  }
}

function crearTabla(jugadorIdx) {
  const tabla = document.createElement('table');
  tabla.className = 'tablero';
  if (estado.fase === 'final') {
    tabla.classList.add('modo-final');
  }
  
  const thead = document.createElement('thead');
  const trHead = document.createElement('tr');
  for (let i = 1; i <= 3; i++) {
    const th = document.createElement('th');
    th.textContent = i;
    trHead.appendChild(th);
  }
  thead.appendChild(trHead);
  tabla.appendChild(thead);
  
  const tbody = document.createElement('tbody');
  
  for (let fila = 0; fila < 3; fila++) {
    const tr = document.createElement('tr');
    
    for (let col = 0; col < 3; col++) {
      const cellIdx = fila * 3 + col;
      const td = document.createElement('td');
      const isCurrentPlayer = jugadorIdx === estado.turnoActual;
      
      if (estado.fase === 'setup' && isCurrentPlayer) {
        // Fase de setup: seleccionar venenos
        td.addEventListener('click', () => seleccionarVeneno(jugadorIdx, cellIdx, td));
        td.style.cursor = 'pointer';
      } else if (estado.fase === 'play' && isCurrentPlayer && jugadorIdx !== estado.turnoActual) {
        // Fase de juego
      } else if (estado.fase === 'play' && jugadorIdx === estado.turnoActual && isCurrentPlayer) {
        // No se juega en propio tablero
      }
      
      // Mostrar contenido según fase
      if (estado.fase === 'final') {
        const valor = estado.jugadores[jugadorIdx].tableroFinal[cellIdx];
        if (valor === '☠️') {
          td.classList.add('is-poison-final');
          td.textContent = '☠️';
        } else if (valor === '❌') {
          td.classList.add('is-veneno-borrado');
          td.textContent = '❌';
        } else {
          td.textContent = valor;
        }
      } else {
        const valor = estado.jugadores[jugadorIdx].tablero[cellIdx];
        if (valor === '☠️') {
          td.classList.add('is-poison');
          td.textContent = '☠️';
        } else if (valor === '❌') {
          td.classList.add('is-veneno-borrado');
          td.textContent = '❌';
        } else if (valor === null) {
          td.classList.add('is-empty-cell');
          td.textContent = '';
        } else {
          td.textContent = valor;
        }
      }
      
      if (estado.fase === 'play' && jugadorIdx !== estado.turnoActual && estado.jugadores[jugadorIdx].tablero[cellIdx] !== null) {
        td.addEventListener('click', () => atacarCelda(jugadorIdx, cellIdx));
        td.style.cursor = 'pointer';
      }
      
      tr.appendChild(td);
    }
    
    tbody.appendChild(tr);
  }
  
  tabla.appendChild(tbody);
  return tabla;
}

function seleccionarVeneno(jugadorIdx, cellIdx, elemento) {
  if (estado.celdasClickeadas[jugadorIdx].includes(cellIdx)) {
    // Deseleccionar
    estado.celdasClickeadas[jugadorIdx] = estado.celdasClickeadas[jugadorIdx].filter(c => c !== cellIdx);
    estado.jugadores[jugadorIdx].tablero[cellIdx] = Math.floor(cellIdx) + 1;
    elemento.classList.remove('is-poison');
  } else if (estado.celdasClickeadas[jugadorIdx].length < 3) {
    // Seleccionar
    estado.celdasClickeadas[jugadorIdx].push(cellIdx);
    estado.jugadores[jugadorIdx].tablero[cellIdx] = '☠️';
    elemento.classList.add('is-poison');
  }
  
  actualizarMensajeSetup();
  renderizarTableros();
}

function actualizarMensajeSetup() {
  const faltantes = 3 - estado.celdasClickeadas[estado.turnoActual].length;
  if (faltantes > 0) {
    mensaje.textContent = `Faltan ${faltantes} casilla${faltantes !== 1 ? 's' : ''} por seleccionar`;
    btnContinuar.classList.add('oculto');
  } else {
    mensaje.textContent = '¡Listo! Presiona continuar';
    btnContinuar.classList.remove('oculto');
  }
}

function continuar() {
  if (estado.celdasClickeadas[estado.turnoActual].length !== 3) {
    return;
  }
  
  // Guardar tableros finales con venenos
  for (let j = 0; j < 2; j++) {
    estado.jugadores[j].tableroFinal = [...estado.jugadores[j].tablero];
  }
  
  // Limpiar tableros de juego (sin mostrar venenos)
  for (let j = 0; j < 2; j++) {
    estado.jugadores[j].tablero = estado.jugadores[j].tablero.map((val, idx) => {
      if (val === '☠️') return null;
      return val;
    });
  }
  
  if (estado.turnoActual === 0) {
    estado.turnoActual = 1;
    mensaje.textContent = '';
    btnContinuar.classList.add('oculto');
    mostrarFase();
    renderizar();
  } else {
    estado.fase = 'play';
    estado.turnoActual = 0;
    mensaje.textContent = '';
    btnContinuar.classList.add('oculto');
    btnSiguienteTurno.classList.add('oculto');
    mostrarFase();
    renderizar();
  }
}

function atacarCelda(jugadorDefensa, cellIdx) {
  const valor = estado.jugadores[jugadorDefensa].tableroFinal[cellIdx];
  
  if (valor === '☠️') {
    // Hit! Pierde una vida
    estado.jugadores[jugadorDefensa].vidas--;
    estado.jugadores[jugadorDefensa].tablero[cellIdx] = '❌';
    estado.jugadores[jugadorDefensa].tableroFinal[cellIdx] = '❌';
    mensaje.textContent = `¡${estado.jugadores[estado.turnoActual].nombre} encontró veneno! 💀`;
    
    if (estado.jugadores[jugadorDefensa].vidas <= 0) {
      // Fin del juego
      estado.fase = 'final';
      finElement.textContent = `¡${estado.jugadores[estado.turnoActual].nombre} gana! 🎉`;
      btnReiniciar.classList.remove('oculto');
      mostrarFase();
      renderizar();
      return;
    }
  } else {
    // Normal number hit
    mensaje.textContent = `¡${estado.jugadores[estado.turnoActual].nombre} encontró ${valor} puntos! 💯`;
  }
  
  estado.jugadores[jugadorDefensa].tablero[cellIdx] = null;
  btnSiguienteTurno.classList.remove('oculto');
  renderizar();
}

function siguienteTurno() {
  estado.turnoActual = 1 - estado.turnoActual;
  mensaje.textContent = '';
  btnSiguienteTurno.classList.add('oculto');
  mostrarFase();
  renderizar();
}

function getFinalWinner() {
  if (estado.jugadores[0].vidas > 0) return estado.jugadores[0].nombre;
  if (estado.jugadores[1].vidas > 0) return estado.jugadores[1].nombre;
  return 'Empate';
}

function reiniciar() {
  // Reset todo
  estado = {
    modo: null,
    jugadores: [
      { nombre: 'Jugador 1', vidas: 3, tablero: [], tableroFinal: [] },
      { nombre: 'Jugador 2', vidas: 3, tablero: [], tableroFinal: [] }
    ],
    turnoActual: 0,
    fase: 'setup',
    celdasClickeadas: [[], []],
  };
  
  bloqueModo.classList.remove('oculto');
  bloqueNombres.classList.add('oculto');
  bloqueJuego.classList.add('oculto');
  finElement.textContent = '';
  btnReiniciar.classList.add('oculto');
  
  document.getElementById('inputNombreJ1').value = '';
  document.getElementById('inputNombreJ2').value = '';
}

// Iniciar con modo visible
window.addEventListener('load', () => {
  bloqueModo.classList.remove('oculto');
});
