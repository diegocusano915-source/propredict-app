/**
 * ProPredict i18n - Auto Translation System
 * Uses Google Translate free endpoint - No API Key Required
 * Translates EVERYTHING automatically
 */

const I18N = (function() {
    'use strict';
    
    // Supported languages
    const LANGUAGES = {
        en: { name: 'English', flag: '🇬🇧', googleCode: 'en' },
        es: { name: 'Español', flag: '🇪🇸', googleCode: 'es' },
        fr: { name: 'Français', flag: '🇫🇷', googleCode: 'fr' },
        pt: { name: 'Português', flag: '🇵🇹', googleCode: 'pt' },
        de: { name: 'Deutsch', flag: '🇩🇪', googleCode: 'de' }
    };
    
    const DEFAULT_LANGUAGE = 'en';
    const STORAGE_KEY = 'propredict_language';
    
    let currentLanguage = DEFAULT_LANGUAGE;
    let translationCache = new Map();
    let observer = null;
    let isTranslating = false;
    let translationQueue = [];
    
    // ==========================================================
    // GOOGLE TRANSLATE FREE ENDPOINT
    // ==========================================================
    
    async function translateText(text, targetLang) {
        if (!text || targetLang === 'en') return text;
        
        // Check cache first
        const cacheKey = `${text}_${targetLang}`;
        if (translationCache.has(cacheKey)) {
            return translationCache.get(cacheKey);
        }
        
        try {
            // Google Translate free endpoint
            const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${targetLang}&dt=t&q=${encodeURIComponent(text)}`;
            
            const response = await fetch(url);
            const data = await response.json();
            
            // Parse Google's response format
            let translated = '';
            if (data && data[0]) {
                for (const part of data[0]) {
                    if (part[0]) translated += part[0];
                }
            }
            
            // Cache the result
            translationCache.set(cacheKey, translated || text);
            
            return translated || text;
        } catch (error) {
            console.warn('Translation failed for:', text, error);
            return text;
        }
    }
    
    // ==========================================================
    // BATCH TRANSLATION FOR EFFICIENCY
    // ==========================================================
    
    async function translateElements(elements, targetLang) {
        if (targetLang === 'en' || !elements.length) return;
        
        // Collect all unique text nodes
        const textNodes = [];
        const nodeMap = new Map();
        
        for (const el of elements) {
            // Skip elements that shouldn't be translated
            if (el.hasAttribute('data-no-translate')) continue;
            if (el.tagName === 'SCRIPT' || el.tagName === 'STYLE') continue;
            if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
                if (el.placeholder) {
                    const key = `placeholder_${el.placeholder}`;
                    if (!nodeMap.has(key)) {
                        nodeMap.set(key, []);
                    }
                    nodeMap.get(key).push({ el, attr: 'placeholder', text: el.placeholder });
                }
                continue;
            }
            
            // Get direct text nodes
            for (const node of el.childNodes) {
                if (node.nodeType === Node.TEXT_NODE) {
                    const text = node.textContent.trim();
                    if (text && text.length > 1 && !/^\d+$/.test(text)) {
                        if (!nodeMap.has(text)) {
                            nodeMap.set(text, []);
                        }
                        nodeMap.get(text).push({ node, parent: el });
                    }
                }
            }
            
            // Translate element's own text if it has no children
            if (el.children.length === 0 && el.textContent.trim()) {
                const text = el.textContent.trim();
                if (text && text.length > 1 && !/^\d+$/.test(text)) {
                    if (!nodeMap.has(text)) {
                        nodeMap.set(text, []);
                    }
                    nodeMap.get(text).push({ el, isElement: true });
                }
            }
        }
        
        // Translate each unique text
        for (const [text, targets] of nodeMap) {
            try {
                const translated = await translateText(text, targetLang);
                if (translated && translated !== text) {
                    for (const target of targets) {
                        if (target.isElement) {
                            target.el.textContent = translated;
                        } else if (target.attr === 'placeholder') {
                            target.el.placeholder = translated;
                        } else if (target.node) {
                            target.node.textContent = translated;
                        }
                    }
                }
            } catch (e) {
                console.warn('Failed to translate:', text);
            }
        }
    }
    
    // ==========================================================
    // TRANSLATE ENTIRE PAGE
    // ==========================================================
    
    async function translatePage(targetLang) {
        if (targetLang === 'en') {
            // For English, we need to reload the page to restore original text
            // Or we could use a backup of original text (simpler to just use cache)
            return;
        }
        
        if (isTranslating) return;
        isTranslating = true;
        
        try {
            // Get all translatable elements
            const elements = document.querySelectorAll(`
                h1, h2, h3, h4, h5, h6, p, span, a, button, 
                label, li, td, th, div:not([data-no-translate]),
                .nav-item, .menu-item, .card-title, .card-text,
                [data-translate="true"]
            `);
            
            await translateElements(Array.from(elements), targetLang);
            
            // Dispatch completion event
            window.dispatchEvent(new CustomEvent('translationComplete', { 
                detail: { language: targetLang } 
            }));
            
        } finally {
            isTranslating = false;
            
            // Process queue
            if (translationQueue.length > 0) {
                const next = translationQueue.shift();
                translatePage(next);
            }
        }
    }
    
    // ==========================================================
    // SET LANGUAGE
    // ==========================================================
    
    async function setLanguage(locale) {
        if (!LANGUAGES[locale]) return false;
        
        const googleCode = LANGUAGES[locale].googleCode;
        
        // Save preference
        localStorage.setItem(STORAGE_KEY, locale);
        currentLanguage = locale;
        document.documentElement.setAttribute('lang', locale);
        
        // Update dropdown
        updateLanguageSwitcher();
        
        // Clear cache for new language
        translationCache.clear();
        
        // Translate the page
        await translatePage(googleCode);
        
        // Dispatch event for other components
        window.dispatchEvent(new CustomEvent('languageChanged', { 
            detail: { locale } 
        }));
        
        return true;
    }
    
    // ==========================================================
    // GET TRANSLATION (for manual use)
    // ==========================================================
    
    function t(key, fallback = '') {
        // With auto-translation, return the key itself
        return fallback || key;
    }
    
    // ==========================================================
    // LANGUAGE SWITCHER UI
    // ==========================================================
    
    function updateLanguageSwitcher() {
        const select = document.getElementById('languageSelect');
        if (select) {
            select.value = currentLanguage;
        }
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
                transition: all 0.2s ease;
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
    // MUTATION OBSERVER FOR DYNAMIC CONTENT
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
                            // Also get all descendants
                            const descendants = node.querySelectorAll('*');
                            newElements.push(...descendants);
                        }
                    }
                }
            }
            
            if (newElements.length > 0) {
                const googleCode = LANGUAGES[currentLanguage]?.googleCode || currentLanguage;
                translateElements(newElements, googleCode);
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
    
    async function init() {
        const saved = localStorage.getItem(STORAGE_KEY);
        const urlParams = new URLSearchParams(window.location.search);
        const urlLang = urlParams.get('lang');
        
        const locale = urlLang || saved || DEFAULT_LANGUAGE;
        currentLanguage = locale;
        
        injectLanguageSwitcher();
        setupObserver();
        
        document.documentElement.setAttribute('lang', locale);
        
        // Translate if not English
        if (locale !== 'en') {
            const googleCode = LANGUAGES[locale]?.googleCode || locale;
            await translatePage(googleCode);
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
        getCurrentLanguage: () => currentLanguage,
        getLanguages: () => ({ ...LANGUAGES }),
        translateText,
        translatePage: () => {
            const googleCode = LANGUAGES[currentLanguage]?.googleCode || currentLanguage;
            return translatePage(googleCode);
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
