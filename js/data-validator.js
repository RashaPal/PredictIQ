/**
 * Data Validator Module
 * Handles validation of CSV data to ensure it's properly formatted for processing
 */
class DataValidator {
    /**
     * Validates a CSV structure before processing
     * @param {Object} data - The parsed CSV data object
     * @returns {Object} - Validation result with isValid and errors
     */
    static validateCSVStructure(data) {
      const result = {
        isValid: true,
        errors: [],
        warnings: []
      };
      
      // Check if data exists and has expected structure
      if (!data || !data.headers || !data.records) {
        result.isValid = false;
        result.errors.push('Invalid CSV data structure');
        return result;
      }
      
      // Check if headers exist
      if (data.headers.length === 0) {
        result.isValid = false;
        result.errors.push('CSV file has no headers');
        return result;
      }
      
      // Check for required columns (case-insensitive partial match)
      const requiredColumns = [
        { name: 'Key', alternatives: ['Issue key', 'ID'] },
        { name: 'Issue Type', alternatives: ['Type', 'IssueType'] },
        { name: 'Status', alternatives: ['State', 'Current Status'] },
        { name: 'Summary', alternatives: ['Title', 'Name'] }
      ];
      
      const missingColumns = [];
      
      requiredColumns.forEach(col => {
        // Try to find column with exact or similar name
        const normalized = data.headers.map(h => h.toLowerCase());
        const found = normalized.some(header => 
          header === col.name.toLowerCase() || 
          col.alternatives.some(alt => header === alt.toLowerCase() || header.includes(alt.toLowerCase()))
        );
        
        if (!found) {
          missingColumns.push(col.name);
        }
      });
      
      if (missingColumns.length > 0) {
        result.isValid = false;
        result.errors.push(`CSV is missing required columns: ${missingColumns.join(', ')}`);
      }
      
      // Check for empty records
      if (data.records.length === 0) {
        result.isValid = false;
        result.errors.push('CSV file contains headers but no data rows');
      }
      
      // Check for potential data issues
      if (data.records.length > 0) {
        // Check for missing values in key columns
        const keyColumn = this.findHeaderMatch(data.headers, ['Key', 'Issue key', 'ID']);
        const missingKeys = data.records.filter(record => !record[keyColumn]).length;
        
        if (missingKeys > 0) {
          result.warnings.push(`Found ${missingKeys} rows with missing issue keys`);
        }
        
        // Check if we have any epics at all
        const typeColumn = this.findHeaderMatch(data.headers, ['Issue Type', 'Type', 'IssueType']);
        const epicCount = data.records.filter(record => 
          record[typeColumn] && record[typeColumn].toLowerCase() === 'epic'
        ).length;
        
        if (epicCount === 0) {
          result.warnings.push('No epics found in the CSV file. Please check that your CSV contains records with "Epic" issue type.');
        }
      }
      
      return result;
    }
    
    /**
     * Find a matching header from a list of possible names
     * @param {Array} headers - Available headers
     * @param {Array} possibilities - Possible header names
     * @returns {string|null} - Found header or null
     */
    static findHeaderMatch(headers, possibilities) {
      const normalizedHeaders = headers.map(h => h.toLowerCase());
      
      for (const name of possibilities) {
        const normalizedName = name.toLowerCase();
        const exactIndex = normalizedHeaders.indexOf(normalizedName);
        
        if (exactIndex > -1) {
          return headers[exactIndex];
        }
        
        // Try partial matches
        for (let i = 0; i < normalizedHeaders.length; i++) {
          if (normalizedHeaders[i].includes(normalizedName)) {
            return headers[i];
          }
        }
      }
      
      return null;
    }
    
    /**
     * Validate time data for consistency
     * @param {Object} timeData - Time data from CSV
     * @param {Array} epics - Processed epic data
     * @returns {Object} - Validation results
     */
    static validateTimeData(timeData, epics) {
      const result = {
        isValid: true,
        warnings: []
      };
      
      if (!timeData || !timeData.records || timeData.records.length === 0) {
        result.warnings.push('No time data records found');
        return result;
      }
      
      // Check if we have a key column
      const keyColumn = this.findHeaderMatch(timeData.headers, ['Key', 'Issue key', 'ID']);
      if (!keyColumn) {
        result.warnings.push('Time data CSV is missing a key/ID column');
        result.isValid = false;
        return result;
      }
      
      // Check for matching keys
      const timeKeys = new Set(timeData.records.map(record => record[keyColumn]));
      const epicKeys = new Set(epics.map(epic => epic.id));
      
      let matchCount = 0;
      epicKeys.forEach(key => {
        if (timeKeys.has(key)) matchCount++;
      });
      
      const matchPercentage = epicKeys.size > 0 ? (matchCount / epicKeys.size) * 100 : 0;
      
      if (matchPercentage < 50) {
        result.warnings.push(`Only ${matchPercentage.toFixed(1)}% of epics have matching time data`);
      }
      
      if (matchCount === 0) {
        result.warnings.push('No matching epic keys found in time data');
        result.isValid = false;
      }
      
      return result;
    }
    
    /**
     * Show file preview to help diagnose issues
     * @param {Object} data - Parsed CSV data
     * @param {HTMLElement} container - Container element for preview
     * @param {number} maxRows - Maximum number of rows to show
     */
    static showFilePreview(data, container, maxRows = 5) {
      if (!container || !data || !data.headers || !data.records) return;
      
      const preview = document.createElement('div');
      preview.className = 'file-preview';
      
      const table = document.createElement('table');
      
      // Create header row
      const thead = document.createElement('thead');
      const headerRow = document.createElement('tr');
      
      data.headers.forEach(header => {
        const th = document.createElement('th');
        th.textContent = header;
        headerRow.appendChild(th);
      });
      
      thead.appendChild(headerRow);
      table.appendChild(thead);
      
      // Create data rows
      const tbody = document.createElement('tbody');
      const rowsToShow = Math.min(data.records.length, maxRows);
      
      for (let i = 0; i < rowsToShow; i++) {
        const row = document.createElement('tr');
        
        data.headers.forEach(header => {
          const td = document.createElement('td');
          td.textContent = data.records[i][header] || '';
          row.appendChild(td);
        });
        
        tbody.appendChild(row);
      }
      
      table.appendChild(tbody);
      preview.appendChild(table);
      
      // Add note if showing limited rows
      if (data.records.length > maxRows) {
        const note = document.createElement('div');
        note.className = 'preview-note';
        note.textContent = `Showing ${maxRows} of ${data.records.length} rows`;
        preview.appendChild(note);
      }
      
      // Clear and append to container
      container.innerHTML = '';
      container.appendChild(preview);
      preview.style.display = 'block';
    }
  }

  // Make DataValidator available globally
window.DataValidator = DataValidator;