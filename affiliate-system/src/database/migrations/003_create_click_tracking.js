/**
 * Create click tracking table for detailed analytics
 */

exports.up = function(knex) {
  return knex.schema.createTable('click_tracking', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('affiliate_id').references('id').inTable('affiliates').onDelete('CASCADE');
    table.uuid('link_id').references('id').inTable('affiliate_links').onDelete('CASCADE');
    table.string('click_id').unique().notNullable();

    // User information
    table.string('visitor_id'); // Anonymous visitor tracking
    table.string('session_id');
    table.string('user_id'); // If logged in user

    // Technical details
    table.string('ip_address');
    table.string('user_agent');
    table.string('referer');
    table.string('browser');
    table.string('browser_version');
    table.string('operating_system');
    table.string('device_type'); // desktop, mobile, tablet
    table.boolean('is_mobile').defaultTo(false);
    table.boolean('is_bot').defaultTo(false);

    // Geographic information
    table.string('country');
    table.string('region');
    table.string('city');
    table.decimal('latitude', 10, 8);
    table.decimal('longitude', 11, 8);
    table.string('timezone');

    // Attribution tracking
    table.string('attribution_model').defaultTo('last_click');
    table.json('touchpoint_data').defaultTo('{}');
    table.integer('days_since_first_click');
    table.integer('total_touchpoints');

    // Fraud detection
    table.boolean('is_suspicious').defaultTo(false);
    table.json('fraud_signals').defaultTo('[]');
    table.decimal('fraud_score', 5, 2).defaultTo(0);

    // Conversion tracking
    table.boolean('converted').defaultTo(false);
    table.timestamp('converted_at');
    table.decimal('conversion_value', 15, 2);
    table.string('conversion_type'); // purchase, signup, trial, etc.

    // Quality metrics
    table.integer('time_on_site'); // seconds
    table.integer('pages_viewed');
    table.boolean('bounced').defaultTo(true);
    table.string('landing_page');
    table.string('exit_page');

    // Metadata
    table.json('custom_data').defaultTo('{}');
    table.timestamp('clicked_at').defaultTo(knex.fn.now());
    table.timestamps(true, true);

    // Indexes for performance
    table.index(['affiliate_id', 'clicked_at']);
    table.index(['link_id', 'clicked_at']);
    table.index(['click_id']);
    table.index(['visitor_id']);
    table.index(['ip_address', 'clicked_at']);
    table.index(['converted', 'converted_at']);
    table.index(['is_suspicious']);
    table.index(['clicked_at']);
  });
};

exports.down = function(knex) {
  return knex.schema.dropTable('click_tracking');
};