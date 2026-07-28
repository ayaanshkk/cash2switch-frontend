# Business Gas Payments Module Guide

This guide explains how administrators use the Business Gas Payments and Commission module.

## 1. Payments Menu

Open **Payments** from the left sidebar. Administrators can access:

- **Supplier Terms** - controls how and when each supplier pays commission.
- **Payment Checker** - tracks expected supplier commission and records payments received.
- **Agent Commissions** - calculates and manages commission payments owed to agents.
- **Reports** - shows supplier performance, outstanding balances and agent commission totals.

## 2. Supplier Terms

Open **Payments > Supplier Terms** to review how each supplier pays commission.

The main policies are:

| Policy | How it works |
| --- | --- |
| Upfront + reconciliation | A percentage is expected when the contract goes live. The remaining amount is reconciled at the end of the contract. |
| Monthly actual usage | Commission is expected monthly after the customer has been billed and paid. |
| Quarterly actual usage | Commission is expected every three months after the customer has been billed and paid. |
| Annual estimated | Commission is expected annually after the configured delay. |

E.ON Next and Smartest Energy are configured for **70% upfront plus final reconciliation**.

Monthly suppliers use approximately **21 days for the invoice, 21 days for customer payment and a 2-day grace period**.

TotalEnergies is configured for quarterly payments using the same timing.

### Change a supplier policy

1. Open **Payments > Supplier Terms**.
2. Search for the supplier.
3. Select the payment policy.
4. Enter the percentage or timing values shown for that policy.
5. Select **Save**.

Changes apply to newly generated payment schedules. Existing payment history is not overwritten.

## 3. How Renewals Enter Payment Checker

When a renewal is marked **Already Renewed**, the system generates its supplier commission schedule automatically.

For successful generation, the renewal needs:

- A linked supplier
- Contract start and end dates or a contract term
- Annual usage
- An uplift/commission rate
- A linked project and contract

If information is missing, the renewal remains saved but its payment schedule is not generated until the data is corrected.

## 4. Payment Checker

Open **Payments > Payment Checker**.

The summary cards show:

- **Expected** - total supplier commission expected for the selected filters.
- **Received** - supplier payments already logged.
- **Outstanding** - expected amount still unpaid.

Each renewal is shown as a separate group. The group displays the customer, contract, supplier, agent, total expected, total received, outstanding balance and next due date.

### Find a renewal

1. Enter the customer, supplier, agent or contract number in the search box.
2. Optionally select a status, supplier, agent or due-date range.
3. Select **Apply Filters**.
4. Use the page controls at the bottom to move through the results.

Search checks the complete payment register, not only the currently displayed page.

### View payment periods

1. Select the arrow beside a renewal to expand it.
2. Review its monthly, quarterly, annual, upfront or reconciliation periods.
3. Select an individual period to open its payment panel.

### Log a supplier payment

1. Open the required payment period.
2. Enter the **Amount received**.
3. Select the **Date received**.
4. Add notes or a supplier payment reference when available.
5. Select **Log Payment**.

The system recalculates the received and outstanding amounts automatically.

- A partial receipt changes the status to **Partially Paid**.
- Payment of the full outstanding amount changes the status to **Received**.

Do not log the same supplier receipt twice.

### Chase or close a payment

Open the payment period and use:

- **Mark as Chasing Supplier** when the payment requires supplier follow-up.
- **Close** when no further payment activity is required.

Closing a payment prevents additional receipt and chasing actions for that payment period.

## 5. Payment History

Select **Open Payment History** from a renewal in Payment Checker.

The history page shows:

- The complete supplier payment schedule
- Amounts expected, received and outstanding
- Receipt history and notes
- Agent commission entries created from receipts

The same information is available from a customer renewal:

1. Open **Renewals**.
2. Select the customer renewal.
3. Open the **Payments Log** tab.

## 6. Payment Statuses

| Status | Meaning |
| --- | --- |
| Scheduled | A future payment period that is not yet approaching its due date. |
| Pending | Payment is expected or approaching its due date. |
| Due | The expected date has arrived and the payment remains unpaid. |
| Partially Paid | Some money has been received, but a balance remains. |
| Received | The expected amount has been received in full. |
| Chasing Supplier | Staff are actively following up with the supplier. |
| Closed | No further action is required for the payment period. |

## 7. Agent Commissions

Agent commission is created from supplier receipts. A supplier payment must be logged before the related agent commission can be included in a batch.

### Generate agent commissions

1. Open **Payments > Agent Commissions** as an administrator.
2. Select the month containing the supplier receipts.
3. Review the available agent commission amounts.
4. Generate the commission batch.
5. Review each agent and the included customer payments.

### Pay an agent

1. Open the required commission batch.
2. Review the total and included items.
3. Download the statement if required.
4. Select **Mark Paid** after the agent has been paid.

The agent will then see the status **Commission Paid** in their Agent Commissions view.

## 8. Reports

Open **Payments > Reports** to review:

- Total expected, received and outstanding supplier commission
- Supplier performance
- Agent commission totals
- Overdue and underpaid payments

Use search, sorting and report tabs to investigate specific suppliers or agents. Reports are restricted to administrators.

## 9. Notifications and Follow-Up

Internal CRM notifications are used for commission follow-ups. No supplier emails are sent automatically.

When a follow-up becomes due, administrators and relevant staff may see it under **Notifications**. After checking the payment, update it in Payment Checker by logging the receipt, marking it as chasing the supplier, or closing it.

## 10. Recommended Routine

### Daily or weekly

1. Open Payment Checker.
2. Filter for **Due**, **Partially Paid** and **Chasing Supplier**.
3. Log supplier receipts received.
4. Follow up outstanding payments.
5. Review CRM notifications.

### Monthly

1. Confirm all supplier receipts for the month are logged.
2. Open Agent Commissions.
3. Generate agent commission batches.
4. Download and review statements.
5. Pay agents and mark their batches paid.
6. Review Commission Reports for outstanding or underpaid balances.

## 11. If a Renewal Is Missing

Check the following:

1. The renewal status is **Already Renewed**.
2. A supplier is selected.
3. Contract dates or term are present.
4. Annual usage is present.
5. An uplift/commission rate is present.
6. Supplier payment terms are configured.

After correcting the missing information, process the renewal again or ask an administrator to rerun the commission backfill for missing renewals.
