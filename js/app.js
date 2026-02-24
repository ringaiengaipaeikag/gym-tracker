// Главный файл приложения — роутер и инициализация

import { initDB } from './db.js';
import { renderHome } from './pages/home.js';
import { renderPrograms } from './pages/programs.js';
import { renderExercises } from './pages/exercises.js';
import { renderWorkout } from './pages/workout.js';
import { renderHistory } from './pages/history.js';

const pages = {
  home: renderHome,
  programs: renderPrograms,
  exercises: renderExercises,
  workout: renderWorkout,
  history: renderHistory,
};

let currentPage = 'home';

// Навигация
export function navigate(page, params = {}) {
  currentPage = page;
  
  // Обновляем табы
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.page === page);
  });

  // Скрываем/показываем таббар
  const tabBar = document.getElementById('tab-bar');
  tabBar.style.display = (page === 'workout') ? 'none' : 'flex';

  // Рендерим страницу
  const content = document.getElementById('content');
  const header = document.getElementById('header');
  content.innerHTML = '';
  header.innerHTML = '';

  // Удаляем FAB если есть
  document.querySelectorAll('.fab').forEach(f => f.remove());
  
  // Удаляем таймер отдыха при уходе со страницы тренировки
  if (page !== 'workout') {
    document.querySelectorAll('.rest-timer').forEach(t => t.remove());
  }

  if (pages[page]) {
    pages[page](content, header, params);
  }

  // Скролл наверх
  content.scrollTop = 0;
}

// Модальное окно
export function showModal(renderFn) {
  const overlay = document.getElementById('modal-overlay');
  const modal = document.getElementById('modal');
  overlay.classList.remove('hidden');
  modal.innerHTML = '';
  renderFn(modal);
  
  // Закрытие по клику на оверлей
  overlay.onclick = (e) => {
    if (e.target === overlay) closeModal();
  };
}

export function closeModal() {
  document.getElementById('modal-overlay').classList.add('hidden');
}

// Toast уведомления
export function showToast(message, duration = 2000) {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.style.cssText = `
    background: #2c2c2e;
    color: #fff;
    padding: 12px 20px;
    border-radius: 12px;
    font-size: 15px;
    text-align: center;
    position: fixed;
    top: calc(env(safe-area-inset-top, 0px) + 60px);
    left: 50%;
    transform: translateX(-50%);
    z-index: 300;
    box-shadow: 0 4px 16px rgba(0,0,0,0.4);
    animation: fadeIn 0.2s ease;
    max-width: 80vw;
  `;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 0.3s';
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

// Форматирование даты
export function formatDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  const months = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
  const days = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
  return `${days[d.getDay()]}, ${d.getDate()} ${months[d.getMonth()]}`;
}

export function todayStr() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

// Инициализация
async function init() {
  await initDB();

  // Табы
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => navigate(btn.dataset.page));
  });

  // Регистрация Service Worker
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }

  // Стартовая страница
  navigate('home');
}

init();
