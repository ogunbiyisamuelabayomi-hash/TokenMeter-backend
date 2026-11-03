# TokenMeter – Usage-Based Billing for AI Products

## Project Overview

TokenMeter is a Node.js and Express backend application designed to provide usage-based billing for AI products.

The system allows customers to subscribe to pricing plans, record their AI usage, calculate charges based on graduated pricing tiers, generate invoices, and make payments through Squad's payment gateway.

It also supports subscription management, spending limits, late usage events, payment retries, and webhook processing.

## Technologies Used

- Node.js
- Express.js
- MySQL
- MySQL Workbench
- JavaScript
- Jest
- Squad Payment Gateway
- Nodemon
- Node-cron
- Git and GitHub
- Postman

## Main Features

### 1. Customer Management
- Create customers.
- Retrieve registered customers.
- Set monthly spending caps.
- Check estimated spending before a request.

### 2. Plan Management
- Create subscription plans.
- Configure monthly base fees.
- Configure graduated usage pricing tiers.
- Retrieve available plans.

### 3. Subscription Management
- Create customer subscriptions.
- Retrieve subscriptions.
- Manage subscription status transitions.
- Change subscription plans.
- Calculate prorated base fees when plans change.

### 4. Usage Tracking
- Record customer usage events.
- Track usage by meter.
- Reject duplicate event IDs.
- Accept valid late events within the 48-hour window.
- Reject events older than the permitted window.

### 5. Billing and Invoices
- Calculate usage charges using graduated pricing.
- Generate invoices.
- Store invoice line items.
- Calculate prorated subscription fees.
- Prevent duplicate invoices for the same customer and billing period.
- Verify invoice totals independently.

### 6. Payment Integration
- Integrate Squad sandbox payments.
- Initiate customer payments.
- Verify payments on the server.
- Process payment webhooks.
- Validate webhook signatures.
- Prevent duplicate webhook processing.

### 7. Payment Retry System
- Schedule payment retries.
- Retry failed payments on days 1, 3, and 5.
- Suspend subscriptions after the third failed retry.
- Reactivate subscriptions after successful payment.

### 8. Automated Testing
- Jest tests for graduated billing calculations.
- Jest tests for subscription status transitions.
- Scripts for usage generation and invoice verification.

## Project Structure

```text
TokenMeter/
│
├── database/
│   └── migrations/
│       └── 001_create_tables.sql
│
├── scripts/
│   ├── generateUsage.js
│   ├── checkInvoices.js
│   └── testBillingCalculator.js
│
├── src/
│   ├── config/
│   ├── controllers/
│   ├── jobs/
│   ├── middleware/
│   ├── models/
│   ├── routes/
│   ├── services/
│   └── utils/
│
├── tests/
│   ├── billingCalculator.test.js
│   └── subscriptionTransitions.test.js
│
├── .env
├── .gitignore
├── package.json
├── package-lock.json
└── README.md
```

## Installation and Setup

### Requirements

- Node.js
- MySQL Server
- MySQL Workbench
- Git
- Postman

### 1. Clone the Repository

```bash
git clone YOUR_GITHUB_REPOSITORY_URL
```

### 2. Navigate into the Project

```bash
cd TokenMeter
```

### 3. Install Dependencies

```bash
npm install
```

### 4. Create the Database

Create a MySQL database named:

```sql
CREATE DATABASE tokenmeter_db;
```

### 5. Configure Environment Variables

Create a `.env` file in the project root.

Add the following variables using your own local credentials:

```env
PORT=3030

DB_HOST=localhost
DB_USER=root
DB_PASSWORD=YOUR_MYSQL_PASSWORD
DB_NAME=tokenmeter_db

SQUAD_SECRET_KEY=YOUR_SQUAD_SANDBOX_SECRET_KEY

PAYMENT_RETRY_TEST_MODE=false
```

Never publish your actual database password or Squad secret key.

### 6. Run Database Migrations

Execute the SQL migration file:

```text
database/migrations/001_create_tables.sql
```

in MySQL Workbench.

### 7. Start the Application

Development mode:

```bash
npm run dev
```

Normal mode:

```bash
npm start
```

The application runs on:

```text
http://localhost:3030
```

## Testing

### Run Automated Tests

```bash
npm test
```

### Generate Usage Events

```bash
node scripts/generateUsage.js
```

This script demonstrates large-scale usage ingestion, duplicate submissions, and late events.

### Verify Invoice Calculations

```bash
node scripts/checkInvoices.js
```

This independently compares invoice subtotals against their stored invoice line items.

### Test Graduated Pricing

```bash
node scripts/testBillingCalculator.js
```

## Payment Integration

TokenMeter integrates with Squad's sandbox payment environment.

The payment workflow includes:

1. Initiating a payment.
2. Receiving a payment checkout link.
3. Completing the sandbox payment.
4. Verifying the transaction on the server.
5. Processing payment webhooks.
6. Updating the invoice payment status.

## Security

- Environment variables are used for sensitive configuration.
- `.env` is excluded from Git using `.gitignore`.
- Payment verification is performed server-side.
- Webhook signatures are validated.
- Duplicate webhook events are prevented from being processed repeatedly.

## Author

**Samuel Abayomi Ogunbiyi**

Backend Web Development – Grazac Academy

Project: TokenMeter – Usage-Based Billing for AI Products
