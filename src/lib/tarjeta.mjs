// Dibuja la tarjeta de un poema como JPEG (para Instagram y para la vista previa de enlaces).
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import satori from 'satori';
import sharp from 'sharp';
import { SITIO } from '../config.mjs';
import { extracto, partesFecha } from './poema.mjs';

const PAPEL = '#f2ecdf';
const TINTA = '#151412';
const ROJO = '#d42a1c';

const fuente = (paquete, archivo) => readFileSync(join(process.cwd(), 'node_modules/@fontsource', paquete, 'files', archivo));
let fuentes;
const cargarFuentes = () =>
  (fuentes ??= [
    { name: 'Jost', weight: 800, style: 'normal', data: fuente('jost', 'jost-latin-800-normal.woff') },
    { name: 'Garamond', weight: 400, style: 'normal', data: fuente('eb-garamond', 'eb-garamond-latin-400-normal.woff') },
  ]);

const h = (type, style, children, extra = {}) => ({ type, props: { style, children, ...extra } });

export const FORMATOS = {
  // Instagram y Facebook (vertical 4:5)
  tarjeta: { ancho: 1080, alto: 1350, margen: 80, titulo: 70, verso: 42, renglones: 13, caracteres: 46, emblema: 300 },
  // Vista previa de enlaces (Open Graph)
  og: { ancho: 1200, alto: 630, margen: 60, titulo: 46, verso: 31, renglones: 6, caracteres: 50, emblema: 250 },
};

export async function dibujarTarjeta(poema, formato) {
  const f = FORMATOS[formato];
  const fecha = partesFecha(poema.fecha);
  const { lineas, cortado } = extracto(poema.html, f.renglones, f.caracteres);
  const tamTitulo = poema.titulo.length > 26 ? Math.round(f.titulo * 0.72) : f.titulo;
  const anchoTexto = f.ancho - f.margen * 2 - (formato === 'og' ? f.emblema : 0);
  const pie = Math.round(f.verso * 2.6);

  const emblema = h('svg', { position: 'absolute', top: f.margen * 0.6, right: f.margen * 0.6 }, [
    h('circle', undefined, undefined, { cx: 255, cy: 185, r: 125, fill: TINTA }),
    h('polygon', undefined, undefined, { points: '20,70 250,190 60,290', fill: ROJO }),
  ], { width: f.emblema, height: f.emblema, viewBox: '0 0 400 400' });

  const arbol = h('div', { width: f.ancho, height: f.alto, display: 'flex', flexDirection: 'column', background: PAPEL, color: TINTA, position: 'relative' }, [
    emblema,
    h('div', { display: 'flex', flexDirection: 'column', flexGrow: 1, padding: f.margen, paddingBottom: 0, width: anchoTexto + f.margen * 2, justifyContent: formato === 'og' ? 'center' : 'flex-end', paddingTop: formato === 'og' ? f.margen : f.emblema }, [
      h('div', { fontFamily: 'Jost', fontSize: f.verso * 0.52, letterSpacing: f.verso * 0.16, color: ROJO }, `${fecha.larga}`.toUpperCase()),
      h('div', { fontFamily: 'Jost', fontSize: tamTitulo, lineHeight: 1.05, marginTop: f.verso * 0.4, textTransform: 'uppercase', display: 'flex', flexWrap: 'wrap' }, poema.titulo),
      h('div', { width: f.verso * 4, height: Math.max(8, f.verso * 0.28), background: ROJO, marginTop: f.verso * 0.7, marginBottom: f.verso * 0.8 }),
      ...lineas.map((l) => (l ? h('div', { fontFamily: 'Garamond', fontSize: f.verso, lineHeight: 1.32 }, l) : h('div', { height: f.verso * 0.75 }))),
      cortado ? h('div', { fontFamily: 'Garamond', fontSize: f.verso, lineHeight: 1.32, color: ROJO }, '…') : null,
      h('div', { height: f.margen * 0.7 }),
    ].filter(Boolean)),
    h('div', { height: pie, background: TINTA, color: PAPEL, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: `0 ${f.margen}px`, fontFamily: 'Jost', fontSize: f.verso * 0.52, letterSpacing: f.verso * 0.12 }, [
      h('div', {}, SITIO.autor.toUpperCase()),
      h('div', { letterSpacing: 0 }, SITIO.url.replace(/^https?:\/\//, '')),
    ]),
  ]);

  const svg = await satori(arbol, { width: f.ancho, height: f.alto, fonts: cargarFuentes() });
  return sharp(Buffer.from(svg)).jpeg({ quality: 90 }).toBuffer();
}
