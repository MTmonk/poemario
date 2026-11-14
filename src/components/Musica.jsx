import { useEffect, useRef, useState } from 'react';
import { PISTAS } from '../musica.mjs';

// Reproductor discreto y siempre a la vista: nunca suena solo; empieza cuando el visitante lo pide.
// En pantallas anchas queda fijo en la columna de la fecha; en el móvil es una barra al pie.
export default function Musica({ base }) {
  const audio = useRef(null);
  const fallos = useRef(0); // pistas seguidas que no cargaron
  const [i, setI] = useState(() => Math.floor(Math.random() * Math.max(1, PISTAS.length)));
  const [sonando, setSonando] = useState(false);
  const [sinMusica, setSinMusica] = useState(false);
  const pista = PISTAS[i];

  useEffect(() => {
    if (sonando) audio.current?.play().catch(() => {});
  }, [i, sonando]);

  if (!pista) return null;
  const siguiente = () => setI((n) => (n + 1) % PISTAS.length);
  const alternar = () => {
    if (sonando) audio.current.pause();
    fallos.current = 0;
    setSinMusica(false);
    setSonando(!sonando);
  };
  // Si una pista no carga se pasa a la siguiente; si fallan tres seguidas (sin conexión), se detiene y se avisa.
  const alFallar = () => {
    if (!sonando) return;
    if (++fallos.current >= Math.min(3, PISTAS.length)) {
      setSonando(false);
      setSinMusica(true);
    } else siguiente();
  };

  return (
    <aside className={sonando ? 'musica musica--sonando' : 'musica'} aria-label="Música">
      <audio ref={audio} src={`${base}musica/${pista.archivo}`} preload="none" onEnded={siguiente} onError={alFallar} onPlaying={() => { fallos.current = 0; }} />
      <div className="musica__botones">
        <button type="button" onClick={alternar} aria-pressed={sonando}>
          {sonando ? '❚❚ Pausa' : '▶ Música'}
        </button>
        {sonando && (
          <button type="button" onClick={siguiente} aria-label="Siguiente pieza" title="Siguiente pieza">▶▶</button>
        )}
      </div>
      {sonando && (
        <p className="musica__pista">
          <b>{pista.autor}</b>
          <span>{pista.titulo}</span>
          <a href={`${base}musica/`}>Créditos</a>
        </p>
      )}
      {sinMusica && <p className="musica__pista" role="status">No se pudo cargar la música. Revisa tu conexión.</p>}
    </aside>
  );
}
