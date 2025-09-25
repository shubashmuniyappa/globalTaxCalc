/**
 * SEO-Optimized Blog Post Template
 *
 * Template for all blog posts and educational content with comprehensive
 * SEO optimization, structured data, and content organization.
 */

import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import dynamic from 'next/dynamic';
import SEOLayout from '../components/SEO/SEOLayout';
import { generateBlogMeta } from '../lib/seo/meta-generator';

// Dynamic imports for better performance
const TableOfContents = dynamic(() => import('../components/TableOfContents'), {
  loading: () => <div>Loading table of contents...</div>
});

const RelatedPosts = dynamic(() => import('../components/RelatedPosts'), {
  loading: () => <div>Loading related posts...</div>
});

const NewsletterSignup = dynamic(() => import('../components/NewsletterSignup'), {
  loading: () => <div>Loading newsletter signup...</div>
});

const SocialShare = dynamic(() => import('../components/SocialShare'), {
  loading: () => <div>Loading social share...</div>
});

const BlogPostTemplate = ({
  // Post data
  post,
  relatedPosts = [],

  // Author data
  author,

  // Content data
  tableOfContents = [],

  // SEO data
  customKeywords = [],

  // Performance data
  criticalCSS,
  preloadImages = []
}) => {
  const router = useRouter();
  const [readingProgress, setReadingProgress] = useState(0);
  const [estimatedReadTime, setEstimatedReadTime] = useState(0);
  const [breadcrumbs, setBreadcrumbs] = useState([]);

  // Extract post data
  const {
    title,
    excerpt,
    content,
    slug,
    publishedAt,
    updatedAt,
    featuredImage,
    category,
    tags = [],
    country,
    state,
    taxYear,
    isGuide = false,
    difficulty = 'beginner' // beginner, intermediate, advanced
  } = post;

  // Calculate reading time
  useEffect(() => {
    if (content) {
      const wordsPerMinute = 200;
      const wordCount = content.split(/\s+/).length;
      const readTime = Math.ceil(wordCount / wordsPerMinute);
      setEstimatedReadTime(readTime);
    }
  }, [content]);

  // Track reading progress
  useEffect(() => {
    const updateReadingProgress = () => {
      const scrollTop = window.scrollY;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      const progress = (scrollTop / docHeight) * 100;
      setReadingProgress(Math.min(100, Math.max(0, progress)));
    };

    window.addEventListener('scroll', updateReadingProgress);
    return () => window.removeEventListener('scroll', updateReadingProgress);
  }, []);

  // Generate breadcrumbs
  useEffect(() => {
    const crumbs = [
      { name: 'Home', url: '/' },
      { name: isGuide ? 'Guides' : 'Blog', url: isGuide ? '/guides' : '/blog' }
    ];

    if (category) {
      crumbs.push({
        name: category.charAt(0).toUpperCase() + category.slice(1).replace('-', ' '),
        url: `${isGuide ? '/guides' : '/blog'}/${category}`
      });
    }

    if (country) {
      crumbs.push({
        name: `${country.charAt(0).toUpperCase() + country.slice(1).replace('-', ' ')} Tax`,
        url: `${isGuide ? '/guides' : '/blog'}/${country}`
      });
    }

    crumbs.push({ name: title, url: router.asPath });

    setBreadcrumbs(crumbs);
  }, [category, country, title, router.asPath, isGuide]);

  // Generate comprehensive keywords
  const generateKeywords = () => {
    const baseKeywords = [
      ...tags,
      'tax guide',
      'tax advice',
      'tax tips',
      'tax planning',
      ...(category ? [category.replace('-', ' ')] : [])
    ];

    // Add country-specific keywords
    if (country) {
      baseKeywords.push(
        `${country.replace('-', ' ')} tax`,
        `${country.replace('-', ' ')} tax guide`,
        `${country.replace('-', ' ')} tax tips`
      );
    }

    // Add state-specific keywords
    if (state) {
      baseKeywords.push(
        `${state.replace('-', ' ')} tax`,
        `${state.replace('-', ' ')} tax guide`,
        `${state.replace('-', ' ')} ${country.replace('-', ' ')} tax`
      );
    }

    // Add year-specific keywords
    if (taxYear) {
      baseKeywords.push(
        `${taxYear} tax`,
        `${taxYear} tax guide`,
        `${taxYear} tax changes`
      );
    }

    // Add difficulty-based keywords
    if (difficulty === 'beginner') {
      baseKeywords.push('tax basics', 'beginner tax guide', 'tax 101');
    } else if (difficulty === 'advanced') {
      baseKeywords.push('advanced tax', 'tax strategy', 'complex tax');
    }

    return [...baseKeywords, ...customKeywords];
  };

  // Generate FAQ data from content
  const generateFAQFromContent = () => {
    // This would typically extract FAQ sections from the content
    // For now, we'll return a basic FAQ structure
    return [
      {
        question: `What is covered in this ${isGuide ? 'guide' : 'article'}?`,
        answer: excerpt || `This comprehensive ${isGuide ? 'guide' : 'article'} covers ${title.toLowerCase()} with detailed explanations and practical examples.`
      },
      {
        question: 'Who should read this guide?',
        answer: difficulty === 'beginner'
          ? 'This guide is perfect for beginners who are new to tax planning and want to understand the basics.'
          : difficulty === 'advanced'
          ? 'This guide is designed for experienced taxpayers and tax professionals dealing with complex situations.'
          : 'This guide is suitable for taxpayers with some basic knowledge who want to deepen their understanding.'
      }
    ];
  };

  // Generate article schema data
  const articleData = {
    headline: title,
    description: excerpt,
    url: `https://globaltaxcalc.com${router.asPath}`,
    datePublished: publishedAt,
    dateModified: updatedAt,
    authorName: author?.name || 'GlobalTaxCalc Team',
    authorUrl: author?.url,
    image: featuredImage,
    wordCount: content ? content.split(/\s+/).length : 0,
    keywords: generateKeywords().join(', '),
    category
  };

  const metaData = generateBlogMeta({
    title,
    excerpt,
    slug,
    publishedAt,
    updatedAt,
    author: author?.name,
    category,
    tags,
    readingTime: estimatedReadTime,
    country,
    featured_image: featuredImage
  });

  return (
    <SEOLayout
      title={metaData.title}
      description={metaData.metaTags.description}
      keywords={generateKeywords()}
      canonical={router.asPath}
      article={articleData}
      breadcrumbs={breadcrumbs}
      faq={generateFAQFromContent()}
      country={country}
      state={state}
      taxYear={taxYear}
      publishedTime={publishedAt}
      modifiedTime={updatedAt}
      author={author?.name}
      category={category}
      tags={tags}
      ogImage={featuredImage}
      twitterImage={featuredImage}
      criticalCSS={criticalCSS}
      preloadImages={preloadImages}
    >
      {/* Reading Progress Bar */}
      <div
        className="reading-progress-bar"
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: `${readingProgress}%`,
          height: '3px',
          backgroundColor: '#667eea',
          zIndex: 1000,
          transition: 'width 0.1s ease-out'
        }}
      />

      <article className="blog-post">
        <div className="container">
          {/* Breadcrumb Navigation */}
          <nav className="breadcrumb" aria-label="Breadcrumb">
            <ol className="breadcrumb-list">
              {breadcrumbs.map((crumb, index) => (
                <li key={index} className="breadcrumb-item">
                  {index < breadcrumbs.length - 1 ? (
                    <a href={crumb.url} className="breadcrumb-link">
                      {crumb.name}
                    </a>
                  ) : (
                    <span className="breadcrumb-current" aria-current="page">
                      {crumb.name}
                    </span>
                  )}
                  {index < breadcrumbs.length - 1 && (
                    <span className="breadcrumb-separator" aria-hidden="true">›</span>
                  )}
                </li>
              ))}
            </ol>
          </nav>

          <div className="blog-post-container">
            {/* Post Header */}
            <header className="post-header">
              {/* Category and Tags */}
              <div className="post-meta-top">
                {category && (
                  <a href={`${isGuide ? '/guides' : '/blog'}/${category}`} className="post-category">
                    {category.charAt(0).toUpperCase() + category.slice(1).replace('-', ' ')}
                  </a>
                )}

                {difficulty && (
                  <span className={`difficulty-badge difficulty-${difficulty}`}>
                    {difficulty.charAt(0).toUpperCase() + difficulty.slice(1)}
                  </span>
                )}
              </div>

              {/* Main Title */}
              <h1 className="post-title">{title}</h1>

              {/* Excerpt */}
              {excerpt && (
                <p className="post-excerpt">{excerpt}</p>
              )}

              {/* Post Meta */}
              <div className="post-meta">
                <div className="post-meta-left">
                  {author && (
                    <div className="author-info">
                      {author.avatar && (
                        <img
                          src={author.avatar}
                          alt={author.name}
                          className="author-avatar"
                          width="40"
                          height="40"
                        />
                      )}
                      <div className="author-details">
                        <span className="author-name">{author.name}</span>
                        {author.title && (
                          <span className="author-title">{author.title}</span>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                <div className="post-meta-right">
                  <time dateTime={publishedAt} className="publish-date">
                    {new Date(publishedAt).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    })}
                  </time>

                  {updatedAt && updatedAt !== publishedAt && (
                    <time dateTime={updatedAt} className="updated-date">
                      Updated: {new Date(updatedAt).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      })}
                    </time>
                  )}

                  <span className="reading-time">
                    {estimatedReadTime} min read
                  </span>
                </div>
              </div>

              {/* Featured Image */}
              {featuredImage && (
                <div className="featured-image-container">
                  <img
                    src={featuredImage}
                    alt={title}
                    className="featured-image"
                    loading="lazy"
                  />
                </div>
              )}

              {/* Social Share */}
              <div className="social-share-top">
                <SocialShare
                  url={`https://globaltaxcalc.com${router.asPath}`}
                  title={title}
                  description={excerpt}
                />
              </div>
            </header>

            {/* Content Layout */}
            <div className="post-content-layout">
              {/* Table of Contents */}
              {tableOfContents.length > 0 && (
                <aside className="table-of-contents-sidebar">
                  <TableOfContents items={tableOfContents} />
                </aside>
              )}

              {/* Main Content */}
              <div className="post-content">
                {/* Content */}
                <div
                  className="post-body"
                  dangerouslySetInnerHTML={{ __html: content }}
                />

                {/* Tags */}
                {tags.length > 0 && (
                  <div className="post-tags">
                    <h3 className="tags-title">Tags:</h3>
                    <div className="tags-list">
                      {tags.map((tag, index) => (
                        <a
                          key={index}
                          href={`${isGuide ? '/guides' : '/blog'}/tag/${tag.toLowerCase().replace(/\s+/g, '-')}`}
                          className="tag-link"
                        >
                          #{tag}
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                {/* Author Bio */}
                {author && author.bio && (
                  <div className="author-bio">
                    <h3 className="author-bio-title">About the Author</h3>
                    <div className="author-bio-content">
                      {author.avatar && (
                        <img
                          src={author.avatar}
                          alt={author.name}
                          className="author-bio-avatar"
                          width="80"
                          height="80"
                        />
                      )}
                      <div className="author-bio-text">
                        <h4 className="author-bio-name">{author.name}</h4>
                        {author.title && (
                          <p className="author-bio-title-text">{author.title}</p>
                        )}
                        <p className="author-bio-description">{author.bio}</p>
                        {author.social && (
                          <div className="author-social">
                            {author.social.twitter && (
                              <a href={author.social.twitter} target="_blank" rel="noopener noreferrer">
                                Twitter
                              </a>
                            )}
                            {author.social.linkedin && (
                              <a href={author.social.linkedin} target="_blank" rel="noopener noreferrer">
                                LinkedIn
                              </a>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Social Share Bottom */}
                <div className="social-share-bottom">
                  <h3>Share this {isGuide ? 'guide' : 'article'}:</h3>
                  <SocialShare
                    url={`https://globaltaxcalc.com${router.asPath}`}
                    title={title}
                    description={excerpt}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Related Posts */}
        {relatedPosts.length > 0 && (
          <section className="related-posts-section">
            <div className="container">
              <RelatedPosts
                posts={relatedPosts}
                currentPost={slug}
                isGuide={isGuide}
              />
            </div>
          </section>
        )}

        {/* Newsletter Signup */}
        <section className="newsletter-section">
          <div className="container">
            <NewsletterSignup
              title="Stay Updated on Tax Changes"
              description="Get the latest tax news, tips, and calculator updates delivered to your inbox."
              tags={[category, ...(country ? [country] : [])]}
            />
          </div>
        </section>
      </article>
    </SEOLayout>
  );
};

export default BlogPostTemplate;