const ledgerService = require('../services/ledgerService');

// @desc    Create a ledger transaction
// @route   POST /api/ledger/transactions
// @access  Private
exports.createTransaction = async (req, res, next) => {
  try {
    const { transactionType, entries, referenceType, referenceId, metadata } = req.body;

    if (!transactionType || !entries || !Array.isArray(entries) || entries.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'transactionType and entries array are required',
      });
    }

    const result = await ledgerService.createTransaction({
      transactionType,
      entries,
      referenceType,
      referenceId,
      createdBy: req.user.id,
      metadata,
    });

    res.status(201).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get account balance
// @route   GET /api/ledger/accounts/:accountId/balance
// @access  Private
exports.getAccountBalance = async (req, res, next) => {
  try {
    const { accountId } = req.params;
    const { accountType } = req.query;

    if (!accountType) {
      return res.status(400).json({
        success: false,
        error: 'accountType query parameter is required',
      });
    }

    const balance = await ledgerService.getAccountBalancePublic(accountId, accountType);

    res.status(200).json({
      success: true,
      data: {
        accountId,
        accountType,
        balance,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get user points balance
// @route   GET /api/ledger/points/balance
// @access  Private
exports.getUserPoints = async (req, res, next) => {
  try {
    const accountId = `user_points:${req.user.id}`;
    const balance = await ledgerService.getAccountBalancePublic(accountId, 'ASSET');

    res.status(200).json({
      success: true,
      data: {
        userId: req.user.id,
        points: balance,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Reconcile accounts
// @route   POST /api/ledger/reconcile
// @access  Private (Admin only - add admin check if needed)
exports.reconcileAccounts = async (req, res, next) => {
  try {
    const { accountIds } = req.body;

    const result = await ledgerService.reconcileAccounts(accountIds);

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get transaction history
// @route   GET /api/ledger/transactions
// @access  Private
exports.getTransactionHistory = async (req, res, next) => {
  try {
    const {
      accountId,
      referenceType,
      referenceId,
      startDate,
      endDate,
      limit = 100,
      offset = 0,
    } = req.query;

    const filters = {
      accountId,
      referenceType,
      referenceId,
      startDate,
      endDate,
      limit: parseInt(limit),
      offset: parseInt(offset),
    };

    const transactions = await ledgerService.getTransactionHistory(filters);

    res.status(200).json({
      success: true,
      count: transactions.length,
      data: transactions,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get audit trail
// @route   GET /api/ledger/audit
// @access  Private (Admin only - add admin check if needed)
exports.getAuditTrail = async (req, res, next) => {
  try {
    const {
      transactionId,
      entityType,
      entityId,
      startDate,
      endDate,
      limit = 100,
      offset = 0,
    } = req.query;

    const filters = {
      transactionId,
      entityType,
      entityId,
      startDate,
      endDate,
      limit: parseInt(limit),
      offset: parseInt(offset),
    };

    const auditLogs = await ledgerService.getAuditTrail(filters);

    res.status(200).json({
      success: true,
      count: auditLogs.length,
      data: auditLogs,
    });
  } catch (error) {
    next(error);
  }
};

