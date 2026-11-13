import { useEffect, useRef, useState } from 'react';
import { PISTAS } from '../musica.mjs';

// Reproductor discreto y siempre a la vista: nunca suena solo; empieza cuando el visitante lo pide.
// En pantallas anchas queda fijo en la columna de la fecha; en el móvil es una barra al pie.
export default function Musica({ base }) {
  const audio = useRef(null);
  const [i, setI] = useState(() => Math.floor(Math.random() * Math.max(1, PISTAS.length)));
  const [sonando, setSonando] = useState(false);
  const pista = PISTAS[i];

  useEffect(() => {
    if (sonando) audio.current?.play().catch(() => setSonando(false));
  }, [i, sonando]);

  if (!pista) return null;
  const siguiente = () => setI((n) => (n + 1) % PISTAS.length);
  const alternar = () => {
    if (sonando) audio.current.pause();
    setSonando(!sonando);
  };

  return (
    <aside className={sonando ? 'musica musica--sonando' : 'musica'} aria-label="Música">
      <audio ref={audio} src={`${base}musica/${pista.archivo}`} preload="none" onEnded={siguiente} onError={siguiente} />
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
    </aside>
  );
}
