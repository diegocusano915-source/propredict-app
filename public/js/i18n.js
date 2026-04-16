/**
 * ProPredict i18n - Static JSON Translation System
 * Uses pre-translated locale files - No API, No CSP, Instant
 * Supports: EN, ES, FR, PT, DE
 */

const I18N = (function() {
    'use strict';
    
    const LANGUAGES = {
        en: { name: 'English', flag: '🇬🇧', code: 'en' },
        es: { name: 'Español', flag: '🇪🇸', code: 'es' },
        fr: { name: 'Français', flag: '🇫🇷', code: 'fr' },
        pt: { name: 'Português', flag: '🇵🇹', code: 'pt' },
        de: { name: 'Deutsch', flag: '🇩🇪', code: 'de' }
    };
    
    const DEFAULT_LANGUAGE = 'en';
    const STORAGE_KEY = 'propredict_language';
    
    let currentLanguage = DEFAULT_LANGUAGE;
    let translations = {};
    let isInitialized = false;
    let observer = null;
    
    // Load translation file
    async function loadTranslations(locale) {
        try {
            const response = await fetch(`/locales/${locale}.json`);
            if (!response.ok) throw new Error(`Failed to load ${locale}`);
            translations = await response.json();
            currentLanguage = locale;
            localStorage.setItem(STORAGE_KEY, locale);
            document.documentElement.setAttribute('lang', locale);
            return true;
        } catch (error) {
            console.error('Translation load error:', error);
            return false;
        }
    }
    
    // Get translated string
    function t(key, fallback = '') {
        if (!key) return fallback;
        
        const parts = key.split('.');
        let value = translations;
        
        for (const part of parts) {
            if (value && typeof value === 'object' && part in value) {
                value = value[part];
            } else {
                return fallback || key;
            }
        }
        
        return typeof value === 'string' ? value : fallback || key;
    }
    
    // Translate all elements with data-i18n attribute
    function translatePage() {
        // Text content
        document.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.getAttribute('data-i18n');
            const translated = t(key);
            if (translated && translated !== key) {
                el.textContent = translated;
            }
        });
        
        // Placeholders
        document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
            const key = el.getAttribute('data-i18n-placeholder');
            const translated = t(key);
            if (translated && translated !== key) {
                el.placeholder = translated;
            }
        });
        
        // Aria labels
        document.querySelectorAll('[data-i18n-aria]').forEach(el => {
            const key = el.getAttribute('data-i18n-aria');
            const translated = t(key);
            if (translated && translated !== key) {
                el.setAttribute('aria-label', translated);
            }
        });
        
        // Title attributes
        document.querySelectorAll('[data-i18n-title]').forEach(el => {
            const key = el.getAttribute('data-i18n-title');
            const translated = t(key);
            if (translated && translated !== key) {
                el.setAttribute('title', translated);
            }
        });
        
        // Translate match outcomes and dynamic text
        translateMatchContent();
        
        // Dispatch event
        window.dispatchEvent(new CustomEvent('languageChanged', { detail: { locale: currentLanguage } }));
    }
    
    // Translate match-specific content (team names, outcomes, etc.)
    function translateMatchContent() {
        if (currentLanguage === 'en') return;
        
        // Translate "Win", "Draw", etc. in match cards
        document.querySelectorAll('.pick-name, .outcome-text, .market-name').forEach(el => {
            const text = el.textContent.trim();
            
            // Handle "Win: TeamName" format
            if (text.includes(':')) {
                const parts = text.split(':');
                const outcomeType = parts[0].trim();
                const teamName = parts.slice(1).join(':').trim();
                
                const translatedOutcome = t(`matches.${outcomeType.toLowerCase()}`) || outcomeType;
                el.textContent = `${translatedOutcome}: ${teamName}`;
            } else {
                const translated = t(`matches.${text.toLowerCase()}`) || text;
                if (translated !== text) {
                    el.textContent = translated;
                }
            }
        });
        
        // Translate confidence badges
        document.querySelectorAll('.confidence-badge, .pick-confidence, [class*="confidence-"]').forEach(el => {
            const text = el.textContent.trim();
            const confidenceKey = text.toLowerCase();
            const translated = t(`matches.${confidenceKey}`) || text;
            if (translated !== text) {
                el.textContent = translated;
            }
        });
        
        // Translate "Add to Accumulator" buttons
        document.querySelectorAll('.add-btn').forEach(el => {
            const translated = t('matches.add_to_accumulator');
            if (translated) el.textContent = translated;
        });
        
        // Translate "TOP PICK OF THE DAY"
        document.querySelectorAll('.match-badge, .top-pick-badge').forEach(el => {
            if (el.textContent.includes('TOP PICK') || el.textContent.includes('Top Pick')) {
                const translated = t('matches.top_pick_of_day');
                if (translated) el.textContent = translated;
            }
        });
    }
    
    // Change language
    async function setLanguage(locale) {
        if (!LANGUAGES[locale]) return false;
        
        const success = await loadTranslations(locale);
        if (success) {
            translatePage();
            updateLanguageSwitcher();
            
            // Re-render picks if function exists
            if (typeof window.renderTopPicks === 'function') {
                setTimeout(() => window.renderTopPicks(), 50);
            }
            
            // Update footer pages if in iframe or redirect with lang param
            updateFooterPageLinks();
        }
        return success;
    }
    
    // Update footer links to include language parameter
    function updateFooterPageLinks() {
        document.querySelectorAll('.footer-links a, a[href*=".html"]').forEach(link => {
            const href = link.getAttribute('href');
            if (href && href.endsWith('.html') && !href.includes('#')) {
                const url = new URL(href, window.location.origin);
                url.searchParams.set('lang', currentLanguage);
                link.href = url.pathname + url.search;
            }
        });
    }
    
    // Get current language
    function getCurrentLanguage() {
        return currentLanguage;
    }
    
    // Update dropdown
    function updateLanguageSwitcher() {
        const select = document.getElementById('languageSelect');
        if (select) select.value = currentLanguage;
    }
    
    // Inject language switcher
    function injectLanguageSwitcher() {
        const selectors = [
            '.header .controls',
            '.dashboard-header .controls',
            '.user-controls',
            '.header-controls',
            'header .controls',
            '.navbar .controls',
            '.top-bar .controls'
        ];
        
        let controlsDiv = null;
        for (const selector of selectors) {
            controlsDiv = document.querySelector(selector);
            if (controlsDiv) break;
        }
        
        if (!controlsDiv) {
            // Create floating switcher for pages without header controls
            controlsDiv = document.createElement('div');
            controlsDiv.className = 'controls language-controls-fixed';
            controlsDiv.style.cssText = 'position:fixed;top:20px;right:20px;z-index:9999;display:flex;gap:10px;';
            document.body.appendChild(controlsDiv);
        }
        
        if (!controlsDiv) return;
        if (document.getElementById('languageSwitcher')) return;
        
        const switcherDiv = document.createElement('div');
        switcherDiv.className = 'control-group language-switcher-group';
        switcherDiv.id = 'languageSwitcher';
        switcherDiv.innerHTML = `
            <label for="languageSelect">🌐</label>
            <select id="languageSelect" class="language-select">
                ${Object.entries(LANGUAGES).map(([code, lang]) => 
                    `<option value="${code}">${lang.flag} ${lang.name}</option>`
                ).join('')}
            </select>
        `;
        
        controlsDiv.appendChild(switcherDiv);
        
        document.getElementById('languageSelect').addEventListener('change', (e) => {
            setLanguage(e.target.value);
        });
        
        addStyles();
    }
    
    // Add styles
    function addStyles() {
        if (document.getElementById('i18n-static-styles')) return;
        
        const style = document.createElement('style');
        style.id = 'i18n-static-styles';
        style.textContent = `
            .language-select {
                min-height: 40px;
                padding: 8px 32px 8px 14px;
                border-radius: 10px;
                border: 1px solid rgba(127, 240, 197, 0.25);
                background: rgba(15, 23, 42, 0.9);
                backdrop-filter: blur(8px);
                -webkit-backdrop-filter: blur(8px);
                color: #fff;
                font-size: 14px;
                font-weight: 600;
                cursor: pointer;
                outline: none;
                appearance: none;
                -webkit-appearance: none;
                background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%237ff0c5' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E");
                background-repeat: no-repeat;
                background-position: right 10px center;
                background-size: 14px;
            }
            .language-select option {
                background: #0f172a;
                color: #fff;
            }
            .language-controls-fixed {
                position: fixed !important;
                top: 20px !important;
                right: 20px !important;
                z-index: 9999 !important;
            }
            @media (max-width: 768px) {
                .language-select {
                    min-height: 36px;
                    padding: 6px 28px 6px 12px;
                    font-size: 13px;
                }
            }
        `;
        document.head.appendChild(style);
    }
    
    // Setup observer for dynamic content
    function setupObserver() {
        if (observer) observer.disconnect();
        
        observer = new MutationObserver((mutations) => {
            let needsTranslation = false;
            
            for (const mutation of mutations) {
                if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                    for (const node of mutation.addedNodes) {
                        if (node.nodeType === Node.ELEMENT_NODE) {
                            if (node.hasAttribute && node.hasAttribute('data-i18n') ||
                                node.querySelector && node.querySelector('[data-i18n]')) {
                                needsTranslation = true;
                                break;
                            }
                        }
                    }
                }
                if (needsTranslation) break;
            }
            
            if (needsTranslation) {
                translatePage();
            }
        });
        
        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }
    
    // Initialize
    async function init() {
        const saved = localStorage.getItem(STORAGE_KEY);
        const urlParams = new URLSearchParams(window.location.search);
        const urlLang = urlParams.get('lang');
        
        const locale = urlLang || saved || DEFAULT_LANGUAGE;
        
        await loadTranslations(locale);
        translatePage();
        injectLanguageSwitcher();
        updateLanguageSwitcher();
        updateFooterPageLinks();
        setupObserver();
        
        isInitialized = true;
        console.log('✅ i18n initialized - Language:', locale);
    }
    
    // Public API
    return {
        init,
        t,
        setLanguage,
        getCurrentLanguage,
        getLanguages: () => ({ ...LANGUAGES }),
        translatePage,
        translateMatchContent
    };
    
})();

// Auto-initialize
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => I18N.init());
} else {
    I18N.init();
}

// Expose globally
window.I18N = I18N;
window.t = (key, fallback) => I18N.t(key, fallback);
