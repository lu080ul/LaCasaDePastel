export const loadFromStorage = (key, defaultVal) => {
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : defaultVal;
  } catch (err) {
    console.error(`Error loading ${key}`, err);
    return defaultVal;
  }
};

export const saveToStorage = (key, val) => {
  try {
    if (typeof val === 'string') {
      localStorage.setItem(key, val);
    } else {
      localStorage.setItem(key, JSON.stringify(val));
    }
  } catch (err) {
    console.error(`Error saving ${key}`, err);
  }
};
