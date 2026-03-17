const express = require('express');
const router = express.Router();
const healthController = require('../controllers/healthController');
const authController = require('../controllers/authController');
const sitesController = require('../controllers/sitesController');
const emissionFactorsController = require('../controllers/emissionFactorsController');

// Health
router.get('/health', healthController.getHealth);

// Auth
router.post('/auth/login', authController.login);

// Sites
router.get('/sites', sitesController.getAll);
router.get('/sites/:id', sitesController.getById);
router.post('/sites', sitesController.create);
router.delete('/sites/:id', sitesController.deleteSite);
router.get('/sites/:id/result', sitesController.getResult);

// Emission factors
router.get('/emission-factors', emissionFactorsController.getAll);

module.exports = router;
