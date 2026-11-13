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
  if (r.status === 401) throw Object.assign(new Error('La llave no es válida o ya caducó.'), { llaveMala: true });
  if (r.status === 403 || r.status === 404) throw new Error('La llave no tiene permiso para escribir en el sitio. Pídele a Mario una llave nueva.');
  if (r.status === 409 || r.status === 422) throw new Error('El poema cambió mientras lo editabas. Vuelve a la lista y ábrelo de nuevo.');
  if (!r.ok) throw new Error(`GitHub respondió con un error (${r.status}). Inténtalo de nuevo.`);
  return r.status === 204 ? null : r.json();
}

/** Todos los poemas del repositorio (publicados y programados), con su contenido, en una sola consulta. */
async function listarPoemas(llave) {
  const query = `query($dueno:String!,$nombre:String!,$expr:String!){repository(owner:$dueno,name:$nombre){object(expression:$expr){... on Tree{entries{name oid object{... on Blob{text}}}}}}}`;
  const variables = { dueno: SITIO.repoDueno, nombre: SITIO.repoNombre, expr: `${SITIO.rama}:${SITIO.carpetaPoemas}` };
  const r = await github(llave, '/graphql', { method: 'POST', body: { query, variables } });
  if (r.errors?.length) throw new Error('La llave no tiene acceso al sitio. Pídele a Mario una llave nueva.');
  if (!r.data?.repository) throw new Error('La llave no tiene acceso al sitio. Pídele a Mario una llave nueva.');
  const entradas = r.data.repository.object?.entries ?? [];
  return entradas
    .filter((e) => e.name.endsWith('.json') && e.object?.text)
    .flatMap((e) => {
      try { return [{ ...leerPoema(e.object.text, e.name), sha: e.oid }]; } catch { return []; }
    })
    .sort((a, b) => b.fecha.localeCompare(a.fecha));
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

function Lista({ poemas, hoy, alAbrir, alNuevo, aviso }) {
  const programados = poemas.filter((p) => p.fecha > hoy).length;
  return (
    <div>
      {aviso && <p className="adm-aviso" role="status">{aviso}</p>}
      <button className="adm-boton adm-boton--rojo adm-boton--grande" type="button" onClick={alNuevo}>+ Escribir un poema nuevo</button>
      <p className="adm-nota">{poemas.length} poemas en total · {programados} en espera de su día</p>
      <ul className="adm-lista">
        {poemas.map((p) => (
          <li key={p.fecha}>
            <button type="button" onClick={() => alAbrir(p)}>
              <span className="adm-lista__fecha">{partesFecha(p.fecha).larga}</span>
              <span className="adm-lista__titulo">{p.titulo}</span>
              <span className={p.fecha > hoy ? 'adm-estado adm-estado--espera' : 'adm-estado'}>{p.fecha > hoy ? 'En espera' : 'Publicado'}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Editor({ inicial, original, poemas, hoy, llave, alTerminar, alVolver }) {
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
    if (!window.confirm(`¿Borrar «${original.titulo}»? No se puede deshacer.`)) return;
    setOcupado(true);
    try {
      await borrarPoema(llave, original);
      alTerminar(`«${original.titulo}» se borró.`);
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
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');
  const [edicion, setEdicion] = useState(null); // { inicial, original }
  const hoy = useMemo(() => hoyEn(SITIO.zonaHoraria), []);

  async function cargar(k = llave) {
    setError('');
    try {
      setPoemas(await listarPoemas(k));
    } catch (e) {
      setError(e.message);
      if (e.llaveMala) { guardar(CLAVE_LLAVE, null); setLlave(''); }
    }
  }
  useEffect(() => { if (llave) cargar(); }, [llave]);

  function nuevo() {
    setAviso('');
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
        hoy={hoy}
        llave={llave}
        alVolver={() => setEdicion(null)}
        alTerminar={(mensaje) => { setEdicion(null); setAviso(mensaje); setPoemas(null); cargar(); }}
      />
    );
  else cuerpo = <Lista poemas={poemas} hoy={hoy} aviso={aviso} alNuevo={nuevo} alAbrir={(p) => { setAviso(''); setEdicion({ inicial: p, original: p }); }} />;

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
