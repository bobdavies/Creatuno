const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Ensure .log directory exists
const logDir = path.join(__dirname, '..', '.log');
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

// Get timestamp for filename (YYYYMMDD_HHMMSS format)
const now = new Date();
const year = now.getFullYear();
const month = String(now.getMonth() + 1).padStart(2, '0');
const day = String(now.getDate()).padStart(2, '0');
const hours = String(now.getHours()).padStart(2, '0');
const minutes = String(now.getMinutes()).padStart(2, '0');
const seconds = String(now.getSeconds()).padStart(2, '0');
const timestamp = `${year}${month}${day}_${hours}${minutes}${seconds}`;

// Determine log filename
const useTimestamp = process.argv.includes('--timestamped');
const logFile = useTimestamp 
  ? path.join(logDir, `build_${timestamp}.log`)
  : path.join(logDir, 'build.log');

console.log(`Building and logging to: ${logFile}`);

try {
  // Run next build and capture all output
  const output = execSync('next build', {
    stdio: 'pipe',
    cwd: path.join(__dirname, '..'),
    encoding: 'utf8'
  });
  
  // Write output to log file
  fs.writeFileSync(logFile, output);
  
  // Also display output to console
  console.log(output);
  console.log(`\nBuild completed. Log saved to: ${logFile}`);
} catch (error) {
  // Capture error output
  const errorOutput = error.stdout ? error.stdout.toString() : '';
  const errorStderr = error.stderr ? error.stderr.toString() : '';
  const fullOutput = errorOutput + errorStderr;
  
  // Write error to log file
  fs.writeFileSync(logFile, fullOutput);
  
  // Display error to console
  if (errorOutput) console.log(errorOutput);
  if (errorStderr) console.error(errorStderr);
  console.error(`\nBuild failed. Error log saved to: ${logFile}`);
  process.exit(error.status || 1);
}
