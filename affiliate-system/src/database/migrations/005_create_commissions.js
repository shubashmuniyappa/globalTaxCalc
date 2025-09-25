/**
 * Create commissions table for tracking earnings
 */

exports.up = function(knex) {
  return knex.schema.createTable('commissions', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('affiliate_id').references('id').inTable('affiliates').onDelete('CASCADE');
    table.uuid('link_id').references('id').inTable('affiliate_links').onDelete('SET NULL');
    table.uuid('click_id').references('id').inTable('click_tracking').onDelete('SET NULL');
    table.uuid('commission_structure_id').references('id').inTable('commission_structures').onDelete('SET NULL');

    // Transaction details
    table.string('transaction_id').unique();
    table.string('order_id');
    table.string('customer_id');
    table.decimal('order_value', 15, 2);
    table.string('currency').defaultTo('USD');

    // Commission calculation
    table.decimal('commission_rate', 8, 4);
    table.decimal('commission_amount', 15, 2);
    table.enu('commission_type', ['percentage', 'fixed', 'tiered', 'bonus']);
    table.string('calculation_method');

    // Product information
    table.string('product_id');
    table.string('product_name');
    table.string('product_category');
    table.json('product_details').defaultTo('{}');

    // Status and lifecycle
    table.enu('status', ['pending', 'approved', 'paid', 'reversed', 'disputed']).defaultTo('pending');
    table.text('status_reason');
    table.timestamp('approved_at');
    table.timestamp('paid_at');
    table.timestamp('reversed_at');

    // Attribution and tracking
    table.string('attribution_model').defaultTo('last_click');
    table.integer('days_to_conversion');
    table.json('attribution_data').defaultTo('{}');

    // Payment processing
    table.uuid('payment_batch_id');
    table.string('payment_reference');
    table.decimal('payment_amount', 15, 2); // May differ from commission due to adjustments
    table.string('payment_currency').defaultTo('USD');
    table.decimal('tax_withheld', 15, 2).defaultTo(0);
    table.decimal('fees_deducted', 15, 2).defaultTo(0);

    // Quality and fraud
    table.boolean('is_quality_traffic').defaultTo(true);
    table.decimal('fraud_score', 5, 2).defaultTo(0);
    table.json('quality_signals').defaultTo('{}');

    // Refund and chargeback handling
    table.boolean('refunded').defaultTo(false);
    table.timestamp('refunded_at');
    table.decimal('refund_amount', 15, 2);
    table.boolean('chargeback').defaultTo(false);

    // Metadata
    table.json('metadata').defaultTo('{}');
    table.timestamp('transaction_date');
    table.timestamps(true, true);

    // Indexes for performance
    table.index(['affiliate_id', 'status']);
    table.index(['affiliate_id', 'created_at']);
    table.index(['transaction_id']);
    table.index(['order_id']);
    table.index(['status', 'created_at']);
    table.index(['approved_at']);
    table.index(['paid_at']);
    table.index(['transaction_date']);
  });
};

exports.down = function(knex) {
  return knex.schema.dropTable('commissions');
};