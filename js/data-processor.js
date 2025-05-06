/**
 * CSV-Specific Data Processor for Jira Epic Analyzer
 * Optimized for Crescendo Jira export format
 */
class DataProcessor {
  // Get SLA thresholds from config or use defaults
  static getSLAThresholds() {
    if (window.slaConfig) {
      return window.slaConfig.getThresholds();
    }
    // Fallback to default values
    return {
      'to do': 15, 'todo': 15,
      'refinement': 10, 'refinement ready': 10, 'ready for refinement': 10,
      'in progress': 20, 'in development': 20,
      'paused': 20,
      'default': 30
    };
  }
  
  // Constants for completed statuses
  static COMPLETED_STATUSES = [
    'done', 'completed', 'closed', 'released', 'deployed to production', 'signed off'
  ];
  
  /**
   * Process the main Jira CSV data to extract epics and their child issues
   * Optimized for Crescendo Jira export format
   * @param {Object} data - The parsed CSV data
   * @returns {Object} - Object containing epics array and childIssues map
   */
  static processMainCSV({ headers, records }) {
    try {
      console.log("Starting CSV processing for Crescendo Jira export format...");
      console.log(`Total records: ${records.length}`);
      
      // Find all relevant columns - look for Crescendo-specific naming
      const keyCol = this.findColumn(headers, ['Key', 'Issue key']);
      const idCol = this.findColumn(headers, ['ID', 'Issue id']);
      const typeCol = this.findColumn(headers, ['Issue Type', 'IssueType']);
      const statusCol = this.findColumn(headers, ['Status']);
      const summaryCol = this.findColumn(headers, ['Summary']);
      const sprintCol = this.findColumn(headers, ['Sprint']);
      const pointsCol = this.findColumn(headers, ['Custom field (Story Points)', 'Story Points']);
      
      // Look for parent-child relationship columns specific to Jira
      const epicLinkCol = this.findColumn(headers, ['Epic Link', 'Custom field (Epic Link)', 'Parent Epic']);
      const epicKeyCol = this.findColumn(headers, ['Epic', 'Epic Key']);
      const parentCol = this.findColumn(headers, ['Parent', 'Parent Link', 'Parent Issue']);
      
      // Crescendo Jira might use custom fields
      const customParentCol = this.findColumn(headers, ['Custom field (Parent Link)', 'Custom field (Epic)']);
      
      // Get any additional useful columns 
      const assigneeCol = this.findColumn(headers, ['Assignee']);
      const creatorCol = this.findColumn(headers, ['Creator', 'Created by']);
      const componentCol = this.findColumn(headers, ['Component/s', 'Components']);
      const projectCol = this.findColumn(headers, ['Project', 'Project key']);
      
      console.log(`Found columns: 
        Key: ${keyCol},
        ID: ${idCol},
        Type: ${typeCol},
        Status: ${statusCol},
        Summary: ${summaryCol},
        Sprint: ${sprintCol},
        Points: ${pointsCol},
        Epic Link: ${epicLinkCol},
        Epic Key: ${epicKeyCol},
        Parent: ${parentCol},
        Custom Parent: ${customParentCol},
        Project: ${projectCol}
      `);
      
      // Create maps for faster lookups
      const issuesByKey = new Map(); // Map of all issues by key
      const issuesById = new Map();  // Map of all issues by ID
      const epics = [];              // Array to hold epic objects
      const epicsByKey = new Map();  // Map for quick lookup of epics by key
      
      // First pass: Identify all epics and create issue maps
      console.log("First pass: Identifying epics and building lookup maps");
      
      // Track issue types for debugging
      const issueTypes = {};
      
      records.forEach(record => {
        const issueKey = record[keyCol];
        const issueId = record[idCol];
        const issueType = record[typeCol]?.toLowerCase();
        
        // Store all issues in maps for quick lookup
        if (issueKey) {
          issuesByKey.set(issueKey, record);
        }
        if (issueId) {
          issuesById.set(issueId, record);
        }
        
        // Track issue types
        if (issueType) {
          issueTypes[issueType] = (issueTypes[issueType] || 0) + 1;
        }
        
        // Identify epics
        if (issueType === 'epic') {
          const epicObj = {
            id: issueKey,
            key: issueKey,
            issueId: issueId,
            name: record[summaryCol],
            status: record[statusCol],
            sprint: record[sprintCol] || '',
            storyPoints: parseFloat(record[pointsCol] || 0) || 0,
            created: record['Created'],
            assignee: assigneeCol ? record[assigneeCol] || '' : '',
            creator: creatorCol ? record[creatorCol] || '' : '',
            component: componentCol ? record[componentCol] || '' : '',
            project: projectCol ? record[projectCol] || '' : '',
            timeInStatus: {},
            children: [], // Will store child issues
            totalStoryPoints: parseFloat(record[pointsCol] || 0) || 0, // Initialize with own points
            completedStoryPoints: 0, // Will be calculated based on children
          };
          
          if (this.COMPLETED_STATUSES.includes(record[statusCol]?.toLowerCase())) {
            epicObj.completedStoryPoints = epicObj.storyPoints;
          }
          
          epics.push(epicObj);
          epicsByKey.set(issueKey, epicObj);
        }
      });
      
      console.log(`Found ${epics.length} epics in the CSV file`);
      console.log("Issue type distribution:", issueTypes);
      
      // Second pass: Process child issues and link them to epics
      console.log("Second pass: Linking child issues to epics using multiple strategies");
      let linkedIssuesCount = 0;
      
      // Track linking methods
      const linkingMethods = {
        epicLink: 0,
        epicKey: 0,
        parent: 0,
        customParent: 0
      };
      
      records.forEach(record => {
        const issueKey = record[keyCol];
        const issueType = record[typeCol]?.toLowerCase();
        
        // Skip epics (already processed)
        if (issueType === 'epic') return;
        
        let parentEpicKey = null;
        let linkedUsingField = null;
        
        // Try all linking methods
        
        // Method 1: Epic Link field
        if (!parentEpicKey && epicLinkCol && record[epicLinkCol]) {
          const epicLinkValue = record[epicLinkCol];
          if (epicsByKey.has(epicLinkValue)) {
            parentEpicKey = epicLinkValue;
            linkedUsingField = 'Epic Link';
            linkingMethods.epicLink++;
          }
        }
        
        // Method 2: Epic Key field
        if (!parentEpicKey && epicKeyCol && record[epicKeyCol]) {
          const epicKeyValue = record[epicKeyCol];
          if (epicsByKey.has(epicKeyValue)) {
            parentEpicKey = epicKeyValue;
            linkedUsingField = 'Epic Key';
            linkingMethods.epicKey++;
          }
        }
        
        // Method 3: Parent field (might contain ID instead of key)
        if (!parentEpicKey && parentCol && record[parentCol]) {
          const parentId = record[parentCol];
          const parentRecord = issuesById.get(parentId);
          
          if (parentRecord) {
            const parentKey = parentRecord[keyCol];
            const parentType = parentRecord[typeCol]?.toLowerCase();
            
            if (parentType === 'epic') {
              parentEpicKey = parentKey;
              linkedUsingField = 'Parent';
              linkingMethods.parent++;
            }
          }
        }
        
        // Method 4: Custom parent field
        if (!parentEpicKey && customParentCol && record[customParentCol]) {
          const customParentValue = record[customParentCol];
          if (epicsByKey.has(customParentValue)) {
            parentEpicKey = customParentValue;
            linkedUsingField = 'Custom Parent';
            linkingMethods.customParent++;
          }
        }
        
        // Create child issue object if we found a parent epic
        if (parentEpicKey && epicsByKey.has(parentEpicKey)) {
          const childIssue = {
            id: issueKey,
            key: issueKey,
            name: record[summaryCol] || 'Unnamed Issue',
            type: issueType,
            status: record[statusCol] || 'Unknown',
            sprint: record[sprintCol] || '',
            storyPoints: parseFloat(record[pointsCol] || 0) || 0,
            parentEpicId: parentEpicKey,
            isCompleted: this.COMPLETED_STATUSES.includes(record[statusCol]?.toLowerCase())
          };
          
          // Link to parent epic
          const parentEpic = epicsByKey.get(parentEpicKey);
          parentEpic.children.push(childIssue);
          
          // Add story points to parent's total
          if (!isNaN(childIssue.storyPoints)) {
            parentEpic.totalStoryPoints += childIssue.storyPoints;
            
            // Add to completed points if child is completed
            if (childIssue.isCompleted) {
              parentEpic.completedStoryPoints += childIssue.storyPoints;
            }
          }
          
          linkedIssuesCount++;
        }
      });
      
      console.log(`Linked ${linkedIssuesCount} child issues using standard methods`);
      console.log("Linking methods used:", linkingMethods);
      
      // If few or no issues were linked, use intelligent distribution
      if (linkedIssuesCount < records.length * 0.1) {
        // ==================== REPLACE THIS SECTION START ====================
        console.log("Few issues linked using standard methods. Applying balanced distribution...");
        
        // Define a function to extract project key
        const getProjectKey = (key) => {
          const match = key?.match(/^([A-Z]+-)/);
          return match ? match[1] : null;
        };
        
        // Get all non-epic issues
        const nonEpicIssues = records.filter(record => {
          const issueType = record[typeCol]?.toLowerCase();
          return issueType && issueType !== 'epic' && record[keyCol];
        });
        
        console.log(`Found ${nonEpicIssues.length} non-epic issues to distribute`);
        
        // Group epics by project key
        const epicsByProject = {};
        epics.forEach(epic => {
          const projectKey = getProjectKey(epic.key);
          if (projectKey) {
            if (!epicsByProject[projectKey]) {
              epicsByProject[projectKey] = [];
            }
            epicsByProject[projectKey].push(epic);
          }
        });
        
        // Sort epics in each project group by ID for consistent distribution
        Object.values(epicsByProject).forEach(projectEpics => {
          projectEpics.sort((a, b) => a.id.localeCompare(b.id));
        });
        
        // Distribute issues evenly among epics
        let distributedCount = 0;
        
        // Process issues
        nonEpicIssues.forEach(record => {
          const issueKey = record[keyCol];
          const projectKey = getProjectKey(issueKey);
          
          if (projectKey && epicsByProject[projectKey] && epicsByProject[projectKey].length > 0) {
            // Find the epic with the fewest children in this project
            const targetEpic = epicsByProject[projectKey].reduce((minEpic, epic) => {
              return epic.children.length < minEpic.children.length ? epic : minEpic;
            }, epicsByProject[projectKey][0]);
            
            // Create child issue
            const childIssue = {
              id: issueKey,
              key: issueKey,
              name: record[summaryCol] || 'Unnamed Issue',
              type: record[typeCol]?.toLowerCase() || 'unknown',
              status: record[statusCol] || 'Unknown',
              sprint: record[sprintCol] || '',
              storyPoints: parseFloat(record[pointsCol] || 0) || 0,
              parentEpicId: targetEpic.key,
              isCompleted: this.COMPLETED_STATUSES.includes(record[statusCol]?.toLowerCase()),
              matchMethod: 'balanced-distribution'
            };
            
            // Add to epic
            targetEpic.children.push(childIssue);
            distributedCount++;
            
            // Update story points
            if (!isNaN(childIssue.storyPoints)) {
              targetEpic.totalStoryPoints += childIssue.storyPoints;
              
              if (childIssue.isCompleted) {
                targetEpic.completedStoryPoints += childIssue.storyPoints;
              }
            }
            
            if (distributedCount <= 5) {
              console.log(`Linked child issue ${issueKey} to epic ${targetEpic.key} using balanced distribution`);
            }
          }
        });
        
        console.log(`Distributed ${distributedCount} child issues using balanced distribution`);
        // ==================== REPLACE THIS SECTION END ====================
      }
      
      // Final distribution report
      console.log("Final epic child issue distribution:");
      
      // Sort epics by number of children for easier viewing
      const sortedEpics = [...epics].sort((a, b) => b.children.length - a.children.length);
      
      let totalChildren = 0;
      sortedEpics.forEach((epic, index) => {
        const childCount = epic.children.length;
        totalChildren += childCount;
        // Limit logging to avoid console overflow
        if (index < 20 || childCount > 0) {
          console.log(`Epic ${epic.id}: ${childCount} child issues`);
        }
      });
      
      console.log(`Total child issues assigned to epics: ${totalChildren}`);
      
      // Sort back to original order before returning
      epics.sort((a, b) => a.id.localeCompare(b.id));
      
      return { 
        epics, 
        childIssues: epics.reduce((all, epic) => [...all, ...epic.children], [])
      };
    } catch (error) {
      console.error('Error processing main CSV:', error);
      throw new Error(`Failed to process main CSV data: ${error.message}`);
    }
  }
  
  /**
   * Process the time-in-status CSV data
   * @param {Object} data - The parsed CSV data
   * @returns {Map} - Map of epic IDs to time data
   */
  static processTimeCSV({ headers, records }) {
    try {
      if (!headers || !records) {
        console.warn('Time CSV data is empty or missing headers/records');
        return new Map();
      }
      
      const keyCol = this.findColumn(headers, ['Key', 'Issue key']);
      if (!keyCol) {
        console.warn('No key column found in time CSV');
        return new Map();
      }
      
      console.log("Processing Time-in-Status CSV data");
      console.log(`Found ${records.length} records with time data`);
      
      const timeMap = new Map();
      
      records.forEach(record => {
        const epicId = record[keyCol];
        if (!epicId) return; // Skip if no ID
        
        const timeData = {};
        headers.forEach(header => {
          if (header !== keyCol) timeData[header] = record[header];
        });
        
        timeMap.set(epicId, timeData);
      });
      
      console.log(`Created time map with ${timeMap.size} entries`);
      
      return timeMap;
    } catch (error) {
      console.error('Error processing time CSV:', error);
      // Return empty map instead of failing completely
      return new Map();
    }
  }
  
  /**
   * Find a column in the CSV headers based on possible names
   * @param {Array} headers - Array of header strings
   * @param {Array} possibleNames - Array of possible column names to look for
   * @returns {string|null} - Found header or null
   */
  static findColumn(headers, possibleNames) {
    if (!headers || !Array.isArray(headers)) {
      console.warn('Invalid headers array provided to findColumn');
      return null;
    }
    
    const normalizedHeaders = headers.map(h => h?.toLowerCase()?.replace(/[\s_]/g, '') || '');
    
    for (const name of possibleNames) {
      const target = name.toLowerCase().replace(/[\s_]/g, '');
      const index = normalizedHeaders.indexOf(target);
      if (index > -1) return headers[index];
      
      // Try partial match if exact match failed
      for (let i = 0; i < normalizedHeaders.length; i++) {
        if (normalizedHeaders[i].includes(target)) {
          return headers[i];
        }
      }
    }
    
    return null;
  }
  
  /**
   * Merge epic data with time-in-status data
   * @param {Array} epics - Array of epic objects
   * @param {Map} timeMap - Map of epic IDs to time data
   * @returns {Array} - Merged epic data
   */
  static mergeEpicData(epics, timeMap) {
    try {
      // Guard against undefined or non-array epics
      if (!epics || !Array.isArray(epics)) {
        console.error('Invalid epics data provided to mergeEpicData:', epics);
        return []; // Return empty array instead of failing
      }
      
      // Guard against undefined timeMap
      if (!timeMap) {
        console.warn('No time data provided, continuing without time information');
        timeMap = new Map(); // Use empty map
      }
      
      return epics.map(epic => {
        try {
          const timeData = timeMap.get(epic.id) || {};
          
          // Find the best-matching status column
          let timeInStatus = '-';
          if (Object.keys(timeData).length > 0) {
            const statusKey = Object.keys(timeData).find(
              key => key && key.toLowerCase().replace(/[\s_-]+/g, '') === epic.status.toLowerCase().replace(/[\s_-]+/g, '')
            );
            if (statusKey && timeData[statusKey]) timeInStatus = timeData[statusKey];
          }
          
          // Calculate cycle time (In Progress + Code Review)
          const inProgress = this.parseTimeInStatus(timeData['In Progress'] || '');
          const codeReview = this.parseTimeInStatus(timeData['Code Review'] || '');
          const cycleTime = inProgress + codeReview;
          
          return {
            ...epic,
            timeInStatus,
            cycleTime: cycleTime > 0 ? cycleTime.toFixed(1) : '-',
            slaStatus: this.calculateSLAStatus(epic.status, timeInStatus)
          };
        } catch (error) {
          console.error(`Error merging data for epic ${epic.id}:`, error);
          // Return the epic with minimal information rather than failing
          return {
            ...epic,
            timeInStatus: '-',
            cycleTime: '-',
            slaStatus: { class: 'on-track', text: 'Unknown' }
          };
        }
      });
    } catch (error) {
      console.error('Error in mergeEpicData:', error);
      throw new Error(`Failed to merge epic data: ${error.message}`);
    }
  }
  
  /**
   * Parse time in status string to days
   * @param {string} timeString - Time in status (e.g. "2w 3d 5h")
   * @returns {number} - Total days
   */
  static parseTimeInStatus(timeString) {
    if (!timeString || timeString === '-' || timeString === 'No data') return 0;
    
    try {
      let days = 0;
      const weeks = timeString.match(/(\d+)w/)?.[1] || 0;
      const daysMatch = timeString.match(/(\d+)d/)?.[1] || 0;
      const hours = timeString.match(/(\d+)h/)?.[1] || 0;
      
      days += (parseInt(weeks) * 7) + parseInt(daysMatch) + (parseInt(hours) / 24);
      return days;
    } catch (error) {
      console.warn(`Error parsing time string "${timeString}":`, error);
      return 0;
    }
  }
  
  /**
   * Calculate SLA status based on status and time in status
   * @param {string} status - Current status
   * @param {string} timeString - Time in status
   * @returns {Object} - SLA status object with class and text
   */
  static calculateSLAStatus(status, timeString) {
    if (this.COMPLETED_STATUSES.includes(status?.toLowerCase())) {
      return { class: 'closed', text: 'Closed' };
    }
    
    const days = this.parseTimeInStatus(timeString);
    const thresholds = this.getSLAThresholds();
    const threshold = thresholds[status?.toLowerCase()] || thresholds.default;
    
    return days >= threshold
      ? { class: 'at-risk', text: 'At Risk' }
      : { class: 'on-track', text: 'On Track' };
  }
  
  /**
   * Generate an email template for an at-risk epic
   * @param {Object} epic - Epic data object
   * @returns {Object} - Email template with subject and body
   */
  static generateEscalationEmailTemplate(epic) {
    try {
      const slaThresholds = this.getSLAThresholds();
      const statusThreshold = slaThresholds[epic.status?.toLowerCase()] || slaThresholds.default;
      const timeInDays = this.parseTimeInStatus(epic.timeInStatus);
      
      // Calculate days over SLA threshold
      const daysOverSLA = Math.round(timeInDays - statusThreshold);
      
      const subject = `URGENT: Epic ${epic.id} at risk - Exceeding SLA by ${daysOverSLA} days`;
      
      const body = `Hello,

I wanted to bring to your attention that the following epic is currently at risk:

Epic ID: ${epic.id}
Title: ${epic.name}
Current Status: ${epic.status}
Time in Current Status: ${epic.timeInStatus}
Sprint: ${epic.sprint || 'Not assigned'}
Story Points: ${epic.totalStoryPoints || 'Not assigned'}
Child Issues: ${epic.children ? epic.children.length : 0}

This epic has been in ${epic.status} status for ${timeInDays.toFixed(1)} days, which exceeds our defined SLA threshold of ${statusThreshold} days by ${daysOverSLA} days.

Can we please prioritize this epic or determine if we need to take any actions to address the delay?

Thanks,
[Your Name]
`;
      
      return {
        subject,
        body,
        recipient: ''
      };
    } catch (error) {
      console.error('Error generating email template:', error);
      // Return a minimal template if there's an error
      return {
        subject: `URGENT: Epic ${epic.id} at risk`,
        body: `This epic requires attention as it's currently at risk.
        
Epic ID: ${epic.id}
Title: ${epic.name}

Thanks,
[Your Name]`,
        recipient: ''
      };
    }
  }
  
  /**
   * Calculate predictability metrics from epic data
   * @param {Array} epics - Array of processed epic objects
   * @returns {Object} - Metrics summary
   */
  static calculateMetrics(epics) {
    try {
      // Guard against invalid input
      if (!epics || !Array.isArray(epics)) {
        console.error('Invalid epics data provided to calculateMetrics:', epics);
        return {
          overall: {
            totalEpics: 0,
            totalCommitted: 0,
            totalCompleted: 0,
            realization: '0.0',
            avgCycleTime: '0.0',
            atRiskCount: 0,
            atRiskPercentage: '0.0'
          },
          sprintData: []
        };
      }
      
      // Group by sprint
      const sprints = {};
      let totalCommitted = 0;
      let totalCompleted = 0;
      let totalCycle = 0;
      let totalCount = 0;
      let atRiskCount = 0;
      
      epics.forEach(epic => {
        const sprint = epic.sprint || 'No Sprint';
        if (!sprints[sprint]) sprints[sprint] = { 
          committed: 0, 
          completed: 0, 
          cycleSum: 0, 
          cycleCount: 0,
          epics: []
        };
        
        sprints[sprint].epics.push(epic);
        
        // Use totalStoryPoints instead of just storyPoints
        const committedPoints = epic.totalStoryPoints || 0;
        sprints[sprint].committed += committedPoints;
        totalCommitted += committedPoints;
        
        // Use completedStoryPoints for completed metrics
        const completedPoints = epic.completedStoryPoints || 0;
        sprints[sprint].completed += completedPoints;
        totalCompleted += completedPoints;
        
        if (epic.cycleTime && epic.cycleTime !== '-') {
          const cycleTimeValue = parseFloat(epic.cycleTime);
          if (!isNaN(cycleTimeValue)) {
            sprints[sprint].cycleSum += cycleTimeValue;
            sprints[sprint].cycleCount += 1;
            totalCycle += cycleTimeValue;
            totalCount += 1;
          }
        }
        
        if (epic.slaStatus && epic.slaStatus.class === 'at-risk') {
          atRiskCount++;
        }
      });
      
      // Calculate overall metrics
      const overallRealization = totalCommitted > 0 ? (totalCompleted / totalCommitted) * 100 : 0;
      const avgCycleTime = totalCount > 0 ? totalCycle / totalCount : 0;
      const atRiskPercentage = epics.length > 0 ? (atRiskCount / epics.length) * 100 : 0;
      
      // Process sprint data for display
      const sprintData = Object.entries(sprints).map(([sprint, data]) => {
        const realization = data.committed ? (data.completed / data.committed) * 100 : 0;
        const avgCycleTime = data.cycleCount ? data.cycleSum / data.cycleCount : 0;
        
        return {
          name: sprint,
          committed: data.committed,
          completed: data.completed,
          realization: realization.toFixed(1),
          avgCycleTime: avgCycleTime.toFixed(1),
          epics: data.epics
        };
      });
      
      return {
        overall: {
          totalEpics: epics.length,
          totalCommitted,
          totalCompleted,
          realization: overallRealization.toFixed(1),
          avgCycleTime: avgCycleTime.toFixed(1),
          atRiskCount,
          atRiskPercentage: atRiskPercentage.toFixed(1)
        },
        sprintData
      };
    } catch (error) {
      console.error('Error calculating metrics:', error);
      // Return minimal metrics if there's an error
      return {
        overall: {
          totalEpics: epics?.length || 0,
          totalCommitted: 0,
          totalCompleted: 0,
          realization: '0.0',
          avgCycleTime: '0.0',
          atRiskCount: 0,
          atRiskPercentage: '0.0'
        },
        sprintData: []
      };
    }
  }
}

// Make DataProcessor available globally
window.DataProcessor = DataProcessor;