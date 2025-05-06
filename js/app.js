/**
 * Main application controller for Jira Epic Analyzer
 * With improved error handling and data validation
 * Enhanced with hierarchical data processing support
 * Added embedded demo data functionality
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
    
    // Set up demo data button click handler
    document.getElementById('demoDataBtn').addEventListener('click', () => {
      this.loadDemoData();
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
   * Load and process demo data directly from embedded data
  
  loadDemoData() {
    // Clear previous errors and show loading
    ErrorHandler.clear();
    Utils.showLoading();
    
    try {
      // Show info message about processing
      ErrorHandler.handle(
        "Loading demo data...", 
        '', true, 'info'
      );
      
      // Create demo data directly
      const mainData = this.createDemoMainData();
      const timeData = this.createDemoTimeData();
      
      // Validate and store the parsed data
      this.validateData(mainData);
      
      // Store data for potential reanalysis
      this.mainData = mainData;
      this.timeData = timeData;
      
      // Update UI to show the file names
      document.getElementById('mainFileName').textContent = 'Demo Epic Data (embedded)';
      document.getElementById('timeFileName').textContent = 'Demo Time Data (embedded)';
      
      // Process and display data
      const processedData = DataProcessor.processMainCSV(mainData);
      if (!processedData || !processedData.epics) {
        throw new Error('Failed to process demo epic data. Invalid data structure returned.');
      }
      
      const { epics, childIssues } = processedData;
      this.childIssuesData = childIssues;
      
      // Display warning if no epics found
      if (!epics || epics.length === 0) {
        ErrorHandler.handle(
          'No epics found in the demo data.',
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
          `Error processing demo time data: ${error.message}. Continuing without time information.`,
          'Time Data Warning', true, 'warning'
        );
      }
      
      // Merge and analyze data
      const mergedEpics = DataProcessor.mergeEpicData(epics, timeMap);
      const metrics = DataProcessor.calculateMetrics(mergedEpics);
      
      // Store epics data for reanalysis
      this.epicsData = mergedEpics;
      
      // Display results
      this.uiController.displayResults(mergedEpics, metrics);
      
      // Show success message with counts
      const childIssuesCount = childIssues ? childIssues.length : 0;
      ErrorHandler.handle(
        `Successfully loaded demo data with ${epics.length} epics and ${childIssuesCount} child issues.`,
        '', true, 'info'
      );
      
    } catch (error) {
      ErrorHandler.handle(error, 'Demo Data Error');
      console.error('Demo data error:', error);
    } finally {
      Utils.hideLoading();
    }
  }
   */
  
  /**
   * Creates demo data for main Jira export directly as an object
   * @returns {Object} - Object with headers and records
   */
  createDemoMainData() {
    // Define the headers
    const headers = [
      'Key', 'Summary', 'Issue Type', 'Status', 'Epic Link', 'Parent', 
      'Story Points', 'Sprint', 'Components', 'Time in Status (days)'
    ];
    
    // Define the records
    const records = [
      {
        'Key': 'EPIC-100',
        'Summary': 'Customer Dashboard Redesign',
        'Issue Type': 'Epic',
        'Status': 'In Progress',
        'Epic Link': '',
        'Parent': '',
        'Story Points': '',
        'Sprint': 'Sprint 5',
        'Components': 'Frontend',
        'Time in Status (days)': '15'
      },
      {
        'Key': 'EPIC-101',
        'Summary': 'API Gateway Implementation',
        'Issue Type': 'Epic',
        'Status': 'Ready to Develop',
        'Epic Link': '',
        'Parent': '',
        'Story Points': '',
        'Sprint': 'Sprint 6',
        'Components': 'Backend',
        'Time in Status (days)': '5'
      },
      {
        'Key': 'EPIC-102',
        'Summary': 'Mobile App Authentication',
        'Issue Type': 'Epic',
        'Status': 'Researching',
        'Epic Link': '',
        'Parent': '',
        'Story Points': '',
        'Sprint': 'Sprint 5',
        'Components': 'Security',
        'Time in Status (days)': '8'
      },
      {
        'Key': 'EPIC-103',
        'Summary': 'Analytics Dashboard',
        'Issue Type': 'Epic',
        'Status': 'To Do',
        'Epic Link': '',
        'Parent': '',
        'Story Points': '',
        'Sprint': 'Sprint 7',
        'Components': 'Analytics',
        'Time in Status (days)': '2'
      },
      {
        'Key': 'EPIC-104',
        'Summary': 'Payment Processing Integration',
        'Issue Type': 'Epic',
        'Status': 'Released',
        'Epic Link': '',
        'Parent': '',
        'Story Points': '',
        'Sprint': 'Sprint 4',
        'Components': 'Payments',
        'Time in Status (days)': '45'
      },
      {
        'Key': 'EPIC-105',
        'Summary': 'User Profile Management',
        'Issue Type': 'Epic',
        'Status': 'Ready for Story Refinement',
        'Epic Link': '',
        'Parent': '',
        'Story Points': '',
        'Sprint': 'Sprint 6',
        'Components': 'User Management',
        'Time in Status (days)': '12'
      },
      {
        'Key': 'EPIC-106',
        'Summary': 'Search Functionality Improvement',
        'Issue Type': 'Epic',
        'Status': 'Paused',
        'Epic Link': '',
        'Parent': '',
        'Story Points': '',
        'Sprint': 'Sprint 7',
        'Components': 'Search',
        'Time in Status (days)': '20'
      },
      {
        'Key': 'EPIC-107',
        'Summary': 'Notification System',
        'Issue Type': 'Epic',
        'Status': 'Enabled',
        'Epic Link': '',
        'Parent': '',
        'Story Points': '',
        'Sprint': 'Sprint 5',
        'Components': 'Communications',
        'Time in Status (days)': '7'
      },
      {
        'Key': 'EPIC-108',
        'Summary': 'Performance Optimization',
        'Issue Type': 'Epic',
        'Status': 'Will not implement',
        'Epic Link': '',
        'Parent': '',
        'Story Points': '',
        'Sprint': 'Sprint 6',
        'Components': 'Infrastructure',
        'Time in Status (days)': '0'
      },
      {
        'Key': 'EPIC-109',
        'Summary': 'Data Migration Tools',
        'Issue Type': 'Epic',
        'Status': 'In Progress',
        'Epic Link': '',
        'Parent': '',
        'Story Points': '',
        'Sprint': 'Sprint 7',
        'Components': 'Data',
        'Time in Status (days)': '10'
      },
      {
        'Key': 'TASK-201',
        'Summary': 'Create UI wireframes',
        'Issue Type': 'Task',
        'Status': 'Done',
        'Epic Link': 'EPIC-100',
        'Parent': '',
        'Story Points': '',
        'Sprint': 'Sprint 5',
        'Components': 'Frontend',
        'Time in Status (days)': '5'
      },
      {
        'Key': 'TASK-202',
        'Summary': 'Implement dashboard widgets',
        'Issue Type': 'Task',
        'Status': 'In Progress',
        'Epic Link': 'EPIC-100',
        'Parent': '',
        'Story Points': '',
        'Sprint': 'Sprint 5',
        'Components': 'Frontend',
        'Time in Status (days)': '3'
      },
      {
        'Key': 'TASK-203',
        'Summary': 'Design RESTful API endpoints',
        'Issue Type': 'Task',
        'Status': 'Done',
        'Epic Link': 'EPIC-101',
        'Parent': '',
        'Story Points': '',
        'Sprint': 'Sprint 6',
        'Components': 'Backend',
        'Time in Status (days)': '4'
      },
      {
        'Key': 'TASK-204',
        'Summary': 'Implement rate limiting',
        'Issue Type': 'Task',
        'Status': 'To Do',
        'Epic Link': 'EPIC-101',
        'Parent': '',
        'Story Points': '',
        'Sprint': 'Sprint 6',
        'Components': 'Backend',
        'Time in Status (days)': '0'
      },
      {
        'Key': 'TASK-205',
        'Summary': 'Implement OAuth flow',
        'Issue Type': 'Task',
        'Status': 'In Progress',
        'Epic Link': 'EPIC-102',
        'Parent': '',
        'Story Points': '',
        'Sprint': 'Sprint 5',
        'Components': 'Security',
        'Time in Status (days)': '6'
      }
    ];
    
    return { headers, records };
  }
  
  /**
   * Creates demo time data directly as an object
   * @returns {Object} - Object with headers and records
   */
  createDemoTimeData() {
    // Define the headers
    const headers = [
      'Key', 'Status', 'Started', 'Ended', 'Duration (days)'
    ];
    
    // Define the records
    const records = [
      {
        'Key': 'EPIC-100',
        'Status': 'To Do',
        'Started': '2025-01-01',
        'Ended': '2025-01-10',
        'Duration (days)': '10'
      },
      {
        'Key': 'EPIC-100',
        'Status': 'Researching',
        'Started': '2025-01-11',
        'Ended': '2025-01-20',
        'Duration (days)': '10'
      },
      {
        'Key': 'EPIC-100',
        'Status': 'In Progress',
        'Started': '2025-01-21',
        'Ended': '',
        'Duration (days)': '15'
      },
      {
        'Key': 'EPIC-101',
        'Status': 'To Do',
        'Started': '2025-01-05',
        'Ended': '2025-01-10',
        'Duration (days)': '5'
      },
      {
        'Key': 'EPIC-101',
        'Status': 'Ready to Develop',
        'Started': '2025-01-11',
        'Ended': '',
        'Duration (days)': '5'
      },
      {
        'Key': 'EPIC-102',
        'Status': 'To Do',
        'Started': '2025-01-03',
        'Ended': '2025-01-08',
        'Duration (days)': '5'
      },
      {
        'Key': 'EPIC-102',
        'Status': 'Researching',
        'Started': '2025-01-09',
        'Ended': '',
        'Duration (days)': '8'
      },
      {
        'Key': 'EPIC-103',
        'Status': 'To Do',
        'Started': '2025-01-15',
        'Ended': '',
        'Duration (days)': '2'
      },
      {
        'Key': 'EPIC-104',
        'Status': 'To Do',
        'Started': '2025-01-01',
        'Ended': '2025-01-05',
        'Duration (days)': '5'
      },
      {
        'Key': 'EPIC-104',
        'Status': 'Researching',
        'Started': '2025-01-06',
        'Ended': '2025-01-10',
        'Duration (days)': '5'
      },
      {
        'Key': 'EPIC-104',
        'Status': 'Ready for Story Refinement',
        'Started': '2025-01-11',
        'Ended': '2025-01-15',
        'Duration (days)': '5'
      },
      {
        'Key': 'EPIC-104',
        'Status': 'Ready to Develop',
        'Started': '2025-01-16',
        'Ended': '2025-01-25',
        'Duration (days)': '10'
      },
      {
        'Key': 'EPIC-104',
        'Status': 'In Progress',
        'Started': '2025-01-26',
        'Ended': '2025-02-10',
        'Duration (days)': '15'
      },
      {
        'Key': 'EPIC-104',
        'Status': 'Released',
        'Started': '2025-02-11',
        'Ended': '',
        'Duration (days)': '45'
      },
      {
        'Key': 'EPIC-105',
        'Status': 'To Do',
        'Started': '2025-01-08',
        'Ended': '2025-01-15',
        'Duration (days)': '8'
      },
      {
        'Key': 'EPIC-105',
        'Status': 'Researching',
        'Started': '2025-01-16',
        'Ended': '2025-01-25',
        'Duration (days)': '10'
      },
      {
        'Key': 'EPIC-105',
        'Status': 'Ready for Story Refinement',
        'Started': '2025-01-26',
        'Ended': '',
        'Duration (days)': '12'
      }
    ];
    
    return { headers, records };
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
  /**
 * Load and process demo data from the repository
 */
async loadDemoData() {
  // Clear previous errors and show loading
  ErrorHandler.clear();
  Utils.showLoading();
  
  try {
    // Show info message about processing
    ErrorHandler.handle(
      "Loading demo data from sample files...", 
      '', true, 'info'
    );
    
    // Instead of fetching from absolute paths, use relative paths
    const mainFileUrl = './sampledata/Epicanalyzer_Export_AllFields_Obfuscated.csv';
    const timeFileUrl = './sampledata/Epicanalyzer_TimeInStatus_Obfuscated.csv';
    
    let mainResponse, timeResponse;
    
    try {
      // Use XMLHttpRequest instead of fetch for better compatibility
      mainResponse = await this.loadFileWithXHR(mainFileUrl);
      if (!mainResponse) {
        throw new Error('Failed to load main demo file');
      }
    } catch (error) {
      throw new Error(`Error fetching main demo file: ${error.message}`);
    }
    
    try {
      timeResponse = await this.loadFileWithXHR(timeFileUrl);
      if (!timeResponse) {
        throw new Error('Failed to load time demo file');
      }
    } catch (error) {
      ErrorHandler.handle(
        `Error fetching time demo file: ${error.message}. Continuing without time information.`,
        'Demo Data Warning', true, 'warning'
      );
      timeResponse = null;
    }
    
    // Create File objects from the loaded content
    const mainFileBlob = new Blob([mainResponse], { type: 'text/csv' });
    const mainFile = new File([mainFileBlob], "Epicanalyzer_Export_AllFields_Obfuscated.csv", { type: 'text/csv' });
    
    let timeFile = null;
    if (timeResponse) {
      const timeFileBlob = new Blob([timeResponse], { type: 'text/csv' });
      timeFile = new File([timeFileBlob], "Epicanalyzer_TimeInStatus_Obfuscated.csv", { type: 'text/csv' });
    }
    
    // Update UI to show the file names
    document.getElementById('mainFileName').textContent = mainFile.name;
    document.getElementById('timeFileName').textContent = timeFile ? timeFile.name : 'No file selected';
    
    // Now we use the same analysis path as for uploaded files
    
    // Parse the files using the same CSVParser
    let mainData, timeData;
    
    try {
      mainData = await CSVParser.parseFile(mainFile);
      ErrorHandler.clear();
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
        'No epics found in the demo file.',
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
      `Successfully loaded demo data with ${epics.length} epics and ${childIssuesCount} child issues.`,
      '', true, 'info'
    );
    
  } catch (error) {
    ErrorHandler.handle(error, 'Demo Data Error');
    console.error('Demo data error:', error);
  } finally {
    Utils.hideLoading();
  }
}

/**
 * Helper method to load file using XMLHttpRequest
 * This avoids issues with fetch in some environments
 * @param {string} url - URL of the file to load
 * @returns {Promise<string>} - Promise resolving to file contents
 */
loadFileWithXHR(url) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('GET', url, true);
    xhr.responseType = 'text';
    
    xhr.onload = function() {
      if (xhr.status === 200) {
        resolve(xhr.responseText);
      } else {
        reject(new Error(`Status ${xhr.status}: ${xhr.statusText}`));
      }
    };
    
    xhr.onerror = function() {
      reject(new Error('Network error occurred'));
    };
    
    xhr.send();
  });
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
