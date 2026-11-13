// Convierte un .docx en un poema del sitio, sin pasar por el administrador.
// Uso: node scripts/importar-docx.mjs ruta/al/poema.docx AAAA-MM-DD
import { writeFileSync } from 'node:fs';
import mammoth from 'mammoth';
import { desdeDocx, leerPoema } from '../src/lib/poema.mjs';

const [docx, fecha] = process.argv.slice(2);
if (!docx || !fecha) {
  console.error('Uso: node scripts/importar-docx.mjs ruta/al/poema.docx AAAA-MM-DD');
  process.exit(1);
}
const { value } = await mammoth.convertToHtml({ path: docx }, { ignoreEmptyParagraphs: false });
const poema = leerPoema({ ...desdeDocx(value), fecha }, docx);
const destino = new URL(`../poemas/${fecha}.json`, import.meta.url);
writeFileSync(destino, JSON.stringify(poema, null, 2) + '\n');
console.log(`Guardado poemas/${fecha}.json — «${poema.titulo}»`);
