/**
 * Main application controller for Jira Epic Analyzer
 * With improved error handling and data validation
 * Enhanced with hierarchical data processing support
 */

class JiraEpicAnalyzer {
  constructor() {
    this.uiController = new UIController();
    this.errorHandler = ErrorHandler; // Store reference to ErrorHandler
    this.epicsData = null; // Store epics data for reanalysis
    this.timeData = null; // Store time data for reanalysis
    this.mainData = null; // Store main data for reanalysis
    this.childIssuesData = null; // Store child issues data
    this.initialize();
  }
  
  /**
   * Initialize the application
   */
  initialize() {
    // Set up analyze button click handler
    document.getElementById('analyzeBtn').addEventListener('click', async () => {
      await this.analyzeData();
    });
    
    // Set up reset button handler (delegating to UI controller)
    document.getElementById('resetBtn').addEventListener('click', () => {
      this.uiController.resetForm();
    });
    
    // Initialize tooltips and other UI elements
    this.initializeUIHelpers();
  }
  
  /**
   * Set up UI helper elements
   */
  initializeUIHelpers() {
    // Add SLA info tooltips
    const slaItems = document.querySelectorAll('.sla-item');
    slaItems.forEach(item => {
      const label = item.querySelector('.sla-label').textContent;
      const value = item.querySelector('.sla-value').textContent;
      item.setAttribute('title', `${label} ${value}`);
    });
  }
  
  /**
   * Process and analyze the uploaded CSV data
   */
  async analyzeData() {
    // Clear previous errors and show loading
    ErrorHandler.clear();
    
    // Get file inputs
    const mainFile = document.getElementById('mainCsvFile').files[0];
    const timeFile = document.getElementById('timeCsvFile').files[0];
    
    // Validate main file before showing loading indicator
    if (!mainFile) {
      ErrorHandler.handle(
        'Please upload a main Jira CSV file with epics data before analyzing.',
        'File Required', true, 'info'
      );
      
      // Highlight the file input to draw attention
      const fileInput = document.getElementById('mainCsvFile');
      fileInput.classList.add('highlight-required');
      setTimeout(() => {
        fileInput.classList.remove('highlight-required');
      }, 3000);
      
      return; // Exit the function early
    }
    
    // Show loading only after validation passes
    Utils.showLoading();
    
    try {
      // Show info message about processing
      const totalSize = (mainFile.size + (timeFile ? timeFile.size : 0)) / (1024 * 1024);
      if (totalSize > 5) {
        ErrorHandler.handle(
          `Processing ${totalSize.toFixed(1)}MB of data. This might take a moment...`, 
          '', true, 'info'
        );
      }
      
      // Parse CSV files with improved error handling
      let mainData, timeData;
      
      try {
        mainData = await CSVParser.parseFile(mainFile);
        ErrorHandler.clear(); // Clear info message if successful

         // Log parsed data info for debugging
         console.log(`Parsed main CSV: ${mainData.headers.length} columns, ${mainData.records.length} rows`);
        
      } catch (error) {
        throw new Error(ErrorHandler.formatCSVError(error, mainFile.name));
      }
      
      if (timeFile) {
        try {
          timeData = await CSVParser.parseFile(timeFile);
        } catch (error) {
          ErrorHandler.handle(
            ErrorHandler.formatCSVError(error, timeFile.name),
            'Time CSV Parse Error', true, 'warning'
          );
          // Continue without time data instead of failing completely
          timeData = null;
        }
      } else {
        timeData = null;
      }
      
      // Validate parsed data
      this.validateData(mainData);
      
      // Store data for potential reanalysis
      this.mainData = mainData;
      this.timeData = timeData;
      
      // Process CSV data with hierarchical support
      const processedData = DataProcessor.processMainCSV(mainData);
      // Check if the returned data has the expected format
      if (!processedData || !processedData.epics) {
        throw new Error('Failed to process epic data. Invalid data structure returned.');
      }
      
      const { epics, childIssues } = processedData;
      
      // Store child issues data
      this.childIssuesData = childIssues;
      
      // Display warning if no epics found
      if (!epics || epics.length === 0) {
        ErrorHandler.handle(
          'No epics found in the uploaded CSV file. Please check that your CSV contains records with "Epic" issue type.',
          '', true, 'warning'
        );
        Utils.hideLoading();
        return;
      }
      
      // Process time data if available
      let timeMap = new Map();
      try {
        if (timeData) {
          timeMap = DataProcessor.processTimeCSV(timeData);
        }
      } catch (error) {
        ErrorHandler.handle(
          `Error processing time data: ${error.message}. Continuing without time information.`,
          'Time Data Warning', true, 'warning'
        );
      }
      
      // Merge and analyze data
      let mergedEpics, metrics;
      try {
        mergedEpics = DataProcessor.mergeEpicData(epics, timeMap);
        
        if (!mergedEpics || mergedEpics.length === 0) {
          throw new Error('Failed to merge epic data. No epics were returned.');
        }
        
        metrics = DataProcessor.calculateMetrics(mergedEpics);
        
        if (!metrics || !metrics.overall) {
          throw new Error('Failed to calculate metrics. Invalid metrics structure returned.');
        }
      } catch (error) {
        throw new Error(`Error analyzing data: ${error.message}`);
      }
      
      // Store epics data for reanalysis
      this.epicsData = mergedEpics;
      
      // Display results
      this.uiController.displayResults(mergedEpics, metrics);
      
      // Show success message with counts
      const childIssuesCount = childIssues ? childIssues.length : 0;
      ErrorHandler.handle(
        `Successfully analyzed ${epics.length} epics and ${childIssuesCount} child issues${timeData ? ' with time tracking data' : ''}.`,
        '', true, 'info'
      );
      
    } catch (error) {
      ErrorHandler.handle(error, 'Analysis Error');
      console.error('Analysis error:', error);
    } finally {
      Utils.hideLoading();
    }
  }
  
  /**
   * Validate parsed CSV data
   * @param {Object} data - Parsed CSV data
   * @throws {Error} - If data is invalid
   */
  validateData(data) {
    // Check if data exists and has expected structure
    if (!data || !data.headers || !data.records) {
      throw new Error('Invalid CSV data structure.');
    }
    
    // Check if we have headers
    if (data.headers.length === 0) {
      throw new Error('CSV file has no headers.');
    }
    
    // Check for minimum required columns
    const requiredColumns = ['Key', 'Issue Type', 'Status', 'Summary'];
    const missingColumns = [];
    
    requiredColumns.forEach(col => {
      // Try to find column with similar name
      const found = data.headers.some(header => 
        header.toLowerCase().includes(col.toLowerCase())
      );
      
      if (!found) {
        missingColumns.push(col);
      }
    });
    
    if (missingColumns.length > 0) {
      throw new Error(`CSV is missing required columns: ${missingColumns.join(', ')}`);
    }
    
    // Check for parent-child relationship columns
    const epicLinkCol = data.headers.some(header => 
      header.toLowerCase().includes('epic link') || header.toLowerCase().includes('parent epic')
    );
    
    const parentLinkCol = data.headers.some(header => 
      header.toLowerCase().includes('parent') || header.toLowerCase().includes('parent link')
    );
    
    if (!epicLinkCol && !parentLinkCol) {
      ErrorHandler.handle(
        'No Epic Link or Parent Link column found. Child issues will not be linked to epics.',
        'Field Warning', true, 'warning'
      );
    }
  }
  
  /**
   * Reanalyze data with new SLA settings
   */
  reanalyzeWithNewSLA() {
    if (!this.mainData) {
      return; // No data to reanalyze
    }
    
    try {
      // Process CSV data with hierarchical support
      const processedData = DataProcessor.processMainCSV(this.mainData);
      // Check if the returned data has the expected format
      if (!processedData || !processedData.epics) {
        throw new Error('Failed to process epic data. Invalid data structure returned.');
      }
      
      const { epics } = processedData;
      
      // Process time data if available
      let timeMap = new Map();
      if (this.timeData) {
        timeMap = DataProcessor.processTimeCSV(this.timeData);
      }
      
      // Merge and analyze data with new SLA settings
      const mergedEpics = DataProcessor.mergeEpicData(epics, timeMap);
      const metrics = DataProcessor.calculateMetrics(mergedEpics);
      
      // Store epics data for reanalysis
      this.epicsData = mergedEpics;
      
      // Display results
      this.uiController.displayResults(mergedEpics, metrics);
      
      // Show success message
      ErrorHandler.handle(
        'Data reanalyzed with updated SLA settings.',
        '', true, 'info'
      );
      
    } catch (error) {
      ErrorHandler.handle(error, 'Reanalysis Error');
      console.error('Reanalysis error:', error);
    }
  }
}

// Initialize the application when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  // Make sure ErrorHandler is defined before initializing the app
  if (typeof ErrorHandler === 'undefined') {
    console.error('ErrorHandler module is not loaded. Please include error-handler.js before app.js');
    
    // Display error to user
    const errorElement = document.getElementById('errorMessage');
    if (errorElement) {
      errorElement.innerHTML = '<i class="fas fa-times-circle"></i> Application initialization error: Missing ErrorHandler module';
      errorElement.style.display = 'block';
      errorElement.className = 'error-message error-message';
    }
    return;
  }
  
  // Also check for other required modules
  const requiredModules = ['UIController', 'CSVParser', 'DataProcessor', 'Utils', 'SLAConfig'];
  const missingModules = requiredModules.filter(module => typeof window[module] === 'undefined');
  
  if (missingModules.length > 0) {
    console.error(`Missing required modules: ${missingModules.join(', ')}`);
    
    // Display error to user
    const errorElement = document.getElementById('errorMessage');
    if (errorElement) {
      errorElement.innerHTML = `<i class="fas fa-times-circle"></i> Application initialization error: Missing modules (${missingModules.join(', ')})`;
      errorElement.style.display = 'block';
      errorElement.className = 'error-message error-message';
    }
    return;
  }
  
  // Initialize SLA configuration
  window.slaConfig = new SLAConfig();
  
  // Initialize main application
  window.app = new JiraEpicAnalyzer();
});