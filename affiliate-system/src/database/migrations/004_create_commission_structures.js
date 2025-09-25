/**
 * Create commission structures table
 */

exports.up = function(knex) {
  return knex.schema.createTable('commission_structures', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.string('name').notNullable();
    table.text('description');

    // Commission configuration
    table.enu('type', ['percentage', 'fixed', 'tiered', 'hybrid']).defaultTo('percentage');
    table.decimal('base_rate', 8, 4); // Base commission rate
    table.decimal('fixed_amount', 10, 2); // Fixed commission amount
    table.string('currency').defaultTo('USD');

    // Product/service targeting
    table.json('applicable_products').defaultTo('[]'); // Product IDs or categories
    table.json('excluded_products').defaultTo('[]');
    table.decimal('minimum_order_value', 10, 2);
    table.decimal('maximum_order_value', 10, 2);

    // Performance tiers
    table.json('tier_structure').defaultTo('[]'); // Array of tier configurations
    table.boolean('tier_based').defaultTo(false);

    // Time-based rules
    table.timestamp('effective_from');
    table.timestamp('effective_until');
    table.integer('cookie_duration_days').defaultTo(30);
    table.boolean('recurring_commissions').defaultTo(false);
    table.integer('recurring_months');

    // Bonus and incentives
    table.json('bonus_structure').defaultTo('{}');
    table.decimal('volume_bonus_threshold', 15, 2);
    table.decimal('volume_bonus_rate', 8, 4);

    // Restrictions and rules
    table.json('geo_restrictions').defaultTo('[]'); // Country codes
    table.json('traffic_restrictions').defaultTo('[]'); // Traffic sources
    table.boolean('new_customers_only').defaultTo(false);
    table.boolean('exclude_refunds').defaultTo(true);

    // Status
    table.boolean('is_active').defaultTo(true);
    table.boolean('is_default').defaultTo(false);
    table.integer('priority').defaultTo(0); // Higher priority = applied first

    // Metadata
    table.json('metadata').defaultTo('{}');
    table.timestamps(true, true);
    table.timestamp('deleted_at');

    // Indexes
    table.index(['is_active']);
    table.index(['is_default']);
    table.index(['priority']);
    table.index(['effective_from', 'effective_until']);
  });
};

exports.down = function(knex) {
  return knex.schema.dropTable('commission_structures');
};