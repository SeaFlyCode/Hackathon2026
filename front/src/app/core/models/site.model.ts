export interface Material {
  type: 'béton' | 'acier' | 'verre' | 'bois' | 'aluminium';
  quantityTons: number;
}

export interface Site {
  id: string;
  name: string;
  location: string;
  surfaceM2: number;
  parkingSpots: number;
  annualEnergyMWh: number;
  employees: number;
  workstations: number;
  materials: Material[];
  createdAt: Date;
}
