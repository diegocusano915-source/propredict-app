// ==========================================================
// ProPredict — Multi-Language System (i18n)
// ==========================================================

const I18N = (function() {
  
  // Available languages
  const LANGUAGES = {
    en: { name: 'English', flag: '🇬🇧' },
    es: { name: 'Español', flag: '🇪🇸' },
    fr: { name: 'Français', flag: '🇫🇷' },
    pt: { name: 'Português', flag: '🇵🇹' },
    de: { name: 'Deutsch', flag: '🇩🇪' }
  };
  
  let currentLocale = 'en';
  let translations = {};
  
  // Load translation file
  async function loadTranslations(locale) {
    try {
      const response = await fetch(`/locales/${locale}.json`);
      if (!response.ok) throw new Error(`Failed to load ${locale}`);
      translations = await response.json();
      currentLocale = locale;
      localStorage.setItem('propredict_language', locale);
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
    // Translate text content
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.getAttribute('data-i18n');
      const translated = t(key);
      if (translated) el.textContent = translated;
    });
    
    // Translate placeholders
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
      const key = el.getAttribute('data-i18n-placeholder');
      const translated = t(key);
      if (translated) el.placeholder = translated;
    });
    
    // Translate aria-labels
    document.querySelectorAll('[data-i18n-aria]').forEach(el => {
      const key = el.getAttribute('data-i18n-aria');
      const translated = t(key);
      if (translated) el.setAttribute('aria-label', translated);
    });
    
    // Translate title attributes
    document.querySelectorAll('[data-i18n-title]').forEach(el => {
      const key = el.getAttribute('data-i18n-title');
      const translated = t(key);
      if (translated) el.setAttribute('title', translated);
    });
  }
  
  // Change language
  async function setLanguage(locale) {
    if (!LANGUAGES[locale]) return false;
    
    const success = await loadTranslations(locale);
    if (success) {
      translatePage();
      updateLanguageSwitcher();
      
      // Dispatch event for other components
      window.dispatchEvent(new CustomEvent('languageChanged', { detail: { locale } }));
    }
    return success;
  }
  
  // Detect browser language
  function detectBrowserLanguage() {
    const browserLang = navigator.language || navigator.userLanguage;
    const shortLang = browserLang.split('-')[0];
    
    // Check if we support this language
    if (LANGUAGES[shortLang]) {
      return shortLang;
    }
    
    return 'en'; // Default to English
  }
  
  // Initialize language
  async function init() {
    // Check saved preference
    const saved = localStorage.getItem('propredict_language');
    
    // Check URL parameter
    const urlParams = new URLSearchParams(window.location.search);
    const urlLang = urlParams.get('lang');
    
    // Priority: URL > Saved > Browser > Default
    const locale = urlLang || saved || detectBrowserLanguage();
    
    await loadTranslations(locale);
    translatePage();
    injectLanguageSwitcher();
    updateLanguageSwitcher();
  }
  
  // Inject language switcher dropdown into header
  function injectLanguageSwitcher() {
    const controlsDiv = document.querySelector('.header .controls');
    if (!controlsDiv) return;
    
    // Check if already injected
    if (document.getElementById('languageSwitcher')) return;
    
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
    
    // Add event listener
    document.getElementById('languageSelect').addEventListener('change', (e) => {
      setLanguage(e.target.value);
    });
    
    // Add styles if not present
    if (!document.getElementById('i18n-styles')) {
      const style = document.createElement('style');
      style.id = 'i18n-styles';
      style.textContent = `
        .language-select {
          min-height: 40px;
          padding: 8px 32px 8px 14px;
          border-radius: 10px;
          border: 1px solid rgba(127, 240, 197, 0.25);
          background: rgba(0, 0, 0, 0.25);
          color: #fff;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          outline: none;
          appearance: none;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%237ff0c5' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E");
          background-repeat: no-repeat;
          background-position: right 10px center;
          background-size: 14px;
        }
        .language-select option {
          background: #0f172a;
          color: #fff;
        }
        @media (max-width: 768px) {
          .language-switcher-group label {
            display: none;
          }
        }
      `;
      document.head.appendChild(style);
    }
  }
  
  // Update dropdown to reflect current language
  function updateLanguageSwitcher() {
    const select = document.getElementById('languageSelect');
    if (select) {
      select.value = currentLocale;
    }
  }
  
  // Public API
  return {
    init,
    t,
    setLanguage,
    getCurrentLanguage: () => currentLocale,
    getLanguages: () => ({ ...LANGUAGES }),
    translatePage
  };
  
})();

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => I18N.init());
} else {
  I18N.init();
}

// Expose to window for global access
window.I18N = I18N;
window.t = (key, fallback) => I18N.t(key, fallback);
