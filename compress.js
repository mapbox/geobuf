'use strict';

if (typeof Map == 'undefined' || !Object.entries) {
    module.exports = function compress(value) {
        return value;
    };
    return;
}

/**
 * @param {array} value
 * @returns {Boolean} is this an array where all fields are numbers (including the empty array).
 */
function isNumericArray(array) {
    for (var i = 0; i < array.length; i++) {
        var v = array[i];
        if (typeof (v) !== 'number') {
            return false;
        }
    }
    return true;
}

/**
 * @param {string[]} array, possibly including Infinity/NaN
 * @return {string} cache key identifying an array with those numbers.
 */
function createCacheKey(array) {
    var parts = [];
    for (var i = 0; i < array.length; i++) {
        var v = array[i];
        // String(-0) === '0'
        var representation = v === 0 && 1 / v < 0 ? '-0' : String(v);
        parts.push(representation);
    }
    return parts.join(',');
}

/**
 * Compress data returned by geobuf's decode function.
 * Objects are modified in place.
 *
 * This is useful in cases where the polygons will be used for a long time.
 * By default, arrays are reserved with extra capacity that won't be used.
 * (The empty array starts with a capacity of 16 elements by now,
 * which is inefficient for decoded points of length 2)
 *
 * This has an optional option to deduplicate identical points,
 * which may be useful for collections of polygons sharing points as well
 * as for calling compress multiple times with different objects.
 *
 * @param {any} value the value to compress.
 * @param {Map} [cache] by default, a new cache is created each time for external calls to compress.
 *              Must support get/has/set.
 * @param {null|Map} [numericArrayCache] if non-null, this will be used to deduplicate
 *                   numeric arrays of any length, including empty arrays.
 *
 *                   This deduplication may be unsafe if callers would modify arrays.
 * @return {any} value with all fields compressed.
 */
function compress(value, cache = new Map(), numericArrayCache = null) {
    var i;
    if (cache.has(value)) {
        return cache.get(value);
    }
    if (Array.isArray(value)) {
        // By default, v8 allocates an array with a capacity of 16 elements.
        // This wastes memory for small arrays such as Points of length 2.
        //
        // The function slice is used because it was available in older JS versions
        // and experimentally appears to reduce capacity used.
        var result = value.slice();
        if (numericArrayCache && isNumericArray(result)) {
            var cacheKey = createCacheKey(result);
            var cachedEntry = numericArrayCache.get(cacheKey);
            if (cachedEntry) {
                cache.set(value, cachedEntry);
                return cachedEntry;
            }
            // Reuse array instances such as [], [1.5, 1.5]
            numericArrayCache.set(cacheKey, result);
            cache.set(value, result);
            // Nothing left to compress.
            return result;
        }
        // Store this in the cache immediately to guard against infinite recursion on
        // invalid inputs.
        cache.set(value, result);
        for (i = 0; i < result.length; i++) {
            result[i] = compress(result[i], cache, numericArrayCache);
        }
        return result;
    } else if (value && typeof value === 'object') {
        // Compress fields of the object in place.
        // Set this to the cache immediately to prevent infinite recursion on invalid data.
        cache.set(value, value);
        var entries = Object.entries(value);
        for (i = 0; i < entries.length; i++) {
            var entry = entries[i];
            var field = entry[1];
            var compressedValue = compress(field, cache, numericArrayCache);
            if (field !== compressedValue) {
                // Replace object field for this key with the compressed version
                value[entry[0]] = compressedValue;
            }
        }
    } else if (typeof value === 'string') {
        // Deduplicate strings.
        cache.set(value, value);
    }
    return value;
}
module.exports = compress;
