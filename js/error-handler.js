/**
 * Error Handler Module
 * Provides advanced error handling capabilities for the application
 */
const ErrorHandler = {
    /**
     * Log and display an error with different severity levels
     * @param {Error|string} error - The error to handle
     * @param {string} context - Context where the error occurred
     * @param {boolean} showUser - Whether to show error to user
     * @param {string} level - Error level (error, warning, info)
     */
    handle(error, context = '', showUser = true, level = 'error') {
      const errorMsg = error instanceof Error ? error.message : error;
      const fullMessage = context ? `${context}: ${errorMsg}` : errorMsg;
      
      // Log to console with appropriate level
      switch (level.toLowerCase()) {
        case 'warning':
          console.warn(fullMessage, error);
          break;
        case 'info':
          console.info(fullMessage, error);
          break;
        case 'error':
        default:
          console.error(fullMessage, error);
      }
      
      // Display to user if requested
      if (showUser) {
        this.showToUser(fullMessage, level);
      }
      
      return fullMessage;
    },
    
    /**
     * Show error message to user
     * @param {string} message - Message to display
     * @param {string} level - Error level
     */
    showToUser(message, level = 'error') {
      const errorElement = document.getElementById('errorMessage');
      if (!errorElement) return;
      
      // Set class based on level
      errorElement.className = 'error-message';
      errorElement.classList.add(`${level}-message`);
      
      // Set icon based on level
      let icon;
      switch (level.toLowerCase()) {
        case 'warning':
          icon = '<i class="fas fa-exclamation-triangle"></i> ';
          break;
        case 'info':
          icon = '<i class="fas fa-info-circle"></i> ';
          break;
        case 'error':
        default:
          icon = '<i class="fas fa-times-circle"></i> ';
      }
      
      errorElement.innerHTML = icon + message;
      errorElement.style.display = 'block';
      
      // Hide loading indicator if it's showing
      const loadingIndicator = document.getElementById('loadingIndicator');
      if (loadingIndicator) {
        loadingIndicator.style.display = 'none';
      }
    },
    
    /**
     * Clear any displayed error messages
     */
    clear() {
      const errorElement = document.getElementById('errorMessage');
      if (errorElement) {
        errorElement.textContent = '';
        errorElement.style.display = 'none';
        errorElement.className = 'error-message';
      }
    },
    
    /**
     * Create a user-friendly message for CSV parsing errors
     * @param {Error} error - The original error
     * @param {string} fileName - Name of the file being processed
     * @returns {string} - User-friendly error message
     */
    formatCSVError(error, fileName) {
      const msg = error.message || 'Unknown error';
      
      // Extract row number if available
      const rowMatch = msg.match(/row (\d+)/i);
      const rowNum = rowMatch ? rowMatch[1] : null;
      
      if (rowNum) {
        return `Error in ${fileName || 'CSV file'} at row ${rowNum}. Please check this row for problems such as missing commas, unmatched quotes, or incorrect delimiters.`;
      } else if (msg.includes('column count')) {
        return `The ${fileName || 'CSV file'} contains rows with incorrect number of columns. The application will try to repair minor issues, but please verify your data format.`;
      } else {
        return `Could not process ${fileName || 'CSV file'}: ${msg}. Please ensure the file is a valid CSV.`;
      }
    }
  };

  // Make ErrorHandler available globally
window.ErrorHandler = ErrorHandler;