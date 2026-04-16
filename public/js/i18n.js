/**
 * ProPredict i18n - Simple Translation System
 * Uses LibreTranslate Public API - No API Key, No CSP Issues
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
    const API_URL = 'https://translate.argosopentech.com/translate';
    
    let currentLanguage = DEFAULT_LANGUAGE;
    let translationCache = new Map();
    
    // Simple translation function
    async function translateText(text, targetLang) {
        if (!text || targetLang === 'en') return text;
        if (text.length < 2 || /^[\d\s.%₦$€£]+$/.test(text)) return text;
        
        const cacheKey = `${text}_${targetLang}`;
        if (translationCache.has(cacheKey)) {
            return translationCache.get(cacheKey);
        }
        
        try {
            const response = await fetch(API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    q: text,
                    source: 'en',
                    target: targetLang,
                    format: 'text'
                })
            });
            
            const data = await response.json();
            const translated = data.translatedText || text;
            
            translationCache.set(cacheKey, translated);
            return translated;
        } catch (error) {
            console.warn('Translation failed:', error);
            return text;
        }
    }
    
    // Translate page elements
    async function translatePage(targetLang) {
        if (targetLang === 'en') {
            location.reload();
            return;
        }
        
        const elements = document.querySelectorAll('h1, h2, h3, h4, h5, h6, p, span, a, button, label, li, td, th, .nav-item, .card-title, .match-teams, .pick-name, .section-header h2');
        
        for (const el of elements) {
            if (el.children.length > 0) continue;
            if (el.hasAttribute('data-no-translate')) continue;
            
            const text = el.textContent.trim();
            if (text && text.length > 1) {
                const translated = await translateText(text, targetLang);
                if (translated !== text) {
                    el.textContent = translated;
                }
            }
            await new Promise(r => setTimeout(r, 50)); // Rate limit
        }
    }
    
    // Set language
    async function setLanguage(locale) {
        if (!LANGUAGES[locale]) return false;
        
        localStorage.setItem(STORAGE_KEY, locale);
        currentLanguage = locale;
        document.documentElement.setAttribute('lang', locale);
        updateLanguageSwitcher();
        
        if (locale !== 'en') {
            await translatePage(LANGUAGES[locale].code);
        }
        
        return true;
    }
    
    function t(key, fallback = '') {
        return fallback || key;
    }
    
    function getCurrentLanguage() {
        return currentLanguage;
    }
    
    function updateLanguageSwitcher() {
        const select = document.getElementById('languageSelect');
        if (select) select.value = currentLanguage;
    }
    
    function injectLanguageSwitcher() {
        const controlsDiv = document.querySelector('.header .controls, .dashboard-header .controls, .user-controls');
        if (!controlsDiv || document.getElementById('languageSwitcher')) return;
        
        const switcherDiv = document.createElement('div');
        switcherDiv.className = 'control-group language-switcher-group';
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
        `;
        document.head.appendChild(style);
    }
    
    function init() {
        const saved = localStorage.getItem(STORAGE_KEY);
        const locale = saved || DEFAULT_LANGUAGE;
        currentLanguage = locale;
        
        injectLanguageSwitcher();
        document.documentElement.setAttribute('lang', locale);
        
        if (locale !== 'en') {
            setTimeout(() => translatePage(LANGUAGES[locale].code), 500);
        }
        
        updateLanguageSwitcher();
    }
    
    return {
        init,
        setLanguage,
        getCurrentLanguage,
        getLanguages: () => ({ ...LANGUAGES }),
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
