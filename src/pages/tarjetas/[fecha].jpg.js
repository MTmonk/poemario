import { poemasPublicados } from '../../lib/poemas.mjs';
import { dibujarTarjeta } from '../../lib/tarjeta.mjs';

export const getStaticPaths = () => poemasPublicados().map((poema) => ({ params: { fecha: poema.fecha }, props: { poema } }));

export const GET = async ({ props }) =>
  new Response(await dibujarTarjeta(props.poema, 'tarjeta'), { headers: { 'Content-Type': 'image/jpeg' } });
