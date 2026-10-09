/** Reloj único de la simulación: todo el mundo (invitados, nubes, banderas)
 *  lee de aquí, así que la pausa congela el parque entero. */

let t = 0;

export function simTick(dt: number, playing: boolean, speed: number) {
  if (playing) t += Math.min(dt, 0.05) * speed;
}

export function simTime() {
  return t;
}

export function simReset() {
  t = 0;
}
