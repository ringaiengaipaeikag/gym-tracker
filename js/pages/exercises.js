// Страница «Упражнения» — библиотека упражнений по группам мышц

import { exercisesDB, MUSCLE_GROUPS } from '../db.js';
import { showModal, closeModal, showToast, navigate } from '../app.js';

export async function renderExercises(content, header) {
  header.innerHTML = `<div class="header-title">Упражнения</div>`;

  // Поиск
  const search = document.createElement('input');
  search.className = 'search-bar';
  search.placeholder = 'Поиск упражнения...';
  search.type = 'text';
  content.appendChild(search);

  const list = document.createElement('div');
  list.id = 'exercises-list';
  content.appendChild(list);

  const grouped = await exercisesDB.getByGroup();

  const renderList = (filter = '') => {
    list.innerHTML = '';

    for (const [groupKey, mg] of Object.entries(MUSCLE_GROUPS)) {
      const exercises = grouped[groupKey] || [];
      const filtered = filter
        ? exercises.filter(e => e.name.toLowerCase().includes(filter.toLowerCase()))
        : exercises;

      if (filter && filtered.length === 0) continue;

      const groupEl = document.createElement('div');
      groupEl.className = 'exercise-group';

      const isOpen = !!filter; // при поиске группы раскрыты

      groupEl.innerHTML = `
        <div class="group-header ${isOpen ? 'open' : ''}">
          <div class="icon" style="background:${mg.color}20;color:${mg.color}">${mg.icon}</div>
          <span>${mg.name}</span>
          <span class="count">${exercises.length}</span>
          <span class="chevron">›</span>
        </div>
        <div class="group-items" style="${isOpen ? '' : 'display:none'}">
          ${filtered.map(ex => `
            <div class="exercise-item" data-id="${ex.id}">
              <span class="name">${ex.name}</span>
              ${ex.isCustom ? '<span style="font-size:11px;color:var(--text-muted);margin-left:8px">свой</span>' : ''}
            </div>
          `).join('')}
        </div>
      `;

      // Раскрытие/сворачивание группы
      const headerEl = groupEl.querySelector('.group-header');
      const itemsEl = groupEl.querySelector('.group-items');
      headerEl.onclick = () => {
        const open = itemsEl.style.display !== 'none';
        itemsEl.style.display = open ? 'none' : 'block';
        headerEl.classList.toggle('open', !open);
      };

      // Клик по упражнению — показать действия
      groupEl.querySelectorAll('.exercise-item').forEach(el => {
        el.onclick = (e) => {
          e.stopPropagation();
          const ex = exercises.find(ex => ex.id === parseInt(el.dataset.id));
          if (ex) showExerciseActions(ex);
        };
      });

      list.appendChild(groupEl);
    }
  };

  renderList();
  search.oninput = () => renderList(search.value);

  // FAB — добавить упражнение
  const fab = document.createElement('button');
  fab.className = 'fab';
  fab.textContent = '+';
  fab.onclick = () => showAddExercise();
  document.getElementById('app').appendChild(fab);
}

// Действия с упражнением
function showExerciseActions(exercise) {
  showModal((modal) => {
    const mg = MUSCLE_GROUPS[exercise.group] || {};
    modal.innerHTML = `
      <div class="modal-handle"></div>
      <div class="modal-title">${exercise.name}</div>
      <div style="text-align:center;margin-bottom:20px">
        <span style="font-size:40px">${mg.icon || '🏋️'}</span>
        <div style="color:var(--text-secondary);margin-top:8px">${mg.name || exercise.group}</div>
      </div>
      ${exercise.isCustom ? `
        <button class="btn btn-secondary mb-8" id="edit-ex">Редактировать</button>
        <button class="btn btn-danger" id="delete-ex">Удалить</button>
      ` : `
        <div style="text-align:center;color:var(--text-muted);font-size:14px">Стандартное упражнение</div>
      `}
    `;

    const editBtn = modal.querySelector('#edit-ex');
    if (editBtn) {
      editBtn.onclick = () => {
        closeModal();
        showAddExercise(exercise);
      };
    }

    const deleteBtn = modal.querySelector('#delete-ex');
    if (deleteBtn) {
      deleteBtn.onclick = async () => {
        await exercisesDB.remove(exercise.id);
        showToast('Упражнение удалено');
        closeModal();
        navigate('exercises');
      };
    }
  });
}

// Добавление / редактирование упражнения
function showAddExercise(editEx = null) {
  showModal((modal) => {
    let selectedGroup = editEx?.group || Object.keys(MUSCLE_GROUPS)[0];

    modal.innerHTML = `
      <div class="modal-handle"></div>
      <div class="modal-title">${editEx ? 'Редактировать' : 'Новое'} упражнение</div>

      <div class="form-group">
        <label class="form-label">Название</label>
        <input class="form-input" id="ex-name" placeholder="Название упражнения" value="${editEx?.name || ''}">
      </div>

      <div class="form-group">
        <label class="form-label">Группа мышц</label>
        <div id="group-options">
          ${Object.entries(MUSCLE_GROUPS).map(([key, mg]) => `
            <div class="exercise-item" data-group="${key}" style="margin-bottom:6px;${key === selectedGroup ? 'background:var(--bg-input)' : ''}">
              <span style="font-size:18px;margin-right:8px">${mg.icon}</span>
              <span class="name">${mg.name}</span>
              ${key === selectedGroup ? '<span style="color:var(--accent)">✓</span>' : ''}
            </div>
          `).join('')}
        </div>
      </div>

      <button class="btn btn-primary mt-16" id="save-ex">Сохранить</button>
    `;

    modal.querySelectorAll('[data-group]').forEach(el => {
      el.onclick = () => {
        selectedGroup = el.dataset.group;
        // обновить визуально
        modal.querySelectorAll('[data-group]').forEach(e => {
          e.style.background = e.dataset.group === selectedGroup ? 'var(--bg-input)' : '';
          const check = e.querySelector('span:last-child');
          if (check && !check.classList.contains('name')) {
            check.textContent = e.dataset.group === selectedGroup ? '✓' : '';
            check.style.color = 'var(--accent)';
          }
        });
      };
    });

    modal.querySelector('#save-ex').onclick = async () => {
      const name = modal.querySelector('#ex-name').value.trim();
      if (!name) { showToast('Введите название'); return; }

      if (editEx) {
        await exercisesDB.update({ ...editEx, name, group: selectedGroup });
        showToast('Упражнение обновлено');
      } else {
        await exercisesDB.add({ name, group: selectedGroup });
        showToast('Упражнение добавлено');
      }
      closeModal();
      navigate('exercises');
    };
  });
}
