const fs = require("fs")
const path = require("path")
const { DatabaseSync } = require("node:sqlite")
const { DEFAULT_PRIORITY_RULES_CONFIG } = require("./mailAnalysisService")

const projectRoot = path.resolve(__dirname, "../../..")
const dataDirectory = path.join(projectRoot, "backend", "data")
const databasePath = path.join(dataDirectory, "agent-mail-assistant.db")

let database = null

function ensureDatabaseDirectory() {
  fs.mkdirSync(dataDirectory, { recursive: true })
}

function openDatabase() {
  if (database) {
    return database
  }

  ensureDatabaseDirectory()
  database = new DatabaseSync(databasePath)
  database.exec("PRAGMA journal_mode = WAL;")
  database.exec("PRAGMA foreign_keys = ON;")
  initSchema(database)
  return database
}

function initSchema(db) {
  migrateAccountsTableIfNeeded(db)
  migrateAccountsIndexesIfNeeded(db)
  migrateForeignKeysReferencingLegacyAccounts(db)

  db.exec(`
    CREATE TABLE IF NOT EXISTS account_requests (
      id TEXT PRIMARY KEY,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      status TEXT NOT NULL,
      account_type TEXT NOT NULL,
      usage_mode TEXT NOT NULL,
      first_name TEXT NOT NULL,
      last_name TEXT NOT NULL,
      email TEXT NOT NULL,
      phone TEXT,
      organization_name TEXT,
      disability_usage INTEGER NOT NULL DEFAULT 0,
      planned_mailboxes TEXT,
      motivation TEXT,
      document_required INTEGER NOT NULL DEFAULT 0,
      supporting_document_name TEXT,
      admin_notes TEXT,
      requested_additional_info TEXT,
      reviewed_by TEXT,
      reviewed_at TEXT,
      linked_account_id TEXT
    );

    CREATE TABLE IF NOT EXISTS accounts (
      id TEXT PRIMARY KEY,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      status TEXT NOT NULL,
      role TEXT NOT NULL,
      account_type TEXT NOT NULL,
      usage_mode TEXT NOT NULL,
      product_version TEXT NOT NULL,
      first_name TEXT NOT NULL,
      last_name TEXT NOT NULL,
      email TEXT NOT NULL,
      phone TEXT,
      organization_name TEXT,
      password_hash TEXT,
      validated_by TEXT,
      validated_at TEXT,
      source_request_id TEXT,
      FOREIGN KEY (source_request_id) REFERENCES account_requests(id)
    );

    CREATE TABLE IF NOT EXISTS mailboxes (
      id TEXT PRIMARY KEY,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      status TEXT NOT NULL,
      email_address TEXT NOT NULL,
      display_name TEXT,
      provider TEXT,
      account_id TEXT,
      connection_status TEXT NOT NULL,
      access_mode TEXT NOT NULL,
      simulation_enabled INTEGER NOT NULL DEFAULT 1,
      validation_required INTEGER NOT NULL DEFAULT 1,
      browser_use_enabled INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (account_id) REFERENCES accounts(id)
    );

    CREATE TABLE IF NOT EXISTS mailbox_connections (
      id TEXT PRIMARY KEY,
      account_id TEXT NOT NULL,
      mailbox_resource_id TEXT,
      mailbox_email TEXT NOT NULL,
      provider_id TEXT NOT NULL,
      provider_label TEXT NOT NULL,
      auth_type TEXT NOT NULL,
      connection_status TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      oauth_state TEXT,
      oauth_scope TEXT,
      oauth_access_token TEXT,
      oauth_refresh_token TEXT,
      oauth_token_expires_at TEXT,
      oauth_external_account_id TEXT,
      last_sync_at TEXT,
      last_error TEXT,
      is_default INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (account_id) REFERENCES accounts(id),
      FOREIGN KEY (mailbox_resource_id) REFERENCES mailbox_resources(id)
    );

    CREATE TABLE IF NOT EXISTS mailbox_message_actions (
      id TEXT PRIMARY KEY,
      account_id TEXT NOT NULL,
      connection_id TEXT NOT NULL,
      mailbox_email TEXT NOT NULL,
      gmail_message_id TEXT NOT NULL,
      gmail_thread_id TEXT,
      from_email TEXT,
      subject TEXT,
      action_type TEXT NOT NULL,
      action_reason TEXT,
      reply_subject TEXT,
      reply_body TEXT,
      sent_message_id TEXT,
      source_status TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      metadata_json TEXT,
      FOREIGN KEY (account_id) REFERENCES accounts(id)
    );

    CREATE TABLE IF NOT EXISTS automation_policies (
      id TEXT PRIMARY KEY,
      account_id TEXT NOT NULL,
      connection_id TEXT NOT NULL,
      policy_scope TEXT NOT NULL,
      policy_status TEXT NOT NULL,
      automation_level TEXT NOT NULL,
      browser_provider TEXT NOT NULL,
      browser_enabled INTEGER NOT NULL DEFAULT 0,
      navigation_enabled INTEGER NOT NULL DEFAULT 0,
      message_open_enabled INTEGER NOT NULL DEFAULT 0,
      context_collection_enabled INTEGER NOT NULL DEFAULT 0,
      draft_injection_enabled INTEGER NOT NULL DEFAULT 0,
      send_enabled INTEGER NOT NULL DEFAULT 0,
      human_validation_required INTEGER NOT NULL DEFAULT 1,
      allowed_actions_json TEXT,
      policy_json TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      updated_by TEXT,
      FOREIGN KEY (account_id) REFERENCES accounts(id),
      FOREIGN KEY (connection_id) REFERENCES mailbox_connections(id)
    );

    CREATE TABLE IF NOT EXISTS browser_use_sessions (
      id TEXT PRIMARY KEY,
      account_id TEXT NOT NULL,
      connection_id TEXT NOT NULL,
      automation_policy_id TEXT,
      provider_id TEXT NOT NULL,
      objective TEXT NOT NULL,
      target_message_id TEXT,
      session_status TEXT NOT NULL,
      run_mode TEXT NOT NULL,
      validation_mode TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      started_at TEXT,
      completed_at TEXT,
      error_message TEXT,
      execution_plan_json TEXT,
      result_json TEXT,
      metadata_json TEXT,
      FOREIGN KEY (account_id) REFERENCES accounts(id),
      FOREIGN KEY (connection_id) REFERENCES mailbox_connections(id),
      FOREIGN KEY (automation_policy_id) REFERENCES automation_policies(id)
    );

    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value_json TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS mail_rules (
      id TEXT PRIMARY KEY,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      created_by TEXT,
      updated_by TEXT,
      status TEXT NOT NULL,
      application_scope TEXT NOT NULL DEFAULT 'mail_assistant',
      mailbox_scope TEXT NOT NULL DEFAULT 'global',
      mail_category_scope TEXT NOT NULL DEFAULT 'global',
      workflow_scope TEXT NOT NULL DEFAULT 'reply',
      rule_type TEXT NOT NULL,
      theme TEXT NOT NULL DEFAULT '',
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      missing_info_action TEXT NOT NULL DEFAULT 'cautious_reply',
      priority_rank INTEGER NOT NULL DEFAULT 100,
      notes TEXT,
      metadata_json TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_mail_rules_status
    ON mail_rules(status);

    CREATE INDEX IF NOT EXISTS idx_mail_rules_scope
    ON mail_rules(application_scope, mailbox_scope, mail_category_scope, workflow_scope, status);

    CREATE TABLE IF NOT EXISTS account_actions (
      id TEXT PRIMARY KEY,
      created_at TEXT NOT NULL,
      actor_id TEXT,
      target_type TEXT NOT NULL,
      target_id TEXT NOT NULL,
      action_type TEXT NOT NULL,
      notes TEXT,
      metadata_json TEXT
    );

    CREATE TABLE IF NOT EXISTS password_reset_tokens (
      id TEXT PRIMARY KEY,
      account_id TEXT NOT NULL,
      token TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      used_at TEXT,
      FOREIGN KEY (account_id) REFERENCES accounts(id)
    );

    CREATE TABLE IF NOT EXISTS user_sessions (
      id TEXT PRIMARY KEY,
      account_id TEXT NOT NULL,
      role TEXT NOT NULL,
      session_status TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      FOREIGN KEY (account_id) REFERENCES accounts(id)
    );

    CREATE TABLE IF NOT EXISTS user_stats (
      id TEXT PRIMARY KEY,
      account_id TEXT NOT NULL,
      period_start TEXT NOT NULL,
      period_end TEXT NOT NULL,
      processed_count INTEGER NOT NULL DEFAULT 0,
      validated_count INTEGER NOT NULL DEFAULT 0,
      rejected_count INTEGER NOT NULL DEFAULT 0,
      drafted_count INTEGER NOT NULL DEFAULT 0,
      estimated_time_saved INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (account_id) REFERENCES accounts(id)
    );

    CREATE TABLE IF NOT EXISTS provider_accounts (
      id TEXT PRIMARY KEY,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      owner_scope_type TEXT NOT NULL,
      owner_scope_id TEXT NOT NULL,
      provider_type TEXT NOT NULL,
      provider_label TEXT NOT NULL,
      credential_mode TEXT NOT NULL,
      api_key_encrypted TEXT NOT NULL,
      api_key_masked TEXT NOT NULL,
      status TEXT NOT NULL,
      is_default INTEGER NOT NULL DEFAULT 0,
      billing_mode TEXT NOT NULL,
      monthly_budget_cents INTEGER NOT NULL DEFAULT 0,
      currency TEXT NOT NULL DEFAULT 'EUR',
      notes TEXT,
      last_tested_at TEXT,
      last_error TEXT
    );

    CREATE TABLE IF NOT EXISTS provider_usage_events (
      id TEXT PRIMARY KEY,
      created_at TEXT NOT NULL,
      account_id TEXT NOT NULL,
      provider_account_id TEXT NOT NULL,
      provider_type TEXT NOT NULL,
      feature_type TEXT NOT NULL,
      request_mode TEXT NOT NULL,
      quantity REAL NOT NULL DEFAULT 0,
      quantity_unit TEXT NOT NULL,
      estimated_cost_cents INTEGER NOT NULL DEFAULT 0,
      currency TEXT NOT NULL DEFAULT 'EUR',
      status TEXT NOT NULL,
      request_id TEXT,
      mailbox_resource_id TEXT,
      metadata_json TEXT,
      FOREIGN KEY (account_id) REFERENCES accounts(id),
      FOREIGN KEY (provider_account_id) REFERENCES provider_accounts(id)
    );

    CREATE TABLE IF NOT EXISTS user_preferences (
      account_id TEXT PRIMARY KEY,
      updated_at TEXT NOT NULL,
      ui_settings_json TEXT NOT NULL,
      audio_settings_json TEXT NOT NULL,
      mail_settings_json TEXT NOT NULL,
      provider_preferences_json TEXT NOT NULL,
      FOREIGN KEY (account_id) REFERENCES accounts(id)
    );

    CREATE TABLE IF NOT EXISTS mailbox_resources (
      id TEXT PRIMARY KEY,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      status TEXT NOT NULL,
      email_address TEXT NOT NULL,
      display_name TEXT,
      provider TEXT,
      sharing_enabled INTEGER NOT NULL DEFAULT 0,
      default_connection_id TEXT,
      owner_account_id TEXT,
      notes TEXT,
      FOREIGN KEY (default_connection_id) REFERENCES mailbox_connections(id),
      FOREIGN KEY (owner_account_id) REFERENCES accounts(id)
    );

    CREATE TABLE IF NOT EXISTS mailbox_memberships (
      id TEXT PRIMARY KEY,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      account_id TEXT NOT NULL,
      mailbox_resource_id TEXT NOT NULL,
      membership_status TEXT NOT NULL,
      permission_read INTEGER NOT NULL DEFAULT 1,
      permission_draft INTEGER NOT NULL DEFAULT 1,
      permission_validate INTEGER NOT NULL DEFAULT 0,
      permission_send INTEGER NOT NULL DEFAULT 0,
      permission_manage_mailbox INTEGER NOT NULL DEFAULT 0,
      is_default_mailbox INTEGER NOT NULL DEFAULT 0,
      granted_by_account_id TEXT,
      notes TEXT,
      FOREIGN KEY (account_id) REFERENCES accounts(id),
      FOREIGN KEY (mailbox_resource_id) REFERENCES mailbox_resources(id),
      FOREIGN KEY (granted_by_account_id) REFERENCES accounts(id)
    );

    CREATE TABLE IF NOT EXISTS mailbox_message_collaboration (
      id TEXT PRIMARY KEY,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      mailbox_resource_id TEXT NOT NULL,
      connection_id TEXT NOT NULL,
      gmail_message_id TEXT NOT NULL,
      assigned_to_account_id TEXT,
      lock_owner_account_id TEXT,
      lock_expires_at TEXT,
      assignment_state TEXT NOT NULL DEFAULT 'new',
      collaboration_state TEXT NOT NULL DEFAULT 'new',
      last_actor_account_id TEXT,
      metadata_json TEXT,
      FOREIGN KEY (mailbox_resource_id) REFERENCES mailbox_resources(id),
      FOREIGN KEY (connection_id) REFERENCES mailbox_connections(id),
      FOREIGN KEY (assigned_to_account_id) REFERENCES accounts(id),
      FOREIGN KEY (lock_owner_account_id) REFERENCES accounts(id),
      FOREIGN KEY (last_actor_account_id) REFERENCES accounts(id)
    );

    CREATE TABLE IF NOT EXISTS billing_profiles (
      id TEXT PRIMARY KEY,
      account_id TEXT NOT NULL,
      billing_mode TEXT NOT NULL,
      billing_status TEXT NOT NULL,
      legal_name TEXT,
      legal_identifier TEXT,
      billing_email TEXT,
      notes TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (account_id) REFERENCES accounts(id)
    );

    CREATE TABLE IF NOT EXISTS invoices (
      id TEXT PRIMARY KEY,
      account_id TEXT NOT NULL,
      billing_profile_id TEXT,
      invoice_number TEXT,
      amount_cents INTEGER NOT NULL DEFAULT 0,
      currency TEXT NOT NULL DEFAULT 'EUR',
      status TEXT NOT NULL,
      issued_at TEXT,
      due_at TEXT,
      paid_at TEXT,
      notes TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (account_id) REFERENCES accounts(id),
      FOREIGN KEY (billing_profile_id) REFERENCES billing_profiles(id)
    );

    CREATE INDEX IF NOT EXISTS idx_account_requests_email ON account_requests(email);
    CREATE INDEX IF NOT EXISTS idx_account_requests_status ON account_requests(status);
    CREATE INDEX IF NOT EXISTS idx_accounts_email ON accounts(email);
    DROP INDEX IF EXISTS idx_accounts_email_type;
    CREATE UNIQUE INDEX IF NOT EXISTS idx_accounts_email_type_role ON accounts(email, account_type, role);
    CREATE INDEX IF NOT EXISTS idx_mailboxes_account_id ON mailboxes(account_id);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_mailbox_connections_account_email_provider ON mailbox_connections(account_id, mailbox_email, provider_id);
    CREATE INDEX IF NOT EXISTS idx_mailbox_connections_account_id ON mailbox_connections(account_id);
    CREATE INDEX IF NOT EXISTS idx_mailbox_connections_state ON mailbox_connections(oauth_state);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_mailbox_message_actions_unique_message ON mailbox_message_actions(account_id, connection_id, gmail_message_id);
    CREATE INDEX IF NOT EXISTS idx_mailbox_message_actions_connection ON mailbox_message_actions(connection_id, source_status);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_automation_policies_account_connection ON automation_policies(account_id, connection_id);
    CREATE INDEX IF NOT EXISTS idx_browser_use_sessions_connection_status ON browser_use_sessions(connection_id, session_status);
    CREATE INDEX IF NOT EXISTS idx_browser_use_sessions_account_created_at ON browser_use_sessions(account_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_account_actions_target ON account_actions(target_type, target_id);
    CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_account_id ON password_reset_tokens(account_id);
    CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_token ON password_reset_tokens(token);
    CREATE INDEX IF NOT EXISTS idx_user_sessions_account_id ON user_sessions(account_id);
    CREATE INDEX IF NOT EXISTS idx_user_sessions_status ON user_sessions(session_status);
    CREATE INDEX IF NOT EXISTS idx_provider_accounts_owner ON provider_accounts(owner_scope_type, owner_scope_id);
    CREATE INDEX IF NOT EXISTS idx_provider_accounts_provider_type ON provider_accounts(provider_type);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_provider_accounts_owner_provider_mode ON provider_accounts(owner_scope_type, owner_scope_id, provider_type, credential_mode);
    CREATE INDEX IF NOT EXISTS idx_provider_usage_events_account_created ON provider_usage_events(account_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_provider_usage_events_provider_account_created ON provider_usage_events(provider_account_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_provider_usage_events_provider_feature ON provider_usage_events(provider_type, feature_type);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_mailbox_resources_email_provider ON mailbox_resources(email_address, provider);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_mailbox_memberships_account_resource ON mailbox_memberships(account_id, mailbox_resource_id);
    CREATE INDEX IF NOT EXISTS idx_mailbox_memberships_resource_status ON mailbox_memberships(mailbox_resource_id, membership_status);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_mailbox_message_collab_connection_message ON mailbox_message_collaboration(connection_id, gmail_message_id);
    CREATE INDEX IF NOT EXISTS idx_mailbox_message_collab_resource_state ON mailbox_message_collaboration(mailbox_resource_id, collaboration_state);
  `)

  migrateMailboxSharingSchemaIfNeeded(db)
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_mailbox_connections_resource_id ON mailbox_connections(mailbox_resource_id);
  `)
}

function parseJsonSafely(value, fallback) {
  if (!value) {
    return fallback
  }

  try {
    return JSON.parse(value)
  } catch (_) {
    return fallback
  }
}

function hasColumn(db, tableName, columnName) {
  const columns = db.prepare(`PRAGMA table_info(${tableName})`).all()
  return columns.some((column) => column.name === columnName)
}

function migrateMailboxSharingSchemaIfNeeded(db) {
  if (!hasColumn(db, "mailbox_connections", "mailbox_resource_id")) {
    db.exec("ALTER TABLE mailbox_connections ADD COLUMN mailbox_resource_id TEXT;")
  }
}

function migrateAccountsTableIfNeeded(db) {
  const tableInfo = db.prepare("PRAGMA table_info(accounts)").all()
  if (!tableInfo || tableInfo.length === 0) {
    return
  }

  const emailColumn = tableInfo.find((column) => column.name === "email")
  if (!emailColumn) {
    return
  }

  const createSqlRow = db.prepare(`
    SELECT sql
    FROM sqlite_master
    WHERE type = 'table' AND name = 'accounts'
  `).get()

  if (!createSqlRow?.sql || !createSqlRow.sql.includes("email TEXT NOT NULL UNIQUE")) {
    return
  }

  db.exec(`
    ALTER TABLE accounts RENAME TO accounts_legacy;

    CREATE TABLE accounts (
      id TEXT PRIMARY KEY,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      status TEXT NOT NULL,
      role TEXT NOT NULL,
      account_type TEXT NOT NULL,
      usage_mode TEXT NOT NULL,
      product_version TEXT NOT NULL,
      first_name TEXT NOT NULL,
      last_name TEXT NOT NULL,
      email TEXT NOT NULL,
      phone TEXT,
      organization_name TEXT,
      password_hash TEXT,
      validated_by TEXT,
      validated_at TEXT,
      source_request_id TEXT,
      FOREIGN KEY (source_request_id) REFERENCES account_requests(id)
    );

    INSERT INTO accounts (
      id,
      created_at,
      updated_at,
      status,
      role,
      account_type,
      usage_mode,
      product_version,
      first_name,
      last_name,
      email,
      phone,
      organization_name,
      password_hash,
      validated_by,
      validated_at,
      source_request_id
    )
    SELECT
      id,
      created_at,
      updated_at,
      status,
      role,
      account_type,
      usage_mode,
      product_version,
      first_name,
      last_name,
      email,
      phone,
      organization_name,
      password_hash,
      validated_by,
      validated_at,
      source_request_id
    FROM accounts_legacy;

    DROP TABLE accounts_legacy;
  `)
}

function migrateAccountsIndexesIfNeeded(db) {
  const indexes = db.prepare("PRAGMA index_list(accounts)").all()
  const hasLegacyUniqueIndex = indexes.some((index) => index.name === "idx_accounts_email_type")

  if (hasLegacyUniqueIndex) {
    db.exec("DROP INDEX IF EXISTS idx_accounts_email_type;")
  }
}

function migrateForeignKeysReferencingLegacyAccounts(db) {
  const dependentTables = ["mailboxes", "user_stats", "billing_profiles", "invoices"]
  const tablesToRebuild = dependentTables.filter((tableName) => {
    const foreignKeys = db.prepare(`PRAGMA foreign_key_list(${tableName})`).all()
    return foreignKeys.some((foreignKey) => foreignKey.table === "accounts_legacy")
  })

  if (tablesToRebuild.length === 0) {
    return
  }

  db.exec("PRAGMA foreign_keys = OFF;")

  try {
    if (tablesToRebuild.includes("mailboxes")) {
      db.exec(`
        ALTER TABLE mailboxes RENAME TO mailboxes_legacy;
        CREATE TABLE mailboxes (
          id TEXT PRIMARY KEY,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          status TEXT NOT NULL,
          email_address TEXT NOT NULL,
          display_name TEXT,
          provider TEXT,
          account_id TEXT,
          connection_status TEXT NOT NULL,
          access_mode TEXT NOT NULL,
          simulation_enabled INTEGER NOT NULL DEFAULT 1,
          validation_required INTEGER NOT NULL DEFAULT 1,
          browser_use_enabled INTEGER NOT NULL DEFAULT 0,
          FOREIGN KEY (account_id) REFERENCES accounts(id)
        );
        INSERT INTO mailboxes SELECT * FROM mailboxes_legacy;
        DROP TABLE mailboxes_legacy;
      `)
    }

    if (tablesToRebuild.includes("user_stats")) {
      db.exec(`
        ALTER TABLE user_stats RENAME TO user_stats_legacy;
        CREATE TABLE user_stats (
          id TEXT PRIMARY KEY,
          account_id TEXT NOT NULL,
          period_start TEXT NOT NULL,
          period_end TEXT NOT NULL,
          processed_count INTEGER NOT NULL DEFAULT 0,
          validated_count INTEGER NOT NULL DEFAULT 0,
          rejected_count INTEGER NOT NULL DEFAULT 0,
          drafted_count INTEGER NOT NULL DEFAULT 0,
          estimated_time_saved INTEGER NOT NULL DEFAULT 0,
          FOREIGN KEY (account_id) REFERENCES accounts(id)
        );
        INSERT INTO user_stats SELECT * FROM user_stats_legacy;
        DROP TABLE user_stats_legacy;
      `)
    }

    if (tablesToRebuild.includes("billing_profiles")) {
      db.exec(`
        ALTER TABLE billing_profiles RENAME TO billing_profiles_legacy;
        CREATE TABLE billing_profiles (
          id TEXT PRIMARY KEY,
          account_id TEXT NOT NULL,
          billing_mode TEXT NOT NULL,
          billing_status TEXT NOT NULL,
          legal_name TEXT,
          legal_identifier TEXT,
          billing_email TEXT,
          notes TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          FOREIGN KEY (account_id) REFERENCES accounts(id)
        );
        INSERT INTO billing_profiles SELECT * FROM billing_profiles_legacy;
        DROP TABLE billing_profiles_legacy;
      `)
    }

    if (tablesToRebuild.includes("invoices")) {
      db.exec(`
        ALTER TABLE invoices RENAME TO invoices_legacy;
        CREATE TABLE invoices (
          id TEXT PRIMARY KEY,
          account_id TEXT NOT NULL,
          billing_profile_id TEXT,
          invoice_number TEXT,
          amount_cents INTEGER NOT NULL DEFAULT 0,
          currency TEXT NOT NULL DEFAULT 'EUR',
          status TEXT NOT NULL,
          issued_at TEXT,
          due_at TEXT,
          paid_at TEXT,
          notes TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          FOREIGN KEY (account_id) REFERENCES accounts(id),
          FOREIGN KEY (billing_profile_id) REFERENCES billing_profiles(id)
        );
        INSERT INTO invoices SELECT * FROM invoices_legacy;
        DROP TABLE invoices_legacy;
      `)
    }
  } finally {
    db.exec("PRAGMA foreign_keys = ON;")
  }
}

function insertAccountRequest(request) {
  const db = openDatabase()
  const statement = db.prepare(`
    INSERT INTO account_requests (
      id,
      created_at,
      updated_at,
      status,
      account_type,
      usage_mode,
      first_name,
      last_name,
      email,
      phone,
      organization_name,
      disability_usage,
      planned_mailboxes,
      motivation,
      document_required,
      supporting_document_name,
      admin_notes,
      requested_additional_info,
      reviewed_by,
      reviewed_at,
      linked_account_id
    ) VALUES (
      @id,
      @created_at,
      @updated_at,
      @status,
      @account_type,
      @usage_mode,
      @first_name,
      @last_name,
      @email,
      @phone,
      @organization_name,
      @disability_usage,
      @planned_mailboxes,
      @motivation,
      @document_required,
      @supporting_document_name,
      @admin_notes,
      @requested_additional_info,
      @reviewed_by,
      @reviewed_at,
      @linked_account_id
    )
  `)

  statement.run({
    id: request.id,
    created_at: request.createdAt,
    updated_at: request.updatedAt,
    status: request.status,
    account_type: request.accountType,
    usage_mode: request.usageMode,
    first_name: request.firstName,
    last_name: request.lastName,
    email: request.email,
    phone: request.phone,
    organization_name: request.organizationName,
    disability_usage: request.disabilityUsage ? 1 : 0,
    planned_mailboxes: request.plannedMailboxes,
    motivation: request.motivation,
    document_required: request.documentRequired ? 1 : 0,
    supporting_document_name: request.supportingDocumentName,
    admin_notes: request.adminNotes,
    requested_additional_info: request.requestedAdditionalInfo,
    reviewed_by: request.reviewedBy,
    reviewed_at: request.reviewedAt,
    linked_account_id: request.linkedAccountId
  })
}

function findOpenRequestByEmailAndType(email, accountType) {
  const db = openDatabase()
  return db.prepare(`
    SELECT id, status, account_type, usage_mode, email, linked_account_id
    FROM account_requests
    WHERE email = ?
      AND account_type = ?
      AND status IN ('pending', 'more_info_requested', 'approved')
    ORDER BY created_at DESC
    LIMIT 1
  `).get(email, accountType) || null
}

function findAccountByEmailAndType(email, accountType) {
  const db = openDatabase()
  return db.prepare(`
    SELECT id, status, role, email, account_type
    FROM accounts
    WHERE email = ?
      AND account_type = ?
      AND role = 'user_standard'
    LIMIT 1
  `).get(email, accountType) || null
}

function hasAnyAdminAccount() {
  const db = openDatabase()
  const row = db.prepare(`
    SELECT COUNT(*) AS count
    FROM accounts
    WHERE role = 'admin'
  `).get()

  return Number(row?.count || 0) > 0
}

function createAdminAccount(account) {
  const db = openDatabase()
  const statement = db.prepare(`
    INSERT INTO accounts (
      id,
      created_at,
      updated_at,
      status,
      role,
      account_type,
      usage_mode,
      product_version,
      first_name,
      last_name,
      email,
      phone,
      organization_name,
      password_hash,
      validated_by,
      validated_at,
      source_request_id
    ) VALUES (
      @id,
      @created_at,
      @updated_at,
      @status,
      @role,
      @account_type,
      @usage_mode,
      @product_version,
      @first_name,
      @last_name,
      @email,
      @phone,
      @organization_name,
      @password_hash,
      @validated_by,
      @validated_at,
      @source_request_id
    )
  `)

  statement.run({
    id: account.id,
    created_at: account.createdAt,
    updated_at: account.updatedAt,
    status: account.status,
    role: account.role,
    account_type: account.accountType,
    usage_mode: account.usageMode,
    product_version: account.productVersion,
    first_name: account.firstName,
    last_name: account.lastName,
    email: account.email,
    phone: account.phone || "",
    organization_name: account.organizationName || "",
    password_hash: account.passwordHash,
    validated_by: account.validatedBy || "",
    validated_at: account.validatedAt || "",
    source_request_id: account.sourceRequestId || null
  })
}

function createPendingAccountFromRequest(request) {
  const db = openDatabase()
  const statement = db.prepare(`
    INSERT INTO accounts (
      id,
      created_at,
      updated_at,
      status,
      role,
      account_type,
      usage_mode,
      product_version,
      first_name,
      last_name,
      email,
      phone,
      organization_name,
      password_hash,
      validated_by,
      validated_at,
      source_request_id
    ) VALUES (
      @id,
      @created_at,
      @updated_at,
      @status,
      @role,
      @account_type,
      @usage_mode,
      @product_version,
      @first_name,
      @last_name,
      @email,
      @phone,
      @organization_name,
      @password_hash,
      @validated_by,
      @validated_at,
      @source_request_id
    )
  `)

  const now = request.updatedAt || request.createdAt
  const account = {
    id: `acc-${Date.now()}`,
    created_at: request.createdAt,
    updated_at: now,
    status: "pending_activation",
    role: "user_standard",
    account_type: request.accountType,
    usage_mode: request.usageMode,
    product_version: "base",
    first_name: request.firstName,
    last_name: request.lastName,
    email: request.email,
    phone: request.phone || "",
    organization_name: request.organizationName || "",
    password_hash: null,
    validated_by: null,
    validated_at: null,
    source_request_id: request.id
  }

  statement.run(account)

  db.prepare(`
    UPDATE account_requests
    SET updated_at = @updated_at,
        linked_account_id = @linked_account_id
    WHERE id = @id
  `).run({
    id: request.id,
    updated_at: now,
    linked_account_id: account.id
  })

  return {
    id: account.id,
    status: account.status,
    role: account.role,
    productVersion: account.product_version,
    email: account.email,
    sourceRequestId: account.source_request_id
  }
}

function mapRequestRowToStoredRequest(row) {
  if (!row) return null

  return {
    id: row.id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    status: row.status,
    accountType: row.account_type,
    usageMode: row.usage_mode,
    firstName: row.first_name,
    lastName: row.last_name,
    email: row.email,
    phone: row.phone || "",
    organizationName: row.organization_name || "",
    disabilityUsage: Boolean(row.disability_usage),
    plannedMailboxes: row.planned_mailboxes || "",
    motivation: row.motivation || "",
    documentRequired: Boolean(row.document_required),
    supportingDocumentName: row.supporting_document_name || "",
    adminNotes: row.admin_notes || "",
    requestedAdditionalInfo: row.requested_additional_info || "",
    reviewedBy: row.reviewed_by || "",
    reviewedAt: row.reviewed_at || "",
    linkedAccountId: row.linked_account_id || ""
  }
}

function getDatabaseInfo() {
  return {
    engine: "SQLite",
    path: databasePath
  }
}

function listAccountRequests(filters = {}) {
  const db = openDatabase()
  const clauses = []
  const values = []

  if (filters.email) {
    clauses.push("email = ?")
    values.push(filters.email.trim().toLowerCase())
  }

  if (filters.status) {
    clauses.push("status = ?")
    values.push(filters.status)
  } else if (!filters.includeDeleted) {
    clauses.push("status <> ?")
    values.push("deleted")
  }

  if (filters.accountType) {
    clauses.push("account_type = ?")
    values.push(filters.accountType)
  }

  const whereClause = clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : ""

  return db.prepare(`
    SELECT
      id,
      created_at,
      updated_at,
      status,
      account_type,
      usage_mode,
      first_name,
      last_name,
      email,
      phone,
      organization_name,
      disability_usage,
      planned_mailboxes,
      motivation,
      document_required,
      supporting_document_name,
      admin_notes,
      requested_additional_info,
      reviewed_by,
      reviewed_at,
      linked_account_id
    FROM account_requests
    ${whereClause}
    ORDER BY created_at DESC
  `).all(...values)
}

function listAccounts(filters = {}) {
  const db = openDatabase()
  const clauses = []
  const values = []

  if (filters.email) {
    clauses.push("email = ?")
    values.push(filters.email.trim().toLowerCase())
  }

  if (filters.status) {
    clauses.push("status = ?")
    values.push(filters.status)
  }

  if (filters.role) {
    clauses.push("role = ?")
    values.push(filters.role)
  }

  if (filters.accountType) {
    clauses.push("account_type = ?")
    values.push(filters.accountType)
  }

  const whereClause = clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : ""

  return db.prepare(`
    SELECT
      id,
      created_at,
      updated_at,
      status,
      role,
      account_type,
      usage_mode,
      product_version,
      first_name,
      last_name,
      email,
      phone,
      organization_name,
      validated_by,
      validated_at,
      source_request_id
    FROM accounts
    ${whereClause}
    ORDER BY created_at DESC
  `).all(...values)
}

function getAccountRequestById(requestId) {
  const db = openDatabase()
  return db.prepare(`
    SELECT *
    FROM account_requests
    WHERE id = ?
    LIMIT 1
  `).get(requestId) || null
}

function getAccountById(accountId) {
  const db = openDatabase()
  return db.prepare(`
    SELECT *
    FROM accounts
    WHERE id = ?
    LIMIT 1
  `).get(accountId) || null
}

function insertAccountAction(action) {
  const db = openDatabase()
  db.prepare(`
    INSERT INTO account_actions (
      id,
      created_at,
      actor_id,
      target_type,
      target_id,
      action_type,
      notes,
      metadata_json
    ) VALUES (
      @id,
      @created_at,
      @actor_id,
      @target_type,
      @target_id,
      @action_type,
      @notes,
      @metadata_json
    )
  `).run(action)
}

function updateAccountStatus(accountId, status, options = {}) {
  const db = openDatabase()
  const existingAccount = getAccountById(accountId)
  if (!existingAccount) {
    return null
  }

  const now = new Date().toISOString()
  db.prepare(`
    UPDATE accounts
    SET
      status = @status,
      updated_at = @updated_at,
      product_version = @product_version,
      password_hash = @password_hash,
      validated_by = @validated_by,
      validated_at = @validated_at
    WHERE id = @id
  `).run({
    id: accountId,
    status,
    updated_at: now,
    product_version: options.productVersion || existingAccount.product_version || "base",
    password_hash: options.passwordHash ?? existingAccount.password_hash ?? null,
    validated_by: options.reviewedBy || existingAccount.validated_by || "admin-manuel",
    validated_at: now
  })

  insertAccountAction({
    id: `act-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    created_at: now,
    actor_id: options.reviewedBy || "admin-manuel",
    target_type: "account",
    target_id: accountId,
    action_type: status,
    notes: options.adminNotes || "",
    metadata_json: JSON.stringify({
      sourceRequestId: existingAccount.source_request_id || ""
    })
  })

  return getAccountById(accountId)
}

function updateAccountPassword(accountId, passwordHash, options = {}) {
  const db = openDatabase()
  const existingAccount = getAccountById(accountId)
  if (!existingAccount) {
    return null
  }

  const now = new Date().toISOString()
  db.prepare(`
    UPDATE accounts
    SET
      password_hash = @password_hash,
      updated_at = @updated_at,
      validated_by = @validated_by,
      validated_at = @validated_at
    WHERE id = @id
  `).run({
    id: accountId,
    password_hash: passwordHash,
    updated_at: now,
    validated_by: options.reviewedBy || existingAccount.validated_by || "self-service",
    validated_at: now
  })

  insertAccountAction({
    id: `act-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    created_at: now,
    actor_id: options.reviewedBy || "self-service",
    target_type: "account",
    target_id: accountId,
    action_type: "password_reset",
    notes: options.adminNotes || options.notes || "Mot de passe mis à jour.",
    metadata_json: JSON.stringify({
      sourceRequestId: existingAccount.source_request_id || "",
      role: existingAccount.role || ""
    })
  })

  return getAccountById(accountId)
}

function createPasswordResetToken(accountId, token, expiresAt) {
  const db = openDatabase()
  const now = new Date().toISOString()
  const tokenRow = {
    id: `prt-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    account_id: accountId,
    token,
    created_at: now,
    expires_at: expiresAt,
    used_at: null
  }

  db.prepare(`
    INSERT INTO password_reset_tokens (
      id,
      account_id,
      token,
      created_at,
      expires_at,
      used_at
    ) VALUES (
      @id,
      @account_id,
      @token,
      @created_at,
      @expires_at,
      @used_at
    )
  `).run(tokenRow)

  return {
    id: tokenRow.id,
    account_id: tokenRow.account_id,
    token: tokenRow.token,
    created_at: tokenRow.created_at,
    expires_at: tokenRow.expires_at,
    used_at: tokenRow.used_at
  }
}

function getPasswordResetToken(token) {
  const db = openDatabase()
  return db.prepare(`
    SELECT *
    FROM password_reset_tokens
    WHERE token = ?
    LIMIT 1
  `).get(token) || null
}

function consumePasswordResetToken(token) {
  const db = openDatabase()
  const existingToken = getPasswordResetToken(token)
  if (!existingToken) {
    return null
  }

  const now = new Date().toISOString()
  db.prepare(`
    UPDATE password_reset_tokens
    SET used_at = ?
    WHERE id = ?
  `).run(now, existingToken.id)

  return {
    ...existingToken,
    used_at: now
  }
}

function createUserSession(account) {
  const db = openDatabase()
  const now = new Date().toISOString()
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
  const session = {
    id: `sess-${Date.now()}-${Math.floor(Math.random() * 100000)}`,
    account_id: account.id,
    role: account.role,
    session_status: "active",
    created_at: now,
    updated_at: now,
    expires_at: expiresAt
  }

  db.prepare(`
    INSERT INTO user_sessions (
      id,
      account_id,
      role,
      session_status,
      created_at,
      updated_at,
      expires_at
    ) VALUES (
      @id,
      @account_id,
      @role,
      @session_status,
      @created_at,
      @updated_at,
      @expires_at
    )
  `).run(session)

  return session
}

function getUserSession(sessionId) {
  const db = openDatabase()
  return db.prepare(`
    SELECT *
    FROM user_sessions
    WHERE id = ?
    LIMIT 1
  `).get(sessionId) || null
}

function closeUserSession(sessionId) {
  const db = openDatabase()
  const existingSession = getUserSession(sessionId)
  if (!existingSession) {
    return null
  }

  const now = new Date().toISOString()
  db.prepare(`
    UPDATE user_sessions
    SET session_status = 'closed',
        updated_at = ?
    WHERE id = ?
  `).run(now, sessionId)

  return getUserSession(sessionId)
}

function closeUserSessionsForAccount(accountId) {
  if (!accountId) {
    return 0
  }

  const db = openDatabase()
  const now = new Date().toISOString()
  const result = db.prepare(`
    UPDATE user_sessions
    SET session_status = 'closed',
        updated_at = ?
    WHERE account_id = ?
      AND session_status = 'active'
  `).run(now, accountId)

  return Number(result?.changes || 0)
}

function mapMailboxConnectionRow(row) {
  if (!row) return null

  return {
    id: row.id,
    account_id: row.account_id,
    mailbox_resource_id: row.mailbox_resource_id || "",
    mailbox_email: row.mailbox_email,
    provider_id: row.provider_id,
    provider_label: row.provider_label,
    auth_type: row.auth_type,
    connection_status: row.connection_status,
    created_at: row.created_at,
    updated_at: row.updated_at,
    oauth_state: row.oauth_state || "",
    oauth_scope: row.oauth_scope || "",
    oauth_access_token: row.oauth_access_token || "",
    oauth_refresh_token: row.oauth_refresh_token || "",
    oauth_token_expires_at: row.oauth_token_expires_at || "",
    oauth_external_account_id: row.oauth_external_account_id || "",
    last_sync_at: row.last_sync_at || "",
    last_error: row.last_error || "",
    is_default: Boolean(row.is_default)
  }
}

function upsertMailboxConnection(connection) {
  const db = openDatabase()
  const now = connection.updatedAt || new Date().toISOString()
  const existing = db.prepare(`
    SELECT *
    FROM mailbox_connections
    WHERE account_id = ?
      AND mailbox_email = ?
      AND provider_id = ?
    LIMIT 1
  `).get(connection.accountId, connection.mailboxEmail, connection.providerId)

  if (existing) {
    db.prepare(`
      UPDATE mailbox_connections
      SET
        mailbox_resource_id = @mailbox_resource_id,
        provider_label = @provider_label,
        auth_type = @auth_type,
        connection_status = @connection_status,
        updated_at = @updated_at,
        oauth_state = @oauth_state,
        oauth_scope = @oauth_scope,
        oauth_access_token = @oauth_access_token,
        oauth_refresh_token = @oauth_refresh_token,
        oauth_token_expires_at = @oauth_token_expires_at,
        oauth_external_account_id = @oauth_external_account_id,
        last_sync_at = @last_sync_at,
        last_error = @last_error,
        is_default = @is_default
      WHERE id = @id
    `).run({
      id: existing.id,
      mailbox_resource_id: connection.mailboxResourceId || existing.mailbox_resource_id || null,
      provider_label: connection.providerLabel,
      auth_type: connection.authType,
      connection_status: connection.connectionStatus,
      updated_at: now,
      oauth_state: connection.oauthState || null,
      oauth_scope: connection.oauthScope || null,
      oauth_access_token: connection.oauthAccessToken || null,
      oauth_refresh_token: connection.oauthRefreshToken || null,
      oauth_token_expires_at: connection.oauthTokenExpiresAt || null,
      oauth_external_account_id: connection.oauthExternalAccountId || null,
      last_sync_at: connection.lastSyncAt || null,
      last_error: connection.lastError || null,
      is_default: connection.isDefault ? 1 : 0
    })

    return getMailboxConnectionById(existing.id)
  }

  const row = {
    id: connection.id || `mbxc-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    account_id: connection.accountId,
    mailbox_resource_id: connection.mailboxResourceId || null,
    mailbox_email: connection.mailboxEmail,
    provider_id: connection.providerId,
    provider_label: connection.providerLabel,
    auth_type: connection.authType,
    connection_status: connection.connectionStatus,
    created_at: connection.createdAt || now,
    updated_at: now,
    oauth_state: connection.oauthState || null,
    oauth_scope: connection.oauthScope || null,
    oauth_access_token: connection.oauthAccessToken || null,
    oauth_refresh_token: connection.oauthRefreshToken || null,
    oauth_token_expires_at: connection.oauthTokenExpiresAt || null,
    oauth_external_account_id: connection.oauthExternalAccountId || null,
    last_sync_at: connection.lastSyncAt || null,
    last_error: connection.lastError || null,
    is_default: connection.isDefault ? 1 : 0
  }

  db.prepare(`
    INSERT INTO mailbox_connections (
      id,
      account_id,
      mailbox_resource_id,
      mailbox_email,
      provider_id,
      provider_label,
      auth_type,
      connection_status,
      created_at,
      updated_at,
      oauth_state,
      oauth_scope,
      oauth_access_token,
      oauth_refresh_token,
      oauth_token_expires_at,
      oauth_external_account_id,
      last_sync_at,
      last_error,
      is_default
    ) VALUES (
      @id,
      @account_id,
      @mailbox_resource_id,
      @mailbox_email,
      @provider_id,
      @provider_label,
      @auth_type,
      @connection_status,
      @created_at,
      @updated_at,
      @oauth_state,
      @oauth_scope,
      @oauth_access_token,
      @oauth_refresh_token,
      @oauth_token_expires_at,
      @oauth_external_account_id,
      @last_sync_at,
      @last_error,
      @is_default
    )
  `).run(row)

  return getMailboxConnectionById(row.id)
}

function getMailboxConnectionById(connectionId) {
  const db = openDatabase()
  const row = db.prepare(`
    SELECT *
    FROM mailbox_connections
    WHERE id = ?
    LIMIT 1
  `).get(connectionId)

  return mapMailboxConnectionRow(row)
}

function getMailboxConnectionByIdForAccount(connectionId, accountId) {
  const db = openDatabase()
  const row = db.prepare(`
    SELECT *
    FROM mailbox_connections
    WHERE id = ?
      AND account_id = ?
    LIMIT 1
  `).get(connectionId, accountId)

  return mapMailboxConnectionRow(row)
}

function getMailboxConnectionByState(oauthState) {
  const db = openDatabase()
  const row = db.prepare(`
    SELECT *
    FROM mailbox_connections
    WHERE oauth_state = ?
    LIMIT 1
  `).get(oauthState)

  return mapMailboxConnectionRow(row)
}

function listMailboxConnectionsForAccount(accountId) {
  const db = openDatabase()
  return db.prepare(`
    SELECT *
    FROM mailbox_connections
    WHERE account_id = ?
    ORDER BY updated_at DESC
  `).all(accountId).map(mapMailboxConnectionRow)
}

function listMailboxResourcesAdmin(filters = {}) {
  const db = openDatabase()
  const email = String(filters.email || "").trim().toLowerCase()
  const rows = db.prepare(`
    SELECT
      mr.*,
      owner.email AS owner_email,
      owner.first_name AS owner_first_name,
      owner.last_name AS owner_last_name,
      COUNT(DISTINCT mc.id) AS connection_count,
      COUNT(DISTINCT mm.account_id) AS member_count
    FROM mailbox_resources mr
    LEFT JOIN accounts owner ON owner.id = mr.owner_account_id
    LEFT JOIN mailbox_connections mc ON mc.mailbox_resource_id = mr.id
    LEFT JOIN mailbox_memberships mm ON mm.mailbox_resource_id = mr.id AND mm.membership_status = 'active'
    WHERE (? = '' OR LOWER(mr.email_address) LIKE '%' || ? || '%')
    GROUP BY mr.id
    ORDER BY mr.updated_at DESC, mr.created_at DESC
  `).all(email, email)

  return rows.map((row) => ({
    ...mapMailboxResourceRow(row),
    owner_email: row.owner_email || "",
    owner_first_name: row.owner_first_name || "",
    owner_last_name: row.owner_last_name || "",
    connection_count: Number(row.connection_count || 0),
    member_count: Number(row.member_count || 0)
  }))
}

function getOrCreateMailboxResourceForConnection(connection, options = {}) {
  if (!connection?.id) {
    return null
  }

  const db = openDatabase()
  const now = new Date().toISOString()
  const existingConnection = getMailboxConnectionById(connection.id)
  if (!existingConnection) {
    return null
  }

  if (existingConnection.mailbox_resource_id) {
    return getMailboxResourceById(existingConnection.mailbox_resource_id)
  }

  const existingResource = db.prepare(`
    SELECT *
    FROM mailbox_resources
    WHERE email_address = ?
      AND provider = ?
    LIMIT 1
  `).get(existingConnection.mailbox_email, existingConnection.provider_id)

  const resourceId = existingResource?.id || `mbr-${Date.now()}-${Math.floor(Math.random() * 1000)}`
  if (!existingResource) {
    db.prepare(`
      INSERT INTO mailbox_resources (
        id,
        created_at,
        updated_at,
        status,
        email_address,
        display_name,
        provider,
        sharing_enabled,
        default_connection_id,
        owner_account_id,
        notes
      ) VALUES (
        @id,
        @created_at,
        @updated_at,
        @status,
        @email_address,
        @display_name,
        @provider,
        @sharing_enabled,
        @default_connection_id,
        @owner_account_id,
        @notes
      )
    `).run({
      id: resourceId,
      created_at: now,
      updated_at: now,
      status: "active",
      email_address: existingConnection.mailbox_email,
      display_name: options.displayName || existingConnection.mailbox_email,
      provider: existingConnection.provider_id,
      sharing_enabled: options.sharingEnabled ? 1 : 0,
      default_connection_id: existingConnection.id,
      owner_account_id: existingConnection.account_id,
      notes: options.notes || ""
    })
  } else {
    db.prepare(`
      UPDATE mailbox_resources
      SET
        updated_at = ?,
        default_connection_id = COALESCE(default_connection_id, ?)
      WHERE id = ?
    `).run(now, existingConnection.id, resourceId)
  }

  db.prepare(`
    UPDATE mailbox_connections
    SET mailbox_resource_id = ?
    WHERE id = ?
  `).run(resourceId, existingConnection.id)

  ensureMailboxMembership({
    accountId: existingConnection.account_id,
    mailboxResourceId: resourceId,
    membershipStatus: "active",
    permissionRead: true,
    permissionDraft: true,
    permissionValidate: true,
    permissionSend: true,
    permissionManageMailbox: true,
    isDefaultMailbox: true,
    grantedByAccountId: existingConnection.account_id,
    notes: "Membership propriétaire initiale créée automatiquement."
  })

  return getMailboxResourceById(resourceId)
}

function mapMailboxResourceRow(row) {
  if (!row) {
    return null
  }

  return {
    id: row.id,
    created_at: row.created_at,
    updated_at: row.updated_at,
    status: row.status,
    email_address: row.email_address,
    display_name: row.display_name || "",
    provider: row.provider || "",
    sharing_enabled: Boolean(row.sharing_enabled),
    default_connection_id: row.default_connection_id || "",
    owner_account_id: row.owner_account_id || "",
    notes: row.notes || ""
  }
}

function getMailboxResourceById(mailboxResourceId) {
  const db = openDatabase()
  const row = db.prepare(`
    SELECT *
    FROM mailbox_resources
    WHERE id = ?
    LIMIT 1
  `).get(mailboxResourceId)

  return mapMailboxResourceRow(row)
}

function updateMailboxResource(mailboxResourceId, updates = {}) {
  const db = openDatabase()
  const existing = getMailboxResourceById(mailboxResourceId)
  if (!existing) {
    return null
  }

  const now = new Date().toISOString()
  db.prepare(`
    UPDATE mailbox_resources
    SET
      updated_at = @updated_at,
      status = @status,
      display_name = @display_name,
      sharing_enabled = @sharing_enabled,
      default_connection_id = @default_connection_id,
      owner_account_id = @owner_account_id,
      notes = @notes
    WHERE id = @id
  `).run({
    id: mailboxResourceId,
    updated_at: now,
    status: updates.status || existing.status,
    display_name: updates.displayName !== undefined ? updates.displayName : existing.display_name,
    sharing_enabled: updates.sharingEnabled !== undefined ? (updates.sharingEnabled ? 1 : 0) : (existing.sharing_enabled ? 1 : 0),
    default_connection_id: updates.defaultConnectionId !== undefined ? updates.defaultConnectionId : existing.default_connection_id,
    owner_account_id: updates.ownerAccountId !== undefined ? updates.ownerAccountId : existing.owner_account_id,
    notes: updates.notes !== undefined ? updates.notes : existing.notes
  })

  return getMailboxResourceById(mailboxResourceId)
}

function mapMailboxMembershipRow(row) {
  if (!row) {
    return null
  }

  return {
    id: row.id,
    created_at: row.created_at,
    updated_at: row.updated_at,
    account_id: row.account_id,
    mailbox_resource_id: row.mailbox_resource_id,
    membership_status: row.membership_status,
    permission_read: Boolean(row.permission_read),
    permission_draft: Boolean(row.permission_draft),
    permission_validate: Boolean(row.permission_validate),
    permission_send: Boolean(row.permission_send),
    permission_manage_mailbox: Boolean(row.permission_manage_mailbox),
    is_default_mailbox: Boolean(row.is_default_mailbox),
    granted_by_account_id: row.granted_by_account_id || "",
    notes: row.notes || ""
  }
}

function ensureMailboxMembership(membership) {
  const db = openDatabase()
  const now = new Date().toISOString()
  const existing = db.prepare(`
    SELECT *
    FROM mailbox_memberships
    WHERE account_id = ?
      AND mailbox_resource_id = ?
    LIMIT 1
  `).get(membership.accountId, membership.mailboxResourceId)

  const row = {
    id: existing?.id || membership.id || `mbm-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    created_at: existing?.created_at || membership.createdAt || now,
    updated_at: now,
    account_id: membership.accountId,
    mailbox_resource_id: membership.mailboxResourceId,
    membership_status: membership.membershipStatus || existing?.membership_status || "active",
    permission_read: membership.permissionRead ? 1 : 0,
    permission_draft: membership.permissionDraft ? 1 : 0,
    permission_validate: membership.permissionValidate ? 1 : 0,
    permission_send: membership.permissionSend ? 1 : 0,
    permission_manage_mailbox: membership.permissionManageMailbox ? 1 : 0,
    is_default_mailbox: membership.isDefaultMailbox ? 1 : 0,
    granted_by_account_id: membership.grantedByAccountId || existing?.granted_by_account_id || null,
    notes: membership.notes || existing?.notes || null
  }

  db.prepare(`
    INSERT INTO mailbox_memberships (
      id,
      created_at,
      updated_at,
      account_id,
      mailbox_resource_id,
      membership_status,
      permission_read,
      permission_draft,
      permission_validate,
      permission_send,
      permission_manage_mailbox,
      is_default_mailbox,
      granted_by_account_id,
      notes
    ) VALUES (
      @id,
      @created_at,
      @updated_at,
      @account_id,
      @mailbox_resource_id,
      @membership_status,
      @permission_read,
      @permission_draft,
      @permission_validate,
      @permission_send,
      @permission_manage_mailbox,
      @is_default_mailbox,
      @granted_by_account_id,
      @notes
    )
    ON CONFLICT(account_id, mailbox_resource_id) DO UPDATE SET
      updated_at = excluded.updated_at,
      membership_status = excluded.membership_status,
      permission_read = excluded.permission_read,
      permission_draft = excluded.permission_draft,
      permission_validate = excluded.permission_validate,
      permission_send = excluded.permission_send,
      permission_manage_mailbox = excluded.permission_manage_mailbox,
      is_default_mailbox = excluded.is_default_mailbox,
      granted_by_account_id = excluded.granted_by_account_id,
      notes = excluded.notes
  `).run(row)

  return getMailboxMembershipForAccountAndResource(row.account_id, row.mailbox_resource_id)
}

function getMailboxMembershipForAccountAndResource(accountId, mailboxResourceId) {
  const db = openDatabase()
  const row = db.prepare(`
    SELECT *
    FROM mailbox_memberships
    WHERE account_id = ?
      AND mailbox_resource_id = ?
    LIMIT 1
  `).get(accountId, mailboxResourceId)

  return mapMailboxMembershipRow(row)
}

function listMailboxMembershipsForAccount(accountId) {
  const db = openDatabase()
  return db.prepare(`
    SELECT *
    FROM mailbox_memberships
    WHERE account_id = ?
    ORDER BY updated_at DESC
  `).all(accountId).map(mapMailboxMembershipRow)
}

function mapMailboxMessageCollaborationRow(row) {
  if (!row) {
    return null
  }

  return {
    id: row.id,
    created_at: row.created_at,
    updated_at: row.updated_at,
    mailbox_resource_id: row.mailbox_resource_id,
    connection_id: row.connection_id,
    gmail_message_id: row.gmail_message_id,
    assigned_to_account_id: row.assigned_to_account_id || "",
    lock_owner_account_id: row.lock_owner_account_id || "",
    lock_expires_at: row.lock_expires_at || "",
    assignment_state: row.assignment_state || "new",
    collaboration_state: row.collaboration_state || "new",
    last_actor_account_id: row.last_actor_account_id || "",
    metadata: parseJsonSafely(row.metadata_json, {})
  }
}

function getMailboxMessageCollaboration(connectionId, gmailMessageId) {
  const db = openDatabase()
  const row = db.prepare(`
    SELECT *
    FROM mailbox_message_collaboration
    WHERE connection_id = ?
      AND gmail_message_id = ?
    LIMIT 1
  `).get(connectionId, gmailMessageId)

  return mapMailboxMessageCollaborationRow(row)
}

function upsertMailboxMessageCollaboration(input) {
  const db = openDatabase()
  const now = new Date().toISOString()
  const existing = getMailboxMessageCollaboration(input.connectionId, input.gmailMessageId)
  const row = {
    id: existing?.id || input.id || `mmc-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    created_at: existing?.created_at || input.createdAt || now,
    updated_at: now,
    mailbox_resource_id: input.mailboxResourceId,
    connection_id: input.connectionId,
    gmail_message_id: input.gmailMessageId,
    assigned_to_account_id: input.assignedToAccountId || null,
    lock_owner_account_id: input.lockOwnerAccountId || null,
    lock_expires_at: input.lockExpiresAt || null,
    assignment_state: input.assignmentState || existing?.assignment_state || "new",
    collaboration_state: input.collaborationState || existing?.collaboration_state || "new",
    last_actor_account_id: input.lastActorAccountId || null,
    metadata_json: JSON.stringify(input.metadata || existing?.metadata || {})
  }

  db.prepare(`
    INSERT INTO mailbox_message_collaboration (
      id,
      created_at,
      updated_at,
      mailbox_resource_id,
      connection_id,
      gmail_message_id,
      assigned_to_account_id,
      lock_owner_account_id,
      lock_expires_at,
      assignment_state,
      collaboration_state,
      last_actor_account_id,
      metadata_json
    ) VALUES (
      @id,
      @created_at,
      @updated_at,
      @mailbox_resource_id,
      @connection_id,
      @gmail_message_id,
      @assigned_to_account_id,
      @lock_owner_account_id,
      @lock_expires_at,
      @assignment_state,
      @collaboration_state,
      @last_actor_account_id,
      @metadata_json
    )
    ON CONFLICT(connection_id, gmail_message_id) DO UPDATE SET
      updated_at = excluded.updated_at,
      mailbox_resource_id = excluded.mailbox_resource_id,
      assigned_to_account_id = excluded.assigned_to_account_id,
      lock_owner_account_id = excluded.lock_owner_account_id,
      lock_expires_at = excluded.lock_expires_at,
      assignment_state = excluded.assignment_state,
      collaboration_state = excluded.collaboration_state,
      last_actor_account_id = excluded.last_actor_account_id,
      metadata_json = excluded.metadata_json
  `).run(row)

  return getMailboxMessageCollaboration(row.connection_id, row.gmail_message_id)
}

function updateMailboxConnectionStatus(connectionId, status, options = {}) {
  const db = openDatabase()
  const existing = getMailboxConnectionById(connectionId)
  if (!existing) {
    return null
  }

  const now = new Date().toISOString()
  db.prepare(`
    UPDATE mailbox_connections
    SET
      connection_status = @connection_status,
      updated_at = @updated_at,
      oauth_state = @oauth_state,
      oauth_scope = @oauth_scope,
      oauth_access_token = @oauth_access_token,
      oauth_refresh_token = @oauth_refresh_token,
      oauth_token_expires_at = @oauth_token_expires_at,
      oauth_external_account_id = @oauth_external_account_id,
      last_sync_at = @last_sync_at,
      last_error = @last_error
    WHERE id = @id
  `).run({
    id: connectionId,
    connection_status: status,
    updated_at: now,
    oauth_state: options.oauthState ?? existing.oauth_state ?? null,
    oauth_scope: options.oauthScope ?? existing.oauth_scope ?? null,
    oauth_access_token: options.oauthAccessToken ?? existing.oauth_access_token ?? null,
    oauth_refresh_token: options.oauthRefreshToken ?? existing.oauth_refresh_token ?? null,
    oauth_token_expires_at: options.oauthTokenExpiresAt ?? existing.oauth_token_expires_at ?? null,
    oauth_external_account_id: options.oauthExternalAccountId ?? existing.oauth_external_account_id ?? null,
    last_sync_at: options.lastSyncAt ?? existing.last_sync_at ?? null,
    last_error: options.lastError ?? existing.last_error ?? null
  })

  return getMailboxConnectionById(connectionId)
}

function getAppSetting(key) {
  const db = openDatabase()
  return db.prepare(`
    SELECT key, value_json, updated_at
    FROM app_settings
    WHERE key = ?
    LIMIT 1
  `).get(key) || null
}

function setAppSetting(key, value) {
  const db = openDatabase()
  const now = new Date().toISOString()
  db.prepare(`
    INSERT INTO app_settings (
      key,
      value_json,
      updated_at
    ) VALUES (
      @key,
      @value_json,
      @updated_at
    )
    ON CONFLICT(key) DO UPDATE SET
      value_json = excluded.value_json,
      updated_at = excluded.updated_at
  `).run({
    key,
    value_json: JSON.stringify(value),
    updated_at: now
  })

  return getAppSetting(key)
}

function getPriorityRulesConfig() {
  const existing = getAppSetting("priority_rules_config")
  if (!existing?.value_json) {
    setAppSetting("priority_rules_config", DEFAULT_PRIORITY_RULES_CONFIG)
    return DEFAULT_PRIORITY_RULES_CONFIG
  }

  try {
    return JSON.parse(existing.value_json)
  } catch (_) {
    setAppSetting("priority_rules_config", DEFAULT_PRIORITY_RULES_CONFIG)
    return DEFAULT_PRIORITY_RULES_CONFIG
  }
}

function setPriorityRulesConfig(config) {
  setAppSetting("priority_rules_config", config)
  return getPriorityRulesConfig()
}

function mapMailRuleRow(row) {
  if (!row) return null

  let metadata = {}
  try {
    metadata = row.metadata_json ? JSON.parse(row.metadata_json) : {}
  } catch (_) {
    metadata = {}
  }

  return {
    id: row.id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    createdBy: row.created_by || "",
    updatedBy: row.updated_by || "",
    status: row.status,
    applicationScope: row.application_scope || "mail_assistant",
    mailboxScope: row.mailbox_scope || "global",
    mailCategoryScope: row.mail_category_scope || "global",
    workflowScope: row.workflow_scope || "reply",
    ruleType: row.rule_type,
    theme: row.theme || "",
    title: row.title || "",
    content: row.content || "",
    missingInfoAction: row.missing_info_action || "cautious_reply",
    priorityRank: Number(row.priority_rank || 100),
    notes: row.notes || "",
    metadata
  }
}

function listMailRules(filters = {}) {
  const db = openDatabase()
  const clauses = []
  const params = {}

  if (filters.status) {
    clauses.push("status = @status")
    params.status = filters.status
  }

  if (filters.applicationScope) {
    clauses.push("application_scope = @application_scope")
    params.application_scope = filters.applicationScope
  }

  if (filters.workflowScope) {
    clauses.push("(workflow_scope = @workflow_scope OR workflow_scope = 'global')")
    params.workflow_scope = filters.workflowScope
  }

  if (filters.mailboxScope) {
    clauses.push("(mailbox_scope = @mailbox_scope OR mailbox_scope = 'global')")
    params.mailbox_scope = filters.mailboxScope
  }

  if (filters.mailCategoryScope) {
    clauses.push("(mail_category_scope = @mail_category_scope OR mail_category_scope = 'global')")
    params.mail_category_scope = filters.mailCategoryScope
  }

  if (filters.ruleType) {
    clauses.push("rule_type = @rule_type")
    params.rule_type = filters.ruleType
  }

  const whereSql = clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : ""
  return db.prepare(`
    SELECT *
    FROM mail_rules
    ${whereSql}
    ORDER BY priority_rank ASC, updated_at DESC, title COLLATE NOCASE ASC
  `).all(params).map(mapMailRuleRow)
}

function createMailRule(rule = {}) {
  const db = openDatabase()
  const now = new Date().toISOString()
  const payload = {
    id: rule.id || `rule-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    created_at: now,
    updated_at: now,
    created_by: rule.createdBy || "",
    updated_by: rule.updatedBy || rule.createdBy || "",
    status: rule.status || "active",
    application_scope: rule.applicationScope || "mail_assistant",
    mailbox_scope: rule.mailboxScope || "global",
    mail_category_scope: rule.mailCategoryScope || "global",
    workflow_scope: rule.workflowScope || "reply",
    rule_type: rule.ruleType || "prudence",
    theme: rule.theme || "",
    title: rule.title || "",
    content: rule.content || "",
    missing_info_action: rule.missingInfoAction || "cautious_reply",
    priority_rank: Number(rule.priorityRank || 100),
    notes: rule.notes || "",
    metadata_json: JSON.stringify(rule.metadata || {})
  }

  db.prepare(`
    INSERT INTO mail_rules (
      id,
      created_at,
      updated_at,
      created_by,
      updated_by,
      status,
      application_scope,
      mailbox_scope,
      mail_category_scope,
      workflow_scope,
      rule_type,
      theme,
      title,
      content,
      missing_info_action,
      priority_rank,
      notes,
      metadata_json
    ) VALUES (
      @id,
      @created_at,
      @updated_at,
      @created_by,
      @updated_by,
      @status,
      @application_scope,
      @mailbox_scope,
      @mail_category_scope,
      @workflow_scope,
      @rule_type,
      @theme,
      @title,
      @content,
      @missing_info_action,
      @priority_rank,
      @notes,
      @metadata_json
    )
  `).run(payload)

  return getMailRuleById(payload.id)
}

function getMailRuleById(ruleId) {
  const db = openDatabase()
  const row = db.prepare(`
    SELECT *
    FROM mail_rules
    WHERE id = ?
    LIMIT 1
  `).get(ruleId)

  return mapMailRuleRow(row)
}

function updateMailRule(ruleId, updates = {}) {
  const existing = getMailRuleById(ruleId)
  if (!existing) {
    return null
  }

  const db = openDatabase()
  const now = new Date().toISOString()
  const next = {
    ...existing,
    status: updates.status || existing.status,
    applicationScope: updates.applicationScope || existing.applicationScope,
    mailboxScope: updates.mailboxScope || existing.mailboxScope,
    mailCategoryScope: updates.mailCategoryScope || existing.mailCategoryScope,
    workflowScope: updates.workflowScope || existing.workflowScope,
    ruleType: updates.ruleType || existing.ruleType,
    theme: updates.theme !== undefined ? updates.theme : existing.theme,
    title: updates.title !== undefined ? updates.title : existing.title,
    content: updates.content !== undefined ? updates.content : existing.content,
    missingInfoAction: updates.missingInfoAction || existing.missingInfoAction,
    priorityRank: updates.priorityRank !== undefined ? Number(updates.priorityRank) : existing.priorityRank,
    notes: updates.notes !== undefined ? updates.notes : existing.notes,
    metadata: updates.metadata !== undefined ? updates.metadata : existing.metadata,
    updatedBy: updates.updatedBy || existing.updatedBy || existing.createdBy || ""
  }

  db.prepare(`
    UPDATE mail_rules
    SET updated_at = @updated_at,
        updated_by = @updated_by,
        status = @status,
        application_scope = @application_scope,
        mailbox_scope = @mailbox_scope,
        mail_category_scope = @mail_category_scope,
        workflow_scope = @workflow_scope,
        rule_type = @rule_type,
        theme = @theme,
        title = @title,
        content = @content,
        missing_info_action = @missing_info_action,
        priority_rank = @priority_rank,
        notes = @notes,
        metadata_json = @metadata_json
    WHERE id = @id
  `).run({
    id: ruleId,
    updated_at: now,
    updated_by: next.updatedBy,
    status: next.status,
    application_scope: next.applicationScope,
    mailbox_scope: next.mailboxScope,
    mail_category_scope: next.mailCategoryScope,
    workflow_scope: next.workflowScope,
    rule_type: next.ruleType,
    theme: next.theme,
    title: next.title,
    content: next.content,
    missing_info_action: next.missingInfoAction,
    priority_rank: next.priorityRank,
    notes: next.notes,
    metadata_json: JSON.stringify(next.metadata || {})
  })

  return getMailRuleById(ruleId)
}

function setMailRuleStatus(ruleId, status, updatedBy = "") {
  return updateMailRule(ruleId, { status, updatedBy })
}

function getApplicableMailRules(filters = {}) {
  const rules = listMailRules({
    status: "active",
    applicationScope: filters.applicationScope || "mail_assistant",
    workflowScope: filters.workflowScope || "reply",
    mailboxScope: filters.mailboxScope || "global",
    mailCategoryScope: filters.mailCategoryScope || "global"
  })

  const filtered = rules.filter((rule) => {
    const theme = String(filters.theme || "").trim().toLowerCase()
    if (!theme) {
      return true
    }
    return !rule.theme || rule.theme.toLowerCase() === theme
  })

  return filtered
}

function mapProviderAccountRow(row) {
  if (!row) return null

  return {
    id: row.id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    ownerScopeType: row.owner_scope_type,
    ownerScopeId: row.owner_scope_id,
    providerType: row.provider_type,
    providerLabel: row.provider_label,
    credentialMode: row.credential_mode,
    apiKeyEncrypted: row.api_key_encrypted,
    apiKeyMasked: row.api_key_masked,
    status: row.status,
    isDefault: Boolean(row.is_default),
    billingMode: row.billing_mode,
    monthlyBudgetCents: Number(row.monthly_budget_cents || 0),
    currency: row.currency || "EUR",
    notes: row.notes || "",
    lastTestedAt: row.last_tested_at || "",
    lastError: row.last_error || ""
  }
}

function mapProviderUsageEventRow(row) {
  if (!row) return null

  return {
    id: row.id,
    createdAt: row.created_at,
    accountId: row.account_id,
    providerAccountId: row.provider_account_id,
    providerType: row.provider_type,
    featureType: row.feature_type,
    requestMode: row.request_mode,
    quantity: Number(row.quantity || 0),
    quantityUnit: row.quantity_unit,
    estimatedCostCents: Number(row.estimated_cost_cents || 0),
    currency: row.currency || "EUR",
    status: row.status,
    requestId: row.request_id || "",
    mailboxResourceId: row.mailbox_resource_id || "",
    metadata: parseJsonSafely(row.metadata_json, {})
  }
}

function getProviderAccountById(providerAccountId) {
  const db = openDatabase()
  const row = db.prepare(`
    SELECT *
    FROM provider_accounts
    WHERE id = ?
    LIMIT 1
  `).get(providerAccountId)

  return mapProviderAccountRow(row)
}

function listProviderAccountsForOwner(ownerScopeType, ownerScopeId) {
  const db = openDatabase()
  const rows = db.prepare(`
    SELECT *
    FROM provider_accounts
    WHERE owner_scope_type = ?
      AND owner_scope_id = ?
    ORDER BY provider_type ASC, is_default DESC, updated_at DESC
  `).all(ownerScopeType, ownerScopeId)

  return rows.map(mapProviderAccountRow)
}

function getDefaultProviderAccountForOwner(ownerScopeType, ownerScopeId, providerType) {
  const db = openDatabase()
  const defaultRow = db.prepare(`
    SELECT *
    FROM provider_accounts
    WHERE owner_scope_type = ?
      AND owner_scope_id = ?
      AND provider_type = ?
      AND status = 'active'
      AND is_default = 1
    ORDER BY updated_at DESC
    LIMIT 1
  `).get(ownerScopeType, ownerScopeId, providerType)

  if (defaultRow) {
    return mapProviderAccountRow(defaultRow)
  }

  const fallbackRow = db.prepare(`
    SELECT *
    FROM provider_accounts
    WHERE owner_scope_type = ?
      AND owner_scope_id = ?
      AND provider_type = ?
      AND status = 'active'
    ORDER BY updated_at DESC
    LIMIT 1
  `).get(ownerScopeType, ownerScopeId, providerType)

  return mapProviderAccountRow(fallbackRow)
}

function upsertProviderAccount(payload) {
  const db = openDatabase()
  const now = payload.updatedAt || new Date().toISOString()
  const existing = payload.id ? getProviderAccountById(payload.id) : null
  const providerId = existing?.id || payload.id || `prov-${Date.now()}-${Math.floor(Math.random() * 1000)}`

  if (payload.isDefault) {
    db.prepare(`
      UPDATE provider_accounts
      SET is_default = 0,
          updated_at = ?
      WHERE owner_scope_type = ?
        AND owner_scope_id = ?
        AND provider_type = ?
        AND id <> ?
    `).run(now, payload.ownerScopeType, payload.ownerScopeId, payload.providerType, providerId)
  }

  db.prepare(`
    INSERT INTO provider_accounts (
      id,
      created_at,
      updated_at,
      owner_scope_type,
      owner_scope_id,
      provider_type,
      provider_label,
      credential_mode,
      api_key_encrypted,
      api_key_masked,
      status,
      is_default,
      billing_mode,
      monthly_budget_cents,
      currency,
      notes,
      last_tested_at,
      last_error
    ) VALUES (
      @id,
      @created_at,
      @updated_at,
      @owner_scope_type,
      @owner_scope_id,
      @provider_type,
      @provider_label,
      @credential_mode,
      @api_key_encrypted,
      @api_key_masked,
      @status,
      @is_default,
      @billing_mode,
      @monthly_budget_cents,
      @currency,
      @notes,
      @last_tested_at,
      @last_error
    )
    ON CONFLICT(id) DO UPDATE SET
      updated_at = excluded.updated_at,
      provider_label = excluded.provider_label,
      credential_mode = excluded.credential_mode,
      api_key_encrypted = excluded.api_key_encrypted,
      api_key_masked = excluded.api_key_masked,
      status = excluded.status,
      is_default = excluded.is_default,
      billing_mode = excluded.billing_mode,
      monthly_budget_cents = excluded.monthly_budget_cents,
      currency = excluded.currency,
      notes = excluded.notes,
      last_tested_at = excluded.last_tested_at,
      last_error = excluded.last_error
  `).run({
    id: providerId,
    created_at: existing?.createdAt || payload.createdAt || now,
    updated_at: now,
    owner_scope_type: payload.ownerScopeType,
    owner_scope_id: payload.ownerScopeId,
    provider_type: payload.providerType,
    provider_label: payload.providerLabel,
    credential_mode: payload.credentialMode,
    api_key_encrypted: payload.apiKeyEncrypted,
    api_key_masked: payload.apiKeyMasked,
    status: payload.status || "active",
    is_default: payload.isDefault ? 1 : 0,
    billing_mode: payload.billingMode || "personal",
    monthly_budget_cents: Number(payload.monthlyBudgetCents || 0),
    currency: payload.currency || "EUR",
    notes: payload.notes || "",
    last_tested_at: payload.lastTestedAt || null,
    last_error: payload.lastError || ""
  })

  return getProviderAccountById(providerId)
}

function updateProviderAccount(providerAccountId, payload = {}) {
  const existing = getProviderAccountById(providerAccountId)
  if (!existing) {
    return null
  }

  return upsertProviderAccount({
    ...existing,
    ...payload,
    id: providerAccountId,
    ownerScopeType: existing.ownerScopeType,
    ownerScopeId: existing.ownerScopeId,
    providerType: existing.providerType,
    providerLabel: payload.providerLabel || existing.providerLabel,
    credentialMode: existing.credentialMode,
    apiKeyEncrypted: payload.apiKeyEncrypted || existing.apiKeyEncrypted,
    apiKeyMasked: payload.apiKeyMasked || existing.apiKeyMasked,
    status: payload.status || existing.status,
    isDefault: payload.isDefault ?? existing.isDefault,
    billingMode: payload.billingMode || existing.billingMode,
    monthlyBudgetCents: payload.monthlyBudgetCents ?? existing.monthlyBudgetCents,
    currency: payload.currency || existing.currency,
    notes: payload.notes ?? existing.notes,
    lastTestedAt: payload.lastTestedAt ?? existing.lastTestedAt,
    lastError: payload.lastError ?? existing.lastError
  })
}

function deactivateProviderAccount(providerAccountId) {
  return updateProviderAccount(providerAccountId, {
    status: "inactive",
    isDefault: false
  })
}

function markProviderAccountTestResult(providerAccountId, payload = {}) {
  const status = payload.success === false ? (payload.status || "invalid") : (payload.status || "active")
  return updateProviderAccount(providerAccountId, {
    status,
    lastTestedAt: payload.lastTestedAt || new Date().toISOString(),
    lastError: payload.lastError || ""
  })
}

function recordProviderUsageEvent(payload) {
  const db = openDatabase()
  const usageId = payload.id || `usage-${Date.now()}-${Math.floor(Math.random() * 1000)}`
  const createdAt = payload.createdAt || new Date().toISOString()

  db.prepare(`
    INSERT INTO provider_usage_events (
      id,
      created_at,
      account_id,
      provider_account_id,
      provider_type,
      feature_type,
      request_mode,
      quantity,
      quantity_unit,
      estimated_cost_cents,
      currency,
      status,
      request_id,
      mailbox_resource_id,
      metadata_json
    ) VALUES (
      @id,
      @created_at,
      @account_id,
      @provider_account_id,
      @provider_type,
      @feature_type,
      @request_mode,
      @quantity,
      @quantity_unit,
      @estimated_cost_cents,
      @currency,
      @status,
      @request_id,
      @mailbox_resource_id,
      @metadata_json
    )
  `).run({
    id: usageId,
    created_at: createdAt,
    account_id: payload.accountId,
    provider_account_id: payload.providerAccountId,
    provider_type: payload.providerType,
    feature_type: payload.featureType,
    request_mode: payload.requestMode,
    quantity: Number(payload.quantity || 0),
    quantity_unit: payload.quantityUnit || "requests",
    estimated_cost_cents: Number(payload.estimatedCostCents || 0),
    currency: payload.currency || "EUR",
    status: payload.status || "success",
    request_id: payload.requestId || null,
    mailbox_resource_id: payload.mailboxResourceId || null,
    metadata_json: payload.metadataJson || null
  })

  const row = db.prepare(`
    SELECT *
    FROM provider_usage_events
    WHERE id = ?
    LIMIT 1
  `).get(usageId)

  return mapProviderUsageEventRow(row)
}

function listProviderUsageEventsForAccount(accountId, options = {}) {
  const db = openDatabase()
  const clauses = ["account_id = ?"]
  const values = [accountId]

  if (options.providerType) {
    clauses.push("provider_type = ?")
    values.push(options.providerType)
  }

  if (options.featureType) {
    clauses.push("feature_type = ?")
    values.push(options.featureType)
  }

  if (options.since) {
    clauses.push("created_at >= ?")
    values.push(options.since)
  }

  const limit = Math.max(1, Math.min(Number(options.limit || 100), 500))
  const rows = db.prepare(`
    SELECT *
    FROM provider_usage_events
    WHERE ${clauses.join(" AND ")}
    ORDER BY created_at DESC
    LIMIT ${limit}
  `).all(...values)

  return rows.map(mapProviderUsageEventRow)
}

function getProviderUsageSummaryForAccount(accountId, options = {}) {
  const db = openDatabase()
  const clauses = ["account_id = ?"]
  const values = [accountId]

  if (options.providerType) {
    clauses.push("provider_type = ?")
    values.push(options.providerType)
  }

  if (options.featureType) {
    clauses.push("feature_type = ?")
    values.push(options.featureType)
  }

  if (options.since) {
    clauses.push("created_at >= ?")
    values.push(options.since)
  }

  const rows = db.prepare(`
    SELECT
      provider_type,
      SUM(quantity) AS total_quantity,
      MIN(quantity_unit) AS quantity_unit,
      SUM(estimated_cost_cents) AS total_cost,
      MIN(currency) AS currency,
      COUNT(*) AS events_count
    FROM provider_usage_events
    WHERE ${clauses.join(" AND ")}
    GROUP BY provider_type
    ORDER BY provider_type ASC
  `).all(...values)

  const providers = rows.map((row) => ({
    providerType: row.provider_type,
    quantity: Number(row.total_quantity || 0),
    quantityUnit: row.quantity_unit || "requests",
    estimatedCostCents: Number(row.total_cost || 0),
    currency: row.currency || "EUR",
    eventsCount: Number(row.events_count || 0)
  }))

  return {
    totalEstimatedCostCents: providers.reduce((sum, row) => sum + row.estimatedCostCents, 0),
    currency: providers[0]?.currency || "EUR",
    eventsCount: providers.reduce((sum, row) => sum + row.eventsCount, 0),
    providers
  }
}

function getProviderUsageSummaryForProviderAccount(providerAccountId, options = {}) {
  const db = openDatabase()
  const clauses = ["provider_account_id = ?"]
  const values = [providerAccountId]

  if (options.since) {
    clauses.push("created_at >= ?")
    values.push(options.since)
  }

  const row = db.prepare(`
    SELECT
      provider_account_id,
      provider_type,
      SUM(quantity) AS total_quantity,
      MIN(quantity_unit) AS quantity_unit,
      SUM(estimated_cost_cents) AS total_cost,
      MIN(currency) AS currency,
      COUNT(*) AS events_count
    FROM provider_usage_events
    WHERE ${clauses.join(" AND ")}
    GROUP BY provider_account_id, provider_type
    LIMIT 1
  `).get(...values)

  if (!row) {
    return {
      providerAccountId,
      providerType: "",
      quantity: 0,
      quantityUnit: "requests",
      estimatedCostCents: 0,
      currency: "EUR",
      eventsCount: 0
    }
  }

  return {
    providerAccountId: row.provider_account_id,
    providerType: row.provider_type,
    quantity: Number(row.total_quantity || 0),
    quantityUnit: row.quantity_unit || "requests",
    estimatedCostCents: Number(row.total_cost || 0),
    currency: row.currency || "EUR",
    eventsCount: Number(row.events_count || 0)
  }
}

function getUserPreferences(accountId) {
  const db = openDatabase()
  const row = db.prepare(`
    SELECT *
    FROM user_preferences
    WHERE account_id = ?
    LIMIT 1
  `).get(accountId)

  if (!row) {
    return null
  }

  return {
    accountId: row.account_id,
    updatedAt: row.updated_at,
    ui: parseJsonSafely(row.ui_settings_json, {}),
    audio: parseJsonSafely(row.audio_settings_json, {}),
    mail: parseJsonSafely(row.mail_settings_json, {}),
    provider: parseJsonSafely(row.provider_preferences_json, {})
  }
}

function saveUserPreferences(accountId, payload = {}) {
  const db = openDatabase()
  const now = new Date().toISOString()
  const existing = getUserPreferences(accountId) || {
    ui: {},
    audio: {},
    mail: {},
    provider: {}
  }

  const next = {
    ui: payload.ui ?? existing.ui,
    audio: payload.audio ?? existing.audio,
    mail: payload.mail ?? existing.mail,
    provider: payload.provider ?? existing.provider
  }

  db.prepare(`
    INSERT INTO user_preferences (
      account_id,
      updated_at,
      ui_settings_json,
      audio_settings_json,
      mail_settings_json,
      provider_preferences_json
    ) VALUES (
      @account_id,
      @updated_at,
      @ui_settings_json,
      @audio_settings_json,
      @mail_settings_json,
      @provider_preferences_json
    )
    ON CONFLICT(account_id) DO UPDATE SET
      updated_at = excluded.updated_at,
      ui_settings_json = excluded.ui_settings_json,
      audio_settings_json = excluded.audio_settings_json,
      mail_settings_json = excluded.mail_settings_json,
      provider_preferences_json = excluded.provider_preferences_json
  `).run({
    account_id: accountId,
    updated_at: now,
    ui_settings_json: JSON.stringify(next.ui || {}),
    audio_settings_json: JSON.stringify(next.audio || {}),
    mail_settings_json: JSON.stringify(next.mail || {}),
    provider_preferences_json: JSON.stringify(next.provider || {})
  })

  return getUserPreferences(accountId)
}

function upsertMailboxMessageAction(action) {
  const db = openDatabase()
  const now = action.updatedAt || new Date().toISOString()
  const existing = db.prepare(`
    SELECT id
    FROM mailbox_message_actions
    WHERE account_id = ?
      AND connection_id = ?
      AND gmail_message_id = ?
    LIMIT 1
  `).get(action.accountId, action.connectionId, action.gmailMessageId)

  const row = {
    id: existing?.id || action.id || `mma-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    account_id: action.accountId,
    connection_id: action.connectionId,
    mailbox_email: action.mailboxEmail,
    gmail_message_id: action.gmailMessageId,
    gmail_thread_id: action.gmailThreadId || null,
    from_email: action.fromEmail || null,
    subject: action.subject || null,
    action_type: action.actionType,
    action_reason: action.actionReason || null,
    reply_subject: action.replySubject || null,
    reply_body: action.replyBody || null,
    sent_message_id: action.sentMessageId || null,
    source_status: action.sourceStatus,
    created_at: existing ? (action.createdAt || now) : (action.createdAt || now),
    updated_at: now,
    metadata_json: action.metadataJson || null
  }

  db.prepare(`
    INSERT INTO mailbox_message_actions (
      id,
      account_id,
      connection_id,
      mailbox_email,
      gmail_message_id,
      gmail_thread_id,
      from_email,
      subject,
      action_type,
      action_reason,
      reply_subject,
      reply_body,
      sent_message_id,
      source_status,
      created_at,
      updated_at,
      metadata_json
    ) VALUES (
      @id,
      @account_id,
      @connection_id,
      @mailbox_email,
      @gmail_message_id,
      @gmail_thread_id,
      @from_email,
      @subject,
      @action_type,
      @action_reason,
      @reply_subject,
      @reply_body,
      @sent_message_id,
      @source_status,
      @created_at,
      @updated_at,
      @metadata_json
    )
    ON CONFLICT(account_id, connection_id, gmail_message_id) DO UPDATE SET
      mailbox_email = excluded.mailbox_email,
      gmail_thread_id = excluded.gmail_thread_id,
      from_email = excluded.from_email,
      subject = excluded.subject,
      action_type = excluded.action_type,
      action_reason = excluded.action_reason,
      reply_subject = excluded.reply_subject,
      reply_body = excluded.reply_body,
      sent_message_id = excluded.sent_message_id,
      source_status = excluded.source_status,
      updated_at = excluded.updated_at,
      metadata_json = excluded.metadata_json
  `).run(row)

  return db.prepare(`
    SELECT *
    FROM mailbox_message_actions
    WHERE id = ?
    LIMIT 1
  `).get(row.id) || null
}

function mapMailboxMessageActionRow(row) {
  if (!row) {
    return null
  }

  let metadata = {}
  try {
    metadata = row.metadata_json ? JSON.parse(row.metadata_json) : {}
  } catch (_) {
    metadata = {}
  }

  return {
    ...row,
    metadata
  }
}

function mapAutomationPolicyRow(row) {
  if (!row) {
    return null
  }

  let allowedActions = []
  let policy = {}

  try {
    allowedActions = row.allowed_actions_json ? JSON.parse(row.allowed_actions_json) : []
  } catch (_) {
    allowedActions = []
  }

  try {
    policy = row.policy_json ? JSON.parse(row.policy_json) : {}
  } catch (_) {
    policy = {}
  }

  return {
    id: row.id,
    account_id: row.account_id,
    connection_id: row.connection_id,
    policy_scope: row.policy_scope,
    policy_status: row.policy_status,
    automation_level: row.automation_level,
    browser_provider: row.browser_provider,
    browser_enabled: Boolean(row.browser_enabled),
    navigation_enabled: Boolean(row.navigation_enabled),
    message_open_enabled: Boolean(row.message_open_enabled),
    context_collection_enabled: Boolean(row.context_collection_enabled),
    draft_injection_enabled: Boolean(row.draft_injection_enabled),
    send_enabled: Boolean(row.send_enabled),
    human_validation_required: Boolean(row.human_validation_required),
    allowed_actions: allowedActions,
    policy,
    created_at: row.created_at,
    updated_at: row.updated_at,
    updated_by: row.updated_by || ""
  }
}

function upsertAutomationPolicy(policy) {
  const db = openDatabase()
  const now = policy.updatedAt || new Date().toISOString()
  const existing = db.prepare(`
    SELECT id, created_at
    FROM automation_policies
    WHERE account_id = ?
      AND connection_id = ?
    LIMIT 1
  `).get(policy.accountId, policy.connectionId)

  const row = {
    id: existing?.id || policy.id || `autopol-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    account_id: policy.accountId,
    connection_id: policy.connectionId,
    policy_scope: policy.policyScope || "mailbox_connection",
    policy_status: policy.policyStatus || "draft",
    automation_level: policy.automationLevel || "manual_assisted",
    browser_provider: policy.browserProvider || "browser_use",
    browser_enabled: policy.browserEnabled ? 1 : 0,
    navigation_enabled: policy.navigationEnabled ? 1 : 0,
    message_open_enabled: policy.messageOpenEnabled ? 1 : 0,
    context_collection_enabled: policy.contextCollectionEnabled ? 1 : 0,
    draft_injection_enabled: policy.draftInjectionEnabled ? 1 : 0,
    send_enabled: policy.sendEnabled ? 1 : 0,
    human_validation_required: policy.humanValidationRequired === false ? 0 : 1,
    allowed_actions_json: JSON.stringify(policy.allowedActions || []),
    policy_json: JSON.stringify(policy.policy || {}),
    created_at: existing?.created_at || policy.createdAt || now,
    updated_at: now,
    updated_by: policy.updatedBy || null
  }

  db.prepare(`
    INSERT INTO automation_policies (
      id,
      account_id,
      connection_id,
      policy_scope,
      policy_status,
      automation_level,
      browser_provider,
      browser_enabled,
      navigation_enabled,
      message_open_enabled,
      context_collection_enabled,
      draft_injection_enabled,
      send_enabled,
      human_validation_required,
      allowed_actions_json,
      policy_json,
      created_at,
      updated_at,
      updated_by
    ) VALUES (
      @id,
      @account_id,
      @connection_id,
      @policy_scope,
      @policy_status,
      @automation_level,
      @browser_provider,
      @browser_enabled,
      @navigation_enabled,
      @message_open_enabled,
      @context_collection_enabled,
      @draft_injection_enabled,
      @send_enabled,
      @human_validation_required,
      @allowed_actions_json,
      @policy_json,
      @created_at,
      @updated_at,
      @updated_by
    )
    ON CONFLICT(account_id, connection_id) DO UPDATE SET
      policy_scope = excluded.policy_scope,
      policy_status = excluded.policy_status,
      automation_level = excluded.automation_level,
      browser_provider = excluded.browser_provider,
      browser_enabled = excluded.browser_enabled,
      navigation_enabled = excluded.navigation_enabled,
      message_open_enabled = excluded.message_open_enabled,
      context_collection_enabled = excluded.context_collection_enabled,
      draft_injection_enabled = excluded.draft_injection_enabled,
      send_enabled = excluded.send_enabled,
      human_validation_required = excluded.human_validation_required,
      allowed_actions_json = excluded.allowed_actions_json,
      policy_json = excluded.policy_json,
      updated_at = excluded.updated_at,
      updated_by = excluded.updated_by
  `).run(row)

  return getAutomationPolicyForConnection(policy.accountId, policy.connectionId)
}

function getAutomationPolicyForConnection(accountId, connectionId) {
  const db = openDatabase()
  const row = db.prepare(`
    SELECT *
    FROM automation_policies
    WHERE account_id = ?
      AND connection_id = ?
    LIMIT 1
  `).get(accountId, connectionId)

  return mapAutomationPolicyRow(row)
}

function mapBrowserUseSessionRow(row) {
  if (!row) {
    return null
  }

  let executionPlan = []
  let result = {}
  let metadata = {}

  try {
    executionPlan = row.execution_plan_json ? JSON.parse(row.execution_plan_json) : []
  } catch (_) {
    executionPlan = []
  }

  try {
    result = row.result_json ? JSON.parse(row.result_json) : {}
  } catch (_) {
    result = {}
  }

  try {
    metadata = row.metadata_json ? JSON.parse(row.metadata_json) : {}
  } catch (_) {
    metadata = {}
  }

  return {
    id: row.id,
    account_id: row.account_id,
    connection_id: row.connection_id,
    automation_policy_id: row.automation_policy_id || "",
    provider_id: row.provider_id,
    objective: row.objective,
    target_message_id: row.target_message_id || "",
    session_status: row.session_status,
    run_mode: row.run_mode,
    validation_mode: row.validation_mode,
    created_at: row.created_at,
    updated_at: row.updated_at,
    started_at: row.started_at || "",
    completed_at: row.completed_at || "",
    error_message: row.error_message || "",
    execution_plan: executionPlan,
    result,
    metadata
  }
}

function createBrowserUseSession(session) {
  const db = openDatabase()
  const now = session.createdAt || new Date().toISOString()
  const row = {
    id: session.id || `busess-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    account_id: session.accountId,
    connection_id: session.connectionId,
    automation_policy_id: session.automationPolicyId || null,
    provider_id: session.providerId || "browser_use",
    objective: session.objective,
    target_message_id: session.targetMessageId || null,
    session_status: session.sessionStatus || "planned",
    run_mode: session.runMode || "assistive",
    validation_mode: session.validationMode || "human_required",
    created_at: now,
    updated_at: session.updatedAt || now,
    started_at: session.startedAt || null,
    completed_at: session.completedAt || null,
    error_message: session.errorMessage || null,
    execution_plan_json: JSON.stringify(session.executionPlan || []),
    result_json: JSON.stringify(session.result || {}),
    metadata_json: JSON.stringify(session.metadata || {})
  }

  db.prepare(`
    INSERT INTO browser_use_sessions (
      id,
      account_id,
      connection_id,
      automation_policy_id,
      provider_id,
      objective,
      target_message_id,
      session_status,
      run_mode,
      validation_mode,
      created_at,
      updated_at,
      started_at,
      completed_at,
      error_message,
      execution_plan_json,
      result_json,
      metadata_json
    ) VALUES (
      @id,
      @account_id,
      @connection_id,
      @automation_policy_id,
      @provider_id,
      @objective,
      @target_message_id,
      @session_status,
      @run_mode,
      @validation_mode,
      @created_at,
      @updated_at,
      @started_at,
      @completed_at,
      @error_message,
      @execution_plan_json,
      @result_json,
      @metadata_json
    )
  `).run(row)

  return getBrowserUseSessionById(row.id)
}

function getBrowserUseSessionById(sessionId) {
  const db = openDatabase()
  const row = db.prepare(`
    SELECT *
    FROM browser_use_sessions
    WHERE id = ?
    LIMIT 1
  `).get(sessionId)

  return mapBrowserUseSessionRow(row)
}

function listBrowserUseSessionsForConnection(accountId, connectionId, options = {}) {
  const db = openDatabase()
  const limit = Math.max(1, Math.min(Number(options.limit || 10), 50))

  return db.prepare(`
    SELECT *
    FROM browser_use_sessions
    WHERE account_id = ?
      AND connection_id = ?
    ORDER BY created_at DESC
    LIMIT ?
  `).all(accountId, connectionId, limit).map(mapBrowserUseSessionRow)
}

function listProcessedMailboxMessageIds(accountId, connectionId) {
  const db = openDatabase()
  return db.prepare(`
    SELECT gmail_message_id
    FROM mailbox_message_actions
    WHERE account_id = ?
      AND connection_id = ?
      AND source_status IN ('validated', 'deleted')
  `).all(accountId, connectionId).map((row) => row.gmail_message_id)
}

function listMailboxMessageActionsForConnection(accountId, connectionId) {
  const db = openDatabase()
  return db.prepare(`
    SELECT *
    FROM mailbox_message_actions
    WHERE account_id = ?
      AND connection_id = ?
  `).all(accountId, connectionId).map(mapMailboxMessageActionRow)
}

function getMailboxMessageActionStats(accountId, connectionId) {
  const db = openDatabase()
  const rows = db.prepare(`
    SELECT action_type, COUNT(*) AS total
    FROM mailbox_message_actions
    WHERE account_id = ?
      AND connection_id = ?
    GROUP BY action_type
  `).all(accountId, connectionId)

  const stats = {
    validated: 0,
    rejected: 0,
    deleted: 0
  }

  for (const row of rows) {
    if (row.action_type === "validated") {
      stats.validated = Number(row.total || 0)
    } else if (row.action_type === "rejected") {
      stats.rejected = Number(row.total || 0)
    } else if (row.action_type === "deleted") {
      stats.deleted = Number(row.total || 0)
    }
  }

  return stats
}

function deleteMailboxConnectionForAccount(connectionId, accountId) {
  const db = openDatabase()
  const existing = getMailboxConnectionByIdForAccount(connectionId, accountId)
  if (!existing) {
    return null
  }

  db.prepare(`
    DELETE FROM mailbox_connections
    WHERE id = ?
      AND account_id = ?
  `).run(connectionId, accountId)

  return existing
}

function deleteAccountPermanently(accountId, options = {}) {
  const db = openDatabase()
  const existingAccount = getAccountById(accountId)
  if (!existingAccount) {
    return null
  }

  const now = new Date().toISOString()

  db.exec("BEGIN TRANSACTION;")

  try {
    if (existingAccount.source_request_id) {
      db.prepare(`
        UPDATE account_requests
        SET
          updated_at = @updated_at,
          status = @status,
          linked_account_id = '',
          admin_notes = @admin_notes,
          reviewed_by = @reviewed_by,
          reviewed_at = @reviewed_at
        WHERE id = @id
      `).run({
        id: existingAccount.source_request_id,
        updated_at: now,
        status: "deleted",
        admin_notes: options.adminNotes || "Compte supprimé par l'administrateur.",
        reviewed_by: options.reviewedBy || "admin-manuel",
        reviewed_at: now
      })
    }

    db.prepare("DELETE FROM mailboxes WHERE account_id = ?").run(accountId)
    db.prepare("DELETE FROM mailbox_connections WHERE account_id = ?").run(accountId)
    db.prepare("DELETE FROM user_stats WHERE account_id = ?").run(accountId)
    db.prepare("DELETE FROM invoices WHERE account_id = ?").run(accountId)
    db.prepare("DELETE FROM billing_profiles WHERE account_id = ?").run(accountId)
    db.prepare("DELETE FROM accounts WHERE id = ?").run(accountId)

    insertAccountAction({
      id: `act-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      created_at: now,
      actor_id: options.reviewedBy || "admin-manuel",
      target_type: "account",
      target_id: accountId,
      action_type: "deleted",
      notes: options.adminNotes || "Compte supprimé.",
      metadata_json: JSON.stringify({
        sourceRequestId: existingAccount.source_request_id || "",
        email: existingAccount.email
      })
    })

    db.exec("COMMIT;")
  } catch (error) {
    db.exec("ROLLBACK;")
    throw error
  }

  return existingAccount
}

function updateAccountRequestStatus(requestId, status, options = {}) {
  const db = openDatabase()
  const existingRequest = getAccountRequestById(requestId)
  if (!existingRequest) {
    return null
  }

  const now = new Date().toISOString()
  db.prepare(`
    UPDATE account_requests
    SET
      status = @status,
      updated_at = @updated_at,
      admin_notes = @admin_notes,
      requested_additional_info = @requested_additional_info,
      reviewed_by = @reviewed_by,
      reviewed_at = @reviewed_at
    WHERE id = @id
  `).run({
    id: requestId,
    status,
    updated_at: now,
    admin_notes: options.adminNotes || existingRequest.admin_notes || "",
    requested_additional_info: options.requestedAdditionalInfo || "",
    reviewed_by: options.reviewedBy || "admin-manuel",
    reviewed_at: now
  })

  let updatedRequest = getAccountRequestById(requestId)
  let accountAlreadyHandled = false

  if (!updatedRequest?.linked_account_id && status === "approved") {
    const createdAccount = createPendingAccountFromRequest(mapRequestRowToStoredRequest(updatedRequest))
    updatedRequest = getAccountRequestById(requestId)

    if (createdAccount?.id) {
      updateAccountStatus(createdAccount.id, "active", {
        reviewedBy: options.reviewedBy || "admin-manuel",
        productVersion: options.productVersion || "base",
        adminNotes: options.adminNotes || "",
        passwordHash: options.passwordHash
      })
      accountAlreadyHandled = true
    }
  }

  if (updatedRequest?.linked_account_id && !accountAlreadyHandled) {
    if (status === "approved") {
      updateAccountStatus(updatedRequest.linked_account_id, "active", {
        reviewedBy: options.reviewedBy || "admin-manuel",
        productVersion: options.productVersion || "base",
        adminNotes: options.adminNotes || "",
        passwordHash: options.passwordHash
      })
    } else if (status === "rejected") {
      updateAccountStatus(updatedRequest.linked_account_id, "rejected", {
        reviewedBy: options.reviewedBy || "admin-manuel",
        adminNotes: options.adminNotes || ""
      })
    }
  }

  insertAccountAction({
    id: `act-${Date.now()}`,
    created_at: now,
    actor_id: options.reviewedBy || "admin-manuel",
    target_type: "account_request",
    target_id: requestId,
    action_type: status,
    notes: options.adminNotes || options.requestedAdditionalInfo || "",
    metadata_json: JSON.stringify({
      linkedAccountId: updatedRequest?.linked_account_id || ""
    })
  })

  return getAccountRequestById(requestId)
}

module.exports = {
  openDatabase,
  insertAccountRequest,
  findOpenRequestByEmailAndType,
  findAccountByEmailAndType,
  hasAnyAdminAccount,
  createAdminAccount,
  createPendingAccountFromRequest,
  getDatabaseInfo,
  listAccountRequests,
  listAccounts,
  getAccountRequestById,
  getAccountById,
  updateAccountRequestStatus,
  updateAccountStatus,
  updateAccountPassword,
  createPasswordResetToken,
  getPasswordResetToken,
  consumePasswordResetToken,
  createUserSession,
  getUserSession,
  closeUserSession,
  closeUserSessionsForAccount,
  getUserPreferences,
  saveUserPreferences,
  upsertProviderAccount,
  getProviderAccountById,
  listProviderAccountsForOwner,
  getDefaultProviderAccountForOwner,
  updateProviderAccount,
  deactivateProviderAccount,
  markProviderAccountTestResult,
  recordProviderUsageEvent,
  listProviderUsageEventsForAccount,
  getProviderUsageSummaryForAccount,
  getProviderUsageSummaryForProviderAccount,
  upsertMailboxConnection,
  getMailboxConnectionById,
  getMailboxConnectionByIdForAccount,
  getMailboxConnectionByState,
  listMailboxConnectionsForAccount,
  listMailboxResourcesAdmin,
  getOrCreateMailboxResourceForConnection,
  getMailboxResourceById,
  updateMailboxResource,
  ensureMailboxMembership,
  getMailboxMembershipForAccountAndResource,
  listMailboxMembershipsForAccount,
  getMailboxMessageCollaboration,
  upsertMailboxMessageCollaboration,
  updateMailboxConnectionStatus,
  getAppSetting,
  setAppSetting,
  getPriorityRulesConfig,
  setPriorityRulesConfig,
  listMailRules,
  createMailRule,
  getMailRuleById,
  updateMailRule,
  setMailRuleStatus,
  getApplicableMailRules,
  upsertMailboxMessageAction,
  upsertAutomationPolicy,
  getAutomationPolicyForConnection,
  createBrowserUseSession,
  getBrowserUseSessionById,
  listBrowserUseSessionsForConnection,
  listMailboxMessageActionsForConnection,
  listProcessedMailboxMessageIds,
  getMailboxMessageActionStats,
  deleteMailboxConnectionForAccount,
  deleteAccountPermanently,
  databasePath
}
