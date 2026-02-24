// Страница «История» — журнал тренировок

import { workoutsDB, MUSCLE_GROUPS } from '../db.js';
import { navigate, formatDate, showModal, closeModal, showToast } from '../app.js';

export async function renderHistory(content, header) {
  header.innerHTML = `<div class="header-title">История</div>`;

  const workouts = await workoutsDB.getAll();

  if (workouts.length === 0) {
    content.innerHTML = `
      <div class="empty-state">
        <div class="bear">📊</div>
        <div class="title">Нет тренировок</div>
        <div class="subtitle">Начни тренироваться — история появится здесь</div>
      </div>
    `;
    return;
  }

  // Статистика
  const totalWorkouts = workouts.length;
  let totalSets = 0;
  let totalVolume = 0;
  for (const w of workouts) {
    for (const ex of w.exercises) {
      totalSets += ex.sets.length;
      for (const s of ex.sets) {
        totalVolume += (parseFloat(s.weight) || 0) * (parseInt(s.reps) || 0);
      }
    }
  }

  content.innerHTML = `
    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-value">${totalWorkouts}</div>
        <div class="stat-label">Тренировок</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${totalSets}</div>
        <div class="stat-label">Подходов</div>
      </div>
      <div class="stat-card" style="grid-column:span 2">
        <div class="stat-value">${formatVolume(totalVolume)}</div>
        <div class="stat-label">Общий объём (кг)</div>
      </div>
    </div>
    <div id="history-list"></div>
  `;

  const list = content.querySelector('#history-list');

  // Сортировка: от новых к старым
  const sorted = [...workouts].sort((a, b) => {
    if (a.date !== b.date) return b.date.localeCompare(a.date);
    return (b.startTime || 0) - (a.startTime || 0);
  });

  for (const w of sorted) {
    let wSets = 0;
    let wVolume = 0;
    for (const ex of w.exercises) {
      wSets += ex.sets.length;
      for (const s of ex.sets) {
        wVolume += (parseFloat(s.weight) || 0) * (parseInt(s.reps) || 0);
      }
    }

    const duration = w.endTime && w.startTime
      ? formatDuration(w.endTime - w.startTime)
      : '';

    const item = document.createElement('div');
    item.className = 'history-item';
    item.innerHTML = `
      <div class="date">${formatDate(w.date)}${duration ? ' · ' + duration : ''}</div>
      <div class="program-name">${w.programName || 'Тренировка'}</div>
      <div class="summary">${w.exercises.length} упр. · ${wSets} подходов · ${formatVolume(wVolume)} кг</div>
    `;

    item.onclick = () => showWorkoutDetail(w);
    list.appendChild(item);
  }
}

// Детали тренировки
function showWorkoutDetail(workout) {
  showModal((modal) => {
    modal.innerHTML = `
      <div class="modal-handle"></div>
      <div class="modal-title">${workout.programName || 'Тренировка'}</div>
      <div style="text-align:center;color:var(--text-secondary);margin-bottom:16px">${formatDate(workout.date)}</div>
      <div id="detail-exercises">
        ${workout.exercises.map(ex => {
          const mg = MUSCLE_GROUPS[ex.group] || {};
          return `
            <div style="margin-bottom:16px">
              <div style="font-weight:600;margin-bottom:8px">${mg.icon || '🏋️'} ${ex.name}</div>
              <div class="sets-header">
                <span style="text-align:center">Сет</span>
                <span style="text-align:center">Вес</span>
                <span style="text-align:center">Повтор.</span>
                <span></span>
              </div>
              ${ex.sets.map((s, i) => `
                <div class="set-row" style="margin-bottom:4px">
                  <span class="set-num">${i + 1}</span>
                  <span style="text-align:center;font-size:16px">${s.weight || '—'}</span>
                  <span style="text-align:center;font-size:16px">${s.reps || '—'}</span>
                  <span></span>
                </div>
              `).join('')}
            </div>
          `;
        }).join('')}
      </div>
      <div style="display:flex;gap:8px;margin-top:16px">
        <button class="btn btn-danger" id="delete-workout" style="flex:1">Удалить</button>
        <button class="btn btn-secondary" id="reopen-workout" style="flex:1">Открыть</button>
      </div>
    `;

    modal.querySelector('#delete-workout').onclick = async () => {
      await workoutsDB.remove(workout.id);
      showToast('Тренировка удалена');
      closeModal();
      navigate('history');
    };

    modal.querySelector('#reopen-workout').onclick = () => {
      closeModal();
      navigate('workout', { workoutId: workout.id });
    };
  });
}

function formatVolume(v) {
  if (v >= 1000) return (v / 1000).toFixed(1) + 'k';
  return Math.round(v).toString();
}

function formatDuration(ms) {
  const mins = Math.round(ms / 60000);
  if (mins < 60) return `${mins} мин`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}ч ${m}мин`;
}
