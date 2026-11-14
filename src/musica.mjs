// Lista de música del sitio. Sólo grabaciones de dominio público o con licencia libre:
// cada pista lleva su licencia y la página de origen que la acredita (Wikimedia Commons).
// Los archivos están en public/musica/. Si la lista está vacía, el reproductor no se muestra.
const commons = (archivo) => `https://commons.wikimedia.org/wiki/File:${archivo}`;

export const PISTAS = [
  { archivo: 'bach-goldberg-aria.mp3', autor: 'J. S. Bach', titulo: 'Variaciones Goldberg: Aria', interprete: 'Kimiko Ishizaka, piano (Open Goldberg Variations)', licencia: 'CC0', fuente: commons('Kimiko_Ishizaka_-_01_-_Aria.ogg') },
  { archivo: 'oliver-krooked-blues.mp3', autor: 'King Oliver’s Creole Jazz Band', titulo: 'Krooked Blues (1923)', interprete: 'Con Louis Armstrong, corneta', licencia: 'Dominio público', fuente: commons('King_Oliver%27s_Creole_Jazz_Band--_%22Krooked_Blues%22_(1923).ogg') },
  { archivo: 'vivaldi-primavera.mp3', autor: 'Antonio Vivaldi', titulo: 'Las cuatro estaciones: La primavera, Allegro', interprete: 'John Harrison, violín; Wichita State University Chamber Players, dir. Robert Turizziani', licencia: 'CC BY-SA 4.0', fuente: commons('Vivaldi_-_Four_Seasons_1_Spring_mvt_1_Allegro_-_John_Harrison_violin.oga') },
  { archivo: 'chopin-nocturno-op9-2.mp3', autor: 'Frédéric Chopin', titulo: 'Nocturno op. 9 n.º 2', interprete: 'Frank Lévy, piano (Musopen, «Set Chopin Free»)', licencia: 'Dominio público', fuente: commons('Chopin_-_Nocturne_No._2_in_E-flat_major,_Op._9_No._2_(Frank_Levy).flac') },
  { archivo: 'macleod-bass-walker.mp3', autor: 'Kevin MacLeod', titulo: 'Bass Walker', interprete: 'Kevin MacLeod (incompetech.com)', licencia: 'CC BY 3.0', fuente: commons('Bass_Walker_(ISRC_USUAN1200071).mp3') },
  { archivo: 'beethoven-claro-de-luna.mp3', autor: 'Ludwig van Beethoven', titulo: 'Sonata «Claro de luna»: Adagio sostenuto', interprete: 'Paul Pitman, piano (Musopen)', licencia: 'Dominio público', fuente: commons('Ludwig_van_Beethoven_-_sonata_no._14_in_c_sharp_minor_%27moonlight%27,_op._27_no._2_-_i._adagio_sostenuto.ogg') },
  { archivo: 'liszt-sueno-de-amor.mp3', autor: 'Franz Liszt', titulo: 'Sueño de amor n.º 3', interprete: 'Martha Goldstein, piano Érard de 1851', licencia: 'CC BY-SA 2.0', fuente: commons('Franz_Liszt_-_Liebestraum,_Ab_Major.ogg') },
  { archivo: 'macleod-salsa.mp3', autor: 'Kevin MacLeod', titulo: 'No Frills Salsa', interprete: 'Kevin MacLeod (incompetech.com)', licencia: 'CC BY 3.0', fuente: commons('No_Frills_Salsa_(ISRC_USUAN1100133).mp3') },
  { archivo: 'mozart-romanze.mp3', autor: 'W. A. Mozart', titulo: 'Pequeña serenata nocturna: Romanze', interprete: 'Grabación de Musopen', licencia: 'Dominio público', fuente: commons('Mozart_-_Serenade_No._13_for_strings_in_G_major,_K._525_-_Romanze.ogg') },
  { archivo: 'beiderbecke-riverboat-shuffle.mp3', autor: 'Bix Beiderbecke y la Wolverine Orchestra', titulo: 'Riverboat Shuffle (1924)', interprete: 'Grabación original de 1924', licencia: 'Dominio público', fuente: commons('Riverboat_Shuffle_-_Bix_Beiderbecke_%26_Wolverine_Orchestra_(1924).ogg') },
  { archivo: 'scarlatti-k380.mp3', autor: 'Domenico Scarlatti', titulo: 'Sonata K. 380', interprete: 'John Sankey, clave', licencia: 'Uso libre con atribución', fuente: commons('Scarlatti_K_380.ogg') },
  { archivo: 'macleod-cumbia.mp3', autor: 'Kevin MacLeod', titulo: 'No Frills Cumbia', interprete: 'Kevin MacLeod (incompetech.com)', licencia: 'CC BY 3.0', fuente: commons('No_Frills_Cumbia_(ISRC_USUAN1100275).mp3') },
  { archivo: 'macleod-backed-vibes.mp3', autor: 'Kevin MacLeod', titulo: 'Backed Vibes', interprete: 'Kevin MacLeod (incompetech.com)', licencia: 'CC BY 3.0', fuente: commons('Kevin_MacLeod_-_Backed_Vibes_Clean.ogg') },
];
