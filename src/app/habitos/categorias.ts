import { Habito } from '../models/api.models';

export type Categoria = Habito['categoria'];

/** Datos de cada categoría para mostrarla en pantalla. */
export const CATEGORIAS: { valor: Categoria; nombre: string; icono: string; color: string; unidad: string }[] = [
  { valor: 'hidratacion', nombre: 'Hidratación', icono: 'water-outline', color: '#3a86ff', unidad: 'vasos' },
  { valor: 'ejercicio', nombre: 'Ejercicio', icono: 'barbell-outline', color: '#610f7f', unidad: 'minutos' },
  { valor: 'alimentacion', nombre: 'Alimentación', icono: 'nutrition-outline', color: '#2a9d8f', unidad: 'porciones' },
  { valor: 'mental', nombre: 'Mental', icono: 'sparkles-outline', color: '#ab7295', unidad: 'minutos' },
  { valor: 'sueno', nombre: 'Sueño', icono: 'moon-outline', color: '#480863', unidad: 'horas' },
];

export function categoria(valor: Categoria) {
  return CATEGORIAS.find(c => c.valor === valor) ?? CATEGORIAS[0];
}
