// Страница «Тренировка» — лог подходов в реальном времени

import { workoutsDB, programsDB, exercisesDB, MUSCLE_GROUPS } from '../db.js';
import { navigate, showModal, closeModal, showToast, todayStr } from '../app.js';

let restTimerInterval = null;

export async function renderWorkout(content, header, params = {}) {
  const { programId, workoutId, date } = params;
  let workout;

  if (workoutId) {
    // Открытие существующей тренировки
    workout = await workoutsDB.getById(workoutId);
  } else if (programId) {
    // Новая тренировка из программы
    const program = await programsDB.getById(programId);
    if (!program) { navigate('home'); return; }
    workout = {
      date: date || todayStr(),
      programName: program.name,
      programId: program.id,
      startTime: Date.now(),
      exercises: program.exercises.map(ex => ({
        id: ex.id,
        name: ex.name,
        group: ex.group,
        sets: [{ weight: '', reps: '' }],
      })),
    };
    workout.id = await workoutsDB.add(workout);
  } else {
    // Пустая тренировка
    workout = {
      date: date || todayStr(),
      programName: 'Тренировка',
      startTime: Date.now(),
      exercises: [],
    };
    workout.id = await workoutsDB.add(workout);
  }

  if (!workout) { navigate('home'); return; }

  // Открытость секций
  const openSections = new Set();
  if (workout.exercises.length > 0) openSections.add(0);

  // Header
  header.innerHTML = `
    <div class="flex-between">
      <button class="btn-icon" id="workout-back" style="font-size:24px">‹</button>
      <div style="text-align:center;flex:1">
        <div class="header-title" style="font-size:18px">${workout.programName || 'Тренировка'}</div>
      </div>
      <button class="btn-icon" id="workout-done" style="background:var(--accent);color:#000;font-size:14px;font-weight:700">✓</button>
    </div>
  `;

  header.querySelector('#workout-back').onclick = () => {
    stopRestTimer();
    navigate('home');
  };

  header.querySelector('#workout-done').onclick = async () => {
    workout.endTime = Date.now();
    await saveWorkout(workout);
    stopRestTimer();
    showToast('Тренировка сохранена');
    navigate('home');
  };

  // Рендер упражнений
  renderExercises(content, workout, openSections);

  // Кнопка добавления упражнения
  const addBtn = document.createElement('button');
  addBtn.className = 'btn btn-secondary mt-16 mb-16';
  addBtn.textContent = '+ Добавить упражнение';
  addBtn.onclick = () => showAddExerciseToWorkout(workout, content, openSections);
  content.appendChild(addBtn);
}

function renderExercises(container, workout, openSections) {
  // Очищаем только упражнения
  container.querySelectorAll('.workout-exercise').forEach(el => el.remove());

  const addBtn = container.querySelector('.btn-secondary');

  for (let i = 0; i < workout.exercises.length; i++) {
    const ex = workout.exercises[i];
    const mg = MUSCLE_GROUPS[ex.group] || {};
    const isOpen = openSections.has(i);

    const el = document.createElement('div');
    el.className = 'workout-exercise';

    el.innerHTML = `
      <div class="workout-exercise-header">
        <span style="font-size:18px;margin-right:10px">${mg.icon || '🏋️'}</span>
        <span class="name">${ex.name}</span>
        <span class="toggle ${isOpen ? 'open' : ''}">▾</span>
      </div>
      <div class="exercise-body" style="${isOpen ? '' : 'display:none'}">
        <div class="sets-header">
          <span style="text-align:center">Сет</span>
          <span style="text-align:center">Вес (кг)</span>
          <span style="text-align:center">Повтор.</span>
          <span></span>
        </div>
        <div class="sets-container"></div>
        <button class="add-set-btn">+ Добавить подход</button>
      </div>
    `;

    // Сворачивание
    const headerEl = el.querySelector('.workout-exercise-header');
    const bodyEl = el.querySelector('.exercise-body');
    const toggleEl = el.querySelector('.toggle');
    headerEl.onclick = () => {
      const open = bodyEl.style.display !== 'none';
      bodyEl.style.display = open ? 'none' : 'block';
      toggleEl.classList.toggle('open', !open);
      if (open) openSections.delete(i); else openSections.add(i);
    };

    // Подходы
    const setsContainer = el.querySelector('.sets-container');
    renderSets(setsContainer, ex, workout, i);

    // Добавить подход
    el.querySelector('.add-set-btn').onclick = () => {
      // Копируем вес из последнего подхода
      const lastSet = ex.sets[ex.sets.length - 1];
      ex.sets.push({ weight: lastSet?.weight || '', reps: '' });
      renderSets(setsContainer, ex, workout, i);
      autoSave(workout);
    };

    if (addBtn) {
      container.insertBefore(el, addBtn);
    } else {
      container.appendChild(el);
    }
  }
}

function renderSets(container, exercise, workout, exIndex) {
  container.innerHTML = '';

  for (let s = 0; s < exercise.sets.length; s++) {
    const set = exercise.sets[s];
    const row = document.createElement('div');
    row.className = 'set-row';

    row.innerHTML = `
      <span class="set-num">${s + 1}</span>
      <input class="set-input" type="number" inputmode="decimal" placeholder="0" value="${set.weight || ''}">
      <input class="set-input" type="number" inputmode="numeric" placeholder="0" value="${set.reps || ''}">
      <button class="set-delete">✕</button>
    `;

    const inputs = row.querySelectorAll('.set-input');
    inputs[0].onchange = (e) => {
      set.weight = parseFloat(e.target.value) || 0;
      autoSave(workout);
    };
    inputs[1].onchange = (e) => {
      set.reps = parseInt(e.target.value) || 0;
      autoSave(workout);
      // Запускаем таймер отдыха после ввода повторений
      startRestTimer();
    };

    // Удаление подхода
    row.querySelector('.set-delete').onclick = () => {
      if (exercise.sets.length <= 1) {
        showToast('Минимум 1 подход');
        return;
      }
      exercise.sets.splice(s, 1);
      renderSets(container, exercise, workout, exIndex);
      autoSave(workout);
    };

    container.appendChild(row);
  }
}

// Автосохранение
let saveTimeout = null;
function autoSave(workout) {
  clearTimeout(saveTimeout);
  saveTimeout = setTimeout(async () => {
    await saveWorkout(workout);
  }, 500);
}

async function saveWorkout(workout) {
  await workoutsDB.update(workout);
}

// Таймер отдыха
function startRestTimer(seconds = 90) {
  stopRestTimer();

  let remaining = seconds;

  // Удаляем старый
  document.querySelectorAll('.rest-timer').forEach(t => t.remove());

  const timer = document.createElement('div');
  timer.className = 'rest-timer';
  timer.innerHTML = `
    <div>
      <div class="label">Отдых</div>
      <div class="time" id="rest-time">${formatTime(remaining)}</div>
    </div>
    <div class="rest-timer-controls">
      <button class="btn-icon" id="rest-minus" style="font-size:16px">-30</button>
      <button class="btn-icon" id="rest-plus" style="font-size:16px">+30</button>
      <button class="btn-icon" id="rest-stop" style="background:var(--accent-red);color:#fff;font-size:14px">✕</button>
    </div>
  `;

  document.getElementById('app').appendChild(timer);

  const timeEl = timer.querySelector('#rest-time');

  restTimerInterval = setInterval(() => {
    remaining--;
    if (remaining <= 0) {
      stopRestTimer();
      showToast('Отдых окончен! 💪');
      return;
    }
    timeEl.textContent = formatTime(remaining);
  }, 1000);

  timer.querySelector('#rest-minus').onclick = () => {
    remaining = Math.max(0, remaining - 30);
    timeEl.textContent = formatTime(remaining);
  };

  timer.querySelector('#rest-plus').onclick = () => {
    remaining += 30;
    timeEl.textContent = formatTime(remaining);
  };

  timer.querySelector('#rest-stop').onclick = () => stopRestTimer();
}

function stopRestTimer() {
  if (restTimerInterval) {
    clearInterval(restTimerInterval);
    restTimerInterval = null;
  }
  document.querySelectorAll('.rest-timer').forEach(t => t.remove());
}

function formatTime(sec) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

// Добавление упражнения в тренировку
async function showAddExerciseToWorkout(workout, mainContainer, openSections) {
  const allExercises = await exercisesDB.getAll();

  showModal((modal) => {
    const grouped = {};
    for (const ex of allExercises) {
      if (!grouped[ex.group]) grouped[ex.group] = [];
      grouped[ex.group].push(ex);
    }

    modal.innerHTML = `
      <div class="modal-handle"></div>
      <div class="modal-title">Добавить упражнение</div>
      <input class="search-bar" id="workout-ex-search" placeholder="Поиск..." type="text">
      <div id="workout-ex-list"></div>
    `;

    const renderList = (filter = '') => {
      const list = modal.querySelector('#workout-ex-list');
      list.innerHTML = '';

      for (const [group, exercises] of Object.entries(grouped)) {
        const mg = MUSCLE_GROUPS[group];
        if (!mg) continue;

        const filtered = filter
          ? exercises.filter(e => e.name.toLowerCase().includes(filter.toLowerCase()))
          : exercises;
        if (filtered.length === 0) continue;

        list.innerHTML += `
          <div style="padding:8px 0;font-size:14px;font-weight:600;color:var(--text-secondary)">${mg.icon} ${mg.name}</div>
          ${filtered.map(ex => `
            <div class="exercise-item add-to-workout" data-id="${ex.id}" data-name="${ex.name}" data-group="${ex.group}" style="margin-bottom:4px">
              <span class="name">${ex.name}</span>
            </div>
          `).join('')}
        `;
      }

      list.querySelectorAll('.add-to-workout').forEach(el => {
        el.onclick = () => {
          workout.exercises.push({
            id: parseInt(el.dataset.id),
            name: el.dataset.name,
            group: el.dataset.group,
            sets: [{ weight: '', reps: '' }],
          });
          openSections.add(workout.exercises.length - 1);
          autoSave(workout);
          closeModal();
          renderExercises(mainContainer, workout, openSections);
        };
      });
    };

    renderList();
    modal.querySelector('#workout-ex-search').oninput = (e) => renderList(e.target.value);
  });
}
