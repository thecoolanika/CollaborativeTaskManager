const { Pool } = require('pg');

let pool = null;

const connectPostgres = async () => {
  try {
    pool = new Pool({
      host: process.env.POSTGRES_HOST || 'localhost',
      port: process.env.POSTGRES_PORT || 5432,
      database: process.env.POSTGRES_DB || 'taskledger',
      user: process.env.POSTGRES_USER || 'postgres',
      password: process.env.POSTGRES_PASSWORD || 'postgres',
      max: 20, // Maximum number of clients in the pool
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });

    // Test connection
    const client = await pool.connect();
    console.log('PostgreSQL Connected');
    
    // Initialize database schema
    await initializeSchema(client);
    
    client.release();
    return pool;
  } catch (error) {
    console.error('PostgreSQL connection error:', error.message);
    throw error;
  }
};

const initializeSchema = async (client) => {
  try {
    // Create ledger_entries table
    await client.query(`
      CREATE TABLE IF NOT EXISTS ledger_entries (
        id SERIAL PRIMARY KEY,
        transaction_id VARCHAR(255) NOT NULL,
        account_id VARCHAR(255) NOT NULL,
        account_type VARCHAR(50) NOT NULL CHECK (account_type IN ('ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE')),
        debit DECIMAL(15, 2) DEFAULT 0,
        credit DECIMAL(15, 2) DEFAULT 0,
        balance DECIMAL(15, 2) NOT NULL,
        description TEXT,
        reference_type VARCHAR(50),
        reference_id VARCHAR(255),
        metadata JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_by VARCHAR(255)
      )
    `);

    // Create indexes for ledger_entries
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_ledger_transaction_id ON ledger_entries(transaction_id)
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_ledger_account_id ON ledger_entries(account_id)
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_ledger_created_at ON ledger_entries(created_at)
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_ledger_reference ON ledger_entries(reference_type, reference_id)
    `);

    // Create transactions table for transaction metadata
    await client.query(`
      CREATE TABLE IF NOT EXISTS transactions (
        id VARCHAR(255) PRIMARY KEY,
        transaction_type VARCHAR(50) NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'COMMITTED', 'ROLLED_BACK')),
        description TEXT,
        reference_type VARCHAR(50),
        reference_id VARCHAR(255),
        metadata JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_by VARCHAR(255),
        committed_at TIMESTAMP
      )
    `);

    // Create indexes for transactions
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status)
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON transactions(created_at)
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_transactions_reference ON transactions(reference_type, reference_id)
    `);

    // Create account_balances table for quick balance lookups
    await client.query(`
      CREATE TABLE IF NOT EXISTS account_balances (
        account_id VARCHAR(255) PRIMARY KEY,
        account_type VARCHAR(50) NOT NULL,
        balance DECIMAL(15, 2) DEFAULT 0,
        last_transaction_id VARCHAR(255),
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create index for account_balances
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_account_balances_type ON account_balances(account_type)
    `);

    // Create audit_log table
    await client.query(`
      CREATE TABLE IF NOT EXISTS audit_log (
        id SERIAL PRIMARY KEY,
        transaction_id VARCHAR(255),
        action VARCHAR(50) NOT NULL,
        entity_type VARCHAR(50),
        entity_id VARCHAR(255),
        old_values JSONB,
        new_values JSONB,
        changed_by VARCHAR(255),
        changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        ip_address VARCHAR(45),
        user_agent TEXT
      )
    `);

    // Create indexes for audit_log
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_audit_transaction_id ON audit_log(transaction_id)
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_log(entity_type, entity_id)
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_audit_changed_at ON audit_log(changed_at)
    `);

    console.log('PostgreSQL schema initialized');
  } catch (error) {
    console.error('Error initializing schema:', error);
    throw error;
  }
};

const getPool = () => {
  if (!pool) {
    throw new Error('PostgreSQL pool not initialized. Call connectPostgres() first.');
  }
  return pool;
};

const closePostgres = async () => {
  if (pool) {
    await pool.end();
    pool = null;
    console.log('PostgreSQL connection closed');
  }
};

module.exports = {
  connectPostgres,
  getPool,
  closePostgres,
};

