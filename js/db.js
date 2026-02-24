// IndexedDB обёртка для Gym Tracker

const DB_NAME = 'gym-tracker';
const DB_VERSION = 1;

let dbInstance = null;

// Дефолтные упражнения по группам мышц
const DEFAULT_EXERCISES = [
  // Кардио
  { name: 'Эллиптический тренажёр', group: 'cardio' },
  { name: 'Беговая дорожка', group: 'cardio' },
  { name: 'Велотренажёр', group: 'cardio' },
  { name: 'Гребной тренажёр', group: 'cardio' },
  // Грудь
  { name: 'Жим штанги лёжа', group: 'chest' },
  { name: 'Жим гантелей лёжа', group: 'chest' },
  { name: 'Жим на наклонной скамье', group: 'chest' },
  { name: 'Сведение рук в тренажёре', group: 'chest' },
  { name: 'Отжимания', group: 'chest' },
  // Спина
  { name: 'Верхняя тяга в тренажёре', group: 'back' },
  { name: 'Горизонтальная тяга', group: 'back' },
  { name: 'Тяга штанги в наклоне', group: 'back' },
  { name: 'Тяга гантели в наклоне', group: 'back' },
  { name: 'Подтягивания', group: 'back' },
  { name: 'Гиперэкстензия', group: 'back' },
  // Руки
  { name: 'Сгибание рук со штангой', group: 'arms' },
  { name: 'Сгибание рук с гантелями', group: 'arms' },
  { name: 'Французский жим', group: 'arms' },
  { name: 'Разгибание рук на блоке', group: 'arms' },
  // Ноги
  { name: 'Приседания со штангой', group: 'legs' },
  { name: 'Жим ногами', group: 'legs' },
  { name: 'Разгибание ног в тренажёре', group: 'legs' },
  { name: 'Сгибание ног в тренажёре', group: 'legs' },
  { name: 'Выпады с гантелями', group: 'legs' },
  // Плечи
  { name: 'Жим гантелей сидя', group: 'shoulders' },
  { name: 'Разведение гантелей в стороны', group: 'shoulders' },
  { name: 'Тяга штанги к подбородку', group: 'shoulders' },
  // Пресс
  { name: 'Скручивания', group: 'abs' },
  { name: 'Планка', group: 'abs' },
  { name: 'Подъём ног в висе', group: 'abs' },
  // Растяжка
  { name: 'Растяжка спины', group: 'stretching' },
  { name: 'Растяжка ног', group: 'stretching' },
  { name: 'Растяжка плеч', group: 'stretching' },
];

// Группы мышц с иконками и цветами
export const MUSCLE_GROUPS = {
  stretching:  { name: 'Растяжка',  icon: '🧘', color: '#64d2ff' },
  cardio:      { name: 'Кардио',    icon: '🏃', color: '#30d158' },
  chest:       { name: 'Грудь',     icon: '💪', color: '#ff9500' },
  back:        { name: 'Спина',     icon: '🔙', color: '#007aff' },
  arms:        { name: 'Руки',      icon: '💪', color: '#ff375f' },
  legs:        { name: 'Ноги',      icon: '🦵', color: '#bf5af2' },
  shoulders:   { name: 'Плечи',     icon: '🏋️', color: '#ff6482' },
  abs:         { name: 'Пресс',     icon: '🎯', color: '#ffd60a' },
};

// Цвета программ
export const PROGRAM_COLORS = [
  '#007aff', '#ff9500', '#5856d6', '#ff375f', '#30d158', '#64d2ff', '#bf5af2', '#ff6482'
];

function openDB() {
  return new Promise((resolve, reject) => {
    if (dbInstance) return resolve(dbInstance);

    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = (e) => {
      const db = e.target.result;

      // Упражнения
      if (!db.objectStoreNames.contains('exercises')) {
        const store = db.createObjectStore('exercises', { keyPath: 'id', autoIncrement: true });
        store.createIndex('group', 'group', { unique: false });
      }

      // Программы тренировок
      if (!db.objectStoreNames.contains('programs')) {
        db.createObjectStore('programs', { keyPath: 'id', autoIncrement: true });
      }

      // Тренировки (логи)
      if (!db.objectStoreNames.contains('workouts')) {
        const store = db.createObjectStore('workouts', { keyPath: 'id', autoIncrement: true });
        store.createIndex('date', 'date', { unique: false });
      }
    };

    req.onsuccess = async (e) => {
      dbInstance = e.target.result;
      // Заполняем дефолтные упражнения при первом запуске
      const count = await countStore('exercises');
      if (count === 0) {
        await seedExercises();
      }
      resolve(dbInstance);
    };

    req.onerror = () => reject(req.error);
  });
}

function countStore(storeName) {
  return new Promise((resolve) => {
    const tx = dbInstance.transaction(storeName, 'readonly');
    const req = tx.objectStore(storeName).count();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => resolve(0);
  });
}

async function seedExercises() {
  const tx = dbInstance.transaction('exercises', 'readwrite');
  const store = tx.objectStore('exercises');
  for (const ex of DEFAULT_EXERCISES) {
    store.add({ ...ex, isCustom: false });
  }
  return new Promise((resolve) => {
    tx.oncomplete = resolve;
  });
}

// === CRUD операции ===

// Общие хелперы
function getAll(storeName) {
  return openDB().then(db => {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readonly');
      const req = tx.objectStore(storeName).getAll();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  });
}

function getById(storeName, id) {
  return openDB().then(db => {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readonly');
      const req = tx.objectStore(storeName).get(id);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  });
}

function add(storeName, item) {
  return openDB().then(db => {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      const req = tx.objectStore(storeName).add(item);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  });
}

function update(storeName, item) {
  return openDB().then(db => {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      const req = tx.objectStore(storeName).put(item);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  });
}

function remove(storeName, id) {
  return openDB().then(db => {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      const req = tx.objectStore(storeName).delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  });
}

// === Exercises API ===
export const exercisesDB = {
  getAll: () => getAll('exercises'),
  getById: (id) => getById('exercises', id),
  add: (ex) => add('exercises', { ...ex, isCustom: true }),
  update: (ex) => update('exercises', ex),
  remove: (id) => remove('exercises', id),

  getByGroup: () => {
    return getAll('exercises').then(exercises => {
      const grouped = {};
      for (const group of Object.keys(MUSCLE_GROUPS)) {
        grouped[group] = exercises.filter(e => e.group === group);
      }
      return grouped;
    });
  }
};

// === Programs API ===
export const programsDB = {
  getAll: () => getAll('programs'),
  getById: (id) => getById('programs', id),
  add: (p) => add('programs', p),
  update: (p) => update('programs', p),
  remove: (id) => remove('programs', id),
};

// === Workouts API ===
export const workoutsDB = {
  getAll: () => getAll('workouts'),
  getById: (id) => getById('workouts', id),
  add: (w) => add('workouts', w),
  update: (w) => update('workouts', w),
  remove: (id) => remove('workouts', id),

  getByDate: (dateStr) => {
    return getAll('workouts').then(workouts =>
      workouts.filter(w => w.date === dateStr)
    );
  },

  getDates: () => {
    return getAll('workouts').then(workouts =>
      [...new Set(workouts.map(w => w.date))]
    );
  }
};

// Инициализация БД
export function initDB() {
  return openDB();
}
