/**
 * Create affiliate links table for tracking and attribution
 */

exports.up = function(knex) {
  return knex.schema.createTable('affiliate_links', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('affiliate_id').references('id').inTable('affiliates').onDelete('CASCADE');
    table.string('link_code').unique().notNullable();
    table.string('original_url').notNullable();
    table.string('tracking_url').notNullable();

    // Link configuration
    table.string('campaign_name');
    table.string('campaign_type').defaultTo('general'); // general, email, social, banner, etc.
    table.json('utm_parameters').defaultTo('{}');
    table.json('custom_parameters').defaultTo('{}');

    // Target information
    table.string('target_product'); // specific product or service
    table.string('target_audience');
    table.string('placement_location'); // website, email, social, etc.

    // Performance metrics
    table.integer('clicks').defaultTo(0);
    table.integer('unique_clicks').defaultTo(0);
    table.integer('conversions').defaultTo(0);
    table.decimal('conversion_value', 15, 2).defaultTo(0);
    table.decimal('commission_earned', 15, 2).defaultTo(0);

    // Status and settings
    table.boolean('is_active').defaultTo(true);
    table.timestamp('expires_at');
    table.integer('click_limit');
    table.decimal('conversion_limit', 15, 2);

    // Fraud prevention
    table.json('allowed_domains').defaultTo('[]');
    table.json('blocked_ips').defaultTo('[]');
    table.boolean('require_unique_clicks').defaultTo(true);
    table.integer('click_velocity_limit').defaultTo(100); // max clicks per hour

    // Metadata
    table.json('metadata').defaultTo('{}');
    table.timestamps(true, true);
    table.timestamp('deleted_at');

    // Indexes
    table.index(['affiliate_id']);
    table.index(['link_code']);
    table.index(['campaign_type']);
    table.index(['is_active']);
    table.index(['created_at']);
  });
};

exports.down = function(knex) {
  return knex.schema.dropTable('affiliate_links');
};