/**
 * CSV Parser Module - Simple version that works with Jira exports
 */
class CSVParser {
  /**
   * Parse a CSV file into structured data
   * @param {File} file - The CSV file to parse
   * @returns {Promise<Object>} - Object with headers and records
   */
  static async parseFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = e => {
        try {
          const lines = e.target.result.split('\n').filter(l => l.trim());
          const headers = this.parseCSVLine(lines[0]);
          const records = lines.slice(1).map(line => {
            const values = this.parseCSVLine(line);
            const record = {};
            headers.forEach((header, i) => record[header] = values[i] || '');
            return record;
          });
          resolve({ headers, records });
        } catch (error) {
          reject(error);
        }
      };
      
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsText(file);
    });
  }
  
  /**
   * Parse a single CSV line
   * @param {string} line - CSV line to parse
   * @returns {Array<string>} - Array of field values
   */
  static parseCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;
    
    for (const char of line) {
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current);
        current = '';
      } else {
        current += char;
      }
    }
    
    result.push(current);
    return result.map(f => f.trim().replace(/^"|"$/g, ''));
  }
}

// Make CSVParser available globally
window.CSVParser = CSVParser;