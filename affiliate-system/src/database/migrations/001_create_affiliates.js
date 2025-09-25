/**
 * Create affiliates table
 */

exports.up = function(knex) {
  return knex.schema.createTable('affiliates', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.string('email').unique().notNullable();
    table.string('password_hash').notNullable();
    table.string('first_name').notNullable();
    table.string('last_name').notNullable();
    table.string('company_name');
    table.string('website');
    table.string('phone');
    table.text('bio');
    table.json('social_media_links').defaultTo('{}');

    // Address information
    table.string('address_line1');
    table.string('address_line2');
    table.string('city');
    table.string('state');
    table.string('postal_code');
    table.string('country').defaultTo('US');

    // Tax and payment information
    table.string('tax_id'); // SSN or EIN
    table.string('tax_classification').defaultTo('individual'); // individual, business, llc, etc.
    table.json('payment_methods').defaultTo('[]');
    table.decimal('payment_threshold', 10, 2).defaultTo(50.00);

    // Performance metrics
    table.integer('performance_tier').defaultTo(1);
    table.decimal('lifetime_earnings', 15, 2).defaultTo(0);
    table.integer('total_clicks').defaultTo(0);
    table.integer('total_conversions').defaultTo(0);
    table.decimal('conversion_rate', 5, 4).defaultTo(0);

    // Status and approval
    table.enu('status', ['pending', 'approved', 'rejected', 'suspended', 'terminated']).defaultTo('pending');
    table.text('rejection_reason');
    table.timestamp('approved_at');
    table.uuid('approved_by');

    // Compliance and verification
    table.boolean('terms_accepted').defaultTo(false);
    table.timestamp('terms_accepted_at');
    table.string('terms_version');
    table.boolean('email_verified').defaultTo(false);
    table.timestamp('email_verified_at');
    table.boolean('identity_verified').defaultTo(false);
    table.timestamp('identity_verified_at');

    // Security
    table.string('affiliate_code').unique();
    table.string('api_key').unique();
    table.json('login_sessions').defaultTo('[]');
    table.timestamp('last_login_at');
    table.string('last_login_ip');

    // Metadata
    table.json('metadata').defaultTo('{}');
    table.timestamps(true, true);
    table.timestamp('deleted_at');

    // Indexes
    table.index(['email']);
    table.index(['affiliate_code']);
    table.index(['status']);
    table.index(['performance_tier']);
    table.index(['created_at']);
  });
};

exports.down = function(knex) {
  return knex.schema.dropTable('affiliates');
};