/**
 * Single Sign-On (SSO) Integration
 * Supports SAML 2.0, OAuth 2.0, OpenID Connect, and Active Directory
 */

const passport = require('passport');
const SamlStrategy = require('passport-saml').Strategy;
const OIDCStrategy = require('passport-azure-ad').OIDCStrategy;
const OAuth2Strategy = require('passport-oauth2');
const ldap = require('ldapjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

class SSOIntegration {
    constructor() {
        this.strategies = new Map();
        this.providerConfigs = new Map();
        this.setupPassport();
    }

    setupPassport() {
        passport.serializeUser((user, done) => {
            done(null, {
                id: user.id,
                tenantId: user.tenantId,
                provider: user.provider
            });
        });

        passport.deserializeUser(async (serializedUser, done) => {
            try {
                const user = await this.getUserById(serializedUser.id, serializedUser.tenantId);
                done(null, user);
            } catch (error) {
                done(error, null);
            }
        });
    }

    /**
     * SAML 2.0 Integration
     */
    async configureSAML(tenantId, config) {
        try {
            const samlConfig = {
                entryPoint: config.entryPoint,
                issuer: config.issuer || `globaltaxcalc-${tenantId}`,
                callbackUrl: config.callbackUrl || `${process.env.BASE_URL}/auth/saml/callback/${tenantId}`,
                cert: config.cert,
                privateCert: config.privateCert,
                identifierFormat: config.identifierFormat || 'urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress',
                wantAssertionsSigned: config.wantAssertionsSigned !== false,
                wantResponse: config.wantResponse !== false,
                signatureAlgorithm: config.signatureAlgorithm || 'sha256',
                digestAlgorithm: config.digestAlgorithm || 'sha256',
                attributeConsumingServiceIndex: config.attributeConsumingServiceIndex,
                disableRequestedAuthnContext: config.disableRequestedAuthnContext || false,
                authnContext: config.authnContext || [
                    'urn:oasis:names:tc:SAML:2.0:ac:classes:PasswordProtectedTransport'
                ],
                validateInResponseTo: config.validateInResponseTo !== false,
                requestIdExpirationPeriodMs: config.requestIdExpirationPeriodMs || 28800000,
                cacheProvider: config.cacheProvider || 'memory'
            };

            const strategy = new SamlStrategy(
                samlConfig,
                async (profile, done) => {
                    try {
                        const user = await this.processSAMLProfile(tenantId, profile);
                        return done(null, user);
                    } catch (error) {
                        return done(error, null);
                    }
                }
            );

            const strategyName = `saml-${tenantId}`;
            passport.use(strategyName, strategy);

            this.strategies.set(tenantId, {
                type: 'saml',
                name: strategyName,
                config: samlConfig
            });

            // Store provider configuration
            this.providerConfigs.set(tenantId, {
                type: 'saml',
                config: config,
                metadata: await this.generateSAMLMetadata(tenantId, samlConfig)
            });

            console.log(`SAML strategy configured for tenant ${tenantId}`);
            return { success: true, strategyName, metadata: this.providerConfigs.get(tenantId).metadata };

        } catch (error) {
            console.error('Error configuring SAML:', error);
            throw error;
        }
    }

    async processSAMLProfile(tenantId, profile) {
        const userInfo = {
            id: profile.nameID || profile['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier'],
            email: profile.email || profile['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress'],
            firstName: profile.firstName || profile['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/givenname'],
            lastName: profile.lastName || profile['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/surname'],
            displayName: profile.displayName || profile['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/displayname'],
            groups: profile.groups || profile['http://schemas.microsoft.com/ws/2008/06/identity/claims/groups'] || [],
            roles: profile.roles || profile['http://schemas.microsoft.com/ws/2008/06/identity/claims/role'] || [],
            department: profile.department || profile['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/department'],
            tenantId: tenantId,
            provider: 'saml',
            ssoId: profile.nameID
        };

        // Create or update user
        return await this.createOrUpdateSSOUser(userInfo);
    }

    async generateSAMLMetadata(tenantId, config) {
        const metadata = `<?xml version="1.0" encoding="UTF-8"?>
<md:EntityDescriptor xmlns:md="urn:oasis:names:tc:SAML:2.0:metadata"
                     entityID="${config.issuer}">
    <md:SPSSODescriptor protocolSupportEnumeration="urn:oasis:names:tc:SAML:2.0:protocol">
        <md:KeyDescriptor use="signing">
            <ds:KeyInfo xmlns:ds="http://www.w3.org/2000/09/xmldsig#">
                <ds:X509Data>
                    <ds:X509Certificate>${config.cert}</ds:X509Certificate>
                </ds:X509Data>
            </ds:KeyInfo>
        </md:KeyDescriptor>
        <md:NameIDFormat>${config.identifierFormat}</md:NameIDFormat>
        <md:AssertionConsumerService
            Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST"
            Location="${config.callbackUrl}"
            index="0" />
    </md:SPSSODescriptor>
</md:EntityDescriptor>`;

        return metadata;
    }

    /**
     * OpenID Connect Integration
     */
    async configureOIDC(tenantId, config) {
        try {
            const oidcConfig = {
                identityMetadata: config.identityMetadata,
                clientID: config.clientID,
                responseType: config.responseType || 'code',
                responseMode: config.responseMode || 'form_post',
                redirectUrl: config.redirectUrl || `${process.env.BASE_URL}/auth/oidc/callback/${tenantId}`,
                allowHttpForRedirectUrl: config.allowHttpForRedirectUrl || false,
                clientSecret: config.clientSecret,
                validateIssuer: config.validateIssuer !== false,
                passReqToCallback: true,
                scope: config.scope || ['openid', 'email', 'profile'],
                loggingLevel: config.loggingLevel || 'info',
                nonceLifetime: config.nonceLifetime || 3600,
                nonceMaxAmount: config.nonceMaxAmount || 5,
                useCookieInsteadOfSession: config.useCookieInsteadOfSession || false,
                cookieEncryptionKeys: config.cookieEncryptionKeys || [
                    { key: crypto.randomBytes(32), iv: crypto.randomBytes(12) }
                ]
            };

            const strategy = new OIDCStrategy(
                oidcConfig,
                async (req, iss, sub, profile, accessToken, refreshToken, done) => {
                    try {
                        const user = await this.processOIDCProfile(tenantId, profile, {
                            accessToken,
                            refreshToken,
                            iss,
                            sub
                        });
                        return done(null, user);
                    } catch (error) {
                        return done(error, null);
                    }
                }
            );

            const strategyName = `oidc-${tenantId}`;
            passport.use(strategyName, strategy);

            this.strategies.set(tenantId, {
                type: 'oidc',
                name: strategyName,
                config: oidcConfig
            });

            this.providerConfigs.set(tenantId, {
                type: 'oidc',
                config: config
            });

            console.log(`OIDC strategy configured for tenant ${tenantId}`);
            return { success: true, strategyName };

        } catch (error) {
            console.error('Error configuring OIDC:', error);
            throw error;
        }
    }

    async processOIDCProfile(tenantId, profile, tokens) {
        const userInfo = {
            id: profile.sub || profile.oid,
            email: profile.email || profile.preferred_username,
            firstName: profile.given_name,
            lastName: profile.family_name,
            displayName: profile.name,
            groups: profile.groups || [],
            roles: profile.roles || [],
            department: profile.department,
            tenantId: tenantId,
            provider: 'oidc',
            ssoId: profile.sub || profile.oid,
            tokens: {
                accessToken: tokens.accessToken,
                refreshToken: tokens.refreshToken,
                expiresAt: new Date(Date.now() + 3600000) // 1 hour
            }
        };

        return await this.createOrUpdateSSOUser(userInfo);
    }

    /**
     * OAuth 2.0 Integration
     */
    async configureOAuth2(tenantId, config) {
        try {
            const oauth2Config = {
                authorizationURL: config.authorizationURL,
                tokenURL: config.tokenURL,
                clientID: config.clientID,
                clientSecret: config.clientSecret,
                callbackURL: config.callbackURL || `${process.env.BASE_URL}/auth/oauth2/callback/${tenantId}`,
                scope: config.scope || ['openid', 'email', 'profile'],
                scopeSeparator: config.scopeSeparator || ' ',
                customHeaders: config.customHeaders || {},
                useAuthorizationHeaderForGET: config.useAuthorizationHeaderForGET || false
            };

            const strategy = new OAuth2Strategy(
                oauth2Config,
                async (accessToken, refreshToken, profile, done) => {
                    try {
                        const user = await this.processOAuth2Profile(tenantId, profile, {
                            accessToken,
                            refreshToken
                        });
                        return done(null, user);
                    } catch (error) {
                        return done(error, null);
                    }
                }
            );

            // Override userProfile method if custom endpoint provided
            if (config.userProfileURL) {
                strategy.userProfile = function(accessToken, done) {
                    this._oauth2.get(config.userProfileURL, accessToken, (err, body, res) => {
                        if (err) return done(err);
                        try {
                            const profile = JSON.parse(body);
                            done(null, profile);
                        } catch (e) {
                            done(e);
                        }
                    });
                };
            }

            const strategyName = `oauth2-${tenantId}`;
            passport.use(strategyName, strategy);

            this.strategies.set(tenantId, {
                type: 'oauth2',
                name: strategyName,
                config: oauth2Config
            });

            this.providerConfigs.set(tenantId, {
                type: 'oauth2',
                config: config
            });

            console.log(`OAuth2 strategy configured for tenant ${tenantId}`);
            return { success: true, strategyName };

        } catch (error) {
            console.error('Error configuring OAuth2:', error);
            throw error;
        }
    }

    async processOAuth2Profile(tenantId, profile, tokens) {
        const userInfo = {
            id: profile.id,
            email: profile.email,
            firstName: profile.first_name || profile.given_name,
            lastName: profile.last_name || profile.family_name,
            displayName: profile.name || profile.display_name,
            groups: profile.groups || [],
            roles: profile.roles || [],
            tenantId: tenantId,
            provider: 'oauth2',
            ssoId: profile.id,
            tokens: {
                accessToken: tokens.accessToken,
                refreshToken: tokens.refreshToken,
                expiresAt: new Date(Date.now() + 3600000)
            }
        };

        return await this.createOrUpdateSSOUser(userInfo);
    }

    /**
     * Active Directory Integration
     */
    async configureActiveDirectory(tenantId, config) {
        try {
            this.providerConfigs.set(tenantId, {
                type: 'ldap',
                config: {
                    url: config.url,
                    baseDN: config.baseDN,
                    bindDN: config.bindDN,
                    bindPassword: config.bindPassword,
                    searchFilter: config.searchFilter || '(sAMAccountName={{username}})',
                    searchAttributes: config.searchAttributes || [
                        'sAMAccountName', 'mail', 'givenName', 'sn', 'displayName',
                        'memberOf', 'department', 'title', 'telephoneNumber'
                    ],
                    tlsOptions: config.tlsOptions || {
                        rejectUnauthorized: false
                    }
                }
            });

            console.log(`Active Directory configured for tenant ${tenantId}`);
            return { success: true };

        } catch (error) {
            console.error('Error configuring Active Directory:', error);
            throw error;
        }
    }

    async authenticateWithActiveDirectory(tenantId, username, password) {
        try {
            const config = this.providerConfigs.get(tenantId);
            if (!config || config.type !== 'ldap') {
                throw new Error('Active Directory not configured for this tenant');
            }

            const ldapConfig = config.config;
            const client = ldap.createClient({
                url: ldapConfig.url,
                tlsOptions: ldapConfig.tlsOptions
            });

            // Bind with service account
            await new Promise((resolve, reject) => {
                client.bind(ldapConfig.bindDN, ldapConfig.bindPassword, (err) => {
                    if (err) reject(err);
                    else resolve();
                });
            });

            // Search for user
            const searchFilter = ldapConfig.searchFilter.replace('{{username}}', username);
            const searchResults = await new Promise((resolve, reject) => {
                client.search(ldapConfig.baseDN, {
                    filter: searchFilter,
                    attributes: ldapConfig.searchAttributes,
                    scope: 'sub'
                }, (err, res) => {
                    if (err) return reject(err);

                    const entries = [];
                    res.on('searchEntry', (entry) => {
                        entries.push(entry.object);
                    });

                    res.on('error', (err) => {
                        reject(err);
                    });

                    res.on('end', (result) => {
                        if (result.status !== 0) {
                            reject(new Error('LDAP search failed'));
                        } else {
                            resolve(entries);
                        }
                    });
                });
            });

            if (searchResults.length === 0) {
                throw new Error('User not found in Active Directory');
            }

            const userEntry = searchResults[0];

            // Authenticate user
            const userDN = userEntry.dn;
            await new Promise((resolve, reject) => {
                client.bind(userDN, password, (err) => {
                    if (err) reject(new Error('Invalid credentials'));
                    else resolve();
                });
            });

            client.unbind();

            // Process user profile
            const userInfo = {
                id: userEntry.sAMAccountName,
                email: userEntry.mail,
                firstName: userEntry.givenName,
                lastName: userEntry.sn,
                displayName: userEntry.displayName,
                groups: this.parseADGroups(userEntry.memberOf),
                department: userEntry.department,
                title: userEntry.title,
                phone: userEntry.telephoneNumber,
                tenantId: tenantId,
                provider: 'ldap',
                ssoId: userEntry.sAMAccountName
            };

            return await this.createOrUpdateSSOUser(userInfo);

        } catch (error) {
            console.error('Active Directory authentication error:', error);
            throw error;
        }
    }

    parseADGroups(memberOf) {
        if (!memberOf) return [];

        const groups = Array.isArray(memberOf) ? memberOf : [memberOf];
        return groups.map(group => {
            const match = group.match(/^CN=([^,]+)/);
            return match ? match[1] : group;
        });
    }

    /**
     * User Management
     */
    async createOrUpdateSSOUser(userInfo) {
        try {
            // Check if user exists
            let user = await this.getUserBySSOId(userInfo.ssoId, userInfo.tenantId, userInfo.provider);

            if (user) {
                // Update existing user
                user = await this.updateUser(user.id, {
                    email: userInfo.email,
                    firstName: userInfo.firstName,
                    lastName: userInfo.lastName,
                    displayName: userInfo.displayName,
                    groups: userInfo.groups,
                    roles: userInfo.roles,
                    department: userInfo.department,
                    title: userInfo.title,
                    phone: userInfo.phone,
                    lastLogin: new Date(),
                    tokens: userInfo.tokens
                });
            } else {
                // Create new user
                user = await this.createUser({
                    ...userInfo,
                    status: 'active',
                    createdAt: new Date(),
                    lastLogin: new Date()
                });
            }

            // Map groups to roles
            const mappedRoles = await this.mapGroupsToRoles(userInfo.tenantId, userInfo.groups);
            if (mappedRoles.length > 0) {
                await this.assignUserRoles(user.id, mappedRoles);
            }

            console.log(`SSO user processed: ${user.email} for tenant ${userInfo.tenantId}`);
            return user;

        } catch (error) {
            console.error('Error creating/updating SSO user:', error);
            throw error;
        }
    }

    async mapGroupsToRoles(tenantId, groups) {
        try {
            // Get tenant role mappings
            const mappings = await this.getTenantRoleMappings(tenantId);
            const roles = [];

            for (const group of groups) {
                const mapping = mappings.find(m => m.group === group);
                if (mapping) {
                    roles.push(mapping.role);
                }
            }

            return [...new Set(roles)]; // Remove duplicates

        } catch (error) {
            console.error('Error mapping groups to roles:', error);
            return [];
        }
    }

    /**
     * SSO Flow Management
     */
    async initiateSSOLogin(tenantId, redirectUrl) {
        try {
            const strategy = this.strategies.get(tenantId);
            if (!strategy) {
                throw new Error('SSO not configured for this tenant');
            }

            const state = jwt.sign(
                { tenantId, redirectUrl, timestamp: Date.now() },
                process.env.JWT_SECRET,
                { expiresIn: '10m' }
            );

            return {
                strategyName: strategy.name,
                state: state,
                loginUrl: this.generateLoginUrl(strategy, state)
            };

        } catch (error) {
            console.error('Error initiating SSO login:', error);
            throw error;
        }
    }

    generateLoginUrl(strategy, state) {
        const baseUrl = process.env.BASE_URL;

        switch (strategy.type) {
            case 'saml':
                return `${baseUrl}/auth/saml/login/${strategy.name.split('-')[1]}?state=${state}`;
            case 'oidc':
                return `${baseUrl}/auth/oidc/login/${strategy.name.split('-')[1]}?state=${state}`;
            case 'oauth2':
                return `${baseUrl}/auth/oauth2/login/${strategy.name.split('-')[1]}?state=${state}`;
            default:
                throw new Error('Unknown strategy type');
        }
    }

    async handleSSOCallback(tenantId, user, state) {
        try {
            // Verify state
            const decoded = jwt.verify(state, process.env.JWT_SECRET);
            if (decoded.tenantId !== tenantId) {
                throw new Error('Invalid state parameter');
            }

            // Log successful login
            await this.logSSOEvent(tenantId, user.id, 'login_success', {
                provider: user.provider,
                timestamp: new Date()
            });

            return {
                user: user,
                redirectUrl: decoded.redirectUrl || '/dashboard'
            };

        } catch (error) {
            console.error('SSO callback error:', error);

            // Log failed login
            await this.logSSOEvent(tenantId, null, 'login_failed', {
                error: error.message,
                timestamp: new Date()
            });

            throw error;
        }
    }

    /**
     * Placeholder methods for database operations
     */
    async getUserById(id, tenantId) {
        // Implementation would query tenant database
        console.log(`Getting user ${id} for tenant ${tenantId}`);
        return null;
    }

    async getUserBySSOId(ssoId, tenantId, provider) {
        // Implementation would query tenant database
        console.log(`Getting SSO user ${ssoId} for tenant ${tenantId}`);
        return null;
    }

    async createUser(userData) {
        // Implementation would create user in tenant database
        console.log('Creating SSO user:', userData.email);
        return userData;
    }

    async updateUser(userId, updates) {
        // Implementation would update user in tenant database
        console.log(`Updating user ${userId}:`, updates);
        return updates;
    }

    async assignUserRoles(userId, roles) {
        // Implementation would assign roles to user
        console.log(`Assigning roles to user ${userId}:`, roles);
    }

    async getTenantRoleMappings(tenantId) {
        // Implementation would get role mappings from database
        console.log(`Getting role mappings for tenant ${tenantId}`);
        return [];
    }

    async logSSOEvent(tenantId, userId, event, data) {
        // Implementation would log SSO events
        console.log(`SSO event for tenant ${tenantId}:`, event, data);
    }
}

module.exports = SSOIntegration;