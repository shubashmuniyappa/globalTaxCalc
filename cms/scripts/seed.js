const fs = require('fs').promises;
const path = require('path');

async function seedData() {
  console.log('🌱 Starting content seeding...');

  try {
    // Create countries first (required for other content)
    await seedCountries();

    // Create taxonomies
    await seedTags();
    await seedBlogCategories();
    await seedFAQCategories();

    // Create main content
    await seedBlogPosts();
    await seedTaxGuides();
    await seedCountryPages();
    await seedToolDescriptions();
    await seedFAQItems();

    console.log('✅ Content seeding completed successfully!');
  } catch (error) {
    console.error('❌ Content seeding failed:', error);
    process.exit(1);
  }
}

async function seedCountries() {
  console.log('📍 Seeding countries...');

  const countries = [
    {
      name: 'United States',
      code: 'US',
      currency: 'USD',
      supportLevel: 'Full',
      taxAuthorityName: 'Internal Revenue Service (IRS)',
      taxAuthorityWebsite: 'https://www.irs.gov',
      primaryLanguage: 'en',
      timeZone: 'America/New_York',
      featured: true,
      priority: 10,
      region: 'North America'
    },
    {
      name: 'Canada',
      code: 'CA',
      currency: 'CAD',
      supportLevel: 'Full',
      taxAuthorityName: 'Canada Revenue Agency',
      taxAuthorityWebsite: 'https://www.canada.ca/en/revenue-agency.html',
      primaryLanguage: 'en',
      timeZone: 'America/Toronto',
      featured: true,
      priority: 9,
      region: 'North America'
    },
    {
      name: 'United Kingdom',
      code: 'GB',
      currency: 'GBP',
      supportLevel: 'Full',
      taxAuthorityName: 'HM Revenue and Customs',
      taxAuthorityWebsite: 'https://www.gov.uk/government/organisations/hm-revenue-customs',
      primaryLanguage: 'en',
      timeZone: 'Europe/London',
      featured: true,
      priority: 8,
      region: 'Europe'
    },
    {
      name: 'Australia',
      code: 'AU',
      currency: 'AUD',
      supportLevel: 'Full',
      taxAuthorityName: 'Australian Taxation Office',
      taxAuthorityWebsite: 'https://www.ato.gov.au',
      primaryLanguage: 'en',
      timeZone: 'Australia/Sydney',
      featured: true,
      priority: 7,
      region: 'Oceania'
    },
    {
      name: 'Germany',
      code: 'DE',
      currency: 'EUR',
      supportLevel: 'Partial',
      taxAuthorityName: 'Bundesministerium der Finanzen',
      taxAuthorityWebsite: 'https://www.bundesfinanzministerium.de',
      primaryLanguage: 'de',
      timeZone: 'Europe/Berlin',
      featured: true,
      priority: 6,
      region: 'Europe'
    },
    {
      name: 'France',
      code: 'FR',
      currency: 'EUR',
      supportLevel: 'Partial',
      taxAuthorityName: 'Direction générale des Finances publiques',
      taxAuthorityWebsite: 'https://www.impots.gouv.fr',
      primaryLanguage: 'fr',
      timeZone: 'Europe/Paris',
      featured: true,
      priority: 5,
      region: 'Europe'
    }
  ];

  for (const country of countries) {
    await strapi.entityService.create('api::country.country', {
      data: {
        ...country,
        publishedAt: new Date().toISOString()
      }
    });
  }

  console.log(`✅ Created ${countries.length} countries`);
}

async function seedTags() {
  console.log('🏷️ Seeding tags...');

  const tags = [
    { name: 'Income Tax', category: 'Tax Type', color: '#3B82F6' },
    { name: 'Deductions', category: 'Tax Type', color: '#10B981' },
    { name: 'Tax Credits', category: 'Tax Type', color: '#8B5CF6' },
    { name: 'Business Tax', category: 'Tax Type', color: '#F59E0B' },
    { name: 'Self Employment', category: 'Tax Type', color: '#EF4444' },
    { name: 'Property Tax', category: 'Tax Type', color: '#6366F1' },
    { name: 'Investment Tax', category: 'Tax Type', color: '#EC4899' },
    { name: 'Retirement', category: 'Topic', color: '#14B8A6' },
    { name: 'Tax Planning', category: 'Topic', color: '#F97316' },
    { name: 'Tax Season', category: 'Topic', color: '#84CC16' },
    { name: 'Beginner', category: 'Difficulty', color: '#22C55E' },
    { name: 'Advanced', category: 'Difficulty', color: '#DC2626' },
    { name: 'Calculator', category: 'Tool Type', color: '#7C3AED' },
    { name: 'Guide', category: 'Tool Type', color: '#059669' }
  ];

  for (const tag of tags) {
    await strapi.entityService.create('api::tag.tag', {
      data: {
        ...tag,
        slug: tag.name.toLowerCase().replace(/\s+/g, '-'),
        description: `Content related to ${tag.name.toLowerCase()}`,
        featured: ['Income Tax', 'Deductions', 'Tax Credits', 'Business Tax'].includes(tag.name)
      }
    });
  }

  console.log(`✅ Created ${tags.length} tags`);
}

async function seedBlogCategories() {
  console.log('📝 Seeding blog categories...');

  const categories = [
    {
      name: 'Tax Tips',
      description: 'Helpful tips and strategies for tax planning and preparation',
      color: '#3B82F6',
      icon: 'lightbulb',
      featured: true,
      priority: 10
    },
    {
      name: 'Tax Law Updates',
      description: 'Latest changes in tax laws and regulations',
      color: '#EF4444',
      icon: 'document-text',
      featured: true,
      priority: 9
    },
    {
      name: 'Small Business',
      description: 'Tax guidance for small business owners and entrepreneurs',
      color: '#10B981',
      icon: 'office-building',
      featured: true,
      priority: 8
    },
    {
      name: 'Personal Finance',
      description: 'Personal tax planning and financial advice',
      color: '#8B5CF6',
      icon: 'currency-dollar',
      featured: true,
      priority: 7
    },
    {
      name: 'International Tax',
      description: 'Tax implications for international income and expats',
      color: '#F59E0B',
      icon: 'globe',
      featured: false,
      priority: 6
    }
  ];

  for (const category of categories) {
    await strapi.entityService.create('api::blog-category.blog-category', {
      data: {
        ...category,
        slug: category.name.toLowerCase().replace(/\s+/g, '-')
      }
    });
  }

  console.log(`✅ Created ${categories.length} blog categories`);
}

async function seedFAQCategories() {
  console.log('❓ Seeding FAQ categories...');

  const categories = [
    {
      name: 'General Tax Questions',
      description: 'Basic tax questions and answers',
      icon: 'question-mark-circle',
      color: '#3B82F6',
      priority: 10
    },
    {
      name: 'Filing and Deadlines',
      description: 'Questions about tax filing processes and deadlines',
      icon: 'calendar',
      color: '#EF4444',
      priority: 9
    },
    {
      name: 'Deductions and Credits',
      description: 'Questions about tax deductions and credits',
      icon: 'receipt-tax',
      color: '#10B981',
      priority: 8
    },
    {
      name: 'Business Taxes',
      description: 'Frequently asked questions about business taxation',
      icon: 'office-building',
      color: '#8B5CF6',
      priority: 7
    },
    {
      name: 'Calculator Usage',
      description: 'How to use our tax calculators and tools',
      icon: 'calculator',
      color: '#F59E0B',
      priority: 6
    }
  ];

  for (const category of categories) {
    await strapi.entityService.create('api::faq-category.faq-category', {
      data: {
        ...category,
        slug: category.name.toLowerCase().replace(/\s+/g, '-')
      }
    });
  }

  console.log(`✅ Created ${categories.length} FAQ categories`);
}

async function seedBlogPosts() {
  console.log('📖 Seeding blog posts...');

  const blogPosts = [
    {
      title: '10 Essential Tax Deductions Every Taxpayer Should Know',
      excerpt: 'Discover the most valuable tax deductions that can significantly reduce your tax liability and maximize your refund.',
      content: generateRichContent('tax-deductions'),
      readingTime: 8,
      views: 1250,
      featured: true,
      difficulty: 'Beginner',
      estimatedSavings: 2500,
      category: 'Tax Tips',
      tags: ['Deductions', 'Tax Planning', 'Beginner']
    },
    {
      title: 'How to Calculate Your Effective Tax Rate',
      excerpt: 'Learn how to calculate your effective tax rate and understand what it means for your financial planning.',
      content: generateRichContent('effective-tax-rate'),
      readingTime: 6,
      views: 890,
      featured: true,
      difficulty: 'Intermediate',
      category: 'Personal Finance',
      tags: ['Income Tax', 'Calculator', 'Tax Planning']
    },
    {
      title: 'Small Business Tax Credits You Might Be Missing',
      excerpt: 'Explore often-overlooked tax credits that could save your small business thousands of dollars.',
      content: generateRichContent('business-tax-credits'),
      readingTime: 10,
      views: 2100,
      featured: true,
      difficulty: 'Intermediate',
      estimatedSavings: 5000,
      category: 'Small Business',
      tags: ['Business Tax', 'Tax Credits', 'Small Business']
    },
    {
      title: '2024 Tax Law Changes: What You Need to Know',
      excerpt: 'Stay updated with the latest tax law changes for 2024 and how they might affect your tax situation.',
      content: generateRichContent('tax-law-changes'),
      readingTime: 12,
      views: 3200,
      featured: true,
      difficulty: 'Advanced',
      category: 'Tax Law Updates',
      tags: ['Tax Season', 'Tax Law Updates', 'Advanced']
    },
    {
      title: 'Tax Planning Strategies for High Earners',
      excerpt: 'Advanced tax planning strategies for individuals with high income to minimize their tax burden legally.',
      content: generateRichContent('high-earner-strategies'),
      readingTime: 15,
      views: 1800,
      featured: false,
      difficulty: 'Advanced',
      estimatedSavings: 15000,
      category: 'Personal Finance',
      tags: ['Tax Planning', 'Advanced', 'Income Tax']
    }
  ];

  for (const post of blogPosts) {
    // Get category and tags
    const category = await strapi.entityService.findMany('api::blog-category.blog-category', {
      filters: { name: post.category }
    });

    const tags = await strapi.entityService.findMany('api::tag.tag', {
      filters: { name: { $in: post.tags } }
    });

    await strapi.entityService.create('api::blog-post.blog-post', {
      data: {
        title: post.title,
        slug: post.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
        excerpt: post.excerpt,
        content: post.content,
        readingTime: post.readingTime,
        views: post.views,
        featured: post.featured,
        difficulty: post.difficulty,
        estimatedSavings: post.estimatedSavings,
        publishDate: new Date().toISOString(),
        lastUpdated: new Date().toISOString(),
        publishedAt: new Date().toISOString(),
        category: category[0]?.id,
        tags: tags.map(tag => tag.id),
        seo: generateSEO(post.title, post.excerpt, 'Article')
      }
    });
  }

  console.log(`✅ Created ${blogPosts.length} blog posts`);
}

async function seedTaxGuides() {
  console.log('📚 Seeding tax guides...');

  const guides = [
    {
      title: 'Complete Guide to US Income Tax 2024',
      country: 'US',
      taxYear: 2024,
      guideType: 'Individual',
      description: 'Comprehensive guide to filing individual income tax returns in the United States for 2024.',
      content: generateRichContent('us-income-tax-guide'),
      accuracy: 'Verified',
      priority: 10
    },
    {
      title: 'Canadian Tax Guide 2024',
      country: 'CA',
      taxYear: 2024,
      guideType: 'Individual',
      description: 'Complete guide to Canadian income tax filing for individuals.',
      content: generateRichContent('canadian-tax-guide'),
      accuracy: 'Verified',
      priority: 9
    },
    {
      title: 'UK Self Assessment Guide 2024/25',
      country: 'GB',
      taxYear: 2024,
      guideType: 'Self-Employed',
      description: 'Step-by-step guide to UK self assessment tax returns.',
      content: generateRichContent('uk-self-assessment'),
      accuracy: 'Reviewed',
      priority: 8
    },
    {
      title: 'Small Business Tax Guide - United States',
      country: 'US',
      taxYear: 2024,
      guideType: 'Business',
      description: 'Essential tax information for small business owners in the United States.',
      content: generateRichContent('us-business-tax'),
      accuracy: 'Verified',
      priority: 9
    }
  ];

  for (const guide of guides) {
    const country = await strapi.entityService.findMany('api::country.country', {
      filters: { code: guide.country }
    });

    await strapi.entityService.create('api::tax-guide.tax-guide', {
      data: {
        title: guide.title,
        slug: guide.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
        description: guide.description,
        content: guide.content,
        taxYear: guide.taxYear,
        guideType: guide.guideType,
        accuracy: guide.accuracy,
        priority: guide.priority,
        lastUpdated: new Date().toISOString(),
        publishedAt: new Date().toISOString(),
        country: country[0]?.id,
        seo: generateSEO(guide.title, guide.description, 'HowTo')
      }
    });
  }

  console.log(`✅ Created ${guides.length} tax guides`);
}

function generateRichContent(type) {
  const contents = {
    'tax-deductions': `
      <h2>Top 10 Tax Deductions for 2024</h2>
      <p>Tax deductions can significantly reduce your taxable income, potentially saving you hundreds or thousands of dollars. Here are the most valuable deductions to consider:</p>

      <h3>1. Standard vs. Itemized Deductions</h3>
      <p>For 2024, the standard deduction amounts are:</p>
      <ul>
        <li>Single filers: $13,850</li>
        <li>Married filing jointly: $27,700</li>
        <li>Head of household: $20,800</li>
      </ul>

      <h3>2. Home Office Deduction</h3>
      <p>If you work from home, you may be able to deduct expenses related to your home office. This includes a portion of your rent/mortgage, utilities, and office supplies.</p>

      <h3>3. Charitable Contributions</h3>
      <p>Donations to qualified charitable organizations are deductible. Keep detailed records and receipts for all contributions.</p>

      <h3>4. Medical and Dental Expenses</h3>
      <p>Medical expenses that exceed 7.5% of your adjusted gross income may be deductible.</p>

      <h3>5. State and Local Tax Deduction</h3>
      <p>You can deduct up to $10,000 in state and local taxes, including property taxes and either income or sales taxes.</p>
    `,

    'effective-tax-rate': `
      <h2>Understanding Your Effective Tax Rate</h2>
      <p>Your effective tax rate is the percentage of your total income that you pay in taxes. It's different from your marginal tax rate and provides a better picture of your overall tax burden.</p>

      <h3>How to Calculate Effective Tax Rate</h3>
      <p>The formula is simple:</p>
      <p><strong>Effective Tax Rate = (Total Tax Paid ÷ Total Income) × 100</strong></p>

      <h3>Example Calculation</h3>
      <p>If you earned $75,000 and paid $12,000 in federal taxes:</p>
      <p>Effective Tax Rate = ($12,000 ÷ $75,000) × 100 = 16%</p>

      <h3>Why It Matters</h3>
      <p>Understanding your effective tax rate helps you:</p>
      <ul>
        <li>Plan for future tax years</li>
        <li>Make informed financial decisions</li>
        <li>Compare tax efficiency of different investment strategies</li>
        <li>Understand the impact of deductions and credits</li>
      </ul>
    `,

    'business-tax-credits': `
      <h2>Valuable Small Business Tax Credits</h2>
      <p>Tax credits directly reduce your tax liability dollar-for-dollar, making them more valuable than deductions. Here are key credits small businesses often miss:</p>

      <h3>1. Small Business Health Care Tax Credit</h3>
      <p>If you provide health insurance to employees and meet certain criteria, you may qualify for a credit of up to 50% of premiums paid.</p>

      <h3>2. Work Opportunity Tax Credit</h3>
      <p>This credit incentivizes hiring individuals from certain targeted groups, potentially worth up to $9,600 per qualified employee.</p>

      <h3>3. Research and Development Credit</h3>
      <p>Businesses that engage in research and development activities may qualify for credits ranging from 20% to 40% of qualified expenses.</p>

      <h3>4. Disabled Access Credit</h3>
      <p>Small businesses that make their facilities more accessible to disabled individuals may claim up to $5,000 in credits annually.</p>
    `
  };

  return contents[type] || '<p>Content coming soon...</p>';
}

function generateSEO(title, description, type = 'Article') {
  return {
    metaTitle: title.length > 60 ? title.substring(0, 57) + '...' : title,
    metaDescription: description.length > 160 ? description.substring(0, 157) + '...' : description,
    keywords: title.toLowerCase().split(' ').filter(word => word.length > 3).slice(0, 5).join(', '),
    metaRobots: 'index,follow',
    structuredData: {
      "@context": "https://schema.org",
      "@type": type,
      "headline": title,
      "description": description,
      "author": {
        "@type": "Organization",
        "name": "GlobalTaxCalc"
      },
      "publisher": {
        "@type": "Organization",
        "name": "GlobalTaxCalc",
        "logo": {
          "@type": "ImageObject",
          "url": "https://globaltaxcalc.com/logo.png"
        }
      }
    }
  };
}

// Main execution
if (require.main === module) {
  // This allows the script to be run directly
  process.env.NODE_ENV = process.env.NODE_ENV || 'development';

  const strapi = require('@strapi/strapi');

  strapi().load().then(() => {
    return seedData();
  }).then(() => {
    console.log('🎉 Seeding completed!');
    process.exit(0);
  }).catch(error => {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  });
} else {
  // Export for use in other scripts
  module.exports = { seedData };
}