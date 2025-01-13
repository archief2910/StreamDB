// Initialize the top-level map
const mp = new Map();

// Helper function to set a value in the deeply nested map
function setNestedValue(mp, key1, key2, key3, key4, value) {
  if (!mp.has(key1)) {
    mp.set(key1, new Map());
  }
  const level1 = mp.get(key1);

  if (!level1.has(key2)) {
    level1.set(key2, new Map());
  }
  const level2 = level1.get(key2);

  if (!level2.has(key3)) {
    level2.set(key3, new Map());
  }
  const level3 = level2.get(key3);

  level3.set(key4, value);
}

// Helper function to get a value from the deeply nested map
function getNestedValue(mp, key1, key2, key3, key4) {
  if (!mp.has(key1)) return undefined;
  const level1 = mp.get(key1);

  if (!level1.has(key2)) return undefined;
  const level2 = level1.get(key2);

  if (!level2.has(key3)) return undefined;
  const level3 = level2.get(key3);

  return level3.get(key4);
}
module.exports = {
  setNestedValue,getNestedValue,
};