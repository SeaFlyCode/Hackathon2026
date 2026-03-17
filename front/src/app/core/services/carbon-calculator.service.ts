import { Injectable } from '@angular/core';
import { Site } from '../models/site.model';
import { CarbonBreakdown } from '../models/carbon-result.model';

// Facteurs d'émission ADEME (kgCO2e par tonne de matériau)
const MATERIAL_FACTORS: Record<string, number> = {
  'béton': 120,
  'acier': 1850,
  'verre': 900,
  'bois': -1600, // stockage carbone
  'aluminium': 8900,
};

// kgCO2e par MWh d'électricité (facteur France ADEME 2024)
const ENERGY_FACTOR_KWH = 0.052; // kgCO2e/kWh
const ENERGY_FACTOR_MWH = ENERGY_FACTOR_KWH * 1000;

// kgCO2e par place de parking (construction béton ~30t béton/place)
const PARKING_FACTOR = 3600; // kgCO2e par place

// kgCO2e par employé/an (déplacements domicile-travail moyens France)
const EMPLOYEE_COMMUTE_FACTOR = 1200; // kgCO2e/an/employé

// kgCO2e par poste de travail informatique/an (facteur ADEME simplifié)
const WORKSTATION_FACTOR = 150; // kgCO2e/an/poste

@Injectable({ providedIn: 'root' })
export class CarbonCalculatorService {
  calculate(site: Site): CarbonBreakdown {
    // Construction matériaux
    const byMaterial = site.materials.map(m => ({
      material: m.type,
      kgCO2e: m.quantityTons * (MATERIAL_FACTORS[m.type] ?? 0)
    }));
    const materialsTotal = byMaterial.reduce((sum, m) => sum + m.kgCO2e, 0);
    const parkingCO2 = site.parkingSpots * PARKING_FACTOR;
    const constructionTotal = materialsTotal + parkingCO2;

    // Exploitation annuelle
    const energyCO2 = site.annualEnergyMWh * ENERGY_FACTOR_MWH;
    const employeesCO2 = site.employees * EMPLOYEE_COMMUTE_FACTOR;
    const workstationsCO2 = (site.workstations ?? 0) * WORKSTATION_FACTOR;
    const exploitationTotal = energyCO2 + employeesCO2 + workstationsCO2;

    const total = constructionTotal + exploitationTotal;

    return {
      construction: { total: constructionTotal, byMaterial, parking: parkingCO2 },
      exploitation: {
        total: exploitationTotal,
        energy: energyCO2,
        employees: employeesCO2,
        workstations: workstationsCO2,
      },
      total,
      perM2: site.surfaceM2 > 0 ? total / site.surfaceM2 : 0,
      perEmployee: site.employees > 0 ? total / site.employees : 0,
    };
  }
}
