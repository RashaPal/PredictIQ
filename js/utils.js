/**
 * Utility functions for Jira Epic Analyzer
 */
console.log('Loading utils.js');

const Utils = {
  /**
   * Format a number as a percentage with specified decimal places
   * @param {number} value - Value to format
   * @param {number} decimals - Number of decimal places (default: 1)
   * @returns {string} - Formatted percentage
   */
  formatPercentage(value, decimals = 1) {
    return value.toFixed(decimals) + '%';
  },
    
    /**
     * Format a number with specified decimal places and thousands separator
     * @param {number} value - Value to format
     * @param {number} decimals - Number of decimal places (default: 0)
     * @returns {string} - Formatted number
     */
    formatNumber(value, decimals = 0) {
      return value.toLocaleString(undefined, {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
      });
    },
    
    /**
     * Show an error message to the user
     * @param {string} message - Error message to display
     */
    showError(message) {
      const errorElement = document.getElementById('errorMessage');
      errorElement.textContent = message;
      errorElement.style.display = 'block';
      
      // Hide loading indicator if it's showing
      document.getElementById('loadingIndicator').style.display = 'none';
    },
    
    /**
     * Clear any displayed error messages
     */
    clearError() {
      const errorElement = document.getElementById('errorMessage');
      errorElement.textContent = '';
      errorElement.style.display = 'none';
    },
    
    /**
     * Show the loading indicator
     */
    showLoading() {
      document.getElementById('loadingIndicator').style.display = 'flex';
    },
    
    /**
     * Hide the loading indicator
     */
    hideLoading() {
      document.getElementById('loadingIndicator').style.display = 'none';
    },
    
    /**
     * Get unique values from an array of objects by a property
     * @param {Array} array - Array of objects
     * @param {string} property - Property to extract unique values from
     * @returns {Array} - Array of unique values
     */
    getUniqueValues(array, property) {
      return [...new Set(array.map(item => item[property]))].filter(Boolean);
    },
    
    /**
     * Create a DOM element with specified attributes and properties
     * @param {string} tag - Tag name
     * @param {Object} attributes - Attributes to set
     * @param {string|Node} content - Inner content (string or Node)
     * @returns {HTMLElement} - Created element
     */
    createElement(tag, attributes = {}, content = '') {
      const element = document.createElement(tag);
      
      // Set attributes
      Object.entries(attributes).forEach(([key, value]) => {
        if (key === 'className') {
          element.className = value;
        } else {
          element.setAttribute(key, value);
        }
      });
      
      // Set content
      if (content) {
        if (typeof content === 'string') {
          element.innerHTML = content;
        } else {
          element.appendChild(content);
        }
      }
      
      return element;
    },
    
    /**
     * Update a select element with options
     * @param {HTMLSelectElement} selectElement - Select element to update
     * @param {Array} options - Array of option values
     * @param {boolean} keepFirst - Whether to keep the first option (default: true)
     */
    updateSelectOptions(selectElement, options, keepFirst = true) {
      // Clear existing options except the first one if keepFirst is true
      selectElement.innerHTML = keepFirst ? selectElement.options[0].outerHTML : '';
      
      // Add new options
      options.forEach(optionValue => {
        const option = document.createElement('option');
        option.value = optionValue;
        option.textContent = optionValue;
        selectElement.appendChild(option);
      });
    },
    
    /**
     * Set the file name display for an input element
     * @param {HTMLInputElement} inputElement - File input element
     * @param {HTMLElement} displayElement - Element to display the file name
     */
    setFileNameDisplay(inputElement, displayElement) {
      if (inputElement.files.length > 0) {
        displayElement.textContent = inputElement.files[0].name;
      } else {
        displayElement.textContent = 'No file selected';
      }
    }
  };

  
  // Make Utils available globally
window.Utils = Utils;