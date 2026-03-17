import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { BaseChartDirective } from 'ng2-charts';
import { ChartData, ChartOptions } from 'chart.js';
import { forkJoin, of } from 'rxjs';
import { SiteService } from '../../core/services/site.service';
import { Site } from '../../core/models/site.model';
import { CarbonBreakdown } from '../../core/models/carbon-result.model';

const SITE_COLORS = [
  '#0070AD', '#00A3A1', '#F4A022', '#E63329',
  '#6B48FF', '#00C853', '#FF6D00', '#AA00FF',
];

export interface CompareRow {
  site: Site;
  result: CarbonBreakdown;
  // Vue globale
  totalTons: number;
  perM2: number;
  perEmployee: number;
  score: number;
  color: string;
  // Détail par poste
  constructionTons: number;
  energyTons: number;
  commuteTons: number;
  constructionPct: number;
  energyPct: number;
  commutePct: number;
}

@Component({
  selector: 'app-compare',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatIconModule,
    MatSelectModule,
    MatFormFieldModule,
    MatProgressSpinnerModule,
    BaseChartDirective,
  ],
  templateUrl: './compare.component.html',
  styleUrl: './compare.component.scss'
})
export class CompareComponent {

  selectedIds: string[] = [];
  compareRows: CompareRow[] = [];
  loading = false;
  error: string | null = null;
  readonly displayedColumns       = ['name', 'total', 'perM2', 'perEmployee', 'score'];
  readonly displayedColumnsDetail = ['name', 'construction', 'energy', 'commute', 'constructionPct', 'energyPct', 'commutePct'];
  readonly displayedColumnsSite   = ['name', 'surface', 'employees', 'workstations', 'energyMWh', 'parking'];
  minValues: Record<string, number> = {};
  maxValues: Record<string, number> = {};

  compareData: ChartData<'bar'> = { labels: [], datasets: [] };
  readonly compareOptions: ChartOptions<'bar'> = {
    responsive: true,
    plugins: { legend: { position: 'top' } },
    scales: { y: { beginAtZero: true, title: { display: true, text: 'tCO₂e' } } }
  };

  get canCompare(): boolean {
    return this.selectedIds.length >= 2;
  }

  constructor(public siteService: SiteService) {}

  compare(): void {
    if (!this.canCompare) return;
    this.loading = true;
    this.error = null;
    this.compareRows = [];

    console.log('[Compare] selectedIds:', this.selectedIds);
    console.log('[Compare] sites signal:', this.siteService.sites());

    const resultCalls: Record<string, ReturnType<SiteService['getResultAsync']>> = {};
    this.selectedIds.forEach(id => {
      const cached = this.siteService.getResult(id);
      console.log(`[Compare] cache for ${id}:`, cached);
      resultCalls[id] = cached ? of(cached) : this.siteService.getResultAsync(id);
    });

    forkJoin(resultCalls).subscribe({
      next: (resultsMap) => {
        console.log('[Compare] resultsMap:', resultsMap);
        const rows: CompareRow[] = this.selectedIds
          .map((id, index) => {
            const site = this.siteService.sites().find(s => s.id === id);
            const result = resultsMap[id];
            if (!site || !result) {
              console.warn(`[Compare] missing site=${!!site} result=${!!result} for id=${id}`);
              return null;
            }
            const constructionTons = result.construction.total / 1000;
            const energyTons       = result.exploitation.energy / 1000;
            const commuteTons      = result.exploitation.employees / 1000;
            const totalTons        = result.total / 1000;
            const safeTotal        = totalTons > 0 ? totalTons : 1;
            return {
              site,
              result,
              totalTons,
              perM2: result.perM2,
              perEmployee: result.perEmployee / 1000,
              constructionTons,
              energyTons,
              commuteTons,
              constructionPct: Math.round(constructionTons / safeTotal * 100),
              energyPct:       Math.round(energyTons       / safeTotal * 100),
              commutePct:      Math.round(commuteTons      / safeTotal * 100),
              score: 0,
              color: SITE_COLORS[index % SITE_COLORS.length],
            } as CompareRow;
          })
          .filter((r): r is CompareRow => r !== null);

        console.log('[Compare] rows built:', rows.length, rows);
        if (rows.length === 0) {
          this.error = 'Impossible de charger les résultats pour les sites sélectionnés.';
        console.log('[Compare] compareRows final:', this.compareRows.length);
        this.loading = false;
          return;
        }

        const maxPerM2 = Math.max(...rows.map(r => r.perM2));
        this.compareRows = rows.map(r => ({
          ...r,
          score: maxPerM2 > 0 ? Math.round(100 - (r.perM2 / maxPerM2 * 100)) : 100,
        }));

        const numericKeys: (keyof CompareRow)[] = ['totalTons', 'perM2', 'perEmployee', 'constructionTons', 'energyTons', 'commuteTons', 'constructionPct', 'energyPct', 'commutePct'];
        numericKeys.forEach(key => {
          const values = this.compareRows.map(r => r[key] as number);
          this.minValues[key as string] = Math.min(...values);
          this.maxValues[key as string] = Math.max(...values);
        });

        const categories = ['Total', 'Construction', 'Énergie', 'Déplacements'];
        this.compareData = {
          labels: categories,
          datasets: this.compareRows.map(r => ({
            label: r.site.name,
            data: [r.totalTons, r.constructionTons, r.energyTons, r.commuteTons],
            backgroundColor: r.color,
          }))
        };

        this.loading = false;
      },
      error: (err: unknown) => {
        console.error('Erreur comparaison:', err);
        this.error = 'Erreur lors du chargement des résultats. Veuillez réessayer.';
        this.loading = false;
      }
    });
  }

  getCellClass(row: CompareRow, key: string): string {
    const val = row[key as keyof CompareRow] as number;
    if (this.compareRows.length < 2) return '';
    if (val === this.minValues[key]) return 'cell-best';
    if (val === this.maxValues[key]) return 'cell-worst';
    return '';
  }
}
