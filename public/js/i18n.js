/**
 * ProPredict i18n - Auto Translation System
 * Uses MyMemory Free Translation API - No API Key, No CSP Issues
 * Translates EVERYTHING automatically
 */

const I18N = (function() {
    'use strict';
    
    // Supported languages
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
    let translationCache = new Map();
    let observer = null;
    let originalTexts = new Map();
    
    // ==========================================================
    // MYMEMORY FREE TRANSLATION API (JSONP - bypasses CSP)
    // ==========================================================
    
    function translateTextJSONP(text, targetLang, callback) {
        if (!text || targetLang === 'en') {
            callback(text);
            return;
        }
        
        const trimmedText = text.trim();
        if (trimmedText.length < 2 || /^[\d\s.%]+$/.test(trimmedText)) {
            callback(text);
            return;
        }
        
        const cacheKey = `${trimmedText}_${targetLang}`;
        if (translationCache.has(cacheKey)) {
            callback(translationCache.get(cacheKey));
            return;
        }
        
        // Create unique callback name
        const callbackName = 'mymemory_cb_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
        
        // Set timeout for slow responses
        const timeout = setTimeout(() => {
            delete window[callbackName];
            callback(text);
        }, 3000);
        
        // Define callback
        window[callbackName] = (response) => {
            clearTimeout(timeout);
            delete window[callbackName];
            
            let translated = text;
            if (response && response.responseData && response.responseData.translatedText) {
                translated = response.responseData.translatedText;
                translationCache.set(cacheKey, translated);
            }
            
            callback(translated);
        };
        
        // Create script tag for JSONP request
        const script = document.createElement('script');
        const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(trimmedText)}&langpair=en|${targetLang}&callback=${callbackName}`;
        script.src = url;
        script.onerror = () => {
            clearTimeout(timeout);
            delete window[callbackName];
            callback(text);
        };
        
        document.head.appendChild(script);
        setTimeout(() => script.remove(), 5000);
    }
    
    // ==========================================================
    // BATCH TRANSLATION
    // ==========================================================
    
    function translateElements(elements, targetLang) {
        if (targetLang === 'en' || !elements.length) return;
        
        // Store original text if not already stored
        for (const el of elements) {
            if (!el.hasAttribute('data-original-text')) {
                const text = el.textContent.trim();
                if (text && text.length > 1) {
                    el.setAttribute('data-original-text', text);
                }
            }
        }
        
        // Get all unique text nodes
        const textSet = new Set();
        const elementMap = new Map();
        
        for (const el of elements) {
            if (el.hasAttribute('data-no-translate')) continue;
            if (el.tagName === 'SCRIPT' || el.tagName === 'STYLE') continue;
            if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
                if (el.placeholder && el.placeholder.length > 1) {
                    textSet.add(el.placeholder);
                    if (!elementMap.has(el.placeholder)) {
                        elementMap.set(el.placeholder, []);
                    }
                    elementMap.get(el.placeholder).push({ el, type: 'placeholder' });
                }
                continue;
            }
            
            // Skip elements with children (only translate leaf elements)
            if (el.children.length === 0) {
                const text = el.textContent.trim();
                if (text && text.length > 1 && !/^[\d\s.%₦$€£]+$/.test(text)) {
                    textSet.add(text);
                    if (!elementMap.has(text)) {
                        elementMap.set(text, []);
                    }
                    elementMap.get(text).push({ el, type: 'text' });
                }
            }
        }
        
        const uniqueTexts = Array.from(textSet);
        let index = 0;
        
        function translateNext() {
            if (index >= uniqueTexts.length) {
                // All done
                window.dispatchEvent(new CustomEvent('translationComplete', { 
                    detail: { language: targetLang } 
                }));
                return;
            }
            
            const text = uniqueTexts[index];
            index++;
            
            translateTextJSONP(text, targetLang, (translated) => {
                if (translated && translated !== text) {
                    const targets = elementMap.get(text) || [];
                    for (const target of targets) {
                        if (target.type === 'placeholder') {
                            target.el.placeholder = translated;
                        } else {
                            target.el.textContent = translated;
                        }
                    }
                }
                
                // Small delay to avoid rate limiting
                setTimeout(translateNext, 50);
            });
        }
        
        translateNext();
    }
    
    // ==========================================================
    // TRANSLATE ENTIRE PAGE
    // ==========================================================
    
    function translatePage(targetLang) {
        if (targetLang === 'en') {
            // Restore original English text
            document.querySelectorAll('[data-original-text]').forEach(el => {
                const original = el.getAttribute('data-original-text');
                if (original) {
                    el.textContent = original;
                }
            });
            return;
        }
        
        const elements = document.querySelectorAll(`
            h1, h2, h3, h4, h5, h6, p, span, a, button:not(.no-translate),
            label, li, td, th, .nav-item, .menu-item, .card-title,
            .match-title, .team-name, .outcome-text, .confidence-badge,
            .section-header, .dashboard-title, .referral-text
        `);
        
        translateElements(Array.from(elements), targetLang);
    }
    
    // ==========================================================
    // SET LANGUAGE
    // ==========================================================
    
    function setLanguage(locale) {
        if (!LANGUAGES[locale]) return false;
        
        const langCode = LANGUAGES[locale].code;
        
        localStorage.setItem(STORAGE_KEY, locale);
        currentLanguage = locale;
        document.documentElement.setAttribute('lang', locale);
        
        updateLanguageSwitcher();
        translationCache.clear();
        
        translatePage(langCode);
        
        window.dispatchEvent(new CustomEvent('languageChanged', { 
            detail: { locale } 
        }));
        
        return true;
    }
    
    function t(key, fallback = '') {
        return fallback || key;
    }
    
    function getCurrentLanguage() {
        return currentLanguage;
    }
    
    // ==========================================================
    // LANGUAGE SWITCHER UI
    // ==========================================================
    
    function updateLanguageSwitcher() {
        const select = document.getElementById('languageSelect');
        if (select) select.value = currentLanguage;
    }
    
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
            const header = document.querySelector('header, .header, .dashboard-header, .navbar');
            if (header) {
                controlsDiv = document.createElement('div');
                controlsDiv.className = 'controls user-controls';
                controlsDiv.style.cssText = 'display:flex;align-items:center;gap:15px;';
                header.appendChild(controlsDiv);
            } else {
                controlsDiv = document.createElement('div');
                controlsDiv.className = 'controls language-controls-fixed';
                controlsDiv.style.cssText = 'position:fixed;top:20px;right:20px;z-index:9999;display:flex;gap:10px;';
                document.body.appendChild(controlsDiv);
            }
        }
        
        if (!controlsDiv) return;
        if (document.getElementById('languageSwitcher')) return;
        
        const switcherDiv = document.createElement('div');
        switcherDiv.className = 'language-switcher-group';
        switcherDiv.style.cssText = 'display:flex;align-items:center;gap:8px;';
        switcherDiv.innerHTML = `
            <span style="color:#7ff0c5;font-size:16px;">🌐</span>
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
    
    function addStyles() {
        if (document.getElementById('i18n-styles')) return;
        
        const style = document.createElement('style');
        style.id = 'i18n-styles';
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
            .language-select:hover {
                border-color: rgba(127, 240, 197, 0.5);
                background: rgba(15, 23, 42, 1);
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
    
    // ==========================================================
    // MUTATION OBSERVER
    // ==========================================================
    
    function setupObserver() {
        if (observer) observer.disconnect();
        
        observer = new MutationObserver((mutations) => {
            if (currentLanguage === 'en') return;
            
            let newElements = [];
            
            for (const mutation of mutations) {
                if (mutation.type === 'childList') {
                    for (const node of mutation.addedNodes) {
                        if (node.nodeType === Node.ELEMENT_NODE) {
                            newElements.push(node);
                            const descendants = node.querySelectorAll('*');
                            newElements.push(...descendants);
                        }
                    }
                }
            }
            
            if (newElements.length > 0) {
                const langCode = LANGUAGES[currentLanguage]?.code || currentLanguage;
                setTimeout(() => translateElements(newElements, langCode), 100);
            }
        });
        
        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }
    
    // ==========================================================
    // INITIALIZE
    // ==========================================================
    
    function init() {
        const saved = localStorage.getItem(STORAGE_KEY);
        const urlParams = new URLSearchParams(window.location.search);
        const urlLang = urlParams.get('lang');
        
        const locale = urlLang || saved || DEFAULT_LANGUAGE;
        currentLanguage = locale;
        
        injectLanguageSwitcher();
        setupObserver();
        
        document.documentElement.setAttribute('lang', locale);
        
        if (locale !== 'en') {
            setTimeout(() => {
                const langCode = LANGUAGES[locale]?.code || locale;
                translatePage(langCode);
            }, 500);
        }
        
        updateLanguageSwitcher();
        console.log('✅ i18n initialized - Language:', locale);
    }
    
    // ==========================================================
    // PUBLIC API
    // ==========================================================
    
    return {
        init,
        setLanguage,
        getCurrentLanguage,
        getLanguages: () => ({ ...LANGUAGES }),
        translatePage: () => {
            const langCode = LANGUAGES[currentLanguage]?.code || currentLanguage;
            translatePage(langCode);
        },
        t
    };
    
})();

// Auto-initialize
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => I18N.init());
} else {
    I18N.init();
}

window.I18N = I18N;
window.t = (key, fallback) => I18N.t(key, fallback);
