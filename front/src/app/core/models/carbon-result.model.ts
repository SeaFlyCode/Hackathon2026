export interface CarbonBreakdown {
  construction: {
    total: number;
    byMaterial: { material: string; kgCO2e: number }[];
    parking: number;
  };
  exploitation: {
    total: number;
    energy: number;
    employees: number;
    workstations: number;
  };
  total: number;
  perM2: number;
  perEmployee: number;
}
