import { AfterViewInit, Component, ElementRef, Input, OnChanges, ViewChild } from '@angular/core';
import * as d3 from 'd3';

export interface DatoBarra {
  etiqueta: string;   // "lun", "mar"...
  valor: number;      // hábitos cumplidos ese día
  destacado?: boolean; // true = hoy
}

/**
 * PLANTILLA 1: "Most basic barplot" de la D3 Graph Gallery
 * https://d3-graph-gallery.com/graph/barplot_basic.html
 *
 * Cambios respecto a la plantilla:
 *  - Los datos vienen por @Input en lugar de un CSV.
 *  - Las barras crecen desde abajo con una transición (ejemplo
 *    "barplot_animation_start" de la misma galería).
 *  - El SVG usa viewBox para adaptarse al ancho del teléfono.
 *  - Colores de la paleta de la app.
 */
@Component({
  selector: 'app-grafica-barras',
  template: '<div #lienzo class="lienzo"></div>',
  styles: [':host { display: block; } .lienzo { width: 100%; }'],
  standalone: false,
})
export class GraficaBarrasComponent implements AfterViewInit, OnChanges {
  @Input() datos: DatoBarra[] = [];
  @Input() maximo = 0; // tope del eje Y (total de hábitos)
  @ViewChild('lienzo', { static: true }) lienzo!: ElementRef<HTMLDivElement>;

  ngAfterViewInit() { this.dibujar(); }
  ngOnChanges() { if (this.lienzo) this.dibujar(); }

  private dibujar() {
    // set the dimensions and margins of the graph
    const margin = { top: 16, right: 12, bottom: 32, left: 32 };
    const width = 460 - margin.left - margin.right;
    const height = 260 - margin.top - margin.bottom;

    const cont = d3.select(this.lienzo.nativeElement);
    cont.selectAll('*').remove(); // borra el dibujo anterior

    // append the svg object
    const svg = cont
      .append('svg')
      .attr('viewBox', `0 0 ${width + margin.left + margin.right} ${height + margin.top + margin.bottom}`)
      .attr('role', 'img')
      .attr('aria-label', 'Hábitos cumplidos por día en la última semana')
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // X axis
    const x = d3.scaleBand()
      .range([0, width])
      .domain(this.datos.map(d => d.etiqueta))
      .padding(0.3);
    svg.append('g')
      .attr('transform', `translate(0,${height})`)
      .call(d3.axisBottom(x).tickSize(0).tickPadding(10))
      .call(g => g.select('.domain').attr('stroke', '#e2c2c6'))
      .selectAll('text')
      .attr('fill', '#9c528b')
      .style('font-size', '13px')
      .style('font-weight', '700');

    // Y axis
    const tope = Math.max(this.maximo, d3.max(this.datos, d => d.valor) ?? 0, 1);
    const y = d3.scaleLinear().domain([0, tope]).range([height, 0]);
    svg.append('g')
      .call(d3.axisLeft(y).ticks(Math.min(tope, 5)).tickFormat(d3.format('d')).tickSize(-width))
      .call(g => g.select('.domain').remove())
      .call(g => g.selectAll('.tick line').attr('stroke', '#e2c2c6').attr('stroke-dasharray', '2,4'))
      .selectAll('text')
      .attr('fill', '#b9929f')
      .style('font-size', '12px');

    // Bars (empiezan en altura 0 y crecen)
    svg.selectAll('rect.barra')
      .data(this.datos)
      .join('rect')
      .attr('class', 'barra')
      .attr('x', d => x(d.etiqueta)!)
      .attr('width', x.bandwidth())
      .attr('rx', 8)
      .attr('fill', d => (d.destacado ? '#610f7f' : '#ab7295'))
      .attr('y', height)
      .attr('height', 0)
      .call(sel => sel.append('title').text(d => `${d.etiqueta}: ${d.valor} hábito(s)`))
      .transition()
      .duration(700)
      .delay((_, i) => i * 60)
      .attr('y', d => y(d.valor))
      .attr('height', d => height - y(d.valor));
  }
}
