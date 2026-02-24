// Страница «Программы» — список программ тренировок

import { programsDB, exercisesDB, MUSCLE_GROUPS, PROGRAM_COLORS } from '../db.js';
import { navigate, showModal, closeModal, showToast } from '../app.js';

export async function renderPrograms(content, header) {
  header.innerHTML = `<div class="header-title">Программы</div>`;

  const programs = await programsDB.getAll();

  if (programs.length === 0) {
    content.innerHTML = `
      <div class="empty-state">
        <div class="bear">📋</div>
        <div class="title">Нет программ</div>
        <div class="subtitle">Создай свою первую программу тренировки</div>
      </div>
    `;
  } else {
    // Поиск
    const search = document.createElement('input');
    search.className = 'search-bar';
    search.placeholder = 'Поиск программы...';
    search.type = 'text';
    content.appendChild(search);

    const list = document.createElement('div');
    list.id = 'programs-list';
    content.appendChild(list);

    const renderList = (filter = '') => {
      const filtered = filter
        ? programs.filter(p => p.name.toLowerCase().includes(filter.toLowerCase()))
        : programs;

      list.innerHTML = filtered.map((p, idx) => `
        <div class="program-card" style="background:${p.color || PROGRAM_COLORS[idx % PROGRAM_COLORS.length]}" data-id="${p.id}">
          <div class="name">${p.name}</div>
          <div class="count">${p.exercises ? p.exercises.length : 0} упражнений</div>
        </div>
      `).join('');

      list.querySelectorAll('.program-card').forEach(card => {
        card.onclick = () => showProgramDetail(parseInt(card.dataset.id));
      });
    };

    renderList();
    search.oninput = () => renderList(search.value);
  }

  // FAB — добавить программу
  const fab = document.createElement('button');
  fab.className = 'fab';
  fab.textContent = '+';
  fab.onclick = () => showCreateProgram();
  document.getElementById('app').appendChild(fab);
}

// Создание новой программы
async function showCreateProgram(editProgram = null) {
  const allExercises = await exercisesDB.getAll();

  showModal((modal) => {
    let selectedColor = editProgram?.color || PROGRAM_COLORS[0];
    let selectedExercises = editProgram ? [...editProgram.exercises] : [];

    const render = () => {
      modal.innerHTML = `
        <div class="modal-handle"></div>
        <div class="modal-title">${editProgram ? 'Редактировать' : 'Новая'} программа</div>

        <div class="form-group">
          <label class="form-label">Название</label>
          <input class="form-input" id="prog-name" placeholder="Напр. День ног" value="${editProgram?.name || ''}">
        </div>

        <div class="form-group">
          <label class="form-label">Цвет</label>
          <div class="color-picker">
            ${PROGRAM_COLORS.map(c => `
              <div class="color-option ${c === selectedColor ? 'selected' : ''}" style="background:${c}" data-color="${c}"></div>
            `).join('')}
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">Упражнения (${selectedExercises.length})</label>
          <div id="selected-exercises">
            ${selectedExercises.map((ex, i) => `
              <div class="exercise-item" style="margin-bottom:6px">
                <span class="name">${ex.name}</span>
                <button class="btn-icon remove-ex" data-index="${i}" style="background:rgba(255,69,58,0.15);color:var(--accent-red);font-size:14px">✕</button>
              </div>
            `).join('')}
          </div>
          <button class="btn btn-secondary btn-small mt-8" id="add-exercises-btn">+ Добавить упражнения</button>
        </div>

        <div style="display:flex;gap:8px;margin-top:20px">
          ${editProgram ? `<button class="btn btn-danger" id="delete-prog" style="flex:1">Удалить</button>` : ''}
          <button class="btn btn-primary" id="save-prog" style="flex:2">Сохранить</button>
        </div>
      `;

      // Цвет
      modal.querySelectorAll('.color-option').forEach(el => {
        el.onclick = () => {
          selectedColor = el.dataset.color;
          render();
        };
      });

      // Удаление упражнения из списка
      modal.querySelectorAll('.remove-ex').forEach(btn => {
        btn.onclick = (e) => {
          e.stopPropagation();
          selectedExercises.splice(parseInt(btn.dataset.index), 1);
          render();
        };
      });

      // Добавление упражнений
      modal.querySelector('#add-exercises-btn').onclick = () => {
        showExercisePicker(allExercises, selectedExercises, (picked) => {
          selectedExercises = picked;
          render();
        });
      };

      // Сохранение
      modal.querySelector('#save-prog').onclick = async () => {
        const name = modal.querySelector('#prog-name').value.trim();
        if (!name) { showToast('Введите название'); return; }

        const data = {
          name,
          color: selectedColor,
          exercises: selectedExercises.map(e => ({ id: e.id, name: e.name, group: e.group })),
        };

        if (editProgram) {
          await programsDB.update({ ...editProgram, ...data });
          showToast('Программа обновлена');
        } else {
          await programsDB.add(data);
          showToast('Программа создана');
        }
        closeModal();
        navigate('programs');
      };

      // Удаление
      const deleteBtn = modal.querySelector('#delete-prog');
      if (deleteBtn) {
        deleteBtn.onclick = async () => {
          await programsDB.remove(editProgram.id);
          showToast('Программа удалена');
          closeModal();
          navigate('programs');
        };
      }
    };

    render();
  });
}

// Выбор упражнений (пикер)
function showExercisePicker(allExercises, alreadySelected, onDone) {
  const selectedIds = new Set(alreadySelected.map(e => e.id));
  const grouped = {};
  for (const ex of allExercises) {
    if (!grouped[ex.group]) grouped[ex.group] = [];
    grouped[ex.group].push(ex);
  }

  const overlay = document.getElementById('modal-overlay');
  const modal = document.getElementById('modal');

  modal.innerHTML = `
    <div class="modal-handle"></div>
    <div class="modal-title">Выбрать упражнения</div>
    <input class="search-bar" id="ex-search" placeholder="Поиск..." type="text">
    <div id="ex-picker-list"></div>
    <button class="btn btn-primary mt-16" id="ex-picker-done">Готово</button>
  `;

  const renderPicker = (filter = '') => {
    const list = modal.querySelector('#ex-picker-list');
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
          <div class="exercise-item ex-pick" data-id="${ex.id}" style="margin-bottom:4px">
            <span class="name">${ex.name}</span>
            <div class="check ${selectedIds.has(ex.id) ? 'checked' : ''}">
              ${selectedIds.has(ex.id) ? '✓' : ''}
            </div>
          </div>
        `).join('')}
      `;
    }

    list.querySelectorAll('.ex-pick').forEach(el => {
      el.onclick = () => {
        const id = parseInt(el.dataset.id);
        if (selectedIds.has(id)) {
          selectedIds.delete(id);
        } else {
          selectedIds.add(id);
        }
        renderPicker(filter);
      };
    });
  };

  renderPicker();
  modal.querySelector('#ex-search').oninput = (e) => renderPicker(e.target.value);

  modal.querySelector('#ex-picker-done').onclick = () => {
    const result = allExercises.filter(e => selectedIds.has(e.id));
    onDone(result);
  };
}

// Детали программы
async function showProgramDetail(id) {
  const program = await programsDB.getById(id);
  if (!program) return;

  showModal((modal) => {
    modal.innerHTML = `
      <div class="modal-handle"></div>
      <div class="modal-title">${program.name}</div>
      <div style="margin-bottom:16px">
        ${program.exercises.map(ex => {
          const mg = MUSCLE_GROUPS[ex.group] || {};
          return `
            <div class="exercise-item" style="margin-bottom:6px">
              <span style="font-size:18px;margin-right:8px">${mg.icon || '🏋️'}</span>
              <span class="name">${ex.name}</span>
            </div>
          `;
        }).join('')}
      </div>
      <div style="display:flex;gap:8px">
        <button class="btn btn-secondary" id="edit-prog" style="flex:1">Редактировать</button>
        <button class="btn btn-primary" id="start-prog" style="flex:2">Начать тренировку</button>
      </div>
    `;

    modal.querySelector('#edit-prog').onclick = () => {
      closeModal();
      showCreateProgram(program);
    };

    modal.querySelector('#start-prog').onclick = () => {
      closeModal();
      const today = new Date();
      const dateStr = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0');
      navigate('workout', { programId: program.id, date: dateStr });
    };
  });
}
