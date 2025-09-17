// Additional seeding for Country Pages, Tool Descriptions, and FAQ Items

async function seedCountryPages() {
  console.log('🌍 Seeding country pages...');

  const countryPages = [
    {
      country: 'US',
      title: 'United States Tax Calculator & Guide',
      heroSection: `
        <h1>Free US Tax Calculator</h1>
        <p>Calculate your federal and state taxes with our comprehensive US tax calculator. Get accurate estimates, understand your tax brackets, and maximize your refund.</p>
        <div class="cta-buttons">
          <a href="/calculator?country=US" class="btn btn-primary">Calculate Your Taxes</a>
          <a href="/guides/us" class="btn btn-secondary">View Tax Guides</a>
        </div>
      `,
      overview: `
        <p>The United States has a progressive federal income tax system with rates ranging from 10% to 37%. Additionally, most states impose their own income taxes. Our calculator helps you understand your complete tax liability including federal taxes, state taxes, FICA taxes, and potential deductions and credits.</p>
      `,
      taxSystemOverview: `
        <h2>US Tax System Overview</h2>
        <p>The US tax system is based on the ability to pay principle, with higher earners paying higher rates. Key features include:</p>
        <ul>
          <li><strong>Progressive Tax Brackets:</strong> Tax rates increase with income levels</li>
          <li><strong>Standard Deduction:</strong> $13,850 for single filers, $27,700 for married couples (2024)</li>
          <li><strong>Itemized Deductions:</strong> Alternative to standard deduction for taxpayers with significant deductible expenses</li>
          <li><strong>Tax Credits:</strong> Dollar-for-dollar reductions in tax liability</li>
          <li><strong>FICA Taxes:</strong> Social Security (6.2%) and Medicare (1.45%) taxes</li>
        </ul>
      `,
      keyTaxRates: {
        federalRates: [
          { bracket: '10%', income: '$0 - $11,000' },
          { bracket: '12%', income: '$11,001 - $44,725' },
          { bracket: '22%', income: '$44,726 - $95,375' },
          { bracket: '24%', income: '$95,376 - $182,050' },
          { bracket: '32%', income: '$182,051 - $231,250' },
          { bracket: '35%', income: '$231,251 - $578,125' },
          { bracket: '37%', income: '$578,126+' }
        ],
        ficaRates: {
          socialSecurity: '6.2%',
          medicare: '1.45%',
          additionalMedicare: '0.9% (on income over $200,000)'
        }
      },
      importantDeadlines: [
        { date: 'April 15, 2024', description: 'Tax return filing deadline' },
        { date: 'October 15, 2024', description: 'Extended filing deadline' },
        { date: 'January 31, 2024', description: 'W-2 and 1099 forms due to taxpayers' }
      ],
      featured: true,
      priority: 10
    },
    {
      country: 'CA',
      title: 'Canada Tax Calculator & Guide',
      heroSection: `
        <h1>Free Canada Tax Calculator</h1>
        <p>Calculate your federal and provincial taxes with our Canadian tax calculator. Understand your tax obligations and optimize your tax strategy.</p>
      `,
      overview: `
        <p>Canada operates a progressive tax system with both federal and provincial components. Tax rates vary by province, and residents may be eligible for various credits and deductions.</p>
      `,
      taxSystemOverview: `
        <h2>Canadian Tax System</h2>
        <p>The Canadian tax system includes federal taxes collected by the Canada Revenue Agency (CRA) and provincial taxes. Key features:</p>
        <ul>
          <li><strong>Federal Tax Brackets:</strong> Progressive rates from 15% to 33%</li>
          <li><strong>Provincial Taxes:</strong> Additional taxes varying by province</li>
          <li><strong>Basic Personal Amount:</strong> $15,000 federal exemption (2024)</li>
          <li><strong>RRSP Contributions:</strong> Tax-deductible retirement savings</li>
          <li><strong>Tax Credits:</strong> Various federal and provincial credits available</li>
        </ul>
      `,
      featured: true,
      priority: 9
    },
    {
      country: 'GB',
      title: 'UK Tax Calculator & Guide',
      heroSection: `
        <h1>Free UK Tax Calculator</h1>
        <p>Calculate your UK income tax, National Insurance, and take-home pay with our comprehensive calculator.</p>
      `,
      overview: `
        <p>The UK tax system includes income tax, National Insurance contributions, and various allowances and reliefs. Understanding your tax liability helps with financial planning.</p>
      `,
      taxSystemOverview: `
        <h2>UK Tax System</h2>
        <p>The UK operates a progressive income tax system administered by HM Revenue and Customs (HMRC):</p>
        <ul>
          <li><strong>Personal Allowance:</strong> £12,570 tax-free allowance (2024/25)</li>
          <li><strong>Basic Rate:</strong> 20% on income £12,571 - £50,270</li>
          <li><strong>Higher Rate:</strong> 40% on income £50,271 - £125,140</li>
          <li><strong>Additional Rate:</strong> 45% on income over £125,140</li>
          <li><strong>National Insurance:</strong> Additional contributions for social security</li>
        </ul>
      `,
      featured: true,
      priority: 8
    }
  ];

  for (const page of countryPages) {
    const country = await strapi.entityService.findMany('api::country.country', {
      filters: { code: page.country }
    });

    if (country.length > 0) {
      await strapi.entityService.create('api::country-page.country-page', {
        data: {
          title: page.title,
          slug: page.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
          heroSection: page.heroSection,
          overview: page.overview,
          taxSystemOverview: page.taxSystemOverview,
          keyTaxRates: page.keyTaxRates,
          importantDeadlines: page.importantDeadlines,
          featured: page.featured || false,
          priority: page.priority || 5,
          lastUpdated: new Date().toISOString(),
          publishedAt: new Date().toISOString(),
          country: country[0].id,
          seo: generateSEO(page.title, page.overview.replace(/<[^>]*>/g, '').substring(0, 160))
        }
      });
    }
  }

  console.log(`✅ Created ${countryPages.length} country pages`);
}

async function seedToolDescriptions() {
  console.log('🛠️ Seeding tool descriptions...');

  const tools = [
    {
      toolName: 'Income Tax Calculator',
      shortDescription: 'Calculate your federal and state income taxes with our comprehensive tax calculator.',
      fullDescription: `
        <p>Our income tax calculator helps you estimate your federal and state tax liability based on your income, filing status, and deductions. The calculator is updated annually with the latest tax brackets and standard deduction amounts.</p>
        <h3>Features:</h3>
        <ul>
          <li>Support for all filing statuses</li>
          <li>Federal and state tax calculations</li>
          <li>Standard and itemized deduction options</li>
          <li>Tax credit calculations</li>
          <li>Detailed breakdown of results</li>
        </ul>
      `,
      howToUse: `
        <h3>How to Use the Income Tax Calculator</h3>
        <ol>
          <li>Select your filing status (Single, Married Filing Jointly, etc.)</li>
          <li>Enter your annual gross income</li>
          <li>Choose your state of residence</li>
          <li>Select deduction method (Standard or Itemized)</li>
          <li>Add any applicable tax credits</li>
          <li>Click "Calculate" to see your results</li>
        </ol>
      `,
      category: 'Income Tax Calculator',
      difficulty: 'Beginner',
      keywords: 'income tax, tax calculator, federal tax, state tax, tax brackets',
      featured: true,
      priority: 10,
      usageCount: 15420
    },
    {
      toolName: 'Self Employment Tax Calculator',
      shortDescription: 'Calculate self-employment taxes including Social Security and Medicare taxes.',
      fullDescription: `
        <p>Self-employed individuals must pay both the employer and employee portions of Social Security and Medicare taxes. Our calculator helps you estimate these obligations.</p>
      `,
      howToUse: `
        <h3>How to Calculate Self-Employment Tax</h3>
        <ol>
          <li>Enter your net self-employment income</li>
          <li>The calculator applies the current SE tax rate (15.3%)</li>
          <li>View your total self-employment tax obligation</li>
          <li>See the deductible portion for income tax purposes</li>
        </ol>
      `,
      category: 'Income Tax Calculator',
      difficulty: 'Intermediate',
      keywords: 'self employment, SE tax, Social Security, Medicare, freelancer',
      featured: true,
      priority: 8,
      usageCount: 8950
    },
    {
      toolName: 'Business Tax Calculator',
      shortDescription: 'Estimate business income taxes for different entity types.',
      fullDescription: `
        <p>Calculate estimated taxes for various business structures including sole proprietorships, partnerships, S-corporations, and C-corporations.</p>
      `,
      category: 'Business Tax Calculator',
      difficulty: 'Advanced',
      keywords: 'business tax, corporate tax, partnership, S-corp, C-corp',
      featured: true,
      priority: 7,
      usageCount: 5670
    },
    {
      toolName: 'Tax Withholding Calculator',
      shortDescription: 'Determine the right amount of tax withholding from your paycheck.',
      fullDescription: `
        <p>Ensure you're having the right amount of tax withheld from your paycheck to avoid owing money or getting a large refund.</p>
      `,
      category: 'Planning Tool',
      difficulty: 'Intermediate',
      keywords: 'withholding, paycheck, W-4, tax planning',
      featured: false,
      priority: 6,
      usageCount: 3240
    }
  ];

  for (const tool of tools) {
    // Get supported countries (US for all tools initially)
    const countries = await strapi.entityService.findMany('api::country.country', {
      filters: { code: { $in: ['US', 'CA'] } }
    });

    // Get related tags
    const tags = await strapi.entityService.findMany('api::tag.tag', {
      filters: { name: { $in: ['Calculator', 'Tax Planning', 'Income Tax'] } }
    });

    await strapi.entityService.create('api::tool-description.tool-description', {
      data: {
        toolName: tool.toolName,
        slug: tool.toolName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
        shortDescription: tool.shortDescription,
        fullDescription: tool.fullDescription,
        howToUse: tool.howToUse,
        category: tool.category,
        difficulty: tool.difficulty,
        keywords: tool.keywords,
        featured: tool.featured || false,
        priority: tool.priority || 5,
        usageCount: tool.usageCount || 0,
        version: '1.0',
        lastUpdated: new Date().toISOString(),
        publishedAt: new Date().toISOString(),
        supportedCountries: countries.map(c => c.id),
        tags: tags.map(t => t.id),
        seo: generateSEO(tool.toolName, tool.shortDescription)
      }
    });
  }

  console.log(`✅ Created ${tools.length} tool descriptions`);
}

async function seedFAQItems() {
  console.log('❓ Seeding FAQ items...');

  const faqItems = [
    {
      question: 'How accurate are the tax calculations?',
      answer: `
        <p>Our tax calculators use the most current tax brackets, standard deduction amounts, and tax rates published by the IRS and state tax authorities. However, these are estimates and should not replace professional tax advice.</p>
        <p>For the most accurate results, consult with a qualified tax professional, especially if you have complex tax situations.</p>
      `,
      shortAnswer: 'Our calculators use current official tax rates but provide estimates only.',
      category: 'Calculator Usage',
      priority: 10,
      featured: true,
      difficulty: 'Basic',
      keywords: 'accuracy, estimates, tax calculations, reliability'
    },
    {
      question: 'What is the difference between marginal and effective tax rates?',
      answer: `
        <p><strong>Marginal Tax Rate:</strong> The rate you pay on your last dollar of income. This is your highest tax bracket.</p>
        <p><strong>Effective Tax Rate:</strong> Your total tax divided by your total income. This represents your overall tax burden.</p>
        <p>For example, if you're in the 22% tax bracket, that's your marginal rate. But your effective rate might be 15% because lower portions of your income are taxed at lower rates.</p>
      `,
      shortAnswer: 'Marginal rate is your highest bracket; effective rate is your average tax rate.',
      category: 'General Tax Questions',
      priority: 9,
      featured: true,
      difficulty: 'Basic',
      keywords: 'marginal rate, effective rate, tax brackets'
    },
    {
      question: 'When is the tax filing deadline?',
      answer: `
        <p>For most taxpayers, the federal tax filing deadline is <strong>April 15th</strong>. If April 15th falls on a weekend or holiday, the deadline is extended to the next business day.</p>
        <p>You can request an automatic 6-month extension to <strong>October 15th</strong> by filing Form 4868, but this only extends the filing deadline, not the payment deadline.</p>
        <p>State tax deadlines may vary, so check with your state tax authority.</p>
      `,
      shortAnswer: 'Federal deadline is April 15th, with extensions available to October 15th.',
      category: 'Filing and Deadlines',
      priority: 8,
      featured: true,
      difficulty: 'Basic',
      keywords: 'filing deadline, April 15, extension, due date'
    },
    {
      question: 'Should I take the standard deduction or itemize?',
      answer: `
        <p>You should choose whichever option gives you the larger deduction:</p>
        <ul>
          <li><strong>Standard Deduction (2024):</strong> $13,850 (single), $27,700 (married filing jointly)</li>
          <li><strong>Itemized Deductions:</strong> Sum of qualifying expenses like mortgage interest, charitable donations, state/local taxes (up to $10,000), and medical expenses exceeding 7.5% of AGI</li>
        </ul>
        <p>Most taxpayers benefit from the standard deduction, but itemizing may be beneficial if you have significant qualifying expenses.</p>
      `,
      shortAnswer: 'Choose the option that gives you the larger deduction amount.',
      category: 'Deductions and Credits',
      priority: 9,
      featured: true,
      difficulty: 'Basic',
      keywords: 'standard deduction, itemized deduction, deductions'
    },
    {
      question: 'Do I need to pay estimated taxes?',
      answer: `
        <p>You may need to pay estimated taxes if you expect to owe $1,000 or more when you file your return. This typically applies to:</p>
        <ul>
          <li>Self-employed individuals</li>
          <li>Business owners</li>
          <li>Investors with significant capital gains</li>
          <li>People with rental income</li>
          <li>Anyone without sufficient tax withholding</li>
        </ul>
        <p>Estimated taxes are due quarterly: January 15, April 15, June 15, and September 15.</p>
      `,
      shortAnswer: 'Yes, if you expect to owe $1,000+ and have insufficient withholding.',
      category: 'Business Taxes',
      priority: 7,
      featured: false,
      difficulty: 'Intermediate',
      keywords: 'estimated taxes, quarterly payments, self-employed'
    },
    {
      question: 'Can I use the calculator for multiple states?',
      answer: `
        <p>Yes! Our calculator supports all 50 states plus Washington D.C. Simply select your state of residence to get accurate state tax calculations.</p>
        <p>If you moved during the year or have income from multiple states, you may need to file multiple state returns. Our calculator can help estimate taxes for each state separately.</p>
      `,
      shortAnswer: 'Yes, we support all 50 states and D.C.',
      category: 'Calculator Usage',
      priority: 6,
      featured: false,
      difficulty: 'Basic',
      keywords: 'multiple states, state taxes, moving'
    }
  ];

  for (const faq of faqItems) {
    // Get category
    const category = await strapi.entityService.findMany('api::faq-category.faq-category', {
      filters: { name: faq.category }
    });

    // Get related countries (US for all FAQs initially)
    const countries = await strapi.entityService.findMany('api::country.country', {
      filters: { code: 'US' }
    });

    await strapi.entityService.create('api::faq-item.faq-item', {
      data: {
        question: faq.question,
        answer: faq.answer,
        shortAnswer: faq.shortAnswer,
        priority: faq.priority,
        featured: faq.featured || false,
        difficulty: faq.difficulty,
        keywords: faq.keywords,
        helpfulVotes: Math.floor(Math.random() * 100) + 20, // Random helpful votes
        totalVotes: Math.floor(Math.random() * 120) + 25, // Random total votes
        lastUpdated: new Date().toISOString(),
        publishedAt: new Date().toISOString(),
        category: category[0]?.id,
        relatedCountries: countries.map(c => c.id)
      }
    });
  }

  console.log(`✅ Created ${faqItems.length} FAQ items`);
}

function generateSEO(title, description) {
  return {
    metaTitle: title.length > 60 ? title.substring(0, 57) + '...' : title,
    metaDescription: description.length > 160 ? description.substring(0, 157) + '...' : description,
    keywords: title.toLowerCase().split(' ').filter(word => word.length > 3).slice(0, 5).join(', '),
    metaRobots: 'index,follow',
    structuredData: {
      "@context": "https://schema.org",
      "@type": "WebPage",
      "name": title,
      "description": description,
      "publisher": {
        "@type": "Organization",
        "name": "GlobalTaxCalc"
      }
    }
  };
}

module.exports = {
  seedCountryPages,
  seedToolDescriptions,
  seedFAQItems
};