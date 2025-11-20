const { getPool } = require('../config/postgres');
const { v4: uuidv4 } = require('uuid');

/**
 * Double-entry accounting service with ACID compliance
 */
class LedgerService {
  /**
   * Create a transaction with double-entry accounting
   * @param {Object} params - Transaction parameters
   * @param {String} params.transactionType - Type of transaction
   * @param {Array} params.entries - Array of ledger entries [{accountId, accountType, debit, credit, description}]
   * @param {String} params.referenceType - Type of reference (e.g., 'TASK')
   * @param {String} params.referenceId - ID of the reference
   * @param {String} params.createdBy - User ID who created the transaction
   * @param {Object} params.metadata - Additional metadata
   * @returns {Promise<Object>} Transaction result
   */
  async createTransaction(params) {
    const {
      transactionType,
      entries,
      referenceType,
      referenceId,
      createdBy,
      metadata = {},
    } = params;

    const pool = getPool();
    const client = await pool.connect();
    const transactionId = uuidv4();

    try {
      await client.query('BEGIN');

      // Validate double-entry: total debits must equal total credits
      const totalDebits = entries.reduce((sum, e) => sum + parseFloat(e.debit || 0), 0);
      const totalCredits = entries.reduce((sum, e) => sum + parseFloat(e.credit || 0), 0);

      if (Math.abs(totalDebits - totalCredits) > 0.01) {
        throw new Error(
          `Double-entry validation failed: Debits (${totalDebits}) must equal Credits (${totalCredits})`
        );
      }

      // Validate all entries have required fields
      for (const entry of entries) {
        if (!entry.accountId || !entry.accountType) {
          throw new Error('All entries must have accountId and accountType');
        }
        if ((!entry.debit || entry.debit === 0) && (!entry.credit || entry.credit === 0)) {
          throw new Error('Each entry must have either a debit or credit amount');
        }
        if (entry.debit && entry.debit < 0) {
          throw new Error('Debit amounts cannot be negative');
        }
        if (entry.credit && entry.credit < 0) {
          throw new Error('Credit amounts cannot be negative');
        }
      }

      // Insert transaction record
      await client.query(
        `INSERT INTO transactions (id, transaction_type, status, description, reference_type, reference_id, metadata, created_by)
         VALUES ($1, $2, 'PENDING', $3, $4, $5, $6, $7)`,
        [
          transactionId,
          transactionType,
          metadata.description || `${transactionType} transaction`,
          referenceType,
          referenceId,
          JSON.stringify(metadata),
          createdBy,
        ]
      );

      // Process each ledger entry
      const ledgerEntries = [];
      for (const entry of entries) {
        const debit = parseFloat(entry.debit || 0);
        const credit = parseFloat(entry.credit || 0);

        // Calculate new balance based on account type
        const currentBalance = await this.getAccountBalance(client, entry.accountId, entry.accountType);
        let newBalance = currentBalance;

        // Update balance based on account type rules
        if (['ASSET', 'EXPENSE'].includes(entry.accountType)) {
          // Assets and Expenses: Debit increases, Credit decreases
          newBalance = currentBalance + debit - credit;
        } else {
          // Liabilities, Equity, Revenue: Credit increases, Debit decreases
          newBalance = currentBalance + credit - debit;
        }

        // Insert ledger entry
        const ledgerResult = await client.query(
          `INSERT INTO ledger_entries 
           (transaction_id, account_id, account_type, debit, credit, balance, description, reference_type, reference_id, metadata, created_by)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
           RETURNING *`,
          [
            transactionId,
            entry.accountId,
            entry.accountType,
            debit,
            credit,
            newBalance,
            entry.description || '',
            referenceType,
            referenceId,
            JSON.stringify(entry.metadata || {}),
            createdBy,
          ]
        );

        // Update account balance
        await client.query(
          `INSERT INTO account_balances (account_id, account_type, balance, last_transaction_id, updated_at)
           VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
           ON CONFLICT (account_id) 
           DO UPDATE SET balance = $3, last_transaction_id = $4, updated_at = CURRENT_TIMESTAMP`,
          [entry.accountId, entry.accountType, newBalance, transactionId]
        );

        ledgerEntries.push(ledgerResult.rows[0]);
      }

      // Commit transaction
      await client.query(
        `UPDATE transactions SET status = 'COMMITTED', committed_at = CURRENT_TIMESTAMP WHERE id = $1`,
        [transactionId]
      );

      // Create audit log entry
      await this.createAuditLog(client, {
        transactionId,
        action: 'TRANSACTION_CREATED',
        entityType: referenceType,
        entityId: referenceId,
        newValues: {
          transactionId,
          transactionType,
          entries: ledgerEntries,
        },
        changedBy: createdBy,
      });

      await client.query('COMMIT');

      return {
        transactionId,
        status: 'COMMITTED',
        entries: ledgerEntries,
        totalDebits,
        totalCredits,
      };
    } catch (error) {
      await client.query('ROLLBACK');
      
      // Update transaction status to rolled back
      try {
        await client.query(
          `UPDATE transactions SET status = 'ROLLED_BACK' WHERE id = $1`,
          [transactionId]
        );
      } catch (updateError) {
        console.error('Error updating transaction status:', updateError);
      }

      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get account balance
   */
  async getAccountBalance(client, accountId, accountType) {
    const result = await client.query(
      'SELECT balance FROM account_balances WHERE account_id = $1',
      [accountId]
    );

    if (result.rows.length === 0) {
      // Initialize account with zero balance
      await client.query(
        `INSERT INTO account_balances (account_id, account_type, balance) 
         VALUES ($1, $2, 0)`,
        [accountId, accountType]
      );
      return 0;
    }

    return parseFloat(result.rows[0].balance) || 0;
  }

  /**
   * Get account balance (public method)
   */
  async getAccountBalancePublic(accountId, accountType) {
    const pool = getPool();
    const client = await pool.connect();
    try {
      return await this.getAccountBalance(client, accountId, accountType);
    } finally {
      client.release();
    }
  }

  /**
   * Reconcile accounts - verify that all transactions balance
   */
  async reconcileAccounts(accountIds = null) {
    const pool = getPool();
    const client = await pool.connect();

    try {
      let query = `
        SELECT 
          account_id,
          account_type,
          SUM(debit) as total_debits,
          SUM(credit) as total_credits,
          MAX(balance) as calculated_balance
        FROM ledger_entries
      `;
      const params = [];

      if (accountIds && accountIds.length > 0) {
        query += ` WHERE account_id = ANY($1)`;
        params.push(accountIds);
      }

      query += ` GROUP BY account_id, account_type ORDER BY account_id`;

      const result = await client.query(query, params);
      const reconciliation = [];

      for (const row of result.rows) {
        const accountId = row.account_id;
        const storedBalance = await this.getAccountBalance(client, accountId, row.account_type);

        // Calculate balance from ledger entries
        const calculatedBalance = parseFloat(row.calculated_balance) || 0;
        const totalDebits = parseFloat(row.total_debits) || 0;
        const totalCredits = parseFloat(row.total_credits) || 0;

        const isBalanced = Math.abs(storedBalance - calculatedBalance) < 0.01;

        reconciliation.push({
          accountId,
          accountType: row.account_type,
          storedBalance,
          calculatedBalance,
          totalDebits,
          totalCredits,
          isBalanced,
          discrepancy: storedBalance - calculatedBalance,
        });
      }

      return {
        reconciled: reconciliation.every((r) => r.isBalanced),
        accounts: reconciliation,
        timestamp: new Date().toISOString(),
      };
    } finally {
      client.release();
    }
  }

  /**
   * Get transaction history
   */
  async getTransactionHistory(filters = {}) {
    const pool = getPool();
    const { accountId, referenceType, referenceId, startDate, endDate, limit = 100, offset = 0 } = filters;

    let query = `
      SELECT 
        le.*,
        t.transaction_type,
        t.status as transaction_status,
        t.created_at as transaction_created_at
      FROM ledger_entries le
      JOIN transactions t ON le.transaction_id = t.id
      WHERE 1=1
    `;
    const params = [];
    let paramCount = 0;

    if (accountId) {
      paramCount++;
      query += ` AND le.account_id = $${paramCount}`;
      params.push(accountId);
    }

    if (referenceType) {
      paramCount++;
      query += ` AND le.reference_type = $${paramCount}`;
      params.push(referenceType);
    }

    if (referenceId) {
      paramCount++;
      query += ` AND le.reference_id = $${paramCount}`;
      params.push(referenceId);
    }

    if (startDate) {
      paramCount++;
      query += ` AND le.created_at >= $${paramCount}`;
      params.push(startDate);
    }

    if (endDate) {
      paramCount++;
      query += ` AND le.created_at <= $${paramCount}`;
      params.push(endDate);
    }

    query += ` ORDER BY le.created_at DESC LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`;
    params.push(limit, offset);

    const result = await pool.query(query, params);
    return result.rows;
  }

  /**
   * Get audit trail
   */
  async getAuditTrail(filters = {}) {
    const pool = getPool();
    const { transactionId, entityType, entityId, startDate, endDate, limit = 100, offset = 0 } = filters;

    let query = `
      SELECT * FROM audit_log WHERE 1=1
    `;
    const params = [];
    let paramCount = 0;

    if (transactionId) {
      paramCount++;
      query += ` AND transaction_id = $${paramCount}`;
      params.push(transactionId);
    }

    if (entityType) {
      paramCount++;
      query += ` AND entity_type = $${paramCount}`;
      params.push(entityType);
    }

    if (entityId) {
      paramCount++;
      query += ` AND entity_id = $${paramCount}`;
      params.push(entityId);
    }

    if (startDate) {
      paramCount++;
      query += ` AND changed_at >= $${paramCount}`;
      params.push(startDate);
    }

    if (endDate) {
      paramCount++;
      query += ` AND changed_at <= $${paramCount}`;
      params.push(endDate);
    }

    query += ` ORDER BY changed_at DESC LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`;
    params.push(limit, offset);

    const result = await pool.query(query, params);
    return result.rows;
  }

  /**
   * Create audit log entry
   */
  async createAuditLog(client, logData) {
    const {
      transactionId,
      action,
      entityType,
      entityId,
      oldValues,
      newValues,
      changedBy,
      ipAddress,
      userAgent,
    } = logData;

    await client.query(
      `INSERT INTO audit_log 
       (transaction_id, action, entity_type, entity_id, old_values, new_values, changed_by, ip_address, user_agent)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        transactionId,
        action,
        entityType,
        entityId,
        oldValues ? JSON.stringify(oldValues) : null,
        newValues ? JSON.stringify(newValues) : null,
        changedBy,
        ipAddress,
        userAgent,
      ]
    );
  }

  /**
   * Record points earned from task completion
   */
  async recordTaskCompletion(taskId, userId, points, taskMetadata = {}) {
    const userPointsAccount = `user_points:${userId}`;
    const systemRevenueAccount = 'system:revenue:task_completion';

    return await this.createTransaction({
      transactionType: 'TASK_COMPLETION',
      entries: [
        {
          accountId: userPointsAccount,
          accountType: 'ASSET',
          debit: points,
          credit: 0,
          description: `Points earned for completing task ${taskId}`,
          metadata: taskMetadata,
        },
        {
          accountId: systemRevenueAccount,
          accountType: 'REVENUE',
          debit: 0,
          credit: points,
          description: `Revenue from task completion ${taskId}`,
          metadata: taskMetadata,
        },
      ],
      referenceType: 'TASK',
      referenceId: taskId,
      createdBy: userId,
      metadata: {
        taskId,
        userId,
        points,
        ...taskMetadata,
      },
    });
  }
}

module.exports = new LedgerService();

