/**
 * ProPredict i18n - Multi-language System
 * Supports: EN, ES, FR, PT, DE
 * FIXED: Translation key display, match data translation, dynamic content refresh
 */

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
  let observer = null;
  
  // Sport name translations for match data
  const SPORT_TRANSLATIONS = {
    'Football': { es: 'Fútbol', fr: 'Football', pt: 'Futebol', de: 'Fußball' },
    'Basketball': { es: 'Baloncesto', fr: 'Basket-ball', pt: 'Basquete', de: 'Basketball' },
    'Tennis': { es: 'Tenis', fr: 'Tennis', pt: 'Tênis', de: 'Tennis' },
    'NFL': { es: 'NFL', fr: 'NFL', pt: 'NFL', de: 'NFL' },
    'NHL': { es: 'NHL', fr: 'LNH', pt: 'NHL', de: 'NHL' },
    'MLB': { es: 'MLB', fr: 'MLB', pt: 'MLB', de: 'MLB' },
    'Rugby League': { es: 'Rugby League', fr: 'Rugby à XIII', pt: 'Rugby League', de: 'Rugby League' },
    'Rugby Union': { es: 'Rugby Union', fr: 'Rugby à XV', pt: 'Rugby Union', de: 'Rugby Union' },
    'Darts': { es: 'Dardos', fr: 'Fléchettes', pt: 'Dardos', de: 'Darts' },
    'Table Tennis': { es: 'Tenis de Mesa', fr: 'Tennis de Table', pt: 'Tênis de Mesa', de: 'Tischtennis' }
  };
  
  // Market/outcome translations
  const OUTCOME_TRANSLATIONS = {
    'Win': { es: 'Victoria', fr: 'Victoire', pt: 'Vitória', de: 'Sieg' },
    'Draw': { es: 'Empate', fr: 'Match nul', pt: 'Empate', de: 'Unentschieden' },
    'Over': { es: 'Más de', fr: 'Plus de', pt: 'Mais de', de: 'Über' },
    'Under': { es: 'Menos de', fr: 'Moins de', pt: 'Menos de', de: 'Unter' },
    'Both Teams to Score': { es: 'Ambos Equipos Marcan', fr: 'Les Deux Équipes Marquent', pt: 'Ambos Marcam', de: 'Beide Teams Treffen' },
    'Yes': { es: 'Sí', fr: 'Oui', pt: 'Sim', de: 'Ja' },
    'No': { es: 'No', fr: 'Non', pt: 'Não', de: 'Nein' }
  };
  
  // Confidence level translations
  const CONFIDENCE_TRANSLATIONS = {
    'High': { es: 'Alta', fr: 'Élevée', pt: 'Alta', de: 'Hoch' },
    'Medium': { es: 'Media', fr: 'Moyenne', pt: 'Média', de: 'Mittel' },
    'Low': { es: 'Baja', fr: 'Faible', pt: 'Baixa', de: 'Niedrig' }
  };
  
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
  
  // Get translated string with fallback chain
  function t(key, fallback = '') {
    if (!key) return fallback;
    
    const parts = key.split('.');
    let value = translations;
    
    for (const part of parts) {
      if (value && typeof value === 'object' && part in value) {
        value = value[part];
      } else {
        // Try to find a fallback translation for common keys
        const fallbackValue = getFallbackTranslation(key);
        return fallbackValue || fallback || key;
      }
    }
    
    return typeof value === 'string' ? value : fallback || key;
  }
  
  // Fallback translations for common keys that might be missing
  function getFallbackTranslation(key) {
    const fallbacks = {
      'dashboard.referral_title': {
        es: 'Programa de Referidos',
        fr: 'Programme de Parrainage',
        pt: 'Programa de Indicação',
        de: 'Empfehlungsprogramm'
      },
      'DASHBOARD_FRIENDS_INVITED': {
        es: 'AMIGOS INVITADOS',
        fr: 'AMIS INVITÉS',
        pt: 'AMIGOS CONVIDADOS',
        de: 'EINGELADENE FREUNDE'
      },
      'DASHBOARD_DAYS_PER_FRIEND': {
        es: 'DÍAS POR AMIGO',
        fr: 'JOURS PAR AMI',
        pt: 'DIAS POR AMIGO',
        de: 'TAGE PRO FREUND'
      },
      'DASHBOARD_DAYS_EARNED': {
        es: 'DÍAS GANADOS',
        fr: 'JOURS GAGNÉS',
        pt: 'DIAS GANHOS',
        de: 'VERDIENTE TAGE'
      },
      'dashboard.market_options_desc': {
        es: 'Seleccione mercados para añadir a su constructor de acumuladores',
        fr: 'Sélectionnez des marchés à ajouter à votre constructeur d\'accumulateurs',
        pt: 'Selecione mercados para adicionar ao seu construtor de acumuladores',
        de: 'Wählen Sie Märkte aus, um sie zu Ihrem Akkumulator-Builder hinzuzufügen'
      },
      'dashboard.accumulator_desc': {
        es: 'Construya acumuladores inteligentes con cálculos de probabilidad en tiempo real',
        fr: 'Construisez des accumulateurs intelligents avec des calculs de probabilité en temps réel',
        pt: 'Construa acumuladores inteligentes com cálculos de probabilidade em tempo real',
        de: 'Erstellen Sie intelligente Akkumulatoren mit Echtzeit-Wahrscheinlichkeitsberechnungen'
      },
      'dashboard.performance_summary_desc': {
        es: 'Realice un seguimiento de su rendimiento de predicciones a lo largo del tiempo',
        fr: 'Suivez vos performances de prédiction au fil du temps',
        pt: 'Acompanhe seu desempenho de previsões ao longo do tempo',
        de: 'Verfolgen Sie Ihre Vorhersageleistung im Laufe der Zeit'
      },
      'dashboard.settled': {
        es: 'Liquidados',
        fr: 'Réglés',
        pt: 'Liquidados',
        de: 'Abgerechnet'
      },
      'dashboard.copy_link': {
        es: 'Copiar Enlace',
        fr: 'Copier le Lien',
        pt: 'Copiar Link',
        de: 'Link Kopieren'
      },
      'dashboard.referral_info': {
        es: 'Invita a amigos y obtén 7 días de Pro gratis por cada uno que se registre',
        fr: 'Invitez des amis et obtenez 7 jours de Pro gratuits pour chaque inscription',
        pt: 'Convide amigos e ganhe 7 dias de Pro grátis por cada inscrição',
        de: 'Laden Sie Freunde ein und erhalten Sie 7 kostenlose Pro-Tage pro Anmeldung'
      },
      'Top Picks': {
        es: 'Mejores Selecciones',
        fr: 'Meilleurs Choix',
        pt: 'Melhores Escolhas',
        de: 'Top-Auswahl'
      },
      'TOP PICK OF THE DAY': {
        es: 'MEJOR SELECCIÓN DEL DÍA',
        fr: 'MEILLEUR CHOIX DU JOUR',
        pt: 'MELHOR ESCOLHA DO DIA',
        de: 'TOP-AUSWAHL DES TAGES'
      },
      'Add to Accumulator': {
        es: 'Añadir al Acumulador',
        fr: 'Ajouter à l\'Accumulateur',
        pt: 'Adicionar ao Acumulador',
        de: 'Zum Akkumulator Hinzufügen'
      }
    };
    
    if (fallbacks[key] && fallbacks[key][currentLocale]) {
      return fallbacks[key][currentLocale];
    }
    
    return null;
  }
  
  // Translate all elements with data-i18n attribute
  function translatePage() {
    // Translate text content
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.getAttribute('data-i18n');
      const translated = t(key);
      if (translated && translated !== key) {
        el.textContent = translated;
      }
    });
    
    // Translate placeholders
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
      const key = el.getAttribute('data-i18n-placeholder');
      const translated = t(key);
      if (translated && translated !== key) {
        el.placeholder = translated;
      }
    });
    
    // Translate aria-labels
    document.querySelectorAll('[data-i18n-aria]').forEach(el => {
      const key = el.getAttribute('data-i18n-aria');
      const translated = t(key);
      if (translated && translated !== key) {
        el.setAttribute('aria-label', translated);
      }
    });
    
    // Translate title attributes
    document.querySelectorAll('[data-i18n-title]').forEach(el => {
      const key = el.getAttribute('data-i18n-title');
      const translated = t(key);
      if (translated && translated !== key) {
        el.setAttribute('title', translated);
      }
    });
    
    // Translate match data (sports, outcomes, confidence levels)
    translateMatchData();
    
    // Translate pro lock overlays
    translateProLockOverlays();
    
    // Translate any dynamic modals
    translateModals();
  }
  
  // Translate match-specific data
  function translateMatchData() {
    if (currentLocale === 'en') return;
    
    // Translate sport names in selects or displays
    document.querySelectorAll('[data-sport], .sport-name, .match-sport').forEach(el => {
      const sportName = el.getAttribute('data-sport') || el.textContent.trim();
      if (SPORT_TRANSLATIONS[sportName] && SPORT_TRANSLATIONS[sportName][currentLocale]) {
        el.textContent = SPORT_TRANSLATIONS[sportName][currentLocale];
      }
    });
    
    // Translate outcome text (Win, Draw, etc.)
    document.querySelectorAll('.outcome-text, .market-name, .pick-outcome').forEach(el => {
      let text = el.textContent.trim();
      
      // Handle "Win: TeamName" format
      if (text.includes(':')) {
        const parts = text.split(':');
        const outcomeType = parts[0].trim();
        const teamName = parts.slice(1).join(':').trim();
        
        if (OUTCOME_TRANSLATIONS[outcomeType] && OUTCOME_TRANSLATIONS[outcomeType][currentLocale]) {
          el.textContent = `${OUTCOME_TRANSLATIONS[outcomeType][currentLocale]}: ${teamName}`;
        }
      } else {
        // Direct outcome translation
        if (OUTCOME_TRANSLATIONS[text] && OUTCOME_TRANSLATIONS[text][currentLocale]) {
          el.textContent = OUTCOME_TRANSLATIONS[text][currentLocale];
        }
      }
    });
    
    // Translate confidence badges
    document.querySelectorAll('.confidence-badge, .confidence-level').forEach(el => {
      const confidence = el.textContent.trim();
      if (CONFIDENCE_TRANSLATIONS[confidence] && CONFIDENCE_TRANSLATIONS[confidence][currentLocale]) {
        el.textContent = CONFIDENCE_TRANSLATIONS[confidence][currentLocale];
      }
    });
    
    // Translate section headers
    document.querySelectorAll('.section-header, .section-title').forEach(el => {
      const text = el.textContent.trim();
      if (text === 'Top Picks' || text === 'Smart Picks') {
        const translated = t('Top Picks');
        if (translated && translated !== 'Top Picks') {
          el.textContent = translated;
        }
      }
    });
  }
  
  // Translate pro lock overlay text
  function translateProLockOverlays() {
    document.querySelectorAll('.pro-lock-overlay, .pro-overlay').forEach(overlay => {
      const messageEl = overlay.querySelector('.pro-message, .lock-message');
      if (messageEl) {
        const key = messageEl.getAttribute('data-i18n');
        if (key) {
          const translated = t(key);
          if (translated && translated !== key) {
            messageEl.textContent = translated;
          }
        } else {
          // Default pro lock message
          const translations = {
            es: '🔒 Actualiza a Pro para desbloquear',
            fr: '🔒 Passez à Pro pour débloquer',
            pt: '🔒 Atualize para Pro para desbloquear',
            de: '🔒 Upgrade auf Pro zum Freischalten'
          };
          if (translations[currentLocale]) {
            messageEl.textContent = translations[currentLocale];
          }
        }
      }
      
      const upgradeBtn = overlay.querySelector('.upgrade-btn, .pro-upgrade-btn');
      if (upgradeBtn) {
        const translations = {
          es: 'Mejorar a Pro',
          fr: 'Passer à Pro',
          pt: 'Atualizar para Pro',
          de: 'Upgrade auf Pro'
        };
        if (translations[currentLocale]) {
          upgradeBtn.textContent = translations[currentLocale];
        }
      }
    });
  }
  
  // Translate modal content
  function translateModals() {
    document.querySelectorAll('.modal').forEach(modal => {
      modal.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        const translated = t(key);
        if (translated && translated !== key) {
          el.textContent = translated;
        }
      });
    });
  }
  
  // Setup MutationObserver to translate dynamically added content
  function setupObserver() {
    if (observer) observer.disconnect();
    
    observer = new MutationObserver((mutations) => {
      let needsTranslation = false;
      
      for (const mutation of mutations) {
        if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
          for (const node of mutation.addedNodes) {
            if (node.nodeType === Node.ELEMENT_NODE) {
              // Check if the added node or its children have data-i18n
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
  
  // Change language
  async function setLanguage(locale) {
    if (!LANGUAGES[locale]) return false;
    
    const success = await loadTranslations(locale);
    if (success) {
      translatePage();
      updateLanguageSwitcher();
      
      // Dispatch event for other components
      window.dispatchEvent(new CustomEvent('languageChanged', { detail: { locale } }));
      
      // Re-render picks if picks module exists
      if (typeof window.renderTopPicks === 'function') {
        setTimeout(() => window.renderTopPicks(), 50);
      }
      
      // Re-render accumulator if module exists
      if (typeof window.updateAccumulatorDisplay === 'function') {
        setTimeout(() => window.updateAccumulatorDisplay(), 50);
      }
    }
    return success;
  }
  
  // Detect browser language
  function detectBrowserLanguage() {
    const browserLang = navigator.language || navigator.userLanguage;
    const shortLang = browserLang.split('-')[0];
    
    if (LANGUAGES[shortLang]) {
      return shortLang;
    }
    
    return 'en';
  }
  
  // Initialize language
  async function init() {
    const saved = localStorage.getItem('propredict_language');
    const urlParams = new URLSearchParams(window.location.search);
    const urlLang = urlParams.get('lang');
    
    const locale = urlLang || saved || detectBrowserLanguage();
    
    await loadTranslations(locale);
    translatePage();
    injectLanguageSwitcher();
    updateLanguageSwitcher();
    setupObserver();
    
    isInitialized = true;
  }
  
  let isInitialized = false;
  
  // Inject language switcher dropdown into header
  function injectLanguageSwitcher() {
    // Try multiple possible selectors for the controls area
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
    
    // If no controls div found, create one in the header
    if (!controlsDiv) {
      const header = document.querySelector('header, .header, .dashboard-header, .navbar');
      if (header) {
        controlsDiv = document.createElement('div');
        controlsDiv.className = 'controls user-controls';
        header.appendChild(controlsDiv);
      } else {
        // Fallback: append to body and position fixed
        controlsDiv = document.createElement('div');
        controlsDiv.className = 'controls language-controls-fixed';
        controlsDiv.style.cssText = 'position:fixed;top:20px;right:20px;z-index:9999;';
        document.body.appendChild(controlsDiv);
      }
    }
    
    if (!controlsDiv) return;
    
    // Check if already injected
    if (document.getElementById('languageSwitcher')) return;
    
    const switcherDiv = document.createElement('div');
    switcherDiv.className = 'control-group language-switcher-group';
    switcherDiv.innerHTML = `
      <label for="languageSelect" style="display:none;">🌐</label>
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
        @media (max-width: 768px) {
          .language-switcher-group label {
            display: none;
          }
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
    translatePage,
    translateMatchData
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
