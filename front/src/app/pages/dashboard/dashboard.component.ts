import { Component, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { BaseChartDirective } from 'ng2-charts';
import { ChartData, ChartOptions, Chart, registerables } from 'chart.js';
import { SiteService } from '../../core/services/site.service';

Chart.register(...registerables);

// Palette de couleurs pour les barres (extensible)
const BAR_COLORS = [
  '#0070AD', '#00A3A1', '#F4A022', '#E63329',
  '#6B48FF', '#00C853', '#FF6D00', '#AA00FF',
  '#0097A7', '#558B2F', '#E91E63', '#FF5722',
];

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink, MatCardModule, MatButtonModule, MatIconModule, BaseChartDirective],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss'
})
export class DashboardComponent {

  // ── KPIs calculés de façon réactive ──────────────────────────────────────
  readonly totalSites = computed(() => this.siteService.sites().length);

  readonly totalEmployees = computed(() =>
    this.siteService.sites().reduce((s, site) => s + site.employees, 0)
  );

  readonly results = computed(() =>
    this.siteService.sites()
      .map(s => ({ site: s, result: this.siteService.getResult(s.id)! }))
      .filter(r => r.result)
  );

  readonly totalCO2Tons = computed(() => {
    const totalKg = this.results().reduce((s, r) => s + r.result.total, 0);
    return totalKg / 1000;
  });

  readonly avgCO2PerM2 = computed(() => {
    const totalKg = this.results().reduce((s, r) => s + r.result.total, 0);
    const totalSurface = this.siteService.sites().reduce((s, site) => s + site.surfaceM2, 0);
    return totalSurface > 0 ? totalKg / totalSurface : 0;
  });

  /** Site le plus polluant (kgCO₂e/m²) */
  readonly worstSite = computed(() => {
    const list = this.results();
    if (list.length === 0) return null;
    return list.reduce((worst, r) =>
      r.result.perM2 > worst.result.perM2 ? r : worst
    );
  });

  // ── Données graphique barres ──────────────────────────────────────────────
  readonly barData = computed<ChartData<'bar'>>(() => {
    const list = this.results();
    return {
      labels: list.map(r => r.site.name),
      datasets: [{
        label: 'Total CO₂ (tCO₂e)',
        data: list.map(r => r.result.total / 1000),
        backgroundColor: list.map((_, i) => BAR_COLORS[i % BAR_COLORS.length]),
        borderRadius: 6,
      }]
    };
  });

  // ── Données graphique doughnut ────────────────────────────────────────────
  readonly doughnutData = computed<ChartData<'doughnut'>>(() => {
    const list = this.results();
    const constructionTotal = list.reduce((s, r) => s + r.result.construction.total, 0);
    const energyTotal = list.reduce((s, r) => s + r.result.exploitation.energy, 0);
    const employeesTotal = list.reduce((s, r) => s + r.result.exploitation.employees, 0);
    const workstationsTotal = list.reduce((s, r) => s + r.result.exploitation.workstations, 0);
    return {
      labels: ['Construction', 'Énergie', 'Déplacements', 'Postes de travail'],
      datasets: [{
        data: [
          constructionTotal / 1000,
          energyTotal / 1000,
          employeesTotal / 1000,
          workstationsTotal / 1000,
        ],
        backgroundColor: ['#0070AD', '#00A3A1', '#F4A022', '#6B48FF']
      }]
    };
  });

  // ── Options des charts ────────────────────────────────────────────────────
  readonly barOptions: ChartOptions<'bar'> = {
    responsive: true,
    plugins: { legend: { display: false } },
    scales: { y: { beginAtZero: true, title: { display: true, text: 'tCO₂e' } } }
  };

  readonly doughnutOptions: ChartOptions<'doughnut'> = {
    responsive: true,
    plugins: { legend: { position: 'bottom' } }
  };

  constructor(public siteService: SiteService) {}
}
