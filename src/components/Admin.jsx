import { useEffect, useMemo, useRef, useState } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { SITIO } from '../config.mjs';
import { desdeDocx, esFecha, hoyEn, leerPoema, lineas, partesFecha, sumarDias } from '../lib/poema.mjs';
import './admin.css';

const CLAVE_LLAVE = 'poemario.llave';
const CLAVE_BORRADOR = 'poemario.borrador';
const API = 'https://api.github.com';
const REPO = `${SITIO.repoDueno}/${SITIO.repoNombre}`;
const ESPACIOS = { preserveWhitespace: 'full' };

// ─── Almacenamiento local (puede fallar en modo privado) ──────────
const guardar = (clave, valor) => { try { valor == null ? localStorage.removeItem(clave) : localStorage.setItem(clave, valor); } catch {} };
const leer = (clave) => { try { return localStorage.getItem(clave); } catch { return null; } };

// ─── GitHub ───────────────────────────────────────────────────────
const aBase64 = (texto) => {
  let binario = '';
  for (const b of new TextEncoder().encode(texto)) binario += String.fromCharCode(b);
  return btoa(binario);
};

async function github(llave, ruta, opciones = {}) {
  let r;
  try {
    r = await fetch(API + ruta, {
      ...opciones,
      headers: { Accept: 'application/vnd.github+json', Authorization: `Bearer ${llave}`, 'X-GitHub-Api-Version': '2022-11-28' },
      body: opciones.body ? JSON.stringify(opciones.body) : undefined,
    });
  } catch {
    throw new Error('No hay conexión a internet. Inténtalo de nuevo en un momento.');
  }
  const sinCupo = r.headers.get('x-ratelimit-remaining') === '0' || r.headers.has('retry-after');
  if (r.status === 429 || (r.status === 403 && sinCupo)) throw new Error('GitHub pide una pausa por demasiados intentos seguidos. Espera unos minutos y vuelve a intentarlo; no se perdió nada.');
  if (r.status >= 500) throw new Error('GitHub tiene problemas en este momento. Espera unos minutos y vuelve a intentarlo; no se perdió nada.');
  if (r.status === 401) throw Object.assign(new Error('La llave no es válida o ya caducó.'), { llaveMala: true });
  if (r.status === 403 || r.status === 404) throw new Error('La llave no tiene permiso para escribir en el sitio. Pídele a Mario una llave nueva.');
  if (r.status === 409 || r.status === 422) throw new Error('El poema cambió mientras lo editabas. Vuelve a la lista y ábrelo de nuevo.');
  if (!r.ok) throw new Error(`GitHub respondió con un error (${r.status}). Inténtalo de nuevo.`);
  return r.status === 204 ? null : r.json();
}

/** Todos los poemas del repositorio (publicados y programados), con su contenido, en una sola consulta. */
async function listarPoemas(llave) {
  const query = `query($dueno:String!,$nombre:String!,$expr:String!,$social:String!){repository(owner:$dueno,name:$nombre){object(expression:$expr){... on Tree{entries{name oid object{... on Blob{text}}}}} social:object(expression:$social){... on Blob{text}}}}`;
  const variables = { dueno: SITIO.repoDueno, nombre: SITIO.repoNombre, expr: `${SITIO.rama}:${SITIO.carpetaPoemas}`, social: `${SITIO.rama}:datos/social.json` };
  const r = await github(llave, '/graphql', { method: 'POST', body: { query, variables } });
  if (r.errors?.length) throw new Error('La llave no tiene acceso al sitio. Pídele a Mario una llave nueva.');
  if (!r.data?.repository) throw new Error('La llave no tiene acceso al sitio. Pídele a Mario una llave nueva.');
  const entradas = r.data.repository.object?.entries ?? [];
  let social = {};
  try { social = JSON.parse(r.data.repository.social?.text ?? '{}'); } catch {}
  const poemas = entradas
    .filter((e) => e.name.endsWith('.json') && e.object?.text)
    .flatMap((e) => {
      try { return [{ ...leerPoema(e.object.text, e.name), sha: e.oid }]; } catch { return []; }
    })
    .sort((a, b) => b.fecha.localeCompare(a.fecha));
  return { poemas, social };
}

// ─── Redes: lo que scripts/social.mjs dejó anotado en datos/social.json ───
const REDES = { facebook: 'Facebook', instagram: 'Instagram' };
const DIAS_REDES = 2; // igual que DIAS_DE_GRACIA en scripts/social.mjs
const LARGO_INSTAGRAM = 2100;
const enRedes = (social, fecha) => Object.keys(REDES).filter((r) => social[fecha]?.[r]).map((r) => REDES[r]);
const fallosRedes = (social, fecha) => Object.keys(social[fecha]?.error ?? {}).map((r) => REDES[r] ?? r);
const unir = (nombres) => nombres.join(' y ');

// ─── Estado del sitio (datos públicos de GitHub Actions; no usan la llave) ───
const FLUJO = `${API}/repos/${REPO}/actions/workflows/publicar.yml`;
async function publico(url) {
  const r = await fetch(url, { headers: { Accept: 'application/vnd.github+json' } });
  if (!r.ok) throw new Error(String(r.status));
  return r.json();
}
async function ultimaCorrida() {
  const corrida = (await publico(`${FLUJO}/runs?per_page=1&branch=${SITIO.rama}`)).workflow_runs?.[0] ?? null;
  let fallo = '';
  if (corrida?.conclusion === 'failure') {
    const { jobs = [] } = await publico(corrida.jobs_url);
    fallo = jobs.some((j) => j.conclusion === 'failure' && j.name !== 'redes') ? 'sitio' : 'redes';
  }
  return { corrida, fallo };
}
const fechaHora = (iso) => new Intl.DateTimeFormat('es-MX', { dateStyle: 'long', timeStyle: 'short', timeZone: SITIO.zonaHoraria }).format(new Date(iso));

/** Avisa si el sitio se está actualizando, si algo falló o si la publicación diaria está apagada. */
function Estado({ desde }) {
  const [e, setE] = useState(null);
  useEffect(() => {
    let vivo = true;
    let reloj;
    let vueltas = 0;
    let apagado = false;
    const mirar = async () => {
      try {
        if (!vueltas) apagado = (await publico(FLUJO)).state !== 'active';
        const { corrida, fallo } = await ultimaCorrida();
        if (!vivo) return;
        // Tras guardar, GitHub tarda unos segundos en arrancar la actualización.
        const porArrancar = desde && Date.now() - desde < 120_000 && (!corrida || Date.parse(corrida.created_at) < desde - 60_000);
        const enCurso = porArrancar || (corrida && corrida.status !== 'completed');
        setE({ apagado, corrida, fallo, enCurso });
        if (enCurso && ++vueltas < 20) reloj = setTimeout(mirar, 30_000);
      } catch {
        if (vivo) setE(null); // sin datos no se muestra nada: no es un error del poeta
      }
    };
    mirar();
    return () => { vivo = false; clearTimeout(reloj); };
  }, [desde]);

  if (!e) return null;
  const { corrida } = e;
  const viejo = corrida && !e.enCurso && Date.now() - Date.parse(corrida.updated_at) > 36 * 3600_000;
  return (
    <div className="adm-estado-sitio">
      {e.apagado && <p className="adm-error" role="alert">La publicación automática de cada mañana está apagada (GitHub la apaga tras 60 días sin cambios). Los poemas en espera no saldrán solos. Avisa a Mario.</p>}
      {e.enCurso ? (
        <p className="adm-aviso adm-aviso--curso" role="status">El sitio se está actualizando. Tarda unos minutos; no hace falta esperar aquí.</p>
      ) : e.fallo === 'sitio' ? (
        <p className="adm-error" role="alert">La última actualización del sitio falló ({fechaHora(corrida.updated_at)}). Los poemas están guardados, pero los cambios recientes aún no se ven. Avisa a Mario.</p>
      ) : e.fallo === 'redes' ? (
        <p className="adm-error" role="alert">El sitio está al día, pero falló la publicación en Facebook o Instagram ({fechaHora(corrida.updated_at)}). Avisa a Mario.</p>
      ) : viejo && !e.apagado ? (
        <p className="adm-error" role="alert">El sitio no se actualiza desde el {fechaHora(corrida.updated_at)}. Si hay un poema en espera para hoy, avisa a Mario.</p>
      ) : corrida ? (
        <p className="adm-nota">Sitio al día · última actualización: {fechaHora(corrida.updated_at)}</p>
      ) : null}
    </div>
  );
}

function Limites() {
  return (
    <details className="adm-limites">
      <summary>Qué conviene saber</summary>
      <ul>
        <li>Un poema por día. Para cambiar el de un día, ábrelo y edítalo.</li>
        <li>Un poema guardado tarda unos minutos en verse en el sitio.</li>
        <li>Los poemas en espera salen solos hacia las 6 de la mañana (hora de México); a veces GitHub se retrasa hasta una hora.</li>
        <li>Sólo texto, con negrita y cursiva. No se pueden poner imágenes, colores ni tamaños de letra.</li>
        <li>De Word sólo se aceptan archivos .docx (no .doc). También puedes copiar y pegar.</li>
        <li>En redes cada poema se publica una sola vez. Si después lo corriges o lo borras, el cambio se ve en el sitio, pero no en Facebook ni en Instagram.</li>
        <li>Un poema con fecha de hace más de dos días no se envía a redes.</li>
        <li>Instagram admite 2&nbsp;200 letras: un poema más largo sale recortado, con la dirección del sitio.</li>
        <li>El borrador de un poema nuevo se guarda sólo en este aparato.</li>
        <li>La llave caduca en la fecha que eligió Mario. Ese día esta página pedirá una nueva.</li>
        <li>Si borras un poema por error, Mario puede recuperarlo.</li>
      </ul>
    </details>
  );
}

const rutaPoema = (fecha) => `/repos/${REPO}/contents/${SITIO.carpetaPoemas}/${fecha}.json`;

async function guardarPoema(llave, poema, original) {
  const contenido = JSON.stringify({ titulo: poema.titulo, fecha: poema.fecha, html: poema.html }, null, 2) + '\n';
  const mismaFecha = original?.fecha === poema.fecha;
  await github(llave, rutaPoema(poema.fecha), {
    method: 'PUT',
    body: { message: `Poema ${poema.fecha}: ${poema.titulo}`, content: aBase64(contenido), branch: SITIO.rama, ...(mismaFecha ? { sha: original.sha } : {}) },
  });
  if (original && !mismaFecha) await borrarPoema(llave, original, `Poema movido de ${original.fecha} a ${poema.fecha}`);
}

const borrarPoema = (llave, poema, mensaje = `Borrar poema ${poema.fecha}`) =>
  github(llave, rutaPoema(poema.fecha), { method: 'DELETE', body: { message: mensaje, sha: poema.sha, branch: SITIO.rama } });

// ─── Pantallas ────────────────────────────────────────────────────
function Llave({ alEntrar, error }) {
  const [valor, setValor] = useState('');
  return (
    <form className="adm-caja" onSubmit={(e) => { e.preventDefault(); if (valor.trim()) alEntrar(valor.trim()); }}>
      <h1>Entrar</h1>
      <p>Pega aquí la llave que te dio Mario. Sólo hay que hacerlo una vez en este aparato.</p>
      <label htmlFor="llave">Llave</label>
      <input id="llave" type="password" autoComplete="off" value={valor} onChange={(e) => setValor(e.target.value)} />
      {error && <p className="adm-error" role="alert">{error}</p>}
      <button className="adm-boton adm-boton--rojo" type="submit">Entrar</button>
    </form>
  );
}

function Lista({ poemas, social, hoy, desde, alAbrir, alNuevo, alBorrar, aviso, ocupado }) {
  const programados = poemas.filter((p) => p.fecha > hoy).length;
  const estado = (p) => {
    if (p.fecha > hoy) return 'En espera';
    const fallos = fallosRedes(social, p.fecha);
    if (fallos.length) return `Publicado · falló en ${unir(fallos)}`;
    const hechas = enRedes(social, p.fecha);
    return hechas.length ? `Publicado · ${unir(hechas)}` : 'Publicado';
  };
  return (
    <div>
      {aviso && <p className="adm-aviso" role="status">{aviso}</p>}
      <Estado desde={desde} />
      <button className="adm-boton adm-boton--rojo adm-boton--grande" type="button" onClick={alNuevo}>+ Escribir un poema nuevo</button>
      <p className="adm-nota">{poemas.length} {poemas.length === 1 ? 'poema' : 'poemas'} en total · {programados} en espera de su día</p>
      <ul className="adm-lista">
        {poemas.map((p) => (
          <li key={p.fecha}>
            <button className="adm-lista__abrir" type="button" onClick={() => alAbrir(p)}>
              <span className="adm-lista__fecha">{partesFecha(p.fecha).larga}</span>
              <span className="adm-lista__titulo">{p.titulo}</span>
              <span className={p.fecha > hoy ? 'adm-estado adm-estado--espera' : fallosRedes(social, p.fecha).length ? 'adm-estado adm-estado--fallo' : 'adm-estado'}>{estado(p)}</span>
            </button>
            <button className="adm-lista__borrar" type="button" disabled={ocupado} onClick={() => alBorrar(p)} aria-label={`Borrar «${p.titulo}»`}>Borrar</button>
          </li>
        ))}
      </ul>
      <Limites />
    </div>
  );
}

function Editor({ inicial, original, poemas, social, hoy, llave, alTerminar, alVolver, alBorrar }) {
  const [titulo, setTitulo] = useState(inicial.titulo);
  const [fecha, setFecha] = useState(inicial.fecha);
  const [error, setError] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const archivo = useRef(null);
  const datos = useRef({ titulo, fecha });
  datos.current = { titulo, fecha };

  const borrador = (html) => { if (!original) guardar(CLAVE_BORRADOR, JSON.stringify({ ...datos.current, html })); };

  const editor = useEditor({
    extensions: [StarterKit.configure({ heading: false, bulletList: false, orderedList: false, listItem: false, listKeymap: false, blockquote: false, codeBlock: false, code: false, horizontalRule: false, strike: false, link: false, underline: false })],
    content: inicial.html,
    parseOptions: ESPACIOS,
    immediatelyRender: false,
    editorProps: { attributes: { class: 'adm-papel poema__texto', 'aria-label': 'Texto del poema', spellcheck: 'true', lang: 'es' } },
    onUpdate: ({ editor }) => borrador(editor.getHTML()),
  });

  useEffect(() => { if (editor) borrador(editor.getHTML()); }, [titulo, fecha]);

  const otro = poemas.find((p) => p.fecha === fecha && p.fecha !== original?.fecha);
  const cuando = !esFecha(fecha) ? '' : fecha <= hoy ? 'Se publicará enseguida.' : `Se publicará solo el ${partesFecha(fecha).larga}.`;

  // Avisos de límites que aplican a este poema en concreto.
  const redesActivas = Object.keys(social).length > 0;
  const yaEnRedes = original ? enRedes(social, original.fecha) : [];
  const avisos = [];
  if (yaEnRedes.length) avisos.push(`Este poema ya salió en ${unir(yaEnRedes)}. Lo que cambies aquí se verá en el sitio, pero no allá.`);
  else if (redesActivas && esFecha(fecha) && fecha < sumarDias(hoy, -DIAS_REDES)) avisos.push('Con esa fecha, de hace más de dos días, el poema saldrá en el sitio pero no se enviará a redes.');
  const largo = titulo.length + (editor ? editor.getText().length : 0);
  if (!yaEnRedes.length && largo > LARGO_INSTAGRAM) avisos.push('Es un poema largo: en Instagram saldrá recortado, con la dirección del sitio para leerlo completo. En el sitio y en Facebook sale entero.');

  async function subirWord(e) {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    setError('');
    if (!/\.docx$/i.test(f.name)) {
      setError('Ese archivo no es .docx. En Word, usa «Guardar como» y elige «Documento de Word (.docx)».');
      return;
    }
    try {
      const mammoth = (await import('mammoth/mammoth.browser.js')).default;
      const { value } = await mammoth.convertToHtml({ arrayBuffer: await f.arrayBuffer() }, { ignoreEmptyParagraphs: false });
      const poema = desdeDocx(value);
      if (!lineas(poema.html).length) throw new Error('vacío');
      if (!titulo.trim()) setTitulo(poema.titulo);
      else if (poema.titulo && poema.titulo !== titulo.trim()) poema.html = `<p>${poema.titulo}</p><p></p>${poema.html}`;
      editor.commands.setContent(poema.html, { parseOptions: ESPACIOS });
      borrador(editor.getHTML());
    } catch {
      setError('No se pudo leer el documento. Puedes copiar el texto en Word y pegarlo aquí.');
    }
  }

  async function publicar() {
    setError('');
    const html = editor.getHTML();
    if (!titulo.trim()) return setError('Falta el título.');
    if (!esFecha(fecha)) return setError('Elige el día de publicación.');
    if (!lineas(html).length) return setError('El poema está vacío.');
    if (otro) return setError(`Ya hay un poema para ese día («${otro.titulo}»). Elige otro día.`);
    setOcupado(true);
    try {
      const poema = leerPoema({ titulo, fecha, html });
      await guardarPoema(llave, poema, original);
      if (!original) guardar(CLAVE_BORRADOR, null);
      alTerminar(fecha <= hoy ? `«${poema.titulo}» se guardó. Aparecerá en el sitio en unos minutos.` : `«${poema.titulo}» quedó en espera. Se publicará solo el ${partesFecha(fecha).larga}.`);
    } catch (e) {
      setError(e.message);
      setOcupado(false);
    }
  }

  async function borrar() {
    setError('');
    setOcupado(true);
    try {
      if (!(await alBorrar(original))) setOcupado(false);
    } catch (e) {
      setError(e.message);
      setOcupado(false);
    }
  }

  return (
    <div className="adm-editor">
      <button className="adm-enlace" type="button" onClick={alVolver}>← Volver a la lista</button>

      <label htmlFor="titulo">Título</label>
      <input id="titulo" type="text" value={titulo} onChange={(e) => setTitulo(e.target.value)} />

      <label htmlFor="fecha">Día de publicación</label>
      <input id="fecha" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
      <p className="adm-nota">{otro ? `Ya hay un poema para ese día: «${otro.titulo}».` : cuando}</p>

      <label>Poema</label>
      <div className="adm-barra">
        <button type="button" className={editor?.isActive('bold') ? 'activo' : ''} onClick={() => editor.chain().focus().toggleBold().run()}><b>Negrita</b></button>
        <button type="button" className={editor?.isActive('italic') ? 'activo' : ''} onClick={() => editor.chain().focus().toggleItalic().run()}><i>Cursiva</i></button>
        <button type="button" onClick={() => editor.chain().focus().undo().run()}>Deshacer</button>
        <button type="button" onClick={() => archivo.current.click()}>Subir documento de Word</button>
        <input ref={archivo} type="file" accept=".docx,.doc" hidden onChange={subirWord} />
      </div>
      <EditorContent editor={editor} />
      <p className="adm-nota">Cada renglón es un verso. Deja un renglón vacío para separar estrofas.</p>

      {avisos.map((a) => <p className="adm-nota adm-nota--limite" key={a}>{a}</p>)}
      {error && <p className="adm-error" role="alert">{error}</p>}
      <div className="adm-acciones">
        <button className="adm-boton adm-boton--rojo adm-boton--grande" type="button" disabled={ocupado || !editor} onClick={publicar}>
          {ocupado ? 'Guardando…' : original ? 'Guardar cambios' : fecha <= hoy ? 'Publicar' : 'Programar'}
        </button>
        {original && <button className="adm-boton" type="button" disabled={ocupado} onClick={borrar}>Borrar poema</button>}
      </div>
    </div>
  );
}

// ─── Aplicación ───────────────────────────────────────────────────
export default function Admin() {
  const [llave, setLlave] = useState(() => {
    const enlace = new URLSearchParams(window.location.hash.slice(1)).get('llave');
    if (enlace) {
      guardar(CLAVE_LLAVE, enlace);
      window.history.replaceState(null, '', window.location.pathname);
    }
    return enlace || leer(CLAVE_LLAVE) || '';
  });
  const [poemas, setPoemas] = useState(null);
  const [social, setSocial] = useState({});
  const [desde, setDesde] = useState(0); // momento del último cambio guardado
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');
  const [edicion, setEdicion] = useState(null); // { inicial, original }
  const hoy = useMemo(() => hoyEn(SITIO.zonaHoraria), []);

  async function cargar(k = llave) {
    setError('');
    try {
      const r = await listarPoemas(k);
      setSocial(r.social);
      setPoemas(r.poemas);
    } catch (e) {
      setError(e.message);
      if (e.llaveMala) { guardar(CLAVE_LLAVE, null); setLlave(''); }
    }
  }
  useEffect(() => { if (llave) cargar(); }, [llave]);

  const terminar = (mensaje) => { setEdicion(null); setAviso(mensaje); setDesde(Date.now()); setPoemas(null); cargar(); };

  /** Pide confirmación y borra. Devuelve false si el poeta se arrepiente. */
  async function borrar(p) {
    const hechas = enRedes(social, p.fecha);
    const redes = hechas.length ? `\n\nYa salió en ${unir(hechas)}: allá seguirá visible.` : '';
    if (!window.confirm(`¿Borrar «${p.titulo}» (${partesFecha(p.fecha).larga})?\n\nDesaparecerá del sitio.${redes}`)) return false;
    await borrarPoema(llave, p);
    terminar(`«${p.titulo}» se borró.`);
    return true;
  }

  async function borrarDeLista(p) {
    setAviso('');
    setError('');
    setOcupado(true);
    try { await borrar(p); } catch (e) { setError(e.message); }
    setOcupado(false);
  }

  function nuevo() {
    setAviso('');
    setError('');
    let borrador = null;
    try { borrador = JSON.parse(leer(CLAVE_BORRADOR)); } catch {}
    const ocupadas = new Set(poemas.map((p) => p.fecha));
    let fecha = hoy;
    while (ocupadas.has(fecha)) fecha = sumarDias(fecha, 1);
    const usarBorrador = borrador && (borrador.titulo || lineas(borrador.html ?? '').length);
    setEdicion({ inicial: usarBorrador ? { titulo: borrador.titulo ?? '', html: borrador.html ?? '', fecha: esFecha(borrador.fecha) && !ocupadas.has(borrador.fecha) && borrador.fecha >= hoy ? borrador.fecha : fecha } : { titulo: '', html: '', fecha } });
  }

  let cuerpo;
  if (!llave) cuerpo = <Llave error={error} alEntrar={(k) => { guardar(CLAVE_LLAVE, k); setLlave(k); }} />;
  else if (!poemas) cuerpo = error ? <div className="adm-caja"><p className="adm-error" role="alert">{error}</p><button className="adm-boton" type="button" onClick={() => cargar()}>Reintentar</button></div> : <p className="adm-nota">Cargando…</p>;
  else if (edicion)
    cuerpo = (
      <Editor
        key={edicion.original?.fecha ?? 'nuevo'}
        {...edicion}
        poemas={poemas}
        social={social}
        hoy={hoy}
        llave={llave}
        alVolver={() => setEdicion(null)}
        alTerminar={terminar}
        alBorrar={borrar}
      />
    );
  else
    cuerpo = (
      <>
        {error && <p className="adm-error adm-error--lista" role="alert">{error}</p>}
        <Lista poemas={poemas} social={social} hoy={hoy} desde={desde} aviso={aviso} ocupado={ocupado} alNuevo={nuevo} alBorrar={borrarDeLista} alAbrir={(p) => { setAviso(''); setError(''); setEdicion({ inicial: p, original: p }); }} />
      </>
    );

  return (
    <div className="adm">
      {cuerpo}
      {llave && !edicion && (
        <button className="adm-enlace adm-salir" type="button" onClick={() => { if (window.confirm('¿Quitar la llave de este aparato?')) { guardar(CLAVE_LLAVE, null); setLlave(''); setPoemas(null); } }}>
          Quitar la llave de este aparato
        </button>
      )}
    </div>
  );
}
