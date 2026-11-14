// Publica en Facebook e Instagram los poemas del día que aún no se han publicado ahí.
// Lo ejecuta GitHub Actions después de desplegar el sitio. Sin credenciales, no hace nada.
//
// Variables de entorno (secretos del repositorio):
//   META_PAGE_TOKEN   token de acceso de la página de Facebook
//   META_PAGE_ID      identificador de la página de Facebook
//   META_IG_USER_ID   identificador de la cuenta profesional de Instagram (opcional)
//   META_GRAPH_VERSION  versión de la API, p. ej. "v23.0" (opcional)
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { SITIO } from '../src/config.mjs';
import { hoyEn, leerPoema, lineas, sumarDias } from '../src/lib/poema.mjs';

const raiz = new URL('../', import.meta.url);
const ARCHIVO_REGISTRO = new URL('datos/social.json', raiz);
const DIAS_DE_GRACIA = 2; // no se publican en redes poemas más viejos que esto
const LIMITE_INSTAGRAM = 2200;

const { META_PAGE_TOKEN: token, META_PAGE_ID: pagina, META_IG_USER_ID: instagram, META_GRAPH_VERSION: version } = process.env;
const GRAPH = 'https://graph.facebook.com' + (version ? `/${version}` : '');
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

async function graph(metodo, ruta, parametros) {
  const cuerpo = new URLSearchParams({ ...parametros, access_token: token });
  const r = metodo === 'GET' ? await fetch(`${GRAPH}/${ruta}?${cuerpo}`) : await fetch(`${GRAPH}/${ruta}`, { method: 'POST', body: cuerpo });
  const json = await r.json().catch(() => ({}));
  if (!r.ok || json.error) throw new Error(`${ruta}: ${json.error?.message ?? r.status}`);
  return json;
}

export function textoFacebook(poema, url) {
  return `${poema.titulo}\n\n${lineas(poema.html).join('\n')}\n\n— ${SITIO.autor}\n${url}`;
}

export function textoInstagram(poema) {
  const cabeza = `${poema.titulo}\n\n`;
  const completo = `\n\n— ${SITIO.autor}`;
  const cortado = `\n…\n\n— ${SITIO.autor}\nPoema completo: ${SITIO.url.replace(/^https?:\/\//, '')}`;
  const versos = lineas(poema.html);
  if ((cabeza + versos.join('\n') + completo).length <= LIMITE_INSTAGRAM) return cabeza + versos.join('\n') + completo;
  const caben = [];
  let largo = cabeza.length + cortado.length;
  for (const v of versos) {
    if (largo + v.length + 1 > LIMITE_INSTAGRAM) break;
    caben.push(v);
    largo += v.length + 1;
  }
  while (caben.length && !caben.at(-1)) caben.pop();
  return cabeza + caben.join('\n') + cortado;
}

async function esperarImagen(url) {
  for (let i = 0; i < 30; i++) {
    const r = await fetch(url, { method: 'HEAD' }).catch(() => null);
    if (r?.ok) return;
    await esperar(10_000);
  }
  throw new Error(`La imagen ${url} no está en línea todavía`);
}

async function publicarFacebook(poema, tarjeta, url) {
  const r = await graph('POST', `${pagina}/photos`, { url: tarjeta, message: textoFacebook(poema, url) });
  return r.post_id ?? r.id;
}

async function publicarInstagram(poema, tarjeta) {
  const { id } = await graph('POST', `${instagram}/media`, { image_url: tarjeta, caption: textoInstagram(poema) });
  for (let i = 0; i < 20; i++) {
    const { status_code } = await graph('GET', id, { fields: 'status_code' });
    if (status_code === 'FINISHED') break;
    if (status_code === 'ERROR' || status_code === 'EXPIRED') throw new Error(`Instagram rechazó la imagen (${status_code})`);
    await esperar(3_000);
  }
  return (await graph('POST', `${instagram}/media_publish`, { creation_id: id })).id;
}

async function main() {
  if (!token || !pagina) {
    console.log('Sin credenciales de Meta: no se publica en redes.');
    return;
  }
  const hoy = hoyEn(SITIO.zonaHoraria);
  const desde = sumarDias(hoy, -DIAS_DE_GRACIA);
  const registro = existsSync(ARCHIVO_REGISTRO) ? JSON.parse(readFileSync(ARCHIVO_REGISTRO, 'utf8')) : {};
  const poemas = readdirSync(new URL(SITIO.carpetaPoemas + '/', raiz))
    .filter((n) => n.endsWith('.json'))
    .map((n) => leerPoema(readFileSync(new URL(`${SITIO.carpetaPoemas}/${n}`, raiz), 'utf8'), n))
    .filter((p) => p.fecha <= hoy && p.fecha >= desde)
    .sort((a, b) => a.fecha.localeCompare(b.fecha));

  const redes = [['facebook', publicarFacebook], ...(instagram ? [['instagram', publicarInstagram]] : [])];
  let fallos = 0;
  for (const poema of poemas) {
    const hecho = (registro[poema.fecha] ??= {});
    const tarjeta = `${SITIO.url}/tarjetas/${poema.fecha}.jpg`;
    const url = `${SITIO.url}/poemas/${poema.fecha}/`;
    for (const [red, publicar] of redes) {
      if (hecho[red]) continue;
      try {
        await esperarImagen(tarjeta);
        hecho[red] = await publicar(poema, tarjeta, url);
        if (hecho.error) {
          delete hecho.error[red];
          if (!Object.keys(hecho.error).length) delete hecho.error;
        }
        writeFileSync(ARCHIVO_REGISTRO, JSON.stringify(registro, null, 2) + '\n');
        console.log(`✓ ${red}: «${poema.titulo}» (${poema.fecha})`);
      } catch (e) {
        fallos++;
        // El administrador lee esta nota para avisarle al poeta de que algo falló.
        (hecho.error ??= {})[red] = String(e.message).slice(0, 200);
        writeFileSync(ARCHIVO_REGISTRO, JSON.stringify(registro, null, 2) + '\n');
        console.error(`✗ ${red}: «${poema.titulo}» (${poema.fecha}) — ${e.message}`);
      }
    }
  }
  if (fallos) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
