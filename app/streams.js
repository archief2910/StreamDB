// Initialize the top-level map
const mp = new Map();

// Helper function to set a value in the deeply nested map
function setNestedValue(mp, key1, key2, key3, value) {
  if (!mp.has(key1)) {
    mp.set(key1, new Map());
  }
  const level1 = mp.get(key1);

  if (!level1.has(key2)) {
    level1.set(key2, new Map());
  }
  const level2 = level1.get(key2);

  if (!level2.has(key3)) {
    level2.set(key3, []); // Initialize as an empty array
  }
  const level3 = level2.get(key3);

  // Add the value to the array (vector equivalent in JavaScript)
  level3.push(...value);
}

// Helper function to get a value from the deeply nested map
function getEntriesInRange(mp, key1, rangeStart, rangeEnd) {
  const result = [];

  // Destructure rangeStart and rangeEnd into key2 and key3 components
  const [key2Start, key3Start] = rangeStart.split('-').map(Number);
  const [key2End, key3End] = rangeEnd.split('-').map(Number);

  if (mp.has(key1)) {
    const level1 = mp.get(key1);

    // Iterate through key2 in the range
    for (const [key2, level2] of level1.entries()) {
      if (key2 >= key2Start && key2 <= key2End) {
        // Iterate through key3 in level2
        for (const [key3, level3] of level2.entries()) {
          if (
            (key2 > key2Start || key3 >= key3Start) &&
            (key2 < key2End || key3 <= key3End)
          ) {
            result.push([`${key2}-${key3}`, level3]);  // level3 is a vector (array)
          }
        }
      }
    }
  }

  // Sort the results by key2 and key3
  result.sort((a, b) => {
    const [keyA2, keyA3] = a[0].split('-').map(Number);  // Access key2 and key3 from the string key
    const [keyB2, keyB3] = b[0].split('-').map(Number);  // Access key2 and key3 from the string key
    return keyA2 - keyB2 || keyA3 - keyB3;
  });

  return result;
}

module.exports = {
  setNestedValue,getEntriesInRange,
};