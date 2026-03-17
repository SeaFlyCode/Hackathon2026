import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { MatChipsModule } from '@angular/material/chips';
import { SiteService } from '../../core/services/site.service';

@Component({
  selector: 'app-sites-list',
  standalone: true,
  imports: [CommonModule, RouterLink, MatCardModule, MatButtonModule, MatIconModule, MatTableModule, MatChipsModule],
  templateUrl: './sites-list.component.html',
  styleUrl: './sites-list.component.scss'
})
export class SitesListComponent {
  displayedColumns = ['name', 'location', 'surface', 'employees', 'total', 'perM2', 'actions'];

  constructor(public siteService: SiteService) {}

  getTotalCO2(id: string): number {
    return this.siteService.getResult(id)?.total ?? 0;
  }

  getCO2PerM2(id: string): number {
    return this.siteService.getResult(id)?.perM2 ?? 0;
  }

  getLevel(kgPerM2: number): 'green' | 'orange' | 'red' {
    if (kgPerM2 < 200) return 'green';
    if (kgPerM2 < 500) return 'orange';
    return 'red';
  }

  deleteSite(id: string, name: string): void {
    if (confirm(`Supprimer le site "${name}" ? Cette action est irréversible.`)) {
      this.siteService.deleteSite(id).subscribe({
        error: (err: unknown) => console.error('Erreur suppression:', err)
      });
    }
  }
}
