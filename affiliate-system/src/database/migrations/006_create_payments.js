/**
 * Create payments table for tracking affiliate payouts
 */

exports.up = function(knex) {
  return knex.schema.createTable('payments', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('affiliate_id').references('id').inTable('affiliates').onDelete('CASCADE');
    table.string('payment_batch_id').index();

    // Payment details
    table.decimal('gross_amount', 15, 2);
    table.decimal('tax_withheld', 15, 2).defaultTo(0);
    table.decimal('fees_deducted', 15, 2).defaultTo(0);
    table.decimal('net_amount', 15, 2);
    table.string('currency').defaultTo('USD');

    // Payment method and processing
    table.enu('payment_method', ['paypal', 'bank_transfer', 'stripe', 'check', 'crypto']);
    table.json('payment_details').defaultTo('{}'); // Account info, etc.
    table.string('external_payment_id'); // PayPal transaction ID, bank reference, etc.
    table.string('payment_reference');

    // Status and processing
    table.enu('status', ['pending', 'processing', 'completed', 'failed', 'cancelled', 'disputed']).defaultTo('pending');
    table.text('status_message');
    table.timestamp('processed_at');
    table.timestamp('completed_at');
    table.timestamp('failed_at');
    table.text('failure_reason');

    // Period and commissions
    table.date('period_start');
    table.date('period_end');
    table.integer('commission_count');
    table.json('commission_ids').defaultTo('[]');

    // Tax and compliance
    table.boolean('tax_form_required').defaultTo(false);
    table.string('tax_form_type'); // 1099-NEC, etc.
    table.boolean('tax_form_sent').defaultTo(false);
    table.timestamp('tax_form_sent_at');
    table.decimal('tax_year', 4, 0);

    // Dispute and support
    table.boolean('disputed').defaultTo(false);
    table.timestamp('disputed_at');
    table.text('dispute_reason');
    table.text('dispute_resolution');
    table.timestamp('dispute_resolved_at');

    // Retry logic for failed payments
    table.integer('retry_count').defaultTo(0);
    table.timestamp('next_retry_at');
    table.integer('max_retries').defaultTo(3);

    // Metadata
    table.json('metadata').defaultTo('{}');
    table.timestamps(true, true);

    // Indexes
    table.index(['affiliate_id', 'status']);
    table.index(['payment_batch_id']);
    table.index(['status', 'processed_at']);
    table.index(['period_start', 'period_end']);
    table.index(['tax_year']);
  });
};

exports.down = function(knex) {
  return knex.schema.dropTable('payments');
};