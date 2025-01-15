// Utility function for binary search to find the first index >= target
function lowerBound(res, target) {
  let [targetKey2, targetKey3] = target.split('-').map(Number);
  let low = 0, high = res.length;
  while (low < high) {
    let mid = Math.floor((low + high) / 2);
    let [key2, key3] = res[mid][0].split('-').map(Number);
    if (key2 > targetKey2 || (key2 === targetKey2 && key3 >= targetKey3)) {
      high = mid;
    } else {
      low = mid + 1;
    }
  }
  return low;
}

// Utility function for binary search to find the first index > target
function upperBound(res, target) {
  let [targetKey2, targetKey3] = target.split('-').map(Number);
  let low = 0, high = res.length - 1;
  let result = -1; // Initialize to -1 to handle cases where no key is <= target

  while (low <= high) {
    let mid = Math.floor((low + high) / 2);
    let [key2, key3] = res[mid][0].split('-').map(Number);

    if (key2 < targetKey2 || (key2 === targetKey2 && key3 <= targetKey3)) {
      result = mid; // Update the result and continue to search higher
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  return result;
}
function UpperBound(res, target) {
  let [targetKey2, targetKey3] = target.split('-').map(Number);
  let low = 0, high = res.length;
  while (low < high) {
    let mid = Math.floor((low + high) / 2);
    let [key2, key3] = res[mid][0].split('-').map(Number);
    if (key2 > targetKey2 || (key2 === targetKey2 && key3 > targetKey3)) {
      high = mid;
    } else {
      low = mid + 1;
    }
  }
  return low;
}
module.exports = {
  lowerBound, upperBound,UpperBound
};