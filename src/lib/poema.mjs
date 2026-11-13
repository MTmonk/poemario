// Funciones puras sobre poemas. Sin dependencias: corren en Astro, en el navegador y en Node.
//
// Formato de un poema (poemas/AAAA-MM-DD.json):
//   { "titulo": "...", "fecha": "AAAA-MM-DD", "html": "<p>verso</p><p></p><p>verso</p>" }
// Cada <p> es un verso (o un párrafo en prosa); un <p></p> vacío separa estrofas.

const PERMITIDAS = new Set(['p', 'br', 'em', 'i', 'strong', 'b']);
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

export const esFecha = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));

/** Fecha de hoy (AAAA-MM-DD) en una zona horaria. */
export function hoyEn(zona, ahora = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: zona, year: 'numeric', month: '2-digit', day: '2-digit' }).format(ahora);
}

export function sumarDias(fecha, n) {
  const d = new Date(fecha + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** "2026-11-14" -> { dia: "14", mes: "noviembre", anio: "2026", larga: "14 de noviembre de 2026" } */
export function partesFecha(fecha) {
  const [a, m, d] = fecha.split('-');
  const dia = String(Number(d));
  const mes = MESES[Number(m) - 1];
  return { dia, mes, anio: a, larga: `${dia} de ${mes} de ${a}` };
}

/** Deja sólo las etiquetas de un poema y les quita todos los atributos. */
export function limpiarHtml(html) {
  return String(html ?? '')
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<(\/?)([a-zA-Z][a-zA-Z0-9]*)[^>]*>/g, (_, cierre, etiqueta) => {
      const t = etiqueta.toLowerCase();
      return PERMITIDAS.has(t) ? `<${cierre}${t}>` : '';
    });
}

const ENTIDADES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
const sinEntidades = (s) =>
  s.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (m, e) => {
    if (e[0] === '#') return String.fromCodePoint(e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10));
    return ENTIDADES[e.toLowerCase()] ?? m;
  });

/** Versos del poema como texto; '' marca un salto de estrofa. */
export function lineas(html) {
  const out = [];
  for (const m of limpiarHtml(html).matchAll(/<p>([\s\S]*?)<\/p>/g)) {
    for (const parte of m[1].split(/<br>/)) out.push(sinEntidades(parte.replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim());
  }
  while (out.length && !out[0]) out.shift();
  while (out.length && !out.at(-1)) out.pop();
  return out.filter((l, i) => l || out[i - 1]);
}

export const textoPlano = (html) => lineas(html).join('\n');

/** Primeros versos, hasta `max` renglones (un salto de estrofa cuenta como renglón). */
export function extracto(html, max = 10, anchoRenglon = 44) {
  const todas = lineas(html);
  const out = [];
  let usados = 0;
  for (const l of todas) {
    const costo = Math.max(1, Math.ceil(l.length / anchoRenglon));
    if (usados + costo > max) break;
    out.push(l);
    usados += costo;
  }
  if (!out.length && todas.length) out.push(todas[0].slice(0, max * anchoRenglon - 1).replace(/\s+\S*$/, '') + '…');
  while (out.length && !out.at(-1)) out.pop();
  return { lineas: out, cortado: out.length < todas.length };
}

/** Valida y normaliza un poema leído de un archivo. Lanza un error claro si está mal. */
export function leerPoema(crudo, origen = 'poema') {
  const p = typeof crudo === 'string' ? JSON.parse(crudo) : crudo;
  if (!p || typeof p.titulo !== 'string' || !p.titulo.trim()) throw new Error(`${origen}: falta "titulo"`);
  if (!esFecha(p.fecha)) throw new Error(`${origen}: "fecha" debe ser AAAA-MM-DD`);
  if (typeof p.html !== 'string' || !lineas(p.html).length) throw new Error(`${origen}: el poema está vacío`);
  return { titulo: p.titulo.trim(), fecha: p.fecha, html: limpiarHtml(p.html) };
}

/**
 * Convierte el HTML que produce mammoth a partir de un .docx al formato de poema.
 * - El primer párrafo se devuelve aparte como título.
 * - Los poemas a dos columnas (versos separados por tabuladores) se pasan a una sola:
 *   primero la columna izquierda de cada bloque y luego la derecha.
 */
export function desdeDocx(htmlMammoth) {
  const plano = limpiarHtml(
    String(htmlMammoth)
      .replace(/<(h[1-6]|li)[^>]*>/gi, '<p>')
      .replace(/<\/(h[1-6]|li)>/gi, '</p>'),
  );
  const parrafos = [...plano.matchAll(/<p>([\s\S]*?)<\/p>/g)].map((m) => m[1].replace(/[  ]+$/g, ''));
  const vacio = (p) => !p.replace(/<[^>]+>/g, '').trim();
  while (parrafos.length && vacio(parrafos[0])) parrafos.shift();
  const titulo = sinEntidades((parrafos.shift() ?? '').replace(/<[^>]+>/g, '')).trim();

  const salida = [];
  let bloque = [];
  const cerrar = () => {
    if (!bloque.length) return;
    const partidas = bloque.map((l) => l.split(/\t+/).map((s) => s.trim()));
    const dosColumnas = partidas.filter((p) => p.length > 1 && p[0] && p[1]).length * 2 >= bloque.length;
    if (dosColumnas) {
      const izq = partidas.map((p) => p[0]).filter(Boolean);
      const der = partidas.map((p) => p.slice(1).join(' ')).filter(Boolean);
      salida.push(...izq, '', ...der);
    } else {
      salida.push(...partidas.map((p) => p.filter(Boolean).join(' ')));
    }
    bloque = [];
  };
  for (const p of parrafos) {
    if (vacio(p)) { cerrar(); salida.push(''); } else bloque.push(p);
  }
  cerrar();
  while (salida.length && !salida[0]) salida.shift();
  while (salida.length && !salida.at(-1)) salida.pop();
  const compacta = salida.filter((l, i) => l || salida[i - 1]);
  return { titulo, html: compacta.map((l) => `<p>${l}</p>`).join('') };
}
