// Date utility functions for consistent date parsing across the application

/**
 * Parse various date formats into a Date object
 * @param {*} dateValue - Date value in various formats
 * @returns {Date|null} - Parsed Date object or null if invalid
 */
export function parseDate(dateValue) {
    if (!dateValue) return null;
    
    try {
        // Handle Firestore Timestamp
        if (dateValue.toDate && typeof dateValue.toDate === 'function') {
            return dateValue.toDate();
        }
        
        // Handle Date object
        if (dateValue instanceof Date) {
            return isNaN(dateValue.getTime()) ? null : dateValue;
        }
        
        // Handle string dates
        if (typeof dateValue === 'string') {
            const parsed = new Date(dateValue);
            return isNaN(parsed.getTime()) ? null : parsed;
        }
        
        // Handle timestamp numbers
        if (typeof dateValue === 'number') {
            const parsed = new Date(dateValue);
            return isNaN(parsed.getTime()) ? null : parsed;
        }
        
        return null;
    } catch (error) {
        console.warn('parseDate: Error parsing date:', error);
        return null;
    }
}

/**
 * Format date for display
 * @param {Date} date - Date to format
 * @param {string} locale - Locale for formatting (default: 'en-US')
 * @returns {string} - Formatted date string
 */
export function formatDate(date, locale = 'en-US') {
    if (!date || !(date instanceof Date)) return 'Invalid Date';
    
    try {
        return date.toLocaleDateString(locale);
    } catch (error) {
        console.warn('formatDate: Error formatting date:', error);
        return 'Invalid Date';
    }
}

/**
 * Check if a date is today
 * @param {Date} date - Date to check
 * @returns {boolean} - Whether the date is today
 */
export function isToday(date) {
    if (!date || !(date instanceof Date)) return false;
    
    const today = new Date();
    return date.toDateString() === today.toDateString();
}

/**
 * Get the start of day (00:00:00) for a given date
 * @param {Date} date - Date to get start of day for
 * @returns {Date} - Date set to start of day
 */
export function getStartOfDay(date) {
    if (!date || !(date instanceof Date)) return null;
    
    const newDate = new Date(date);
    newDate.setHours(0, 0, 0, 0);
    return newDate;
}

/**
 * Get the end of day (23:59:59) for a given date
 * @param {Date} date - Date to get end of day for
 * @returns {Date} - Date set to end of day
 */
export function getEndOfDay(date) {
    if (!date || !(date instanceof Date)) return null;
    
    const newDate = new Date(date);
    newDate.setHours(23, 59, 59, 999);
    return newDate;
}
