
USE tokenmeter_db;

-- 1. Plans
CREATE TABLE plans (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    monthly_base_fee_kobo BIGINT UNSIGNED NOT NULL,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
);

-- 2. Graduated price tiers
CREATE TABLE price_tiers (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    plan_id BIGINT UNSIGNED NOT NULL,
    meter_name VARCHAR(100) NOT NULL,
    from_quantity BIGINT UNSIGNED NOT NULL,
    to_quantity BIGINT UNSIGNED NULL,
    price_per_unit_kobo BIGINT UNSIGNED NOT NULL,

    FOREIGN KEY (plan_id) REFERENCES plans(id),
    UNIQUE (plan_id, meter_name, from_quantity)
);

-- 3. Customers and spending caps
CREATE TABLE customers (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    monthly_spending_cap_kobo BIGINT UNSIGNED NULL,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
);

-- 4. Subscriptions
CREATE TABLE subscriptions (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    customer_id BIGINT UNSIGNED NOT NULL,
    plan_id BIGINT UNSIGNED NOT NULL,
    status ENUM(
        'trialing',
        'active',
        'past_due',
        'suspended'
    ) NOT NULL DEFAULT 'trialing',
    trial_ends_at DATETIME(3) NULL,
    started_at DATETIME(3) NOT NULL,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    FOREIGN KEY (customer_id) REFERENCES customers(id),
    FOREIGN KEY (plan_id) REFERENCES plans(id),

    INDEX idx_subscription_customer (customer_id, status)
);

-- 5. Usage events
CREATE TABLE usage_events (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    event_id VARCHAR(191) NOT NULL UNIQUE,
    customer_id BIGINT UNSIGNED NOT NULL,
    meter_name VARCHAR(100) NOT NULL,
    quantity BIGINT UNSIGNED NOT NULL,
    event_time DATETIME(3) NOT NULL,
    received_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    FOREIGN KEY (customer_id) REFERENCES customers(id),
    INDEX idx_usage_billing (customer_id, event_time),
    INDEX idx_usage_meter (meter_name, event_time)
);

-- 6. Billing periods
CREATE TABLE billing_periods (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    customer_id BIGINT UNSIGNED NOT NULL,
    period_start DATETIME(3) NOT NULL,
    period_end DATETIME(3) NOT NULL,
    status ENUM('open', 'closed') NOT NULL DEFAULT 'open',
    closed_at DATETIME(3) NULL,

    FOREIGN KEY (customer_id) REFERENCES customers(id),
    UNIQUE (customer_id, period_start, period_end)
);

-- 7. Invoices
CREATE TABLE invoices (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    customer_id BIGINT UNSIGNED NOT NULL,
    billing_period_id BIGINT UNSIGNED NOT NULL,
    subtotal_kobo BIGINT UNSIGNED NOT NULL DEFAULT 0,
    status ENUM(
        'pending',
        'paid',
        'past_due',
        'cancelled'
    ) NOT NULL DEFAULT 'pending',
    issued_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    paid_at DATETIME(3) NULL,

    FOREIGN KEY (customer_id) REFERENCES customers(id),
    FOREIGN KEY (billing_period_id) REFERENCES billing_periods(id),
    UNIQUE (customer_id, billing_period_id)
);

-- 8. Invoice lines
CREATE TABLE invoice_lines (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    invoice_id BIGINT UNSIGNED NOT NULL,
    description VARCHAR(255) NOT NULL,
    line_type ENUM(
        'base_fee',
        'usage_tier',
        'proration',
        'credit'
    ) NOT NULL,
    quantity BIGINT UNSIGNED NOT NULL DEFAULT 1,
    unit_price_kobo BIGINT UNSIGNED NOT NULL DEFAULT 0,
    amount_kobo BIGINT UNSIGNED NOT NULL,

    FOREIGN KEY (invoice_id) REFERENCES invoices(id),
    INDEX idx_invoice_lines (invoice_id)
);

-- 9. Payment attempts
CREATE TABLE payment_attempts (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    invoice_id BIGINT UNSIGNED NOT NULL,
    attempt_number INT UNSIGNED NOT NULL,
    transaction_ref VARCHAR(191) NULL UNIQUE,
    amount_kobo BIGINT UNSIGNED NOT NULL,
    status ENUM(
        'pending',
        'successful',
        'failed'
    ) NOT NULL DEFAULT 'pending',
    attempted_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    next_retry_at DATETIME(3) NULL,

    FOREIGN KEY (invoice_id) REFERENCES invoices(id),
    UNIQUE (invoice_id, attempt_number)
);

-- 10. Webhook events
CREATE TABLE webhook_events (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    transaction_ref VARCHAR(191) NOT NULL UNIQUE,
    event_type VARCHAR(100) NOT NULL,
    signature_verified BOOLEAN NOT NULL DEFAULT FALSE,
    processed_at DATETIME(3) NULL,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
);

-- 11. Subscription plan changes
CREATE TABLE subscription_plan_changes (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    subscription_id BIGINT UNSIGNED NOT NULL,
    old_plan_id BIGINT UNSIGNED NOT NULL,
    new_plan_id BIGINT UNSIGNED NOT NULL,
    effective_at DATETIME(3) NOT NULL,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    FOREIGN KEY (subscription_id) REFERENCES subscriptions(id),
    FOREIGN KEY (old_plan_id) REFERENCES plans(id),
    FOREIGN KEY (new_plan_id) REFERENCES plans(id),

    INDEX idx_plan_changes (subscription_id, effective_at)
);
