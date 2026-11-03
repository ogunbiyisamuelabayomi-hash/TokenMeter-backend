
# TokenMeter – Entity Relationship Diagram (ERD)

This diagram represents the database structure of the TokenMeter usage-based billing system.

It contains 12 tables showing the primary keys (PK), foreign keys (FK), and relationships between the entities.

## Database Relationships

```mermaid
erDiagram
    CUSTOMERS ||--o{ SUBSCRIPTIONS : has
    PLANS ||--o{ SUBSCRIPTIONS : assigned_to
    PLANS ||--o{ PRICE_TIERS : contains

    CUSTOMERS ||--o{ USAGE_EVENTS : generates
    CUSTOMERS ||--o{ BILLING_PERIODS : has
    CUSTOMERS ||--o{ INVOICES : receives
    CUSTOMERS ||--o{ SPENDING_CAP_ALERTS : triggers

    BILLING_PERIODS ||--o| INVOICES : generates
    INVOICES ||--o{ INVOICE_LINES : contains
    INVOICES ||--o{ PAYMENT_ATTEMPTS : has

    SUBSCRIPTIONS ||--o{ SUBSCRIPTION_PLAN_CHANGES : records
    PLANS ||--o{ SUBSCRIPTION_PLAN_CHANGES : old_plan
    PLANS ||--o{ SUBSCRIPTION_PLAN_CHANGES : new_plan

    CUSTOMERS {
        bigint id PK
        varchar name
        varchar email
        bigint monthly_spending_cap_kobo
        datetime created_at
    }

    PLANS {
        bigint id PK
        varchar name
        bigint monthly_base_fee_kobo
        datetime created_at
    }

    PRICE_TIERS {
        bigint id PK
        bigint plan_id FK
        varchar meter_name
        bigint from_quantity
        bigint to_quantity
        bigint price_per_unit_kobo
    }

    SUBSCRIPTIONS {
        bigint id PK
        bigint customer_id FK
        bigint plan_id FK
        enum status
        datetime trial_ends_at
        datetime started_at
        datetime created_at
    }

    USAGE_EVENTS {
        bigint id PK
        varchar event_id
        bigint customer_id FK
        varchar meter_name
        bigint quantity
        datetime event_time
        datetime received_at
    }

    BILLING_PERIODS {
        bigint id PK
        bigint customer_id FK
        datetime period_start
        datetime period_end
        enum status
        datetime closed_at
    }

    INVOICES {
        bigint id PK
        bigint customer_id FK
        bigint billing_period_id FK
        bigint subtotal_kobo
        enum status
        datetime issued_at
        datetime paid_at
    }

    INVOICE_LINES {
        bigint id PK
        bigint invoice_id FK
        varchar description
        enum line_type
        bigint quantity
        bigint unit_price_kobo
        bigint amount_kobo
    }

    PAYMENT_ATTEMPTS {
        bigint id PK
        bigint invoice_id FK
        int attempt_number
        varchar transaction_ref
        bigint amount_kobo
        enum status
        datetime attempted_at
        datetime next_retry_at
    }

    WEBHOOK_EVENTS {
        bigint id PK
        varchar transaction_ref
        varchar event_type
        boolean signature_verified
        datetime processed_at
        datetime created_at
    }

    SUBSCRIPTION_PLAN_CHANGES {
        bigint id PK
        bigint subscription_id FK
        bigint old_plan_id FK
        bigint new_plan_id FK
        datetime effective_at
        datetime created_at
    }

    SPENDING_CAP_ALERTS {
        bigint id PK
        bigint customer_id FK
        enum alert_type
        bigint spending_kobo
        bigint spending_cap_kobo
        enum status
        datetime created_at
        datetime processed_at
    }
```

## Key

- PK – Primary Key
- FK – Foreign Key

## Database Information

- Database: MySQL
- Database name: tokenmeter_db
- Total tables: 12
- Currency storage: Integer kobo
- Datetime storage: UTC
