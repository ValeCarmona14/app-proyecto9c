import { AfterViewInit, Component, ElementRef, Input, OnChanges, ViewChild } from '@angular/core';
import * as d3 from 'd3';

export interface DatoLinea {
  fecha: Date;
  valor: number;
}

/**
 * PLANTILLA 2: "Most basic line chart" de la D3 Graph Gallery
 * https://d3-graph-gallery.com/graph/line_basic.html
 *
 * Cambios respecto a la plantilla:
 *  - Los datos vienen por @Input (un punto por día) en lugar de un CSV.
 *  - Se agregó un área suave debajo de la línea y puntos en los días con entreno.
 *  - Fechas en formato día/mes y SVG adaptable con viewBox.
 */
@Component({
  selector: 'app-grafica-lineas',
  template: '<div #lienzo class="lienzo"></div>',
  styles: [':host { display: block; } .lienzo { width: 100%; }'],
  standalone: false,
})
export class GraficaLineasComponent implements AfterViewInit, OnChanges {
  @Input() datos: DatoLinea[] = [];
  @Input() unidad = '';
  @ViewChild('lienzo', { static: true }) lienzo!: ElementRef<HTMLDivElement>;

  ngAfterViewInit() { this.dibujar(); }
  ngOnChanges() { if (this.lienzo) this.dibujar(); }

  private dibujar() {
    // set the dimensions and margins of the graph
    const margin = { top: 16, right: 16, bottom: 32, left: 44 };
    const width = 460 - margin.left - margin.right;
    const height = 260 - margin.top - margin.bottom;

    const cont = d3.select(this.lienzo.nativeElement);
    cont.selectAll('*').remove();

    const svg = cont
      .append('svg')
      .attr('viewBox', `0 0 ${width + margin.left + margin.right} ${height + margin.top + margin.bottom}`)
      .attr('role', 'img')
      .attr('aria-label', `Entrenamiento de los últimos ${this.datos.length} días`)
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // Add X axis --> it is a date format
    const x = d3.scaleTime()
      .domain(d3.extent(this.datos, d => d.fecha) as [Date, Date])
      .range([0, width]);
    svg.append('g')
      .attr('transform', `translate(0,${height})`)
      .call(d3.axisBottom<Date>(x).ticks(5).tickFormat(d3.timeFormat('%d/%m')).tickSize(0).tickPadding(10))
      .call(g => g.select('.domain').attr('stroke', '#e2c2c6'))
      .selectAll('text')
      .attr('fill', '#9c528b')
      .style('font-size', '12px')
      .style('font-weight', '700');

    // Add Y axis
    const tope = Math.max(d3.max(this.datos, d => d.valor) ?? 0, 1);
    const y = d3.scaleLinear().domain([0, tope]).nice().range([height, 0]);
    svg.append('g')
      .call(d3.axisLeft(y).ticks(5).tickFormat(d3.format('~s')).tickSize(-width))
      .call(g => g.select('.domain').remove())
      .call(g => g.selectAll('.tick line').attr('stroke', '#e2c2c6').attr('stroke-dasharray', '2,4'))
      .selectAll('text')
      .attr('fill', '#b9929f')
      .style('font-size', '12px');

    // Área debajo de la línea
    svg.append('path')
      .datum(this.datos)
      .attr('fill', 'rgba(171, 114, 149, 0.18)')
      .attr('d', d3.area<DatoLinea>()
        .x(d => x(d.fecha))
        .y0(height)
        .y1(d => y(d.valor))
        .curve(d3.curveMonotoneX));

    // Add the line
    svg.append('path')
      .datum(this.datos)
      .attr('fill', 'none')
      .attr('stroke', '#610f7f')
      .attr('stroke-width', 3)
      .attr('stroke-linecap', 'round')
      .attr('d', d3.line<DatoLinea>()
        .x(d => x(d.fecha))
        .y(d => y(d.valor))
        .curve(d3.curveMonotoneX));

    // Puntos solo en los días que sí entrenaste
    svg.selectAll('circle.punto')
      .data(this.datos.filter(d => d.valor > 0))
      .join('circle')
      .attr('class', 'punto')
      .attr('cx', d => x(d.fecha))
      .attr('cy', d => y(d.valor))
      .attr('r', 4.5)
      .attr('fill', '#fbf5f6')
      .attr('stroke', '#610f7f')
      .attr('stroke-width', 2.5)
      .append('title')
      .text(d => `${d3.timeFormat('%d/%m')(d.fecha)}: ${d.valor.toLocaleString('es-MX')} ${this.unidad}`);
  }
}
