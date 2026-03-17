const pool = require('../db/pool');

// Facteurs d'émission ADEME (kgCO2e par tonne) - cohérents avec le front
const MATERIAL_FACTORS = {
  'béton': 120,
  'acier': 1850,
  'verre': 900,
  'bois': -1600,
  'aluminium': 8900,
};
const ENERGY_FACTOR_MWH = 52; // kgCO2e/MWh (France)
const PARKING_FACTOR = 3600; // kgCO2e/place
const EMPLOYEE_COMMUTE_FACTOR = 1200; // kgCO2e/an/employé
const WORKSTATION_FACTOR = 150; // kgCO2e/an/poste

function calculateCarbon(site, materials) {
  const totalParkingSpots = (site.parking_sous_dalle || 0) + (site.parking_sous_sol || 0) + (site.parking_aeriens || 0);

  // Construction matériaux
  const byMaterial = materials.map(m => ({
    material: m.material_name,
    kgCO2e: m.quantity * (MATERIAL_FACTORS[m.material_name.toLowerCase()] ?? 0)
  }));
  const materialsTotal = byMaterial.reduce((sum, m) => sum + m.kgCO2e, 0);
  const parkingCO2 = totalParkingSpots * PARKING_FACTOR;
  const constructionTotal = materialsTotal + parkingCO2;

  // Exploitation annuelle
  const energyCO2 = (site.annual_energy_consumption_mwh || 0) * ENERGY_FACTOR_MWH;
  const employeesCO2 = (site.employees_count || 0) * EMPLOYEE_COMMUTE_FACTOR;
  const workstationsCO2 = (site.workstations_count || 0) * WORKSTATION_FACTOR;
  const exploitationTotal = energyCO2 + employeesCO2 + workstationsCO2;

  const total = constructionTotal + exploitationTotal;
  const perM2 = site.surface_area > 0 ? total / site.surface_area : 0;
  const perEmployee = (site.employees_count || 0) > 0 ? total / site.employees_count : 0;

  return {
    construction: { total: constructionTotal, byMaterial, parking: parkingCO2 },
    exploitation: { total: exploitationTotal, energy: energyCO2, employees: employeesCO2, workstations: workstationsCO2 },
    total,
    perM2,
    perEmployee,
  };
}

const getAll = async (req, res, next) => {
  try {
    const { rows: sites } = await pool.query('SELECT * FROM sites ORDER BY created_at DESC');

    // Récupérer les matériaux pour chaque site
    const sitesWithMaterials = await Promise.all(sites.map(async (site) => {
      const { rows: materials } = await pool.query(
        `SELECT sm.id, sm.quantity, ef.name as material_name, ef.unit, ef.co2_equivalent_per_unit
         FROM site_materials sm
         JOIN emission_factors ef ON ef.id = sm.emission_factor_id
         WHERE sm.site_id = $1`,
        [site.id]
      );
      return mapSiteToFront(site, materials);
    }));

    res.json(sitesWithMaterials);
  } catch (err) {
    next(err);
  }
};

const getById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { rows } = await pool.query('SELECT * FROM sites WHERE id = $1', [id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Site non trouvé' });

    const site = rows[0];
    const { rows: materials } = await pool.query(
      `SELECT sm.id, sm.quantity, ef.name as material_name, ef.unit, ef.co2_equivalent_per_unit
       FROM site_materials sm
       JOIN emission_factors ef ON ef.id = sm.emission_factor_id
       WHERE sm.site_id = $1`,
      [id]
    );

    res.json(mapSiteToFront(site, materials));
  } catch (err) {
    next(err);
  }
};

const create = async (req, res, next) => {
  const client = await pool.connect();
  try {
    const { name, location, surfaceM2, parkingSpots, annualEnergyMWh, employees, workstations, materials } = req.body;

    await client.query('BEGIN');

    // Insérer le site
    const { rows } = await client.query(
      `INSERT INTO sites (name, surface_area, employees_count, workstations_count,
        parking_aeriens, annual_energy_consumption_mwh)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [name, surfaceM2, employees, workstations, parkingSpots || 0, annualEnergyMWh]
    );
    const site = rows[0];

    // Insérer les matériaux
    const savedMaterials = [];
    if (materials && materials.length > 0) {
      for (const mat of materials) {
        // Chercher le facteur d'émission correspondant au nom du matériau
        const { rows: efRows } = await client.query(
          'SELECT * FROM emission_factors WHERE LOWER(name) = LOWER($1) AND category = $2',
          [mat.type, 'MATERIAL']
        );

        let efId;
        if (efRows.length > 0) {
          efId = efRows[0].id;
        } else {
          // Créer un facteur d'émission générique si inconnu
          const factor = MATERIAL_FACTORS[mat.type] ?? 0;
          const { rows: newEf } = await client.query(
            `INSERT INTO emission_factors (name, category, unit, co2_equivalent_per_unit, source)
             VALUES ($1, 'MATERIAL', 'tonne', $2, 'ADEME 2024') RETURNING *`,
            [mat.type, factor]
          );
          efId = newEf[0].id;
        }

        const { rows: smRows } = await client.query(
          `INSERT INTO site_materials (site_id, emission_factor_id, quantity)
           VALUES ($1, $2, $3)
           ON CONFLICT (site_id, emission_factor_id) DO UPDATE SET quantity = EXCLUDED.quantity
           RETURNING *`,
          [site.id, efId, mat.quantityTons]
        );
        savedMaterials.push({ ...smRows[0], material_name: mat.type });
      }
    }

    // Calculer et stocker le bilan carbone
    const carbon = calculateCarbon(site, savedMaterials);
    await client.query(
      `INSERT INTO carbon_assessments (site_id, construction_co2, operation_co2, total_co2, co2_per_m2, co2_per_employee)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [site.id, carbon.construction.total, carbon.exploitation.total, carbon.total, carbon.perM2, carbon.perEmployee]
    );

    await client.query('COMMIT');

    res.status(201).json(mapSiteToFront(site, savedMaterials));
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
};

const deleteSite = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { rowCount } = await pool.query('DELETE FROM sites WHERE id = $1', [id]);
    if (rowCount === 0) return res.status(404).json({ error: 'Site non trouvé' });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
};

const getResult = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Récupérer le site
    const { rows: siteRows } = await pool.query('SELECT * FROM sites WHERE id = $1', [id]);
    if (siteRows.length === 0) return res.status(404).json({ error: 'Site non trouvé' });
    const site = siteRows[0];

    // Récupérer les matériaux
    const { rows: materials } = await pool.query(
      `SELECT sm.id, sm.quantity, ef.name as material_name, ef.unit, ef.co2_equivalent_per_unit
       FROM site_materials sm
       JOIN emission_factors ef ON ef.id = sm.emission_factor_id
       WHERE sm.site_id = $1`,
      [id]
    );

    // Recalculer (ou récupérer le dernier assessment)
    const { rows: assessments } = await pool.query(
      'SELECT * FROM carbon_assessments WHERE site_id = $1 ORDER BY assessment_date DESC LIMIT 1',
      [id]
    );

    if (assessments.length > 0) {
      const a = assessments[0];
      // Reconstruire le breakdown complet
      const carbon = calculateCarbon(site, materials);
      res.json(carbon);
    } else {
      const carbon = calculateCarbon(site, materials);
      res.json(carbon);
    }
  } catch (err) {
    next(err);
  }
};

// Mapper les données DB (snake_case) vers le format front (camelCase)
function mapSiteToFront(site, materials) {
  const totalParkingSpots = (site.parking_sous_dalle || 0) + (site.parking_sous_sol || 0) + (site.parking_aeriens || 0);
  return {
    id: site.id,
    name: site.name,
    location: site.location || '',
    surfaceM2: parseFloat(site.surface_area),
    parkingSpots: totalParkingSpots,
    annualEnergyMWh: parseFloat(site.annual_energy_consumption_mwh) || 0,
    employees: site.employees_count || 0,
    workstations: site.workstations_count || 0,
    materials: materials.map(m => ({
      type: m.material_name.toLowerCase(),
      quantityTons: parseFloat(m.quantity),
    })),
    createdAt: site.created_at,
  };
}

module.exports = { getAll, getById, create, deleteSite, getResult };
