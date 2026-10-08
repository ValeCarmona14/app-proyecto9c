import { AfterViewInit, Component, ElementRef, Input, OnChanges, ViewChild } from '@angular/core';
import * as d3 from 'd3';

export interface DatoDona {
  nombre: string;
  valor: number;
  color: string;
}

/**
 * PLANTILLA 3: "Most basic donut chart" de la D3 Graph Gallery
 * https://d3-graph-gallery.com/graph/donut_basic.html
 *
 * Cambios respecto a la plantilla:
 *  - d3.entries() ya no existe en D3 v6+, así que se pasa el arreglo directo a d3.pie().
 *  - Cada hábito trae su propio color (la leyenda se dibuja en el HTML de la página).
 *  - En el centro se muestra un texto (ej. porcentaje de cumplimiento).
 */
@Component({
  selector: 'app-grafica-dona',
  template: '<div #lienzo class="lienzo"></div>',
  styles: [':host { display: block; } .lienzo { width: 100%; max-width: 280px; margin: 0 auto; }'],
  standalone: false,
})
export class GraficaDonaComponent implements AfterViewInit, OnChanges {
  @Input() datos: DatoDona[] = [];
  @Input() centro = '';
  @Input() subCentro = '';
  @ViewChild('lienzo', { static: true }) lienzo!: ElementRef<HTMLDivElement>;

  ngAfterViewInit() { this.dibujar(); }
  ngOnChanges() { if (this.lienzo) this.dibujar(); }

  private dibujar() {
    // set the dimensions and margins of the graph
    const width = 280;
    const height = 280;
    const margin = 10;
    // The radius of the pieplot is half the width or half the height (smallest one)
    const radius = Math.min(width, height) / 2 - margin;

    const cont = d3.select(this.lienzo.nativeElement);
    cont.selectAll('*').remove();

    const svg = cont
      .append('svg')
      .attr('viewBox', `0 0 ${width} ${height}`)
      .attr('role', 'img')
      .attr('aria-label', 'Días cumplidos por hábito')
      .append('g')
      .attr('transform', `translate(${width / 2},${height / 2})`);

    // Compute the position of each group on the pie
    const pie = d3.pie<DatoDona>().value(d => d.valor).sort(null).padAngle(0.025);
    const data_ready = pie(this.datos.filter(d => d.valor > 0));

    const arc = d3.arc<d3.PieArcDatum<DatoDona>>()
      .innerRadius(radius * 0.62) // This is the size of the donut hole
      .outerRadius(radius)
      .cornerRadius(6);

    // Build the pie chart: each part of the pie is a path built with the arc function
    svg.selectAll('path.rebanada')
      .data(data_ready)
      .join('path')
      .attr('class', 'rebanada')
      .attr('d', arc)
      .attr('fill', d => d.data.color)
      .append('title')
      .text(d => `${d.data.nombre}: ${d.data.valor} día(s)`);

    // Texto del centro
    svg.append('text')
      .attr('text-anchor', 'middle')
      .attr('dy', '0.1em')
      .attr('fill', '#2f0147')
      .style('font-size', '44px')
      .style('font-weight', '900')
      .text(this.centro);
    svg.append('text')
      .attr('text-anchor', 'middle')
      .attr('dy', '2.2em')
      .attr('fill', '#9c528b')
      .style('font-size', '13px')
      .style('font-weight', '700')
      .text(this.subCentro);
  }
}
