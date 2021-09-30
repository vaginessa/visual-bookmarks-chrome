export function get(key) {
  let value = null;
  try {
    value = JSON.parse(localStorage[key]);
  } catch (error) {
    value = localStorage[key];
  }
  return value;
}

export function set(key, value) {
  if (typeof value === 'object') {
    localStorage[key] = JSON.stringify(value);

  } else {
    localStorage[key] = value;
  }
}
