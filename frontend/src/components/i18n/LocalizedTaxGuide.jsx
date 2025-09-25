/**
 * Localized Tax Guide Component
 * Displays country-specific tax guides with cultural context and navigation
 */

import React, { useState, useEffect } from 'react';
import { FormattedMessage, FormattedDate } from 'react-intl';
import {
  BookOpenIcon,
  CalendarIcon,
  DocumentTextIcon,
  QuestionMarkCircleIcon,
  LinkIcon,
  ChevronRightIcon,
  ChevronDownIcon,
  InformationCircleIcon
} from '@heroicons/react/24/outline';
import { useI18n } from '../../lib/i18n/IntlProvider';
import { useLocalizedContent, useTaxGuideContent } from './LocalizedContentProvider';

const LocalizedTaxGuide = ({
  topic = 'overview',
  country,
  className = '',
  showNavigation = true,
  showResources = true,
  showFAQ = true,
  compact = false
}) => {
  const { locale, isRTL } = useI18n();
  const { currentCountry, getTaxGuideTopics, getCountryName } = useLocalizedContent();
  const { guideContent, loading } = useTaxGuideContent(topic, country);

  const [availableTopics, setAvailableTopics] = useState([]);
  const [expandedSections, setExpandedSections] = useState(new Set(['overview']));
  const [selectedTopic, setSelectedTopic] = useState(topic);

  const targetCountry = country || currentCountry;

  // Load available topics
  useEffect(() => {
    const loadTopics = async () => {
      try {
        const topics = await getTaxGuideTopics(targetCountry, locale);
        setAvailableTopics(topics);
      } catch (error) {
        console.error('Failed to load guide topics:', error);
      }
    };

    loadTopics();
  }, [targetCountry, locale, getTaxGuideTopics]);

  // Toggle section expansion
  const toggleSection = (sectionId) => {
    setExpandedSections(prev => {
      const newSet = new Set(prev);
      if (newSet.has(sectionId)) {
        newSet.delete(sectionId);
      } else {
        newSet.add(sectionId);
      }
      return newSet;
    });
  };

  // Render navigation sidebar
  const renderNavigation = () => {
    if (!showNavigation || compact) return null;

    return (
      <div className="w-64 bg-gray-50 rounded-lg p-4 mb-6 lg:mb-0">
        <h3 className="text-lg font-semibold mb-4 flex items-center">
          <BookOpenIcon className="w-5 h-5 mr-2" />
          <FormattedMessage
            id="guides.navigation.title"
            defaultMessage="Tax Guide Topics"
          />
        </h3>

        <nav className="space-y-2">
          {availableTopics.map(topicItem => (
            <button
              key={topicItem.id}
              onClick={() => setSelectedTopic(topicItem.id)}
              className={`
                w-full text-left px-3 py-2 rounded-md text-sm transition-colors duration-200
                ${selectedTopic === topicItem.id
                  ? 'bg-blue-100 text-blue-700 font-medium'
                  : 'text-gray-700 hover:bg-gray-100'
                }
              `}
            >
              <div className="font-medium">{topicItem.title}</div>
              <div className="text-xs text-gray-500 mt-1">
                {topicItem.description}
              </div>
            </button>
          ))}
        </nav>

        {/* Country selector in navigation */}
        <div className="mt-6 pt-4 border-t border-gray-200">
          <div className="text-sm font-medium text-gray-700 mb-2">
            <FormattedMessage
              id="guides.navigation.country"
              defaultMessage="Guide for"
            />
          </div>
          <div className="text-sm text-gray-600">
            {getCountryName(targetCountry, locale)}
          </div>
        </div>
      </div>
    );
  };

  // Render guide section
  const renderSection = (section) => {
    const isExpanded = expandedSections.has(section.id);

    return (
      <div key={section.id} className="border border-gray-200 rounded-lg mb-4">
        <button
          onClick={() => toggleSection(section.id)}
          className="w-full px-4 py-3 bg-gray-50 hover:bg-gray-100 rounded-t-lg flex items-center justify-between transition-colors duration-200"
        >
          <h3 className="text-lg font-semibold text-gray-900 flex items-center">
            <DocumentTextIcon className="w-5 h-5 mr-2" />
            {section.title}
          </h3>
          {isExpanded ? (
            <ChevronDownIcon className="w-5 h-5 text-gray-500" />
          ) : (
            <ChevronRightIcon className="w-5 h-5 text-gray-500" />
          )}
        </button>

        {isExpanded && (
          <div className="px-4 py-4">
            <div className="prose max-w-none">
              <div
                className="text-gray-700 leading-relaxed"
                dangerouslySetInnerHTML={{ __html: section.content }}
              />
            </div>
          </div>
        )}
      </div>
    );
  };

  // Render key dates section
  const renderKeyDates = () => {
    if (!guideContent?.keyDates) return null;

    const { keyDates } = guideContent;

    return (
      <div className="bg-blue-50 rounded-lg p-4 mb-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center text-blue-800">
          <CalendarIcon className="w-5 h-5 mr-2" />
          <FormattedMessage
            id="guides.keyDates.title"
            defaultMessage="Important Tax Dates"
          />
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white rounded p-3">
            <div className="text-sm font-medium text-blue-700">
              <FormattedMessage
                id="guides.keyDates.taxYear"
                defaultMessage="Tax Year"
              />
            </div>
            <div className="text-gray-800">
              {keyDates.taxYearStart} - {keyDates.taxYearEnd}
            </div>
          </div>

          <div className="bg-white rounded p-3">
            <div className="text-sm font-medium text-blue-700">
              <FormattedMessage
                id="guides.keyDates.filingDeadline"
                defaultMessage="Filing Deadline"
              />
            </div>
            <div className="text-gray-800">
              {keyDates.filingDeadline}
            </div>
          </div>

          {keyDates.quarterlyDates?.length > 0 && (
            <div className="bg-white rounded p-3 md:col-span-2">
              <div className="text-sm font-medium text-blue-700 mb-2">
                <FormattedMessage
                  id="guides.keyDates.quarterly"
                  defaultMessage="Quarterly Payment Dates"
                />
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {keyDates.quarterlyDates.map(date => (
                  <div key={date.quarter} className="text-center">
                    <div className="text-xs text-gray-500">{date.quarter}</div>
                    <div className="text-sm font-medium">{date.date}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {keyDates.importantDeadlines?.map(deadline => (
            <div key={deadline.name} className="bg-white rounded p-3">
              <div className="text-sm font-medium text-blue-700">
                {deadline.name}
              </div>
              <div className="text-gray-800">{deadline.date}</div>
              {deadline.description && (
                <div className="text-xs text-gray-600 mt-1">
                  {deadline.description}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  };

  // Render FAQ section
  const renderFAQ = () => {
    if (!showFAQ || !guideContent?.commonQuestions) return null;

    return (
      <div className="mb-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center">
          <QuestionMarkCircleIcon className="w-5 h-5 mr-2" />
          <FormattedMessage
            id="guides.faq.title"
            defaultMessage="Frequently Asked Questions"
          />
        </h3>

        <div className="space-y-4">
          {guideContent.commonQuestions.map(faq => (
            <div key={faq.id} className="border border-gray-200 rounded-lg">
              <button
                onClick={() => toggleSection(faq.id)}
                className="w-full px-4 py-3 text-left hover:bg-gray-50 rounded-lg flex items-center justify-between transition-colors duration-200"
              >
                <span className="font-medium text-gray-900">{faq.question}</span>
                {expandedSections.has(faq.id) ? (
                  <ChevronDownIcon className="w-5 h-5 text-gray-500 flex-shrink-0" />
                ) : (
                  <ChevronRightIcon className="w-5 h-5 text-gray-500 flex-shrink-0" />
                )}
              </button>

              {expandedSections.has(faq.id) && (
                <div className="px-4 pb-4">
                  <div className="text-gray-700 leading-relaxed">
                    {faq.answer}
                  </div>
                  {faq.category && (
                    <div className="mt-2">
                      <span className="inline-block px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded">
                        {faq.category}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  };

  // Render resources section
  const renderResources = () => {
    if (!showResources || !guideContent?.resources) return null;

    const { resources } = guideContent;

    return (
      <div className="bg-gray-50 rounded-lg p-4">
        <h3 className="text-lg font-semibold mb-4 flex items-center">
          <LinkIcon className="w-5 h-5 mr-2" />
          <FormattedMessage
            id="guides.resources.title"
            defaultMessage="Additional Resources"
          />
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Official Resources */}
          {resources.official?.length > 0 && (
            <div>
              <h4 className="font-medium text-gray-800 mb-2">
                <FormattedMessage
                  id="guides.resources.official"
                  defaultMessage="Official Resources"
                />
              </h4>
              <ul className="space-y-2">
                {resources.official.map((resource, index) => (
                  <li key={index}>
                    <a
                      href={resource.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-800 text-sm flex items-center"
                    >
                      <LinkIcon className="w-4 h-4 mr-1 flex-shrink-0" />
                      {resource.name}
                    </a>
                    <div className="text-xs text-gray-600 ml-5">
                      {resource.description}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Tax Forms */}
          {resources.forms?.length > 0 && (
            <div>
              <h4 className="font-medium text-gray-800 mb-2">
                <FormattedMessage
                  id="guides.resources.forms"
                  defaultMessage="Tax Forms"
                />
              </h4>
              <ul className="space-y-2">
                {resources.forms.map((form, index) => (
                  <li key={index} className="text-sm">
                    <div className="font-medium text-gray-800">{form.name}</div>
                    <div className="text-xs text-gray-600">{form.description}</div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Related Calculators */}
          {resources.calculators?.length > 0 && (
            <div>
              <h4 className="font-medium text-gray-800 mb-2">
                <FormattedMessage
                  id="guides.resources.calculators"
                  defaultMessage="Related Calculators"
                />
              </h4>
              <ul className="space-y-2">
                {resources.calculators.map((calculator, index) => (
                  <li key={index}>
                    <a
                      href={calculator.url}
                      className="text-blue-600 hover:text-blue-800 text-sm flex items-center"
                    >
                      <ChevronRightIcon className="w-4 h-4 mr-1 flex-shrink-0" />
                      {calculator.name}
                    </a>
                    <div className="text-xs text-gray-600 ml-5">
                      {calculator.description}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Related Guides */}
          {resources.guides?.length > 0 && (
            <div>
              <h4 className="font-medium text-gray-800 mb-2">
                <FormattedMessage
                  id="guides.resources.guides"
                  defaultMessage="Related Guides"
                />
              </h4>
              <ul className="space-y-2">
                {resources.guides.map((guide, index) => (
                  <li key={index}>
                    <a
                      href={guide.url}
                      className="text-blue-600 hover:text-blue-800 text-sm flex items-center"
                    >
                      <BookOpenIcon className="w-4 h-4 mr-1 flex-shrink-0" />
                      {guide.name}
                    </a>
                    <div className="text-xs text-gray-600 ml-5">
                      {guide.description}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    );
  };

  // Loading state
  if (loading) {
    return (
      <div className={`flex items-center justify-center p-8 ${className}`}>
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-2">
          <FormattedMessage id="common.loading" defaultMessage="Loading..." />
        </span>
      </div>
    );
  }

  // Error state
  if (!guideContent) {
    return (
      <div className={`text-center p-8 ${className}`}>
        <InformationCircleIcon className="w-12 h-12 mx-auto mb-4 text-gray-400" />
        <p className="text-gray-600">
          <FormattedMessage
            id="guides.error.notFound"
            defaultMessage="Tax guide not available for this topic"
          />
        </p>
      </div>
    );
  }

  return (
    <div className={`max-w-6xl mx-auto ${className}`}>
      <div className={`flex flex-col lg:flex-row gap-6 ${isRTL ? 'lg:flex-row-reverse' : ''}`}>
        {/* Navigation Sidebar */}
        {renderNavigation()}

        {/* Main Content */}
        <div className="flex-1">
          {/* Header */}
          <div className="mb-6">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              {guideContent.title}
            </h1>
            <div className="text-gray-600 leading-relaxed">
              {guideContent.introduction}
            </div>
          </div>

          {/* Key Dates */}
          {renderKeyDates()}

          {/* Guide Sections */}
          {guideContent.sections && (
            <div className="mb-6">
              {guideContent.sections.map(section => renderSection(section))}
            </div>
          )}

          {/* FAQ Section */}
          {renderFAQ()}

          {/* Resources */}
          {renderResources()}

          {/* Last Updated */}
          <div className="mt-8 pt-4 border-t border-gray-200 text-center">
            <p className="text-sm text-gray-500">
              <FormattedMessage
                id="guides.lastUpdated"
                defaultMessage="Last updated: {date}"
                values={{
                  date: <FormattedDate value={new Date()} />
                }}
              />
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LocalizedTaxGuide;