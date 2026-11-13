import { useEffect, useRef, useState } from 'react';
import { PISTAS } from '../musica.mjs';

// Reproductor discreto: nunca suena solo; empieza cuando el visitante lo pide.
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
  const estilo = { background: 'none', border: '2px solid currentColor', color: 'inherit', font: 'inherit', padding: '0.45rem 0.9rem', cursor: 'pointer' };

  return (
    <div className="etiqueta" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.8rem' }}>
      <audio ref={audio} src={`${base}musica/${pista.archivo}`} preload="none" onEnded={siguiente} onError={siguiente} />
      <button type="button" style={estilo} onClick={alternar} aria-pressed={sonando}>
        {sonando ? '❚❚ Pausa' : '▶ Música'}
      </button>
      {sonando && (
        <>
          <button type="button" style={estilo} onClick={siguiente} aria-label="Siguiente pieza">▶▶</button>
          <span style={{ letterSpacing: '0.08em' }}>
            {pista.autor} · {pista.titulo} · <a href={`${base}musica/`}>créditos</a>
          </span>
        </>
      )}
    </div>
  );
}
