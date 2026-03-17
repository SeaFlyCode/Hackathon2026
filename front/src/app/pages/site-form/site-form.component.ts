import { Component } from '@angular/core';
import { FormBuilder, FormGroup, FormArray, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatDividerModule } from '@angular/material/divider';
import { MatStepperModule, MatStepper } from '@angular/material/stepper';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { CommonModule } from '@angular/common';
import { SiteService } from '../../core/services/site.service';
import { Site } from '../../core/models/site.model';

@Component({
  selector: 'app-site-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, MatCardModule, MatFormFieldModule, MatInputModule, MatButtonModule, MatIconModule, MatSelectModule, MatDividerModule, MatStepperModule, MatProgressSpinnerModule],
  templateUrl: './site-form.component.html',
  styleUrl: './site-form.component.scss'
})
export class SiteFormComponent {
  infoForm: FormGroup;
  materialsForm: FormGroup;
  loading = false;
  error: string | null = null;

  materialTypes = ['béton', 'acier', 'verre', 'bois', 'aluminium'];

  constructor(private fb: FormBuilder, private siteService: SiteService, private router: Router) {
    this.infoForm = this.fb.group({
      name: ['', Validators.required],
      location: [''],
      surfaceM2: [null, [Validators.required, Validators.min(1)]],
      parkingSpots: [null, [Validators.required, Validators.min(0)]],
      annualEnergyMWh: [null, [Validators.required, Validators.min(0)]],
      employees: [null, [Validators.required, Validators.min(1)]],
      workstations: [null, [Validators.required, Validators.min(1)]],
    });

    this.materialsForm = this.fb.group({
      materials: this.fb.array([this.createMaterial()])
    });
  }

  get materials(): FormArray {
    return this.materialsForm.get('materials') as FormArray;
  }

  createMaterial(): FormGroup {
    return this.fb.group({
      type: ['béton', Validators.required],
      quantityTons: [null, [Validators.required, Validators.min(0)]]
    });
  }

  addMaterial(): void { this.materials.push(this.createMaterial()); }
  removeMaterial(i: number): void { this.materials.removeAt(i); }

  goToStep2(stepper: MatStepper): void {
    if (this.infoForm.invalid) {
      this.infoForm.markAllAsTouched();
      return;
    }
    stepper.next();
  }

  onSubmit(): void {
    if (this.infoForm.invalid || this.materialsForm.invalid) return;
    this.loading = true;
    this.error = null;
    const siteData = { ...this.infoForm.value, materials: this.materials.value };
    this.siteService.addSite(siteData).subscribe({
      next: (site: Site) => {
        this.router.navigate(['/sites', site.id, 'result']);
      },
      error: (err: unknown) => {
        console.error('Erreur création site:', err);
        this.error = 'Erreur lors de la création du site. Veuillez réessayer.';
        this.loading = false;
      }
    });
  }
}
