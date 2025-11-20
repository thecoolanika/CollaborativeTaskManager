const express = require('express');
const {
  createTransaction,
  getAccountBalance,
  getUserPoints,
  reconcileAccounts,
  getTransactionHistory,
  getAuditTrail,
} = require('../controllers/ledgerController');
const { protect } = require('../middleware/auth');

const router = express.Router();

// All routes require authentication
router.use(protect);

router.post('/transactions', createTransaction);
router.get('/accounts/:accountId/balance', getAccountBalance);
router.get('/points/balance', getUserPoints);
router.post('/reconcile', reconcileAccounts);
router.get('/transactions', getTransactionHistory);
router.get('/audit', getAuditTrail);

module.exports = router;

