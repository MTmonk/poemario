// Carga los poemas del repositorio para las páginas de Astro.
import { SITIO } from '../config.mjs';
import { hoyEn, leerPoema } from './poema.mjs';

const archivos = import.meta.glob('/poemas/*.json', { eager: true, query: '?raw', import: 'default' });

/** Poemas ya publicados (fecha <= hoy), del más reciente al más antiguo. */
export function poemasPublicados() {
  const hoy = hoyEn(SITIO.zonaHoraria);
  return Object.entries(archivos)
    .map(([ruta, crudo]) => {
      const poema = leerPoema(crudo, ruta);
      if (!ruta.endsWith(`/${poema.fecha}.json`)) throw new Error(`${ruta}: el nombre del archivo debe ser ${poema.fecha}.json`);
      return poema;
    })
    .filter((p) => p.fecha <= hoy)
    .sort((a, b) => b.fecha.localeCompare(a.fecha));
}
