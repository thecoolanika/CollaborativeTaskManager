# Transaction Ledger System

## Overview

The Transaction Ledger System implements a double-entry accounting system with ACID compliance using PostgreSQL. Every task completion creates immutable ledger entries that track points earned by users.

## Features

### 1. Double-Entry Accounting
- Every transaction creates at least two entries (debit and credit)
- Total debits must equal total credits (enforced validation)
- Immutable ledger entries that cannot be modified

### 2. ACID Compliance
- **Atomicity**: All ledger entries in a transaction succeed or fail together
- **Consistency**: Double-entry validation ensures accounts always balance
- **Isolation**: Transactions are isolated using PostgreSQL transactions
- **Durability**: All committed transactions are permanently stored

### 3. Reconciliation
- Automated reconciliation checks to verify account balances
- Compares stored balances with calculated balances from ledger entries
- Identifies discrepancies for investigation

### 4. Audit Trail
- Complete audit log of all transactions
- Tracks who, what, when, and why for every change
- Immutable audit records for compliance

## Database Schema

### Tables

1. **ledger_entries**: Individual debit/credit entries
   - Links to transactions
   - Tracks account balances
   - Stores metadata and references

2. **transactions**: Transaction metadata
   - Transaction status (PENDING, COMMITTED, ROLLED_BACK)
   - Reference to source entity (e.g., TASK)
   - Transaction type and description

3. **account_balances**: Quick balance lookups
   - Cached account balances
   - Updated atomically with transactions

4. **audit_log**: Complete audit trail
   - All changes tracked
   - Old and new values stored
   - User and timestamp information

## Account Types

- **ASSET**: User points accounts (increased by debits)
- **REVENUE**: System revenue from task completions (increased by credits)
- **LIABILITY**: Future use
- **EQUITY**: Future use
- **EXPENSE**: Future use

## API Endpoints

### Create Transaction
```
POST /api/ledger/transactions
Body: {
  transactionType: "TASK_COMPLETION",
  entries: [
    {
      accountId: "user_points:userId",
      accountType: "ASSET",
      debit: 25,
      credit: 0,
      description: "Points earned"
    },
    {
      accountId: "system:revenue:task_completion",
      accountType: "REVENUE",
      debit: 0,
      credit: 25,
      description: "Revenue from task"
    }
  ],
  referenceType: "TASK",
  referenceId: "taskId"
}
```

### Get User Points
```
GET /api/ledger/points/balance
Returns: { userId, points }
```

### Get Account Balance
```
GET /api/ledger/accounts/:accountId/balance?accountType=ASSET
Returns: { accountId, accountType, balance }
```

### Reconcile Accounts
```
POST /api/ledger/reconcile
Body: { accountIds: [] } // Optional, reconciles all if empty
Returns: Reconciliation report with balance verification
```

### Get Transaction History
```
GET /api/ledger/transactions?accountId=...&referenceType=...&limit=100&offset=0
Returns: List of transactions with filters
```

### Get Audit Trail
```
GET /api/ledger/audit?transactionId=...&entityType=...&limit=100&offset=0
Returns: Audit log entries
```

## Task Completion Integration

When a task status changes to "Done":
1. Points are calculated based on priority:
   - Low: 10 points
   - Medium: 25 points
   - High: 50 points

2. Points are awarded to:
   - All assigned users (if any)
   - Task creator (if no users assigned)

3. Double-entry transaction is created:
   - Debit: User points account (ASSET)
   - Credit: System revenue account (REVENUE)

## Environment Variables

```env
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=taskledger
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
```

## Usage Example

```javascript
const ledgerService = require('./services/ledgerService');

// Record task completion
await ledgerService.recordTaskCompletion(
  taskId,
  userId,
  25, // points
  { taskTitle: "Complete feature", taskPriority: "Medium" }
);

// Get user points
const balance = await ledgerService.getAccountBalancePublic(
  `user_points:${userId}`,
  'ASSET'
);

// Reconcile accounts
const reconciliation = await ledgerService.reconcileAccounts();
console.log(reconciliation.reconciled); // true if all balanced
```

## Error Handling

- Transactions that fail validation are rolled back
- All changes are atomic (all or nothing)
- Errors are logged to audit trail
- Task updates continue even if ledger recording fails (non-blocking)

## Security

- All endpoints require authentication
- Reconciliation and audit endpoints should be restricted to admins
- Transactions are immutable once committed
- Complete audit trail for compliance

