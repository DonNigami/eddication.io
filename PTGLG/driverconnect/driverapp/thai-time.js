/**
 * Thailand Timezone Utilities
 * Provides functions to work with Thailand timezone (UTC+7)
 */

(function (window) {
  'use strict';

  const TIMEZONE_OFFSET = 7; // Thailand is UTC+7

  /**
   * Get current time in Thailand timezone as ISO string
   * @returns {string} ISO string in Thailand timezone
   */
  function getThaiTimeISO() {
    const now = new Date();
    const utcTime = new Date(now.getTime() + now.getTimezoneOffset() * 60000);
    const thaiTime = new Date(utcTime.getTime() + TIMEZONE_OFFSET * 60 * 60 * 1000);
    return thaiTime.toISOString();
  }

  /**
   * Get current time in Thailand timezone
   * @returns {Date} Date object adjusted to Thailand timezone
   */
  function getThaiDateTime() {
    const now = new Date();
    const utcTime = new Date(now.getTime() + now.getTimezoneOffset() * 60000);
    const thaiTime = new Date(utcTime.getTime() + TIMEZONE_OFFSET * 60 * 60 * 1000);
    return thaiTime;
  }

  /**
   * Format date to string in Thailand timezone
   * @param {Date|string} date - Date object or ISO string
   * @param {string} format - Format: 'datetime', 'date', 'time', 'iso'
   * @returns {string} Formatted date string
   */
  function formatThaiDate(date, format = 'datetime') {
    let d;
    if (typeof date === 'string') {
      d = new Date(date);
    } else if (date instanceof Date) {
      d = date;
    } else {
      return '';
    }

    // Adjust to Thailand timezone
    const utcTime = new Date(d.getTime() + d.getTimezoneOffset() * 60000);
    const thaiTime = new Date(utcTime.getTime() + TIMEZONE_OFFSET * 60 * 60 * 1000);

    const year = thaiTime.getFullYear();
    const month = String(thaiTime.getMonth() + 1).padStart(2, '0');
    const day = String(thaiTime.getDate()).padStart(2, '0');
    const hours = String(thaiTime.getHours()).padStart(2, '0');
    const minutes = String(thaiTime.getMinutes()).padStart(2, '0');
    const seconds = String(thaiTime.getSeconds()).padStart(2, '0');

    switch (format) {
      case 'iso':
        return thaiTime.toISOString();
      case 'datetime':
        return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
      case 'datetime-short':
        return `${year}-${month}-${day} ${hours}:${minutes}`;
      case 'date':
        return `${year}-${month}-${day}`;
      case 'time':
        return `${hours}:${minutes}:${seconds}`;
      case 'time-short':
        return `${hours}:${minutes}`;
      case 'thai-date':
        // Thai format: DD/MM/YYYY HH:mm
        return `${day}/${month}/${year} ${hours}:${minutes}`;
      case 'mm/dd/yyyy hh:mm:ss':
        // US format used in sheets
        return `${month}/${day}/${year} ${hours}:${minutes}:${seconds}`;
      default:
        return thaiTime.toString();
    }
  }

  /**
   * Get current time in Thai format (HH:mm:ss)
   * @returns {string} Time string
   */
  function getThaiTimeString() {
    return formatThaiDate(new Date(), 'time');
  }

  /**
   * Get current datetime in format MM/DD/YYYY HH:mm:ss (for sheets)
   * @returns {string} DateTime string
   */
  function getThaiDateTimeForSheets() {
    return formatThaiDate(new Date(), 'mm/dd/yyyy hh:mm:ss');
  }

  /**
   * Get current date in Thai format (DD/MM/YYYY)
   * @returns {string} Date string
   */
  function getThaiDateString() {
    const d = getThaiDateTime();
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  }

  /**
   * Convert UTC timestamp to Thailand timezone
   * @param {string} utcTimestamp - UTC ISO string
   * @returns {string} Formatted Thai datetime
   */
  function convertUTCToThai(utcTimestamp) {
    return formatThaiDate(utcTimestamp, 'datetime');
  }

  /**
   * Get Thai time with custom separator
   * @param {string} separator - Separator character (default ':')
   * @returns {string} Time string with custom separator
   */
  function getThaiTimeCustom(separator = ':') {
    const time = formatThaiDate(new Date(), 'time');
    return time.replace(/:/g, separator);
  }

  // Export to window
  window.ThaiTimeUtils = {
    getThaiTimeISO,
    getThaiDateTime,
    formatThaiDate,
    getThaiTimeString,
    getThaiDateTimeForSheets,
    getThaiDateString,
    convertUTCToThai,
    getThaiTimeCustom,
    TIMEZONE_OFFSET
  };

  // Also export as top-level functions for convenience
  window.getThaiTimeISO = getThaiTimeISO;
  window.getThaiDateTime = getThaiDateTime;
  window.formatThaiDate = formatThaiDate;
  window.getThaiTimeString = getThaiTimeString;
  window.getThaiDateTimeForSheets = getThaiDateTimeForSheets;
  window.getThaiDateString = getThaiDateString;

  console.log('✅ Thailand Timezone Utils loaded');
})(window);
