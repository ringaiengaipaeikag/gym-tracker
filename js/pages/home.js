// Главная страница — календарь + тренировка дня

import { workoutsDB, programsDB } from '../db.js';
import { navigate, todayStr, formatDate, showModal, closeModal } from '../app.js';

let selectedDate = todayStr();

export async function renderHome(content, header) {
  selectedDate = todayStr();
  
  header.innerHTML = `
    <div class="header-title">Gym Tracker</div>
    <div class="header-subtitle">${formatDate(selectedDate)}</div>
  `;

  await renderCalendar(content);
  await renderDayContent(content);
  renderFAB();
}

async function renderCalendar(container) {
  const dates = await workoutsDB.getDates();
  const dateSet = new Set(dates);
  
  const strip = document.createElement('div');
  strip.className = 'calendar-strip';

  const today = new Date();
  // Показываем 2 недели: неделю назад и неделю вперёд
  for (let i = -7; i <= 7; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    const dateStr = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    
    const days = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
    
    const el = document.createElement('div');
    el.className = 'cal-day';
    if (dateStr === todayStr()) el.classList.add('today');
    if (dateStr === selectedDate) el.classList.add('selected');
    if (dateSet.has(dateStr)) el.classList.add('has-workout');
    
    el.innerHTML = `
      <div class="weekday">${days[d.getDay()]}</div>
      <div class="date">${d.getDate()}</div>
    `;
    
    el.onclick = () => {
      selectedDate = dateStr;
      // Обновить header
      document.querySelector('.header-subtitle').textContent = formatDate(dateStr);
      // Обновить выделение
      strip.querySelectorAll('.cal-day').forEach(c => c.classList.remove('selected'));
      el.classList.add('selected');
      // Перерисовать контент дня
      const dayContent = document.getElementById('day-content');
      if (dayContent) {
        dayContent.innerHTML = '';
        renderDayContentInner(dayContent);
      }
    };
    
    strip.appendChild(el);
  }

  container.appendChild(strip);

  // Скроллим к сегодня
  requestAnimationFrame(() => {
    const todayEl = strip.querySelector('.cal-day.today');
    if (todayEl) {
      todayEl.scrollIntoView({ inline: 'center', behavior: 'instant' });
    }
  });
}

async function renderDayContent(container) {
  const dayContent = document.createElement('div');
  dayContent.id = 'day-content';
  container.appendChild(dayContent);
  await renderDayContentInner(dayContent);
}

async function renderDayContentInner(container) {
  const workouts = await workoutsDB.getByDate(selectedDate);

  if (workouts.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="bear">🐻</div>
        <div class="title">Нет тренировок</div>
        <div class="subtitle">Нажми + чтобы начать тренировку</div>
      </div>
    `;
    return;
  }

  for (const workout of workouts) {
    const card = document.createElement('div');
    card.className = 'card';
    card.style.cursor = 'pointer';
    
    let totalSets = 0;
    let totalVolume = 0;
    for (const ex of workout.exercises) {
      totalSets += ex.sets.length;
      for (const s of ex.sets) {
        totalVolume += (s.weight || 0) * (s.reps || 0);
      }
    }

    card.innerHTML = `
      <div class="card-header">
        <div>
          <div class="card-title">${workout.programName || 'Тренировка'}</div>
          <div style="font-size:13px;color:var(--text-secondary);margin-top:4px">
            ${workout.exercises.length} упр. · ${totalSets} подходов · ${Math.round(totalVolume)} кг объём
          </div>
        </div>
        <span style="color:var(--text-muted);font-size:20px">›</span>
      </div>
      ${workout.exercises.slice(0, 3).map(ex => `
        <div style="font-size:14px;color:var(--text-secondary);padding:3px 0">
          ${ex.name}: ${ex.sets.map(s => s.weight + '×' + s.reps).join(', ')}
        </div>
      `).join('')}
      ${workout.exercises.length > 3 ? `<div style="font-size:13px;color:var(--text-muted);padding-top:4px">ещё ${workout.exercises.length - 3} упр.</div>` : ''}
    `;

    card.onclick = () => navigate('workout', { workoutId: workout.id });
    container.appendChild(card);
  }
}

function renderFAB() {
  // Удаляем старый если есть
  document.querySelectorAll('.fab').forEach(f => f.remove());
  
  const fab = document.createElement('button');
  fab.className = 'fab';
  fab.textContent = '+';
  fab.onclick = () => showStartWorkout();
  document.getElementById('app').appendChild(fab);
}

async function showStartWorkout() {
  const programs = await programsDB.getAll();
  
  showModal((modal) => {
    modal.innerHTML = `
      <div class="modal-handle"></div>
      <div class="modal-title">Начать тренировку</div>
      ${programs.length === 0 ? `
        <div class="empty-state" style="padding:20px">
          <div class="subtitle">Сначала создай программу тренировки</div>
          <button class="btn btn-primary mt-16" id="go-programs">Создать программу</button>
        </div>
      ` : `
        <div id="program-list">
          ${programs.map(p => `
            <div class="program-card" style="background:${p.color}" data-id="${p.id}">
              <div class="name">${p.name}</div>
              <div class="count">${p.exercises.length} упражнений</div>
            </div>
          `).join('')}
        </div>
        <button class="btn btn-secondary mt-8" id="empty-workout">Пустая тренировка</button>
      `}
    `;

    modal.querySelectorAll('.program-card').forEach(card => {
      card.onclick = () => {
        closeModal();
        navigate('workout', { programId: parseInt(card.dataset.id), date: selectedDate });
      };
    });

    const goPrograms = modal.querySelector('#go-programs');
    if (goPrograms) {
      goPrograms.onclick = () => { closeModal(); navigate('programs'); };
    }

    const emptyBtn = modal.querySelector('#empty-workout');
    if (emptyBtn) {
      emptyBtn.onclick = () => {
        closeModal();
        navigate('workout', { date: selectedDate });
      };
    }
  });
}
