/* ============================================================
   AFAIA MAPS — Landing Page JS
   ============================================================ */

(function () {
  'use strict';

  /* -------- NAV SCROLL -------- */
  const nav = document.getElementById('mainNav');
  window.addEventListener('scroll', () => {
    if (window.scrollY > 40) {
      nav.classList.add('scrolled');
    } else {
      nav.classList.remove('scrolled');
    }
  });
  // Init scroll state
  if (window.scrollY > 40) nav.classList.add('scrolled');

  /* -------- MOBILE MENU -------- */
  const mobileToggle = document.getElementById('mobileToggle');
  const navLinks = document.getElementById('navLinks');
  if (mobileToggle && navLinks) {
    mobileToggle.addEventListener('click', () => {
      navLinks.classList.toggle('mobile-open');
    });
  }

  /* -------- HERO PARTICLES -------- */
  const particlesContainer = document.getElementById('heroParticles');
  if (particlesContainer) {
    for (let i = 0; i < 30; i++) {
      const p = document.createElement('div');
      p.className = 'particle';
      p.style.cssText = `
        left: ${Math.random() * 100}%;
        top: ${Math.random() * 100}%;
        --duration: ${6 + Math.random() * 10}s;
        --delay: ${Math.random() * 8}s;
        --drift: ${(Math.random() - 0.5) * 60}px;
        width: ${1 + Math.random() * 3}px;
        height: ${1 + Math.random() * 3}px;
        opacity: 0;
      `;
      particlesContainer.appendChild(p);
    }
  }

  /* -------- INTERSECTION OBSERVER (Feature cards) -------- */
  const featureCards = document.querySelectorAll('.feature-card');
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const delay = parseInt(entry.target.dataset.delay || 0);
        setTimeout(() => {
          entry.target.classList.add('visible');
        }, delay);
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1, rootMargin: '0px 0px -60px 0px' });

  featureCards.forEach(card => observer.observe(card));

  /* -------- USE CASE CARDS ANIMATION -------- */
  const useCaseCards = document.querySelectorAll('.use-case-card');
  const ucObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry, idx) => {
      if (entry.isIntersecting) {
        setTimeout(() => {
          entry.target.style.opacity = '1';
          entry.target.style.transform = 'translateY(0)';
        }, idx * 80);
        ucObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1 });

  useCaseCards.forEach(card => {
    card.style.opacity = '0';
    card.style.transform = 'translateY(24px)';
    card.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
    ucObserver.observe(card);
  });

  /* -------- SMOOTH SCROLL NAV LINKS -------- */
  document.querySelectorAll('a[href^="#"]').forEach(link => {
    link.addEventListener('click', (e) => {
      const targetId = link.getAttribute('href');
      if (targetId === '#') return;
      const target = document.querySelector(targetId);
      if (target) {
        e.preventDefault();
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        if (navLinks) navLinks.classList.remove('mobile-open');
      }
    });
  });

  /* -------- COUNTER ANIMATION -------- */
  function animateCounter(el, target, duration = 1500) {
    const start = 0;
    const startTime = performance.now();
    const isFloat = target % 1 !== 0;

    function update(currentTime) {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const value = start + (target - start) * eased;
      el.textContent = isFloat ? value.toFixed(1) : Math.floor(value).toLocaleString('pt-BR');
      if (progress < 1) requestAnimationFrame(update);
    }

    requestAnimationFrame(update);
  }

  /* -------- TOAST NOTIFICATIONS -------- */
  window.showToast = function (type, title, message, duration = 4000) {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const icons = {
      success: 'fa-check-circle',
      error: 'fa-exclamation-circle',
      warning: 'fa-exclamation-triangle',
      info: 'fa-info-circle'
    };

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
      <i class="fas ${icons[type] || icons.info} toast-icon"></i>
      <div class="toast-content">
        <div class="toast-title">${title}</div>
        ${message ? `<div class="toast-message">${message}</div>` : ''}
      </div>
      <button onclick="this.parentElement.remove()" style="background:none;border:none;cursor:pointer;color:var(--color-gray-mid);padding:0;margin-left:8px;">
        <i class="fas fa-times"></i>
      </button>
    `;

    container.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('show'));

    if (duration > 0) {
      setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 350);
      }, duration);
    }

    return toast;
  };

  /* -------- DEMO BUTTONS -------- */
  document.querySelectorAll('a[href="app.html"]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      // Allow navigation — just show toast
      showToast('info', 'Abrindo mapa…', 'Carregando o visualizador de mapas Afaia');
    });
  });

  /* -------- TICKER / ANIMATED MAP COORDS -------- */
  const coordVal = document.querySelector('.coord-val');
  if (coordVal) {
    const lat = -23.550 + (Math.random() - 0.5) * 0.002;
    setInterval(() => {
      const jitter = (Math.random() - 0.5) * 0.0001;
      coordVal.textContent = (lat + jitter).toFixed(4) + '°';
    }, 2500);
  }

  /* -------- INIT -------- */
  console.log('%cAfaia Maps v1.0.0-beta', 'color:#2FA37C;font-weight:bold;font-size:14px;');
  console.log('%cMapeie. Navegue. Registre. Mesmo Offline.', 'color:#163F59;font-size:11px;');

})();
