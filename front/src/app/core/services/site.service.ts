import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap, map, forkJoin } from 'rxjs';
import { Site } from '../models/site.model';
import { CarbonBreakdown } from '../models/carbon-result.model';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class SiteService {
  private _sites = signal<Site[]>([]);
  sites = this._sites.asReadonly();

  private _results = signal<Map<string, CarbonBreakdown>>(new Map());
  results = this._results.asReadonly();

  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {
    this.loadSites();
  }

  private loadSites(): void {
    this.http.get<Site[]>(`${this.apiUrl}/sites`).subscribe({
      next: (sites) => {
        const mapped = sites.map(s => ({ ...s, createdAt: new Date(s.createdAt) }));
        this._sites.set(mapped);
        if (mapped.length > 0) {
          const calls: Record<string, Observable<CarbonBreakdown>> = {};
          mapped.forEach(s => {
            calls[s.id] = this.http.get<CarbonBreakdown>(`${this.apiUrl}/sites/${s.id}/result`);
          });
          forkJoin(calls).subscribe({
            next: (resultsMap) => {
              this._results.set(new Map(Object.entries(resultsMap)));
            },
            error: (err: unknown) => console.error('Erreur chargement résultats:', err),
          });
        }
      },
      error: (err: unknown) => console.error('Erreur chargement sites:', err),
    });
  }

  getById(id: string): Observable<Site> {
    return this.http.get<Site>(`${this.apiUrl}/sites/${id}`).pipe(
      map(s => ({ ...s, createdAt: new Date(s.createdAt) }))
    );
  }

  getResult(id: string): CarbonBreakdown | undefined {
    return this._results().get(id);
  }

  getResultAsync(id: string): Observable<CarbonBreakdown> {
    return this.http.get<CarbonBreakdown>(`${this.apiUrl}/sites/${id}/result`);
  }

  addSite(site: Omit<Site, 'id' | 'createdAt'>): Observable<Site> {
    return this.http.post<Site>(`${this.apiUrl}/sites`, site).pipe(
      tap(newSite => {
        const mapped = { ...newSite, createdAt: new Date(newSite.createdAt) };
        this._sites.update(sites => [mapped, ...sites]);
        this.http.get<CarbonBreakdown>(`${this.apiUrl}/sites/${newSite.id}/result`).subscribe({
          next: (result) => {
            const map = new Map(this._results());
            map.set(newSite.id, result);
            this._results.set(map);
          }
        });
      })
    );
  }

  deleteSite(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/sites/${id}`).pipe(
      tap(() => {
        this._sites.update(sites => sites.filter(s => s.id !== id));
        const map = new Map(this._results());
        map.delete(id);
        this._results.set(map);
      })
    );
  }

  refresh(): void {
    this.loadSites();
  }
}
