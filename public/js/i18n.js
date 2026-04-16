/**
 * ProPredict i18n - Auto Translation System
 * Powered by translate.js + SiliconFlow (Free, No API Key)
 * Translates EVERYTHING automatically - No more mixed languages!
 */

const I18N = (function() {
    'use strict';
    
    // Supported languages
    const LANGUAGES = {
        en: { name: 'English', flag: '🇬🇧' },
        es: { name: 'Español', flag: '🇪🇸' },
        fr: { name: 'Français', flag: '🇫🇷' },
        pt: { name: 'Português', flag: '🇵🇹' },
        de: { name: 'Deutsch', flag: '🇩🇪' }
    };
    
    const DEFAULT_LANGUAGE = 'en';
    const STORAGE_KEY = 'propredict_language';
    
    let currentLanguage = DEFAULT_LANGUAGE;
    let translateJsLoaded = false;
    let pendingTranslations = [];
    
    // Load translate.js script dynamically
    function loadTranslateJs() {
        return new Promise((resolve, reject) => {
            if (window.translate) {
                translateJsLoaded = true;
                resolve();
                return;
            }
            
            // Check if script is already loading
            if (document.querySelector('script[src*="translate.js"]')) {
                const checkInterval = setInterval(() => {
                    if (window.translate) {
                        clearInterval(checkInterval);
                        translateJsLoaded = true;
                        resolve();
                    }
                }, 100);
                return;
            }
            
            const script = document.createElement('script');
            script.src = 'https://cdn.staticfile.org/translate.js/3.15.6/translate.min.js';
            script.onload = () => {
                translateJsLoaded = true;
                
                // Configure translate.js to use SiliconFlow (free, no API key)
                if (window.translate) {
                    window.translate.service.use('siliconflow');
                    window.translate.language.setDefault(DEFAULT_LANGUAGE);
                    
                    // Set up callback for when translation completes
                    window.translate.on('translate', (result) => {
                        currentLanguage = result.to;
                        localStorage.setItem(STORAGE_KEY, currentLanguage);
                        document.documentElement.setAttribute('lang', currentLanguage);
                        updateLanguageSwitcher();
                        
                        // Dispatch event for other components
                        window.dispatchEvent(new CustomEvent('languageChanged', { 
                            detail: { locale: currentLanguage } 
                        }));
                        
                        // Process any pending translations
                        processPendingTranslations();
                    });
                }
                
                resolve();
            };
            script.onerror = () => {
                console.warn('translate.js failed to load, using fallback');
                reject(new Error('translate.js load failed'));
            };
            document.head.appendChild(script);
        });
    }
    
    // Process any dynamic content that needs translation
    function processPendingTranslations() {
        if (!window.translate) return;
        
        pendingTranslations.forEach(selector => {
            const elements = document.querySelectorAll(selector);
            elements.forEach(el => {
                window.translate.element.execute(el);
            });
        });
        pendingTranslations = [];
    }
    
    // Translate specific element (for dynamic content)
    function translateElement(element) {
        if (!element) return;
        
        if (window.translate && translateJsLoaded) {
            window.translate.element.execute(element);
        } else {
            // Queue for later
            const selector = element.id ? `#${element.id}` : 
                            element.className ? `.${element.className.split(' ')[0]}` : 
                            element.tagName.toLowerCase();
            pendingTranslations.push(selector);
        }
    }
    
    // Translate entire page
    function translatePage() {
        if (window.translate && translateJsLoaded) {
            window.translate.execute();
        } else {
            loadTranslateJs().then(() => {
                if (window.translate) {
                    window.translate.execute();
                }
            }).catch(() => {
                console.warn('Translation service unavailable');
            });
        }
    }
    
    // Set language
    async function setLanguage(locale) {
        if (!LANGUAGES[locale]) return false;
        
        // Save to localStorage immediately
        localStorage.setItem(STORAGE_KEY, locale);
        
        // Wait for translate.js to load if needed
        if (!translateJsLoaded) {
            try {
                await loadTranslateJs();
            } catch (e) {
                console.warn('Could not load translation service');
                return false;
            }
        }
        
        if (window.translate) {
            // Change language using translate.js
            window.translate.language.set(locale);
            
            // Force re-translation of the page
            setTimeout(() => {
                window.translate.execute();
            }, 100);
            
            updateLanguageSwitcher();
            return true;
        }
        
        return false;
    }
    
    // Get current language
    function getCurrentLanguage() {
        return currentLanguage;
    }
    
    // Get translation for a key (kept for backward compatibility)
    function t(key, fallback = '') {
        // With auto-translation, we don't need manual translations
        // Return the key itself - it will be auto-translated by translate.js
        return fallback || key;
    }
    
    // Update language switcher dropdown
    function updateLanguageSwitcher() {
        const select = document.getElementById('languageSelect');
        if (select) {
            select.value = currentLanguage;
        }
    }
    
    // Inject language switcher into the page
    function injectLanguageSwitcher() {
        // Try multiple selectors for the controls area
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
        
        // If no controls found, create one
        if (!controlsDiv) {
            const header = document.querySelector('header, .header, .dashboard-header, .navbar');
            if (header) {
                controlsDiv = document.createElement('div');
                controlsDiv.className = 'controls user-controls';
                header.appendChild(controlsDiv);
            } else {
                controlsDiv = document.createElement('div');
                controlsDiv.className = 'controls language-controls-fixed';
                controlsDiv.style.cssText = 'position:fixed;top:20px;right:20px;z-index:9999;display:flex;gap:10px;';
                document.body.appendChild(controlsDiv);
            }
        }
        
        if (!controlsDiv) return;
        
        // Check if already injected
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
        
        // Add event listener
        document.getElementById('languageSelect').addEventListener('change', (e) => {
            setLanguage(e.target.value);
        });
        
        // Add styles
        addStyles();
    }
    
    // Add required styles
    function addStyles() {
        if (document.getElementById('i18n-auto-styles')) return;
        
        const style = document.createElement('style');
        style.id = 'i18n-auto-styles';
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
            .language-select:focus {
                border-color: #7ff0c5;
                box-shadow: 0 0 0 3px rgba(127, 240, 197, 0.15);
            }
            .language-select option {
                background: #0f172a;
                color: #fff;
                padding: 10px;
            }
            .language-controls-fixed {
                position: fixed !important;
                top: 20px !important;
                right: 20px !important;
                z-index: 9999 !important;
            }
            /* Hide translate.js branding if any */
            .translatejs-brand,
            [class*="translate-brand"],
            [id*="translate-brand"] {
                display: none !important;
            }
            @media (max-width: 768px) {
                .language-select {
                    min-height: 36px;
                    padding: 6px 28px 6px 12px;
                    font-size: 13px;
                    background-size: 12px;
                }
            }
        `;
        document.head.appendChild(style);
    }
    
    // Setup mutation observer for dynamic content
    function setupObserver() {
        const observer = new MutationObserver((mutations) => {
            let hasNewContent = false;
            
            for (const mutation of mutations) {
                if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                    for (const node of mutation.addedNodes) {
                        if (node.nodeType === Node.ELEMENT_NODE) {
                            // Check if this is new content that needs translation
                            const textContent = node.textContent?.trim();
                            if (textContent && textContent.length > 0) {
                                hasNewContent = true;
                                break;
                            }
                        }
                    }
                }
                if (hasNewContent) break;
            }
            
            // If new content was added and we're not in English, translate it
            if (hasNewContent && currentLanguage !== 'en' && window.translate) {
                setTimeout(() => {
                    window.translate.execute();
                }, 100);
            }
        });
        
        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }
    
    // Initialize
    async function init() {
        // Get saved language
        const saved = localStorage.getItem(STORAGE_KEY);
        const urlParams = new URLSearchParams(window.location.search);
        const urlLang = urlParams.get('lang');
        
        const locale = urlLang || saved || DEFAULT_LANGUAGE;
        currentLanguage = locale;
        
        // Inject language switcher
        injectLanguageSwitcher();
        
        // Load translate.js
        try {
            await loadTranslateJs();
            
            // Set initial language
            if (window.translate) {
                window.translate.language.setDefault(locale);
                window.translate.language.set(locale);
            }
            
            // Setup observer for dynamic content
            setupObserver();
            
            // Update document lang attribute
            document.documentElement.setAttribute('lang', locale);
            
        } catch (e) {
            console.warn('Translation service unavailable, using fallback');
        }
        
        updateLanguageSwitcher();
    }
    
    // Public API
    return {
        init,
        setLanguage,
        getCurrentLanguage,
        getLanguages: () => ({ ...LANGUAGES }),
        translateElement,
        translatePage,
        t
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
