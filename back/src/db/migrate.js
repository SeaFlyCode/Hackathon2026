const pool = require('./pool');

async function migrate() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Extension UUID
    await client.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

    // 2. Users
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        role VARCHAR(50) DEFAULT 'USER',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 3. Emission factors
    await client.query(`
      CREATE TABLE IF NOT EXISTS emission_factors (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        name VARCHAR(100) NOT NULL,
        category VARCHAR(50) NOT NULL,
        unit VARCHAR(20) NOT NULL,
        co2_equivalent_per_unit NUMERIC(10, 4) NOT NULL,
        source VARCHAR(100)
      )
    `);

    // 4. Sites (avec colonne location ajoutée)
    await client.query(`
      CREATE TABLE IF NOT EXISTS sites (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        name VARCHAR(255) NOT NULL,
        location VARCHAR(255),
        surface_area NUMERIC(10, 2) NOT NULL,
        employees_count INTEGER,
        workstations_count INTEGER,
        parking_sous_dalle INTEGER DEFAULT 0,
        parking_sous_sol INTEGER DEFAULT 0,
        parking_aeriens INTEGER DEFAULT 0,
        annual_energy_consumption_mwh NUMERIC(10, 2),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 5. Site materials
    await client.query(`
      CREATE TABLE IF NOT EXISTS site_materials (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        site_id UUID REFERENCES sites(id) ON DELETE CASCADE,
        emission_factor_id UUID REFERENCES emission_factors(id),
        quantity NUMERIC(12, 2) NOT NULL,
        CONSTRAINT unique_site_material UNIQUE (site_id, emission_factor_id)
      )
    `);

    // 6. Carbon assessments
    await client.query(`
      CREATE TABLE IF NOT EXISTS carbon_assessments (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        site_id UUID REFERENCES sites(id) ON DELETE CASCADE,
        assessment_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        construction_co2 NUMERIC(15, 2) NOT NULL,
        operation_co2 NUMERIC(15, 2) NOT NULL,
        total_co2 NUMERIC(15, 2) NOT NULL,
        co2_per_m2 NUMERIC(10, 2),
        co2_per_employee NUMERIC(10, 2)
      )
    `);

    await client.query('COMMIT');
    console.log('✓ Migration terminée');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('✗ Erreur migration:', err);
    throw err;
  } finally {
    client.release();
  }
}

async function seed() {
  const client = await pool.connect();
  try {
    // Vérifier si les facteurs existent déjà
    const { rows } = await client.query('SELECT COUNT(*) FROM emission_factors');
    if (parseInt(rows[0].count) > 0) {
      console.log('✓ Seed déjà effectué (emission_factors non vide)');
      return;
    }

    await client.query('BEGIN');

    // Facteurs d'émission ADEME 2024
    const factors = [
      // Matériaux de construction (kgCO2e par tonne)
      { name: 'béton', category: 'MATERIAL', unit: 'tonne', co2: 120, source: 'ADEME 2024' },
      { name: 'acier', category: 'MATERIAL', unit: 'tonne', co2: 1850, source: 'ADEME 2024' },
      { name: 'verre', category: 'MATERIAL', unit: 'tonne', co2: 900, source: 'ADEME 2024' },
      { name: 'bois', category: 'MATERIAL', unit: 'tonne', co2: -1600, source: 'ADEME 2024' },
      { name: 'aluminium', category: 'MATERIAL', unit: 'tonne', co2: 8900, source: 'ADEME 2024' },
      // Énergie (kgCO2e par MWh)
      { name: 'Électricité France', category: 'ENERGY', unit: 'MWh', co2: 52, source: 'ADEME 2024' },
    ];

    for (const f of factors) {
      await client.query(
        `INSERT INTO emission_factors (name, category, unit, co2_equivalent_per_unit, source)
         VALUES ($1, $2, $3, $4, $5)`,
        [f.name, f.category, f.unit, f.co2, f.source]
      );
    }

    // User admin par défaut
    const bcrypt = require('bcryptjs');
    const hash = await bcrypt.hash('admin', 10);
    await client.query(
      `INSERT INTO users (email, password_hash, role) VALUES ($1, $2, $3)
       ON CONFLICT (email) DO NOTHING`,
      ['admin@capgemini.com', hash, 'ADMIN']
    );

    await client.query('COMMIT');
    console.log('✓ Seed terminé (facteurs ADEME + user admin)');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('✗ Erreur seed:', err);
    throw err;
  } finally {
    client.release();
  }
}

async function run() {
  await migrate();
  await seed();
  await pool.end();
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
