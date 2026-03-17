import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDividerModule } from '@angular/material/divider';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { BaseChartDirective } from 'ng2-charts';
import { ChartData, ChartOptions } from 'chart.js';
import { SiteService } from '../../core/services/site.service';
import { Site } from '../../core/models/site.model';
import { CarbonBreakdown } from '../../core/models/carbon-result.model';
import { forkJoin } from 'rxjs';

@Component({
  selector: 'app-result',
  standalone: true,
  imports: [CommonModule, RouterLink, MatCardModule, MatButtonModule, MatIconModule, MatDividerModule, MatProgressSpinnerModule, BaseChartDirective],
  templateUrl: './result.component.html',
  styleUrl: './result.component.scss'
})
export class ResultComponent implements OnInit {
  site?: Site;
  result?: CarbonBreakdown;
  loading = true;
  error: string | null = null;

  pieData: ChartData<'pie'> = { labels: [], datasets: [{ data: [] }] };
  barData: ChartData<'bar'> = { labels: [], datasets: [] };

  pieOptions: ChartOptions<'pie'> = {
    responsive: true,
    plugins: { legend: { position: 'bottom' } }
  };

  barOptions: ChartOptions<'bar'> = {
    responsive: true,
    plugins: { legend: { display: false } },
    scales: { y: { beginAtZero: true } }
  };

  constructor(private route: ActivatedRoute, private siteService: SiteService, public router: Router) {}

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id')!;
    forkJoin([
      this.siteService.getById(id),
      this.siteService.getResultAsync(id),
    ]).subscribe({
      next: ([site, result]: [Site, CarbonBreakdown]) => {
        this.site = site;
        this.result = result;
        this.loading = false;
        this.buildCharts();
      },
      error: (err: unknown) => {
        console.error('Erreur chargement résultat:', err);
        this.error = 'Impossible de charger les résultats.';
        this.loading = false;
      }
    });
  }

  buildCharts(): void {
    const r = this.result!;
    this.pieData = {
      labels: ['Construction', 'Énergie', 'Déplacements', 'Postes de travail'],
      datasets: [{
        data: [r.construction.total, r.exploitation.energy, r.exploitation.employees, r.exploitation.workstations],
        backgroundColor: ['#0070ad', '#00b050', '#ff6600', '#6B48FF']
      }]
    };
    this.barData = {
      labels: r.construction.byMaterial.map(m => m.material),
      datasets: [{
        label: 'kgCO₂e',
        data: r.construction.byMaterial.map(m => m.kgCO2e),
        backgroundColor: '#0070ad'
      }]
    };
  }

  formatTons(kg: number): string {
    return (kg / 1000).toFixed(1) + ' tCO₂e';
  }

  exportPDF(): void {
    import('jspdf').then(({ jsPDF }) => {
      const doc = new jsPDF();
      doc.setFontSize(20);
      doc.text('Rapport Empreinte Carbone', 20, 20);
      doc.setFontSize(14);
      doc.text(`Site : ${this.site?.name}`, 20, 35);
      doc.text(`Total : ${this.formatTons(this.result!.total)}`, 20, 45);
      doc.text(`CO2/m2 : ${this.result!.perM2.toFixed(1)} kgCO2e/m2`, 20, 55);
      doc.text(`CO2/employe : ${this.result!.perEmployee.toFixed(1)} kgCO2e/emp.`, 20, 65);
      doc.text(`Construction : ${this.formatTons(this.result!.construction.total)}`, 20, 80);
      doc.text(`Exploitation : ${this.formatTons(this.result!.exploitation.total)}`, 20, 90);
      doc.save(`rapport-${this.site?.name}.pdf`);
    });
  }
}
