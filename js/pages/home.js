// Главная страница — календарь + тренировка дня

import { workoutsDB, programsDB } from '../db.js';
import { navigate, todayStr, formatDate, showModal, closeModal } from '../app.js';

let selectedDate = todayStr();
let currentWeekOffset = 0; // 0 = текущая неделя, -1 = прошлая, +1 = следующая

const MONTHS_FULL = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
const DAYS_SHORT = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

// Получить понедельник недели для заданного смещения
function getWeekMonday(offset) {
  const d = new Date();
  const day = d.getDay(); // 0=Вс, 1=Пн, ...
  const diff = day === 0 ? -6 : 1 - day; // сдвиг до понедельника
  d.setDate(d.getDate() + diff + offset * 7);
  d.setHours(0, 0, 0, 0);
  return d;
}

// Получить 7 дней недели начиная с понедельника
function getWeekDays(offset) {
  const monday = getWeekMonday(offset);
  const days = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    days.push(d);
  }
  return days;
}

function dateToStr(d) {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

export async function renderHome(content, header) {
  selectedDate = todayStr();
  currentWeekOffset = 0;

  renderHeader(header);
  await renderCalendar(content);
  await renderDayContent(content);
  renderFAB();
}

function renderHeader(header) {
  const days = getWeekDays(currentWeekOffset);
  const month = days[3].getMonth(); // середина недели для определения месяца
  const year = days[3].getFullYear();

  header.innerHTML = `
    <div class="home-header">
      <div class="home-header-title">${MONTHS_FULL[month]} ${year}</div>
      <div class="home-header-today" id="btn-today">Сегодня →</div>
    </div>
    <div class="calendar-weekdays">
      ${DAYS_SHORT.map(d => `<div class="calendar-weekday">${d}</div>`).join('')}
    </div>
  `;

  const btnToday = header.querySelector('#btn-today');
  btnToday.onclick = () => {
    currentWeekOffset = 0;
    selectedDate = todayStr();
    renderHeader(header);
    const calStrip = document.getElementById('cal-week');
    if (calStrip) updateCalendarWeek(calStrip);
    const dayContent = document.getElementById('day-content');
    if (dayContent) {
      dayContent.innerHTML = '';
      renderDayContentInner(dayContent);
    }
  };
}

async function renderCalendar(container) {
  const strip = document.createElement('div');
  strip.className = 'calendar-week';
  strip.id = 'cal-week';
  container.appendChild(strip);

  await updateCalendarWeek(strip);

  // Свайп для смены недели
  let touchStartX = 0;
  let touchStartY = 0;
  let swiping = false;

  strip.addEventListener('touchstart', (e) => {
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
    swiping = true;
  }, { passive: true });

  strip.addEventListener('touchend', (e) => {
    if (!swiping) return;
    swiping = false;
    const dx = e.changedTouches[0].clientX - touchStartX;
    const dy = e.changedTouches[0].clientY - touchStartY;
    // Горизонтальный свайп > 50px и преобладает над вертикальным
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) {
      if (dx < 0) {
        currentWeekOffset++;
      } else {
        currentWeekOffset--;
      }
      const header = document.getElementById('header');
      renderHeader(header);
      updateCalendarWeek(strip);
      // При смене недели — если выбранная дата не в этой неделе, выбираем понедельник
      const weekDays = getWeekDays(currentWeekOffset);
      const weekDates = weekDays.map(dateToStr);
      if (!weekDates.includes(selectedDate)) {
        selectedDate = weekDates[0];
      }
      const dayContent = document.getElementById('day-content');
      if (dayContent) {
        dayContent.innerHTML = '';
        renderDayContentInner(dayContent);
      }
    }
  }, { passive: true });
}

async function updateCalendarWeek(strip) {
  const dates = await workoutsDB.getDates();
  const dateSet = new Set(dates);
  const today = todayStr();
  const weekDays = getWeekDays(currentWeekOffset);

  strip.innerHTML = weekDays.map(d => {
    const ds = dateToStr(d);
    let cls = 'cal-day-cell';
    if (ds === today) cls += ' today';
    if (ds === selectedDate) cls += ' selected';
    if (dateSet.has(ds)) cls += ' has-workout';
    return `<div class="${cls}" data-date="${ds}"><div class="cal-date">${d.getDate()}</div></div>`;
  }).join('');

  strip.querySelectorAll('.cal-day-cell').forEach(cell => {
    cell.onclick = () => {
      selectedDate = cell.dataset.date;
      strip.querySelectorAll('.cal-day-cell').forEach(c => c.classList.remove('selected'));
      cell.classList.add('selected');
      const dayContent = document.getElementById('day-content');
      if (dayContent) {
        dayContent.innerHTML = '';
        renderDayContentInner(dayContent);
      }
    };
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
        <div class="subtitle">Добавь упражнения или программу, чтобы записать тренировку</div>
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
