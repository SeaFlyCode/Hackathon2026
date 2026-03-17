# CarbonTrack — Capgemini

Outil de calcul et de comparaison de l'empreinte carbone des sites physiques Capgemini.
Développé dans le cadre du Hackathon 2026.

---

## Équipe

| Nom |
|---|
| Grégoire YAKEUCHAGHEN |
| Julian CHRISTMANN |
| Nathan HUMEAU |
| Mathéo VIEILLEVILLE |
| Gildas LONTSI |
| Quentin BOURDOIS |

---

## Architecture

```
Hackaton2026/
├── front/          # Application Angular 21 (SPA)
└── back/           # API REST Node.js / Express
```

La base de données PostgreSQL est hébergée sur **Neon** (cloud).

---

## Prérequis

- Node.js >= 18
- npm >= 10

---

## Installation

### Back-end

```bash
cd back
npm install
```

Créer un fichier `back/.env` :

```env
DATABASE_URL=postgresql://api_user:<password>@ep-rapid-flower-agkjb7m5-pooler.c-2.eu-central-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require
JWT_SECRET=your_jwt_secret
PORT=3000
```

### Front-end

```bash
cd front
npm install
```

---

## Lancement

Ouvrir **deux terminaux** :

```bash
# Terminal 1 — Back-end (port 3000)
cd back
node server.js

# Terminal 2 — Front-end (port 4200)
cd front
npm start
```

→ Accéder à l'application : [http://localhost:4200](http://localhost:4200)

> ⚠️ Si le port 3000 est déjà occupé : `lsof -i :3000` puis `kill <PID>`

---

## Connexion

| Email | Mot de passe |
|---|---|
| admin@capgemini.com | admin |

---

## Fonctionnalités

| Page | Description |
|---|---|
| **Dashboard** | KPIs globaux (total CO₂, sites, employés) + graphiques bar/doughnut |
| **Sites** | Liste des sites, suppression |
| **Nouveau site** | Formulaire 2 étapes (infos générales + matériaux) avec calcul carbone |
| **Résultat** | Détail du bilan carbone d'un site (construction, énergie, déplacements) |
| **Comparer** | Comparaison multi-sites — 3 tableaux + graphique groupé |

---

## Stack technique

### Front-end
| Technologie | Version | Usage |
|---|---|---|
| Angular | 21 | Framework SPA |
| Angular Material | 21 | Composants UI |
| Chart.js / ng2-charts | 4 / 10 | Graphiques |
| RxJS | 7.8 | Gestion asynchrone |
| jsPDF | 4 | Export PDF |

### Back-end
| Technologie | Version | Usage |
|---|---|---|
| Node.js / Express | 5 | API REST |
| pg | 8 | Client PostgreSQL |
| bcryptjs | 3 | Hash des mots de passe |
| jsonwebtoken | 9 | Authentification JWT |
| dotenv | 17 | Variables d'environnement |

### Base de données
| Technologie | Usage |
|---|---|
| PostgreSQL (Neon) | Stockage sites, matériaux, bilans carbone |

---

## API

Toutes les routes sont préfixées par `/api`.

| Méthode | Route | Description | Auth |
|---|---|---|---|
| `POST` | `/auth/login` | Connexion — retourne un JWT | Non |
| `GET` | `/sites` | Liste tous les sites | JWT |
| `GET` | `/sites/:id` | Détail d'un site | JWT |
| `POST` | `/sites` | Créer un site | JWT |
| `DELETE` | `/sites/:id` | Supprimer un site | JWT |
| `GET` | `/sites/:id/result` | Bilan carbone d'un site | JWT |
| `GET` | `/emission-factors` | Facteurs d'émission ADEME | JWT |
| `GET` | `/health` | Healthcheck | Non |

---

## Calcul carbone

Les émissions sont calculées selon les facteurs ADEME 2024 :

### Matériaux de construction
| Matériau | Facteur (kgCO₂e/tonne) |
|---|---|
| Béton | 120 |
| Acier | 1 850 |
| Verre | 900 |
| Bois | -1 600 *(séquestration)* |
| Aluminium | 8 900 |

### Exploitation
| Poste | Facteur |
|---|---|
| Énergie | 52 kgCO₂e / MWh (mix France) |
| Parking | 3 600 kgCO₂e / place |
| Déplacements domicile-travail | 1 200 kgCO₂e / employé / an |
| Postes de travail | 150 kgCO₂e / poste / an |

---

## Schéma base de données

```
users               → authentification
sites               → informations des bâtiments
emission_factors    → facteurs d'émission ADEME
site_materials      → matériaux utilisés par site
carbon_assessments  → bilans carbone calculés
```
