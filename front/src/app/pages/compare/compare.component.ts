import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatTableModule } from '@angular/material/table';
import { BaseChartDirective } from 'ng2-charts';
import { ChartData, ChartOptions } from 'chart.js';
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
  totalTons: number;
  perM2: number;
  perEmployee: number;
  constructionTons: number;
  energyTons: number;
  commuteTons: number;
  score: number;
  color: string;
}

@Component({
  selector: 'app-compare',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatSelectModule,
    MatFormFieldModule,
    MatTableModule,
    BaseChartDirective,
  ],
  templateUrl: './compare.component.html',
  styleUrl: './compare.component.scss'
})
export class CompareComponent {

  selectedIds: string[] = [];
  compareRows: CompareRow[] = [];
  readonly displayedColumns = ['name', 'total', 'perM2', 'perEmployee', 'construction', 'energy', 'commute', 'score'];
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

    this.compareRows = this.selectedIds
      .map((id, index) => {
        const site = this.siteService.sites().find(s => s.id === id);
        const result = this.siteService.getResult(id);
        if (!site || !result) return null;
        return {
          site,
          result,
          totalTons: result.total / 1000,
          perM2: result.perM2,
          perEmployee: result.perEmployee / 1000,
          constructionTons: result.construction.total / 1000,
          energyTons: result.exploitation.energy / 1000,
          commuteTons: result.exploitation.employees / 1000,
          score: 0,
          color: SITE_COLORS[index % SITE_COLORS.length],
        } as CompareRow;
      })
      .filter((r): r is CompareRow => r !== null);

    if (this.compareRows.length === 0) return;

    const maxPerM2 = Math.max(...this.compareRows.map(r => r.perM2));
    this.compareRows = this.compareRows.map(r => ({
      ...r,
      score: maxPerM2 > 0 ? Math.round(100 - (r.perM2 / maxPerM2 * 100)) : 100,
    }));

    const numericKeys: (keyof CompareRow)[] = ['totalTons', 'perM2', 'perEmployee', 'constructionTons', 'energyTons', 'commuteTons'];
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
  }

  getCellClass(row: CompareRow, key: string): string {
    const val = row[key as keyof CompareRow] as number;
    if (this.compareRows.length < 2) return '';
    if (val === this.minValues[key]) return 'cell-best';
    if (val === this.maxValues[key]) return 'cell-worst';
    return '';
  }
}
