/**
 * Frases para la tarjeta "Palabra del día".
 * Versículos en la Reina-Valera 1909 (dominio público) + frases propias.
 * Agrega o cambia las que quieras; la app elige una por día.
 */
export interface Frase {
  texto: string;
  fuente: string;
  tipo: 'biblia' | 'motivacion';
}

export const FRASES: Frase[] = [
  { tipo: 'biblia', texto: 'Todo lo puedo en Cristo que me fortalece.', fuente: 'Filipenses 4:13' },
  { tipo: 'motivacion', texto: 'No tienes que hacerlo perfecto, solo tienes que volver a hacerlo hoy.', fuente: 'FitHábitos' },
  { tipo: 'biblia', texto: 'Jehová es mi pastor; nada me faltará.', fuente: 'Salmos 23:1' },
  { tipo: 'motivacion', texto: 'La disciplina es acordarte de lo que quieres cuando no tienes ganas.', fuente: 'FitHábitos' },
  { tipo: 'biblia', texto: 'Encomienda a Jehová tus obras, y tus pensamientos serán afirmados.', fuente: 'Proverbios 16:3' },
  { tipo: 'motivacion', texto: 'Un vaso de agua, una página, una serie más. Así se construye todo.', fuente: 'FitHábitos' },
  { tipo: 'biblia', texto: 'Pero los que esperan a Jehová tendrán nuevas fuerzas; levantarán las alas como águilas, correrán, y no se cansarán.', fuente: 'Isaías 40:31' },
  { tipo: 'motivacion', texto: 'El descanso también es parte del entrenamiento.', fuente: 'FitHábitos' },
  { tipo: 'biblia', texto: 'Mira que te mando que te esfuerces y seas valiente; no temas ni desmayes, porque Jehová tu Dios será contigo en donde quiera que fueres.', fuente: 'Josué 1:9' },
  { tipo: 'motivacion', texto: 'Compárate solo con quien eras ayer.', fuente: 'FitHábitos' },
  { tipo: 'biblia', texto: 'Así que, no os congojéis por el día de mañana; que el día de mañana traerá su fatiga: basta al día su afán.', fuente: 'Mateo 6:34' },
  { tipo: 'motivacion', texto: 'Los días malos también cuentan si no te rindes en ellos.', fuente: 'FitHábitos' },
];

/** Misma frase para todo el día; cambia al día siguiente. */
export function fraseDelDia(fecha: string, desplazamiento = 0): Frase {
  const [a, m, d] = fecha.split('-').map(Number);
  const diaDelAnio = Math.floor((Date.UTC(a, m - 1, d) - Date.UTC(a, 0, 0)) / 86400000);
  const i = (((diaDelAnio + desplazamiento) % FRASES.length) + FRASES.length) % FRASES.length;
  return FRASES[i];
}
